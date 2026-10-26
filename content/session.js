// content/session.js - 拾取篮会话：顶层 Frame 持有唯一真实状态，其余 Frame 只接收只读副本
// 状态：{ active, paused, items: [{ id, frameId, frameKey, data, note }], question, preset }
// 退出拾取即清空拾取篮，最近一次非空拾取篮归档为「上次选择」(storage.session)，下次开启可一键恢复
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const { bus, isTop, log } = PP.runtime;
  const MAX_ITEMS = 30;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function documentKey(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    } catch (e) {
      return '';
    }
  }

  class Session {
    constructor() {
      this.state = { active: false, paused: false, items: [], question: '', preset: 'none', rev: 0 };
      this.last = null; // 上次选择快照 { items, question, preset }
      this.listeners = new Set();
      this.persistTimer = null;
      this.broadcastTimer = null;
      this.locateTimer = null;
      this.locatingId = null;

      bus.on('state', payload => this.apply(payload));
      bus.on('ping', () => {});
      if (isTop) {
        bus.on('cmd', (payload, from) => this.handleCommand(payload, from));
        bus.on('toast', ({ msg, tone }) => PP.overlay.toast(msg, tone));
        this.loadLast();
      } else {
        // 新建 / 重建的 iframe 主动登记，顶层据此回传当前状态并认领旧 Frame 的元素
        const hello = () => bus.send('top', 'cmd', { name: 'hello', frameKey: PP.dom.frameKey() });
        bus.ready.then(hello);
        bus.on('rehello', hello);
      }
    }

    subscribe(fn) {
      this.listeners.add(PP.runtime.guard(fn, 'session.listener'));
    }

    apply(next) {
      this.state = next;
      this.listeners.forEach(fn => fn(next));
    }

    get count() {
      return this.state.items.length;
    }

    // 可恢复的上次选择数量（当前拾取篮非空时不提供恢复）
    get restorableCount() {
      return !this.count && this.last ? this.last.items.length : 0;
    }

    // ---------- 以下仅顶层调用 ----------
    commit(mutate, { persist = true, quiet = false } = {}) {
      const next = { ...this.state, items: this.state.items.slice() };
      mutate(next);
      next.rev = (this.state.rev || 0) + 1;
      if (quiet) {
        // 备注 / 问题输入：不触发重新渲染，延迟广播给子 Frame（Enter 复制时需要最新文本）
        this.state = next;
        clearTimeout(this.broadcastTimer);
        this.broadcastTimer = setTimeout(() => bus.send('all', 'state', this.state, { excludeSelf: true }), 300);
      } else {
        this.apply(next);
        bus.send('all', 'state', next, { excludeSelf: true });
      }
      if (persist) this.persist();
    }

    // 非空拾取篮实时归档为「上次选择」：退出、刷新或关闭弹窗后都能恢复；清空到 0 时保留之前的快照
    persist() {
      clearTimeout(this.persistTimer);
      this.persistTimer = setTimeout(() => this.saveLast(), 300);
    }

    saveLast() {
      clearTimeout(this.persistTimer);
      const { items, question, preset } = this.state;
      if (!items.length) return;
      this.last = { items, question, preset };
      chrome.runtime.sendMessage({ action: 'PP_SAVE_SESSION', session: this.last })
        .catch(e => log.warn('session.saveLast', e));
    }

    async loadLast() {
      try {
        const res = await chrome.runtime.sendMessage({ action: 'PP_LOAD_SESSION' });
        const saved = res && res.session;
        if (saved && Array.isArray(saved.items) && saved.items.length) {
          this.last = saved;
          this.apply(this.state); // 通知面板刷新「恢复上次选择」入口
        }
      } catch (e) {
        log.warn('session.loadLast', e);
      }
    }

    // 用户主动恢复上次选择（仅在当前拾取篮为空时可用）
    restoreLast() {
      if (!this.last || this.count) return;
      const { items, question, preset } = this.last;
      this.commit(next => {
        next.items = items.slice();
        next.question = question || '';
        next.preset = preset || 'none';
      }, { persist: false });
      // 请所有 Frame 重新登记，让重建 / 刷新后的 iframe 认领各自的元素
      bus.send('all', 'rehello', {}, { excludeSelf: true });
      if (PP.panel) PP.panel.open();
      PP.overlay.toast(`已恢复上次选择的 ${items.length} 个元素`);
      log.info('session.restoreLast', { items: items.length });
    }

    start() {
      if (this.state.active) return;
      PP.overlay.hideToast(); // 收起上一轮遗留的「已退出」提示
      this.commit(next => { next.active = true; next.paused = false; }, { persist: false });
      chrome.runtime.sendMessage({ action: 'PICKER_STATUS_CHANGED', active: true }).catch(() => {});
      log.info('session.start', { bootMs: PP.runtime.initMs(), items: this.count });
    }

    // 退出整个拾取工具：归档后清空拾取篮，下次开启从空篮子开始
    stop() {
      if (!this.state.active) return;
      const archived = this.count;
      this.saveLast();
      this.commit(next => {
        next.active = false;
        next.paused = false;
        next.items = [];
        next.question = '';
      }, { persist: false });
      if (PP.panel) PP.panel.close();
      if (archived) PP.overlay.toast(`已退出拾取，${archived} 个元素已存为「上次选择」，下次开启可恢复`, 'info');
      chrome.runtime.sendMessage({ action: 'PICKER_STATUS_CHANGED', active: false }).catch(() => {});
    }

    toggle() {
      if (this.state.active) this.stop();
      else this.start();
      return this.state.active;
    }

    setPaused(paused) {
      if (!this.state.active) return;
      this.commit(next => { next.paused = paused; }, { persist: false });
    }

    // Esc 分级：拾取篮展开 → 折叠为右侧窄条（继续拾取）；已折叠 → 退出整个拾取工具
    escape() {
      if (PP.panel && PP.panel.isOpen) {
        PP.panel.close();
      } else if (this.state.active) {
        this.stop();
      }
    }

    add(item, from) {
      if (this.state.items.some(existing => existing.id === item.id)) return;
      if (this.count >= MAX_ITEMS) {
        PP.overlay.toast(`拾取篮最多 ${MAX_ITEMS} 个元素，请先移除不需要的项`, 'warn');
        bus.send(from, 'state', this.state);
        return;
      }
      const data = item.data;
      data.context = data.context || {};
      data.context.topUrl = PP.dom.sanitizeUrl(window.location.href);
      data.context.topPath = PP.dom.currentPath();
      this.commit(next => {
        next.items.push({ id: item.id, frameId: from, frameKey: item.frameKey, data, note: '' });
      });
      if (this.count === 1 && PP.panel) PP.panel.open();
    }

    remove(id) {
      this.saveLast(); // 移除最后一个元素前先归档，避免防抖期间丢失
      this.commit(next => { next.items = next.items.filter(item => item.id !== id); });
    }

    move(id, delta) {
      const idx = this.state.items.findIndex(item => item.id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= this.count) return;
      this.commit(next => {
        const [item] = next.items.splice(idx, 1);
        next.items.splice(target, 0, item);
      });
    }

    clear() {
      this.saveLast();
      this.commit(next => { next.items = []; });
    }

    setNote(id, note) {
      this.commit(next => {
        next.items = next.items.map(item => (item.id === id ? { ...item, note } : item));
      }, { quiet: true });
    }

    setQuestion(question) {
      this.commit(next => { next.question = question; }, { quiet: true });
    }

    setPreset(preset) {
      this.commit(next => { next.preset = preset; });
    }

    // 重建后的 iframe 登记：同一文档（frameKey 相同）的旧 Frame 已销毁时，把元素交给新 Frame 重连
    async onHello(from, frameKey) {
      const staleIds = Array.from(new Set(this.state.items
        .filter(item => item.frameKey === frameKey && item.frameId !== from)
        .map(item => item.frameId)));
      const dead = [];
      for (const frameId of staleIds) {
        if (!(await bus.send(frameId, 'ping'))) dead.push(frameId);
      }
      if (dead.length) {
        this.commit(next => {
          next.items = next.items.map(item =>
            (item.frameKey === frameKey && dead.includes(item.frameId) ? { ...item, frameId: from } : item));
        });
        log.info('session.reclaim', { frameKey, frames: dead.length });
      }
      bus.send(from, 'state', this.state);
    }

    async locate(id) {
      const item = this.state.items.find(entry => entry.id === id);
      if (!item) return;
      clearTimeout(this.locateTimer);
      this.locatingId = id;
      const ctx = item.data.context || {};

      if (item.frameId !== 0 && ctx.topPath && PP.relink.isRouteDifferent(ctx.topPath)) {
        // 只恢复同一外层文档的 SPA 路由，绝不把子系统的 hash 写入外层
        if (documentKey(ctx.topUrl) !== documentKey(window.location.href)) {
          PP.overlay.toast('该元素所在的外层页面已变化，请先打开原页面', 'warn');
          return;
        }
        PP.relink.navigateToRoute(ctx.topPath);
        await sleep(500);
      }

      const delivered = await bus.send(item.frameId, 'locate', { id });
      if (!delivered) {
        // 原 Frame 已销毁：广播给同一文档的 Frame 认领
        await bus.send('all', 'locate', { id, claimKey: item.frameKey });
      }
      this.locateTimer = setTimeout(() => {
        if (this.locatingId !== id) return;
        this.locatingId = null;
        PP.overlay.toast('没有找到该元素：目标页面或 iframe 尚未打开，或元素已被删除', 'warn');
        log.info('session.locateTimeout', { tag: item.data.tag, frame: item.frameKey === 'top' ? 'top' : 'iframe' });
      }, 7000);
    }

    onLocateResult(from, { id, found }) {
      if (this.locatingId !== id) return;
      this.locatingId = null;
      clearTimeout(this.locateTimer);
      if (!found) {
        PP.overlay.toast('已打开目标页面，但没有找到该元素，可能已被删除或尚未渲染', 'warn');
        return;
      }
      const item = this.state.items.find(entry => entry.id === id);
      if (item && item.frameId !== from) {
        this.commit(next => {
          next.items = next.items.map(entry => (entry.id === id ? { ...entry, frameId: from } : entry));
        });
      }
    }

    handleCommand(payload, from) {
      switch (payload.name) {
        case 'add': return this.add(payload.item, from);
        case 'remove': return this.remove(payload.id);
        case 'pause': return this.setPaused(!this.state.paused);
        case 'escape': return this.escape();
        case 'restoreLast': return this.restoreLast();
        case 'hello': return this.onHello(from, payload.frameKey);
        case 'locateResult': return this.onLocateResult(from, payload);
        default: log.warn('session.unknownCommand', payload.name);
      }
    }
  }

  PP.session = new Session();
})();
