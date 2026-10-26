// content/runtime.js - 运行时基础：分级错误日志 + 经 background 中转的跨 Frame 消息总线
// 跨 Frame 消息只走 chrome.runtime 通道，宿主页面脚本无法读取或伪造（取代原 window.postMessage 广播）。
(function() {
  // 兜底注入（chrome.scripting）可能与清单注入重复：已有存活实例时，令本轮后续脚本全部跳过
  const existing = window.__PixPagePicker;
  if (existing && existing.runtime && existing.runtime.alive()) {
    existing.__skip = true;
    return;
  }
  // 扩展重载后的孤儿实例：通知其停止（新版本起监听此事件），再建立全新命名空间
  // 旧实例只在自身 chrome.runtime 已失效时响应，页面脚本伪造该事件无法关闭正常会话
  if (existing) {
    try { window.dispatchEvent(new CustomEvent('pixpage-teardown')); } catch (e) { console.debug('[PixPage] teardown dispatch failed', e); }
  }
  const PP = window.__PixPagePicker = { __skip: false };

  const isTop = window === window.top;
  const bootAt = performance.now();
  const version = (() => {
    try { return chrome.runtime.getManifest().version; } catch (e) { return ''; }
  })();

  // 扩展被重载/更新后旧脚本会成为孤儿，chrome.runtime.id 变为 undefined
  function alive() {
    try { return Boolean(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }

  function pageRef() {
    try { return location.origin + location.pathname; } catch (e) { return ''; }
  }

  function describe(detail) {
    if (detail === undefined || detail === null) return '';
    if (typeof detail === 'string') return detail;
    try { return JSON.stringify(detail).slice(0, 500); } catch (e) { return String(detail); }
  }

  // debug 只进控制台；info 及以上同时写入后台环形日志，供 popup「复制诊断信息」导出
  const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
  function write(level, op, detail) {
    const err = detail instanceof Error ? detail : null;
    const entry = {
      t: Date.now(),
      level,
      op,
      msg: err ? err.message : describe(detail),
      stack: err && err.stack ? String(err.stack).split('\n').slice(0, 5).join('\n') : '',
      frame: isTop ? 'top' : 'iframe',
      page: pageRef(),
      v: version
    };
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'debug';
    console[method](`[PixPage] ${op}`, detail === undefined ? '' : detail);
    if (LEVELS[level] >= LEVELS.info && alive()) {
      chrome.runtime.sendMessage({ action: 'PP_LOG', entry }).catch(() => {});
    }
  }

  const log = {
    debug: (op, detail) => write('debug', op, detail),
    info: (op, detail) => write('info', op, detail),
    warn: (op, detail) => write('warn', op, detail),
    error: (op, detail) => write('error', op, detail)
  };

  // 包装事件处理函数：异常写入日志而不是静默吞掉或打断宿主页面
  function guard(fn, op) {
    return function(...args) {
      try {
        return fn.apply(this, args);
      } catch (e) {
        log.error(op, e);
        return undefined;
      }
    };
  }

  // ---- 消息总线 ----
  const handlers = new Map();
  let selfId = isTop ? 0 : null;
  const ready = isTop
    ? Promise.resolve(0)
    : (alive()
      ? chrome.runtime.sendMessage({ action: 'PP_WHOAMI' })
        .then(res => {
          selfId = res && typeof res.frameId === 'number' ? res.frameId : -1;
          return selfId;
        })
        .catch(e => {
          log.warn('bus.whoami', e);
          selfId = -1;
          return -1;
        })
      : Promise.resolve(-1));

  function dispatch(type, payload, from) {
    const handler = handlers.get(type);
    if (handler) handler(payload || {}, from);
  }

  /**
   * target: 'top' | 'all' | Chrome frameId
   * 返回 Promise<boolean>：目标 Frame 是否存在并收到消息（可用于探测 Frame 存活）
   */
  async function send(target, type, payload = {}, options = {}) {
    if (!alive()) return false;
    await ready;
    if (target === selfId || (target === 'top' && isTop)) {
      dispatch(type, payload, selfId);
      return true;
    }
    try {
      const res = await chrome.runtime.sendMessage({
        action: 'PP_RELAY', target, type, payload, excludeSelf: Boolean(options.excludeSelf)
      });
      return Boolean(res && res.ok);
    } catch (e) {
      log.warn(`bus.send ${type}`, e);
      return false;
    }
  }

  function on(type, fn) {
    handlers.set(type, guard(fn, `bus.${type}`));
  }

  // 由 content.js 收到 background 转发的 PP_EVENT 后调用
  function receive(envelope) {
    if (envelope.excludeSelf && envelope.from === selfId) return;
    dispatch(envelope.type, envelope.payload, envelope.from);
  }

  PP.log = log;
  PP.runtime = {
    isTop,
    version,
    alive,
    log,
    guard,
    initMs: () => Math.round(performance.now() - bootAt),
    bus: {
      send,
      on,
      receive,
      ready,
      get selfId() { return selfId; }
    }
  };
})();
