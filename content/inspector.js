// content/inspector.js - 每个 Frame 的拾取引擎：悬停高亮、点击加入/移除拾取篮、层级穿透、快捷键、常驻选中框
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const { bus, isTop, guard, log } = PP.runtime;
  const dom = PP.dom;
  const overlay = PP.overlay;
  const session = PP.session;
  const RELINK_INTERVAL = 400;
  const BLOCKED_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu'];

  class Inspector {
    constructor() {
      this.attached = false;
      this.hoverTarget = null;     // 最近一次 mousemove 的原始目标
      this.current = null;         // 当前高亮元素（可能经 Tab / 方向键钻取）
      this.drilled = false;        // 用户是否显式钻取过层级
      this.ownsHover = false;      // 本 Frame 是否持有悬停高亮权
      this.layerStack = [];
      this.layerIndex = 0;
      this.lastPoint = null;
      this.originalCursor = '';
      this.localEls = new Map();   // itemId -> Element（仅本 Frame 的元素）
      this.lastRelinkTry = new Map();
      this.rafId = null;
      this.observer = null;

      this.onMove = guard(this.handleMove.bind(this), 'inspector.move');
      this.onClick = guard(this.handleClick.bind(this), 'inspector.click');
      this.onBlock = guard(this.handleBlock.bind(this), 'inspector.block');
      this.onKey = guard(this.handleKey.bind(this), 'inspector.key');
      this.onKeyUp = guard(this.handleKeyUp.bind(this), 'inspector.keyup');
      this.onLeave = guard(() => this.clearHover(), 'inspector.leave');
      this.onRefresh = () => this.scheduleRefresh();

      session.subscribe(state => this.sync(state));
      bus.on('locate', payload => this.locate(payload));
    }

    // ---------- 状态同步 ----------
    sync(state) {
      const shouldAttach = state.active;
      if (shouldAttach && !this.attached) this.attach();
      if (!shouldAttach && this.attached) this.detach();

      if (this.attached) {
        document.documentElement.style.cursor = state.paused ? this.originalCursor : 'crosshair';
        if (state.paused) this.clearHover();
      }

      const liveIds = new Set(state.items.map(item => item.id));
      Array.from(this.localEls.keys()).forEach(id => {
        if (!liveIds.has(id)) this.localEls.delete(id);
      });
      this.scheduleRefresh();
    }

    attach() {
      this.attached = true;
      this.originalCursor = document.documentElement.style.cursor;
      const opts = { capture: true, passive: false };
      window.addEventListener('mousemove', this.onMove, { capture: true, passive: true });
      window.addEventListener('click', this.onClick, opts);
      BLOCKED_EVENTS.forEach(type => window.addEventListener(type, this.onBlock, opts));
      window.addEventListener('keydown', this.onKey, opts);
      window.addEventListener('keyup', this.onKeyUp, { capture: true, passive: true });
      document.addEventListener('mouseleave', this.onLeave, { capture: true });
      window.addEventListener('scroll', this.onRefresh, { capture: true, passive: true });
      window.addEventListener('resize', this.onRefresh, { passive: true });
      // 弹窗出现/关闭多为 CSS 动画，MutationObserver 捕获不到位移，需要监听动画结束
      ['transitionend', 'animationend'].forEach(type => window.addEventListener(type, this.onRefresh, { capture: true, passive: true }));
      this.observer = new MutationObserver(this.onRefresh);
      this.observer.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'open', 'aria-hidden']
      });
    }

    detach() {
      this.attached = false;
      window.removeEventListener('mousemove', this.onMove, { capture: true });
      window.removeEventListener('click', this.onClick, { capture: true });
      BLOCKED_EVENTS.forEach(type => window.removeEventListener(type, this.onBlock, { capture: true }));
      window.removeEventListener('keydown', this.onKey, { capture: true });
      window.removeEventListener('keyup', this.onKeyUp, { capture: true });
      document.removeEventListener('mouseleave', this.onLeave, { capture: true });
      window.removeEventListener('scroll', this.onRefresh, { capture: true });
      window.removeEventListener('resize', this.onRefresh);
      ['transitionend', 'animationend'].forEach(type => window.removeEventListener(type, this.onRefresh, { capture: true }));
      if (this.observer) this.observer.disconnect();
      this.observer = null;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      document.documentElement.style.cursor = this.originalCursor;
      this.hoverTarget = null;
      this.current = null;
      overlay.clear();
    }

    // ---------- 常驻选中框 ----------
    scheduleRefresh() {
      if (this.rafId) return;
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.refreshPins();
        if (this.current && !this.current.isConnected) this.clearHover();
      });
    }

    resolveElement(item) {
      const data = item.data;
      if (data.context && PP.relink.isRouteDifferent(data.context.path)) return null;
      let el = this.localEls.get(item.id);
      if (el && el.isConnected && PP.relink.isValidCandidate(el, data)) return el;
      // 节点已被 SPA 重建：限频重连，避免 DOM 高频变化时反复全量查询
      const now = Date.now();
      if (now - (this.lastRelinkTry.get(item.id) || 0) < RELINK_INTERVAL) return null;
      this.lastRelinkTry.set(item.id, now);
      el = PP.relink.findLivingElement(data);
      if (el) this.localEls.set(item.id, el);
      else this.localEls.delete(item.id);
      return el;
    }

    refreshPins() {
      if (!this.attached) {
        overlay.drawPins([]);
        return;
      }
      const items = session.state.items;
      const entries = [];
      items.forEach((item, idx) => {
        if (item.frameId !== bus.selfId) return;
        const el = this.resolveElement(item);
        if (!el) return;
        const state = dom.occlusionState(el);
        if (state === 'hidden' || state === 'offscreen') return;
        entries.push({ id: item.id, idx, rect: el.getBoundingClientRect(), occluded: state === 'occluded' });
      });
      overlay.drawPins(entries);
    }

    findItemIdByElement(el) {
      for (const [id, node] of this.localEls) {
        if (node === el) return id;
      }
      return null;
    }

    // ---------- 悬停 ----------
    isIgnoredTarget(target) {
      return !target || target.nodeType !== Node.ELEMENT_NODE || dom.isPluginNode(target) ||
        target === document.documentElement || target === document.body ||
        target.tagName === 'IFRAME' || target.tagName === 'FRAME';
    }

    clearHover() {
      overlay.hideHover();
      this.hoverTarget = null;
      this.current = null;
      this.drilled = false;
    }

    handleMove(event) {
      if (session.state.paused) return;
      this.lastPoint = { x: event.clientX, y: event.clientY };
      // 按住 Alt：临时放行，显示正常指针以便直接操作页面
      if (event.altKey) {
        this.clearHover();
        document.documentElement.style.cursor = this.originalCursor;
        return;
      }
      const target = event.target;
      if (this.isIgnoredTarget(target)) {
        // 空白区域与 iframe 矩形不高亮，iframe 交给其内部的拾取引擎
        if (target && !dom.isPluginNode(target)) this.clearHover();
        return;
      }
      if (target === this.hoverTarget && this.current && this.current.isConnected) return;
      this.hoverTarget = target;
      this.drilled = false;
      this.layerStack = document.elementsFromPoint(event.clientX, event.clientY)
        .filter(el => !this.isIgnoredTarget(el));
      if (!this.layerStack.length) this.layerStack = [target];
      this.layerIndex = Math.max(0, this.layerStack.indexOf(target));
      this.highlight(this.layerStack[this.layerIndex]);
    }

    highlight(el) {
      if (!el) return;
      this.current = el;
      document.documentElement.style.cursor = 'crosshair';
      // 跨 Frame 互斥：只保留当前 Frame 的悬停框（仅在悬停权转移时广播一次）
      if (!this.ownsHover) {
        this.ownsHover = true;
        bus.send('all', 'hoverOwner', {}, { excludeSelf: true });
      }
      const cls = dom.stableClasses(el.classList)[0];
      overlay.showHover(el, {
        classHint: cls ? `.${cls}` : '',
        selected: Boolean(this.findItemIdByElement(el)),
        layerIndex: this.layerIndex,
        layerTotal: this.layerStack.length
      });
    }

    handleKeyUp(event) {
      if (event.key !== 'Alt' || session.state.paused || !this.lastPoint) return;
      document.documentElement.style.cursor = 'crosshair';
      const el = document.elementFromPoint(this.lastPoint.x, this.lastPoint.y);
      if (!this.isIgnoredTarget(el)) {
        this.hoverTarget = el;
        this.layerStack = [el];
        this.layerIndex = 0;
        this.highlight(el);
      }
    }

    // ---------- 点击 ----------
    shouldIntercept(event) {
      if (session.state.paused || event.altKey) return false;
      return !this.isIgnoredTarget(event.target);
    }

    handleBlock(event) {
      if (!this.shouldIntercept(event)) return;
      // 阻断 mousedown/pointerdown 类监听，防止下拉框、拖拽等在按下阶段就触发业务逻辑
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.type !== 'pointerdown' && event.type !== 'touchstart') event.preventDefault();
      // Chrome 不向原生禁用控件派发 click，在 pointerdown 阶段完成拾取
      if (event.type === 'pointerdown' && event.button === 0 && event.isPrimary !== false &&
          event.target.closest && event.target.closest(':disabled')) {
        this.pick(event);
      }
    }

    handleClick(event) {
      if (!this.shouldIntercept(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.target.closest && event.target.closest(':disabled')) return; // 已在 pointerdown 处理
      this.pick(event);
    }

    // 以点击事件的真实目标为准；只有用户显式钻取且钻取元素仍覆盖点击位置时才沿用钻取结果。
    // 修复：弹窗在光标不动时出现，旧逻辑会选中弹窗背后的元素。
    resolvePickTarget(event) {
      if (this.drilled && this.current && this.current.isConnected) {
        const rect = this.current.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
          return this.current;
        }
      }
      return event.target;
    }

    pick(event) {
      const el = this.resolvePickTarget(event);
      if (!el || this.isIgnoredTarget(el)) return;

      const quickCopy = event.metaKey || event.ctrlKey;
      const existingId = this.findItemIdByElement(el);
      if (existingId && !quickCopy) {
        this.localEls.delete(existingId);
        bus.send('top', 'cmd', { name: 'remove', id: existingId });
        overlay.toast('已从拾取篮移除', 'info');
        this.highlight(el);
        return;
      }

      const data = PP.extractElementInfo(el);
      if (!data) {
        log.warn('inspector.extractEmpty', el.tagName);
        return;
      }
      if (quickCopy) {
        // Cmd/Ctrl + 点击：不进入拾取篮，直接复制该元素的 Prompt
        overlay.copy(PP.prompt.buildPrompt([{ data, note: '' }], { preset: session.state.preset }), '已复制该元素的 AI Prompt');
        return;
      }
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      this.localEls.set(id, el);
      bus.send('top', 'cmd', { name: 'add', item: { id, frameKey: dom.frameKey(), data } });
      overlay.toast(`已加入拾取篮 <${data.tag}>${data.sensitive ? '（敏感值已脱敏）' : ''}`);
      this.highlight(el);
    }

    // ---------- 键盘 ----------
    isTypingTarget(event) {
      if (event.isComposing || event.keyCode === 229 || event.key === 'Process') return true;
      const target = event.target;
      if (!target || target.nodeType !== Node.ELEMENT_NODE) return false;
      if (dom.isPluginNode(target)) return true; // 拾取篮面板内的输入
      return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    }

    swallow(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    handleKey(event) {
      if (event.key === 'Escape') {
        if (event.isComposing || event.keyCode === 229) return;
        this.swallow(event);
        if (!event.repeat) bus.send('top', 'cmd', { name: 'escape' });
        return;
      }
      if (this.isTypingTarget(event)) return;

      if (event.key === ' ' || event.code === 'Space') {
        this.swallow(event);
        if (!event.repeat) bus.send('top', 'cmd', { name: 'pause' });
        return;
      }
      if (session.state.paused) return;

      if (event.key === 'Enter') {
        this.swallow(event);
        if (session.count === 0) {
          overlay.toast('拾取篮为空，请先点击页面元素', 'warn');
          return;
        }
        const { items, question, preset } = session.state;
        overlay.copy(PP.prompt.buildPrompt(items, { question, preset }), `已复制 ${items.length} 个元素的 AI Prompt`);
        return;
      }

      const step = {
        Tab: event.shiftKey ? -1 : 1, ']': 1, '[': -1
      }[event.key];
      if (step !== undefined) {
        this.swallow(event);
        if (this.layerStack.length > 1) {
          this.layerIndex = (this.layerIndex + step + this.layerStack.length) % this.layerStack.length;
          this.drilled = true;
          this.highlight(this.layerStack[this.layerIndex]);
        }
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        this.swallow(event);
        if (!this.current) return;
        const next = event.key === 'ArrowUp' ? this.current.parentElement : this.current.firstElementChild;
        if (next && !this.isIgnoredTarget(next)) {
          this.drilled = true;
          this.highlight(next);
        }
      }
    }

    // ---------- 定位 ----------
    async locate({ id, claimKey }) {
      if (claimKey && claimKey !== dom.frameKey()) return;
      const item = session.state.items.find(entry => entry.id === id);
      if (!item) return;
      if (!claimKey && item.frameId !== bus.selfId) return;
      const data = item.data;
      const routeChanged = data.context && PP.relink.isRouteDifferent(data.context.path);
      if (routeChanged) PP.relink.navigateToRoute(data.context.path);

      let previous = null;
      for (let attempt = 0; attempt < 24; attempt++) {
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? (routeChanged ? 300 : 0) : 220));
        if (data.context && PP.relink.isRouteDifferent(data.context.path)) continue;
        let el = this.localEls.get(id);
        if (!el || !el.isConnected || !PP.relink.isValidCandidate(el, data)) {
          el = PP.relink.findLivingElement(data, true);
        }
        if (!el) continue;
        // 路由切换后 DOM 仍在渲染，连续两次命中同一节点才认为稳定
        if (routeChanged && el !== previous) {
          previous = el;
          continue;
        }
        this.localEls.set(id, el);
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        setTimeout(() => {
          this.refreshPins();
          overlay.pulse(id);
        }, 350);
        const idx = session.state.items.findIndex(entry => entry.id === id);
        const occluded = dom.occlusionState(el) === 'occluded';
        overlay.toast(occluded ? `已定位第 ${idx + 1} 个元素，但它被弹窗或浮层遮挡（虚线框）` : `已定位第 ${idx + 1} 个元素`, occluded ? 'warn' : 'ok');
        bus.send('top', 'cmd', { name: 'locateResult', id, found: true });
        return;
      }
      // 认领广播未找到时保持沉默，交给其他同文档 Frame 或顶层超时提示
      if (!claimKey) bus.send('top', 'cmd', { name: 'locateResult', id, found: false });
    }

    destroy() {
      if (this.attached) this.detach();
    }
  }

  PP.inspector = new Inspector();
  bus.on('hoverOwner', () => {
    PP.overlay.hideHover();
    PP.inspector.hoverTarget = null;
    PP.inspector.current = null;
    PP.inspector.ownsHover = false;
  });
  if (!isTop) log.debug('inspector.ready', { frame: dom.frameKey() });
})();
