// content/ui-styles.js - Shadow DOM 内的设计令牌、组件样式与 SVG 图标（不向宿主页面注入任何样式）
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  // Lucide 图标路径 (ISC License)，统一 24 视框 + currentColor 描边
  const ICON_PATHS = {
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    pointer: '<path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/>'
  };

  PP.icon = function(name, size = 16) {
    return `<svg class="pp-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ''}</svg>`;
  };

  PP.uiStyles = `
    :host {
      all: initial;
      /* 设计令牌：深色开发者工具风格 (ui-ux-pro-max: Dark Mode / developer tool) */
      --pp-bg: #0f172a;
      --pp-surface: #1b2336;
      --pp-surface-2: #242e45;
      --pp-border: #334155;
      --pp-border-strong: #475569;
      --pp-fg: #f8fafc;
      --pp-fg-muted: #94a3b8;
      --pp-fg-subtle: #a3b1c6;
      --pp-primary: #3b82f6;
      --pp-primary-hover: #2563eb;
      --pp-on-primary: #ffffff;
      --pp-hover: #3b82f6;
      --pp-selected: #22c55e;
      --pp-selected-ink: #052e16;
      --pp-warn: #f59e0b;
      --pp-warn-ink: #451a03;
      --pp-danger: #f87171;
      --pp-ring: #93c5fd;
      --pp-radius: 8px;
      --pp-radius-sm: 6px;
      --pp-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.6), 0 4px 12px -4px rgba(0, 0, 0, 0.4);
      --pp-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif;
      --pp-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --pp-ease: cubic-bezier(0.16, 1, 0.3, 1);
      font-family: var(--pp-font);
      font-size: 13px;
      line-height: 1.5;
      color: var(--pp-fg);
    }
    *, *::before, *::after { box-sizing: border-box; }
    /* 宿主节点的内联 all:initial 优先级高于 :host，基础排版必须落在各顶层组件上 */
    .pp-toolbar, .pp-panel, .pp-toast, .pp-tip, .pp-pin-badge {
      color: var(--pp-fg);
      font-family: var(--pp-font);
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    h2, p, ul { margin: 0; }
    .pp-icon { flex-shrink: 0; display: block; }
    [hidden] { display: none !important; }
    button { font: inherit; color: inherit; }
    :focus-visible { outline: 2px solid var(--pp-ring); outline-offset: 2px; }

    /* ---- 悬停高亮 ---- */
    .pp-mask {
      position: fixed; pointer-events: none; display: none;
      background: rgba(59, 130, 246, 0.16);
      border: 2px solid var(--pp-hover);
      border-radius: 3px;
      transition: top 60ms ease-out, left 60ms ease-out, width 60ms ease-out, height 60ms ease-out;
    }
    .pp-mask.is-visible { display: block; }
    .pp-mask.is-selected { border-color: var(--pp-selected); background: rgba(34, 197, 94, 0.12); }
    .pp-tip {
      position: fixed; pointer-events: none; display: none;
      max-width: min(560px, 92vw);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      background: var(--pp-bg); color: var(--pp-fg);
      border: 1px solid var(--pp-border-strong);
      padding: 3px 8px; border-radius: var(--pp-radius-sm);
      font-family: var(--pp-mono); font-size: 12px;
      box-shadow: var(--pp-shadow);
    }
    .pp-tip.is-visible { display: block; }
    .pp-tip-tag { color: #93c5fd; }
    .pp-tip-size { color: var(--pp-fg-muted); margin-left: 6px; }
    .pp-tip-hint { color: #fcd34d; margin-left: 8px; font-family: var(--pp-font); }
    .pp-tip-hint.is-selected { color: #86efac; }

    /* ---- 拾取篮常驻选中框 ---- */
    .pp-pin {
      position: fixed; pointer-events: none;
      border: 2px solid var(--pp-selected);
      background: rgba(34, 197, 94, 0.10);
      border-radius: 4px;
    }
    .pp-pin.is-occluded {
      border-style: dashed;
      border-color: rgba(148, 163, 184, 0.85);
      background: transparent;
    }
    .pp-pin-badge {
      position: absolute; top: -22px; left: -2px;
      display: inline-flex; align-items: center; gap: 4px;
      height: 20px; padding: 0 6px;
      background: var(--pp-selected); color: var(--pp-selected-ink);
      border-radius: 4px;
      font-family: var(--pp-mono); font-size: 12px; font-weight: 600; line-height: 20px;
      white-space: nowrap;
    }
    .pp-pin.is-below .pp-pin-badge { top: auto; bottom: -22px; }
    .pp-pin.is-occluded .pp-pin-badge { background: #475569; color: var(--pp-fg); }
    .pp-pin.is-pulse { animation: pp-pulse 600ms var(--pp-ease) 2; }
    @keyframes pp-pulse {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      100% { box-shadow: 0 0 0 14px rgba(34, 197, 94, 0); }
    }

    /* ---- Toast ---- */
    .pp-toast {
      position: fixed; top: 16px; left: 50%;
      transform: translate(-50%, -8px); opacity: 0;
      display: flex; align-items: center; gap: 8px;
      max-width: min(520px, 90vw);
      padding: 8px 14px;
      background: var(--pp-bg); color: var(--pp-fg);
      border: 1px solid var(--pp-border-strong);
      border-radius: var(--pp-radius);
      box-shadow: var(--pp-shadow);
      pointer-events: none;
      transition: opacity 160ms ease, transform 200ms var(--pp-ease);
    }
    .pp-toast.is-visible { opacity: 1; transform: translate(-50%, 0); }
    .pp-toast .pp-icon { color: var(--pp-selected); }
    .pp-toast.tone-warn .pp-icon { color: var(--pp-warn); }
    .pp-toast.tone-error .pp-icon { color: var(--pp-danger); }

    /* ---- 底部工具栏 ---- */
    .pp-toolbar {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      display: none; align-items: center; gap: 6px;
      height: 44px; padding: 0 6px 0 4px;
      max-width: 96vw;
      background: rgba(15, 23, 42, 0.96);
      border: 1px solid var(--pp-border-strong);
      border-radius: 12px;
      box-shadow: var(--pp-shadow);
      pointer-events: auto; user-select: none; white-space: nowrap;
    }
    .pp-toolbar.is-visible { display: flex; animation: pp-rise 200ms var(--pp-ease); }
    .pp-toolbar.is-paused { border-color: var(--pp-warn); }
    @keyframes pp-rise { from { opacity: 0; transform: translate(-50%, 8px); } }
    .pp-grip {
      display: flex; align-items: center; justify-content: center;
      width: 20px; height: 32px; color: var(--pp-fg-muted); cursor: grab; touch-action: none;
    }
    .pp-grip:active { cursor: grabbing; }
    .pp-status { display: flex; align-items: center; gap: 8px; padding-right: 4px; }
    .pp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pp-selected); }
    .pp-toolbar.is-paused .pp-dot { background: var(--pp-warn); }
    .pp-brand { font-weight: 700; font-size: 13px; }
    .pp-count {
      display: inline-flex; align-items: center; height: 22px; padding: 0 8px;
      border-radius: 11px; background: var(--pp-surface-2); color: var(--pp-fg);
      font-size: 12px; font-weight: 600;
    }
    .pp-count.has-items { background: var(--pp-selected); color: var(--pp-selected-ink); }
    .pp-hints { display: flex; align-items: center; gap: 6px; color: var(--pp-fg-subtle); font-size: 12px; padding: 0 4px; }
    .pp-toolbar.is-paused .pp-hints { color: #fcd34d; }
    .pp-sep { width: 1px; height: 20px; background: var(--pp-border); margin: 0 2px; }
    kbd, .pp-kbd {
      display: inline-flex; align-items: center; height: 20px; padding: 0 6px;
      border: 1px solid var(--pp-border-strong); border-bottom-width: 2px;
      border-radius: 4px; background: var(--pp-surface);
      color: var(--pp-fg); font: 12px/1 var(--pp-mono);
    }

    /* ---- 按钮 ---- */
    .pp-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 32px; padding: 0 12px;
      border: 1px solid transparent; border-radius: var(--pp-radius-sm);
      background: var(--pp-surface-2); color: var(--pp-fg);
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
    }
    .pp-btn:hover { background: #2f3b56; }
    .pp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pp-btn-primary { background: var(--pp-primary); color: var(--pp-on-primary); }
    .pp-btn-primary:hover { background: var(--pp-primary-hover); }
    .pp-btn-ghost { background: transparent; color: var(--pp-fg-subtle); }
    .pp-btn-ghost:hover { background: var(--pp-surface-2); color: var(--pp-fg); }
    .pp-btn-icon { width: 32px; padding: 0; }
    .pp-btn-sm { height: 28px; padding: 0 8px; font-size: 12px; }
    .pp-btn-sm.pp-btn-icon { width: 28px; }
    .pp-btn.is-active { background: var(--pp-warn); color: var(--pp-warn-ink); }
    .pp-btn-danger:hover { color: var(--pp-danger); }

    /* ---- 拾取篮侧边面板 ---- */
    .pp-panel {
      position: fixed; top: 16px; right: 16px; bottom: 80px;
      width: 384px; max-width: calc(100vw - 32px);
      display: none; flex-direction: column;
      background: var(--pp-bg);
      border: 1px solid var(--pp-border);
      border-radius: 12px;
      box-shadow: var(--pp-shadow);
      pointer-events: auto; overflow: hidden;
    }
    .pp-panel.is-visible { display: flex; animation: pp-slide 220ms var(--pp-ease); }
    @keyframes pp-slide { from { opacity: 0; transform: translateX(16px); } }
    /* ---- 拾取篮折叠态：右侧窄条 ---- */
    .pp-rail {
      position: fixed; top: 16px; right: 16px;
      width: 48px; max-height: calc(100vh - 112px);
      display: none; flex-direction: column; align-items: center; gap: 6px;
      padding: 6px 0;
      background: var(--pp-bg);
      border: 1px solid var(--pp-border);
      border-radius: 12px;
      box-shadow: var(--pp-shadow);
      pointer-events: auto;
      color: var(--pp-fg); font-family: var(--pp-font); font-size: 13px; line-height: 1.5;
    }
    .pp-rail.is-visible { display: flex; animation: pp-slide 200ms var(--pp-ease); }
    .pp-rail-label {
      writing-mode: vertical-rl; letter-spacing: 2px;
      font-size: 12px; font-weight: 600; color: var(--pp-fg-subtle);
      padding: 2px 0;
    }
    .pp-rail-list {
      flex: 1 1 auto; min-height: 0; overflow-y: auto;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 2px 0; scrollbar-width: none;
    }
    .pp-rail-list::-webkit-scrollbar { display: none; }
    .pp-rail-item {
      width: 32px; height: 28px; border: none; border-radius: 6px;
      background: var(--pp-selected); color: var(--pp-selected-ink);
      font-family: var(--pp-mono); font-size: 12px; font-weight: 700;
      cursor: pointer; transition: filter 150ms ease;
    }
    .pp-rail-item:hover { filter: brightness(1.12); }
    .pp-rail-item.is-frame { background: #fbbf24; color: var(--pp-warn-ink); }
    .pp-rail-sep { width: 24px; height: 1px; background: var(--pp-border); flex-shrink: 0; }

    .pp-panel-head {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 10px 10px 16px;
      border-bottom: 1px solid var(--pp-border);
    }
    .pp-panel-title { flex: 1; font-size: 14px; font-weight: 700; }
    .pp-panel-title span { color: var(--pp-fg-muted); font-weight: 500; margin-left: 4px; }
    .pp-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .pp-list::-webkit-scrollbar { width: 8px; }
    .pp-list::-webkit-scrollbar-thumb { background: var(--pp-border); border-radius: 4px; }

    .pp-empty { margin: auto 0; padding: 24px 12px; text-align: center; color: var(--pp-fg-subtle); }
    /* 只作用于空状态顶部的主图标，不能影响卡片内按钮的图标 */
    .pp-empty-icon { display: flex; justify-content: center; margin-bottom: 10px; color: var(--pp-primary); }
    .pp-empty-title { color: var(--pp-fg); font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .pp-restore-card {
      margin: 16px 0 0; padding: 10px 12px; text-align: left;
      display: flex; align-items: center; gap: 10px;
      background: var(--pp-surface); border: 1px solid var(--pp-border); border-radius: var(--pp-radius);
    }
    .pp-restore-card div { flex: 1; font-size: 12px; }
    .pp-restore-card strong { display: block; color: var(--pp-fg); font-size: 13px; }
    .pp-guide { margin: 16px 0 0; padding: 0; list-style: none; text-align: left; display: grid; gap: 8px; }
    .pp-guide li { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; }

    .pp-card {
      background: var(--pp-surface);
      border: 1px solid var(--pp-border);
      border-radius: var(--pp-radius);
      padding: 8px 8px 10px 10px;
      transition: border-color 150ms ease;
    }
    .pp-card:hover { border-color: var(--pp-border-strong); }
    .pp-card.is-new { animation: pp-flash 900ms ease; }
    @keyframes pp-flash { 0% { border-color: var(--pp-selected); } }
    .pp-card-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .pp-idx {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 22px; padding: 0 4px; border-radius: 6px;
      background: var(--pp-selected); color: var(--pp-selected-ink);
      font: 700 12px/1 var(--pp-mono);
    }
    .pp-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .pp-name code { font-family: var(--pp-mono); color: #93c5fd; font-weight: 500; }
    .pp-card-actions { display: flex; gap: 2px; }
    .pp-tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 0 30px; }
    .pp-tag {
      display: inline-flex; align-items: center; height: 20px; padding: 0 6px;
      border-radius: 4px; font-size: 12px;
      background: var(--pp-surface-2); color: var(--pp-fg-subtle);
    }
    .pp-tag.is-modal { background: rgba(59, 130, 246, 0.18); color: #bfdbfe; }
    .pp-tag.is-frame { background: rgba(245, 158, 11, 0.16); color: #fde68a; }
    .pp-tag.is-route { background: rgba(148, 163, 184, 0.18); color: var(--pp-fg); }
    .pp-locator {
      margin: 6px 0 0 30px; padding: 4px 8px;
      background: var(--pp-bg); border: 1px solid var(--pp-border); border-radius: 4px;
      font: 12px/1.6 var(--pp-mono); color: #cbd5e1;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .pp-locator .pp-unique { color: #86efac; margin-left: 4px; }
    .pp-locator .pp-dup { color: #fcd34d; margin-left: 4px; }
    .pp-note {
      display: block; width: calc(100% - 30px); margin: 6px 0 0 30px;
      height: 28px; padding: 0 8px;
      background: transparent; color: var(--pp-fg);
      border: 1px solid var(--pp-border); border-radius: 4px;
      font: 12px var(--pp-font);
    }
    .pp-note::placeholder, .pp-question::placeholder { color: #7c8aa0; }
    .pp-note:focus, .pp-question:focus { outline: none; border-color: var(--pp-primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35); }

    .pp-panel-foot { border-top: 1px solid var(--pp-border); padding: 10px; display: grid; gap: 8px; background: var(--pp-bg); }
    .pp-presets { display: flex; flex-wrap: wrap; gap: 6px; }
    .pp-chip {
      height: 28px; padding: 0 10px; border-radius: 14px;
      border: 1px solid var(--pp-border-strong); background: transparent;
      color: var(--pp-fg-subtle); font-size: 12px; cursor: pointer;
      transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
    }
    .pp-chip:hover { color: var(--pp-fg); border-color: var(--pp-fg-muted); }
    .pp-chip.is-active { background: rgba(59, 130, 246, 0.2); border-color: var(--pp-primary); color: var(--pp-fg); }
    .pp-label { font-size: 12px; color: var(--pp-fg-muted); }
    .pp-question {
      width: 100%; min-height: 64px; max-height: 180px; resize: vertical;
      padding: 8px; border-radius: var(--pp-radius-sm);
      background: var(--pp-surface); color: var(--pp-fg);
      border: 1px solid var(--pp-border);
      font: 13px/1.5 var(--pp-font);
    }
    .pp-actions { display: flex; gap: 8px; }
    .pp-actions .pp-btn-primary { flex: 1; height: 36px; }
    .pp-actions .pp-btn:not(.pp-btn-primary) { height: 36px; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
    }
  `;
})();
