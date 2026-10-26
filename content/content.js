// content/content.js - 内容脚本入口：接收 background 指令与跨 Frame 事件
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const { bus, isTop, log, alive } = PP.runtime;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 只处理来自本扩展 background 的消息
    if (sender.id !== chrome.runtime.id) return false;

    if (request.action === 'PP_EVENT') {
      bus.receive(request);
      sendResponse({ ok: true });
      return false;
    }
    if (!isTop) return false;

    if (request.action === 'TOGGLE_PICKER') {
      sendResponse({ success: true, active: PP.session.toggle() });
    } else if (request.action === 'GET_PICKER_STATUS') {
      sendResponse({ success: true, active: PP.session.state.active, count: PP.session.count });
    } else if (request.action === 'STOP_PICKER') {
      PP.session.stop();
      sendResponse({ success: true, active: false });
    }
    return false;
  });

  // 扩展重载后新脚本发出 teardown：本实例 chrome.runtime 已失效时自行清理，避免两套监听并存
  window.addEventListener('pixpage-teardown', () => {
    if (alive()) return;
    try {
      PP.inspector.destroy();
      PP.overlay.destroy();
    } catch (e) { /* 孤儿实例无法再写日志 */ }
  });

  window.addEventListener('error', event => {
    // 只记录本扩展脚本抛出的异常，不收集宿主页面的错误
    if (event.filename && event.filename.startsWith('chrome-extension://')) {
      log.error('content.uncaught', event.error || event.message);
    }
  });

  // 控制台调试别名
  if (isTop) window.__pixpage_toggle = () => PP.session.toggle();
  log.debug('content.ready', { ms: PP.runtime.initMs() });
})();
