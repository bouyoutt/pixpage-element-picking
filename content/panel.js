// content/panel.js - 顶层 Frame 专属：底部工具栏 + 拾取篮侧边面板（渲染 session 状态，所有写操作回到 session）
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip || !PP.runtime.isTop) return;

  const { guard } = PP.runtime;
  const session = PP.session;
  const overlay = PP.overlay;
  const icon = PP.icon;

  function escapeHTML(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  function shortText(text, max) {
    const clean = String(text || '').trim().replace(/\s+/g, ' ');
    return clean.length > max ? clean.substring(0, max - 1) + '…' : clean;
  }

  class Panel {
    constructor() {
      this.toolbar = null;
      this.panel = null;
      this.rail = null;
      this.isOpen = false; // true = 展开；拾取中且 false 时显示右侧折叠窄条
      this.renderedIds = [];
      session.subscribe(guard(state => this.render(state), 'panel.render'));
    }

    mount() {
      if (this.toolbar) return;
      const root = overlay.ensure();
      this.toolbar = document.createElement('div');
      this.toolbar.className = 'pp-toolbar';
      this.toolbar.setAttribute('role', 'toolbar');
      this.toolbar.setAttribute('aria-label', 'PixPage 元素拾取');
      this.toolbar.innerHTML = `
        <span class="pp-grip" title="拖动工具栏">${icon('grip', 16)}</span>
        <div class="pp-status">
          <span class="pp-dot"></span>
          <span class="pp-brand">PixPage</span>
          <span class="pp-count" data-ref="count">0</span>
        </div>
        <span class="pp-sep"></span>
        <span class="pp-hints" data-ref="hints"></span>
        <span class="pp-sep"></span>
        <button class="pp-btn pp-btn-sm" data-act="pause" title="暂停拾取，正常操作页面（Space）"></button>
        <button class="pp-btn pp-btn-sm pp-btn-ghost" data-act="restore" hidden title="恢复上次退出时的拾取篮"></button>
        <button class="pp-btn pp-btn-sm pp-btn-ghost" data-act="panel" title="展开或折叠拾取篮">${icon('panel', 16)}<span>拾取篮</span></button>
        <button class="pp-btn pp-btn-sm pp-btn-primary" data-act="copy" title="复制 AI Prompt（Enter）">${icon('copy', 16)}<span>复制</span></button>
        <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-ghost" data-act="exit" aria-label="退出拾取" title="退出拾取（拾取篮收起后按 Esc）">${icon('x', 16)}</button>
      `;
      this.toolbar.addEventListener('click', guard(event => this.onToolbarClick(event), 'panel.toolbarClick'));
      this.makeDraggable(this.toolbar, this.toolbar.querySelector('.pp-grip'));

      this.panel = document.createElement('section');
      this.panel.className = 'pp-panel';
      this.panel.setAttribute('aria-label', '拾取篮');
      this.panel.innerHTML = `
        <header class="pp-panel-head">
          <h2 class="pp-panel-title">拾取篮<span data-ref="title-count"></span></h2>
          <button class="pp-btn pp-btn-sm pp-btn-ghost pp-btn-danger" data-act="clear" title="清空拾取篮">${icon('trash', 16)}<span>清空</span></button>
          <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-ghost" data-act="close" aria-label="折叠拾取篮" title="折叠拾取篮（Esc），继续拾取">${icon('chevronRight', 16)}</button>
        </header>
        <div class="pp-list" data-ref="list"></div>
        <footer class="pp-panel-foot">
          <div class="pp-presets" role="radiogroup" aria-label="任务模板" data-ref="presets"></div>
          <label class="pp-label" for="pp-question">你的问题（会写入 Prompt 的「任务」段）</label>
          <textarea class="pp-question" id="pp-question" data-ref="question" rows="3" placeholder="例如：点击 [1] 后为什么 [2] 没有出现？"></textarea>
          <div class="pp-actions">
            <button class="pp-btn pp-btn-primary" data-act="copy">${icon('copy', 16)}<span>复制 AI Prompt</span></button>
            <button class="pp-btn" data-act="json" title="复制结构化 JSON">${icon('braces', 16)}<span>JSON</span></button>
          </div>
        </footer>
      `;
      this.panel.addEventListener('click', guard(event => this.onPanelClick(event), 'panel.click'));
      this.panel.addEventListener('input', guard(event => this.onPanelInput(event), 'panel.input'));
      // 面板内的按键不能冒泡到页面（避免触发宿主快捷键），Esc 除外交给拾取引擎分级处理
      this.panel.addEventListener('keydown', event => {
        if (event.key !== 'Escape') event.stopPropagation();
      });

      const presets = this.panel.querySelector('[data-ref="presets"]');
      Object.entries(PP.prompt.PRESETS).forEach(([key, preset]) => {
        const chip = document.createElement('button');
        chip.className = 'pp-chip';
        chip.dataset.preset = key;
        chip.setAttribute('role', 'radio');
        chip.textContent = preset.label;
        presets.appendChild(chip);
      });

      this.rail = document.createElement('aside');
      this.rail.className = 'pp-rail';
      this.rail.setAttribute('aria-label', '拾取篮（已折叠）');
      this.rail.innerHTML = `
        <span class="pp-rail-grip" title="拖动折叠栏">${icon('grip', 14)}</span>
        <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-ghost" data-act="expand" aria-label="展开拾取篮" title="展开拾取篮">${icon('chevronLeft', 16)}</button>
        <span class="pp-count" data-ref="rail-count">0</span>
        <span class="pp-rail-label" aria-hidden="true">拾取篮</span>
        <div class="pp-rail-list" data-ref="rail-list"></div>
        <span class="pp-rail-more" data-ref="rail-more" hidden></span>
        <span class="pp-rail-sep"></span>
        <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-primary" data-act="copy" aria-label="复制 AI Prompt" title="复制 AI Prompt（Enter）">${icon('copy', 16)}</button>
      `;
      this.rail.addEventListener('click', guard(event => this.onRailClick(event), 'panel.railClick'));
      this.rail.querySelector('[data-ref="rail-list"]').addEventListener('scroll', guard(() => this.updateRailMore(), 'panel.railScroll'));
      this.makeDraggable(this.rail, this.rail.querySelector('.pp-rail-grip'));

      root.append(this.panel, this.rail, this.toolbar);
    }

    open() {
      this.mount();
      this.isOpen = true;
      this.render(session.state);
    }

    close() {
      this.isOpen = false;
      this.render(session.state);
    }

    // ---------- 渲染 ----------
    render(state) {
      if (!state.active && !this.isOpen && !this.toolbar) return;
      this.mount();
      const count = state.items.length;

      this.toolbar.classList.toggle('is-visible', state.active);
      this.toolbar.classList.toggle('is-paused', state.paused);
      const countEl = this.toolbar.querySelector('[data-ref="count"]');
      countEl.textContent = String(count);
      countEl.classList.toggle('has-items', count > 0);
      countEl.setAttribute('aria-label', `拾取篮 ${count} 个元素`);
      this.toolbar.querySelector('[data-ref="hints"]').innerHTML = state.paused
        ? '已暂停，可正常操作页面 <kbd>Space</kbd> 继续拾取'
        : '点击加入/移除 <kbd>Tab</kbd> 穿透 <kbd>↑↓</kbd> 父/子 <kbd>Alt</kbd> 放行';
      const pauseBtn = this.toolbar.querySelector('[data-act="pause"]');
      pauseBtn.innerHTML = state.paused ? `${icon('play', 14)}<span>继续</span>` : `${icon('pause', 14)}<span>暂停</span>`;
      pauseBtn.classList.toggle('is-active', state.paused);
      this.toolbar.querySelector('[data-act="copy"]').disabled = count === 0;
      const restorable = session.restorableCount;
      const restoreBtn = this.toolbar.querySelector('[data-act="restore"]');
      restoreBtn.hidden = !restorable;
      if (restorable) restoreBtn.innerHTML = `${icon('history', 14)}<span>恢复上次 · ${restorable}</span>`;

      this.panel.classList.toggle('is-visible', this.isOpen);
      this.toolbar.querySelector('[data-act="panel"]').setAttribute('aria-pressed', String(this.isOpen));
      const railVisible = state.active && !this.isOpen;
      this.rail.classList.toggle('is-visible', railVisible);
      if (railVisible) this.renderRail(state);
      if (!this.isOpen) return;

      this.panel.querySelector('[data-ref="title-count"]').textContent = count ? `· ${count}` : '';
      this.panel.querySelector('[data-act="clear"]').disabled = count === 0;
      this.panel.querySelectorAll('.pp-actions .pp-btn').forEach(btn => { btn.disabled = count === 0; });
      this.panel.querySelectorAll('.pp-chip').forEach(chip => {
        const active = chip.dataset.preset === state.preset;
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-checked', String(active));
      });
      const question = this.panel.querySelector('[data-ref="question"]');
      if (question !== overlay.root.activeElement && question.value !== state.question) {
        question.value = state.question || '';
      }
      this.renderList(state);
    }

    renderList(state) {
      const list = this.panel.querySelector('[data-ref="list"]');
      const ids = state.items.map(item => item.id);
      if (!ids.length) ids.push(`empty:${session.restorableCount}`);
      const previous = new Set(this.renderedIds);
      // 输入备注时 commit 为 quiet 模式不会触发渲染；其余变化整体重绘，焦点在备注框时跳过以免打断输入
      const focused = overlay.root.activeElement;
      if (focused && focused.classList && focused.classList.contains('pp-note') && ids.join() === this.renderedIds.join()) return;
      this.renderedIds = ids;

      if (!state.items.length) {
        list.innerHTML = `
          <div class="pp-empty">
            <span class="pp-empty-icon">${icon('pointer', 28)}</span>
            <div class="pp-empty-title">拾取篮是空的</div>
            <div>${state.active ? '在页面上点击元素即可加入' : '开启拾取后点击页面元素即可加入'}</div>
            ${session.restorableCount ? `
            <div class="pp-restore-card">
              <div><strong>上次选择 · ${session.restorableCount} 个元素</strong>退出拾取时自动保存</div>
              <button class="pp-btn pp-btn-sm" data-act="restore">${icon('history', 14)}<span>恢复</span></button>
            </div>` : ''}
            <ul class="pp-guide">
              <li><span>选中多个元素，按顺序生成 Prompt</span><kbd>点击</kbd></li>
              <li><span>不加入拾取篮，直接复制单个元素</span><kbd>⌘/Ctrl+点击</kbd></li>
              <li><span>暂停拾取以打开弹窗、切换菜单</span><kbd>Space</kbd></li>
              <li><span>复制拾取篮的 AI Prompt</span><kbd>Enter</kbd></li>
              <li><span>先折叠拾取篮，再按一次退出拾取</span><kbd>Esc</kbd></li>
            </ul>
          </div>`;
        return;
      }

      const currentPath = PP.dom.currentPath();
      list.innerHTML = state.items.map((item, idx) => {
        const data = item.data;
        const ctx = data.context || {};
        const sel = data.selectors || {};
        const counts = data.matchCounts || {};
        const label = data.text || (data.attributes && (data.attributes.placeholder || data.attributes['aria-label'] || data.attributes.title || data.attributes.alt)) || '';
        const tags = [];
        if (ctx.isInsideModal) tags.push(`<span class="pp-tag is-modal">弹窗${ctx.modalTitle ? ' · ' + escapeHTML(shortText(ctx.modalTitle, 12)) : ''}</span>`);
        if (ctx.isIframe) tags.push(`<span class="pp-tag is-frame" title="${escapeHTML(ctx.frameUrl)}">iframe</span>`);
        const route = ctx.topPath || ctx.path;
        if (route && PP.relink.isRouteDifferent(route, currentPath)) tags.push(`<span class="pp-tag is-route" title="${escapeHTML(route)}">其他页面 · ${escapeHTML(PP.relink.getRouteName(route))}</span>`);
        if (data.disabled) tags.push('<span class="pp-tag">已禁用</span>');
        if (data.sensitive) tags.push('<span class="pp-tag">值已脱敏</span>');

        const locator = sel.playwrightFrame || sel.playwright || sel.css || '';
        const uniqueKey = sel.testId ? 'testId' : sel.id ? 'id' : sel.xpath ? 'xpath' : sel.attr ? 'attr' : 'css';
        const matchCount = counts[uniqueKey];
        const matchHint = matchCount === 1 ? '<span class="pp-unique">唯一</span>'
          : matchCount > 1 ? `<span class="pp-dup">${matchCount} 个匹配</span>` : '';

        return `
          <article class="pp-card${previous.has(item.id) ? '' : ' is-new'}" data-id="${escapeHTML(item.id)}">
            <div class="pp-card-head">
              <span class="pp-idx">${idx + 1}</span>
              <span class="pp-name" title="${escapeHTML(label)}"><code>&lt;${escapeHTML(data.tag)}&gt;</code> ${escapeHTML(shortText(label, 24))}</span>
              <div class="pp-card-actions">
                <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-ghost" data-act="locate" aria-label="在页面中定位" title="在页面中定位">${icon('target', 16)}</button>
                <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-ghost" data-act="up" aria-label="上移" title="上移" ${idx === 0 ? 'disabled' : ''}>${icon('up', 16)}</button>
                <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-ghost" data-act="down" aria-label="下移" title="下移" ${idx === state.items.length - 1 ? 'disabled' : ''}>${icon('down', 16)}</button>
                <button class="pp-btn pp-btn-sm pp-btn-icon pp-btn-ghost pp-btn-danger" data-act="remove" aria-label="移除" title="移除">${icon('x', 16)}</button>
              </div>
            </div>
            ${tags.length ? `<div class="pp-tags">${tags.join('')}</div>` : ''}
            <div class="pp-locator" title="${escapeHTML(locator)}">${escapeHTML(locator)}${matchHint}</div>
            <input class="pp-note" data-act="note" value="${escapeHTML(item.note || '')}" placeholder="备注（可选），例如：提交按钮" aria-label="第 ${idx + 1} 个元素的备注">
          </article>`;
      }).join('');

      const fresh = list.querySelector('.pp-card.is-new:last-child');
      if (fresh) fresh.scrollIntoView({ block: 'nearest' });
    }

    renderRail(state) {
      const count = state.items.length;
      const countEl = this.rail.querySelector('[data-ref="rail-count"]');
      countEl.textContent = String(count);
      countEl.classList.toggle('has-items', count > 0);
      countEl.setAttribute('aria-label', `拾取篮 ${count} 个元素`);
      this.rail.querySelector('[data-act="copy"]').disabled = count === 0;
      const list = this.rail.querySelector('[data-ref="rail-list"]');
      const grew = count > (this.railCount || 0);
      this.railCount = count;
      list.innerHTML = state.items.map((item, idx) => {
        const data = item.data;
        const label = `<${data.tag}> ${shortText(data.text || '', 20)}`.trim();
        const isFrame = data.context && data.context.isIframe;
        return `<button class="pp-rail-item${isFrame ? ' is-frame' : ''}" data-id="${escapeHTML(item.id)}" title="定位 ${idx + 1}：${escapeHTML(label)}" aria-label="定位第 ${idx + 1} 个元素 ${escapeHTML(label)}">${idx + 1}</button>`;
      }).join('');
      // 新加入元素时滚到末尾，让最新序号可见
      if (grew) list.scrollTop = list.scrollHeight;
      this.updateRailMore();
    }

    // 列表下方提示未显示的剩余数量
    updateRailMore() {
      const list = this.rail.querySelector('[data-ref="rail-list"]');
      const more = this.rail.querySelector('[data-ref="rail-more"]');
      const hiddenBelow = list.scrollHeight - list.clientHeight - list.scrollTop > 2;
      const hiddenAbove = list.scrollTop > 2;
      more.hidden = !hiddenBelow && !hiddenAbove;
      more.textContent = hiddenBelow ? '▾ 更多' : '▴ 更多';
    }

    onRailClick(event) {
      const item = event.target.closest('.pp-rail-item');
      if (item) {
        session.locate(item.dataset.id);
        return;
      }
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'expand') this.open();
      else if (btn.dataset.act === 'copy') this.copyPrompt();
    }

    // ---------- 交互 ----------
    copyPrompt() {
      const { items, question, preset } = session.state;
      if (!items.length) return;
      overlay.copy(PP.prompt.buildPrompt(items, { question, preset }), `已复制 ${items.length} 个元素的 AI Prompt`);
    }

    onToolbarClick(event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      switch (btn.dataset.act) {
        case 'pause': return session.setPaused(!session.state.paused);
        case 'panel': return this.isOpen ? this.close() : this.open();
        case 'restore': return session.restoreLast();
        case 'copy': return this.copyPrompt();
        case 'exit': return session.stop();
        default: return undefined;
      }
    }

    onPanelClick(event) {
      const chip = event.target.closest('.pp-chip');
      if (chip) {
        session.setPreset(chip.dataset.preset);
        return;
      }
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const card = btn.closest('.pp-card');
      const id = card && card.dataset.id;
      switch (btn.dataset.act) {
        case 'close': return this.close();
        case 'restore': return session.restoreLast();
        case 'clear': return session.clear();
        case 'copy': return this.copyPrompt();
        case 'json': {
          const { items, question, preset } = session.state;
          return overlay.copy(PP.prompt.buildJSON(items, { question, preset }), `已复制 ${items.length} 个元素的 JSON`);
        }
        case 'locate': return session.locate(id);
        case 'up': return session.move(id, -1);
        case 'down': return session.move(id, 1);
        case 'remove': return session.remove(id);
        default: return undefined;
      }
    }

    onPanelInput(event) {
      const target = event.target;
      if (target.dataset.ref === 'question') {
        session.setQuestion(target.value);
      } else if (target.dataset.act === 'note') {
        session.setNote(target.closest('.pp-card').dataset.id, target.value);
      }
    }

    makeDraggable(el, handle) {
      let start = null;
      const onMove = event => {
        if (!start) return;
        const rect = el.getBoundingClientRect();
        const left = Math.max(8, Math.min(start.left + event.clientX - start.x, window.innerWidth - rect.width - 8));
        const top = Math.max(8, Math.min(start.top + event.clientY - start.y, window.innerHeight - rect.height - 8));
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
      };
      const onUp = () => {
        start = null;
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
      };
      handle.addEventListener('pointerdown', event => {
        const rect = el.getBoundingClientRect();
        start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        el.style.transform = 'none';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        event.preventDefault();
        event.stopPropagation();
      });
    }
  }

  PP.panel = new Panel();
})();
