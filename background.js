// background.js - PixPage Picker Service Worker (MV3)
// 职责：快捷键/popup 启停、跨 Frame 消息中转、拾取篮会话存储、错误日志环形缓冲、未注入页面的兜底注入。

const CONTENT_FILES = [
  'content/runtime.js',
  'content/dom-utils.js',
  'content/selector.js',
  'content/extractor.js',
  'content/prompt-builder.js',
  'content/relink.js',
  'content/ui-styles.js',
  'content/ui-shadow.js',
  'content/session.js',
  'content/panel.js',
  'content/inspector.js',
  'content/content.js'
];
const LOG_KEY = 'pp_logs';
const LOG_LIMIT = 200;
const RESTRICTED_URL = /^(chrome|chrome-extension|edge|about|devtools|view-source):|^https:\/\/chromewebstore\.google\.com|^https:\/\/chrome\.google\.com\/webstore/;

// ---- 日志：串行写入，避免并发 get/set 丢条目 ----
let logQueue = Promise.resolve();
function appendLog(entry) {
  logQueue = logQueue.then(async () => {
    const stored = await chrome.storage.local.get(LOG_KEY);
    const logs = Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
    logs.push(entry);
    await chrome.storage.local.set({ [LOG_KEY]: logs.slice(-LOG_LIMIT) });
  }).catch(err => console.error('[PixPage] 写入日志失败:', err));
  return logQueue;
}

function bgLog(level, op, detail) {
  const err = detail instanceof Error ? detail : null;
  const entry = {
    t: Date.now(), level, op,
    msg: err ? err.message : (typeof detail === 'string' ? detail : JSON.stringify(detail || '')),
    stack: err && err.stack ? String(err.stack).split('\n').slice(0, 5).join('\n') : '',
    frame: 'background', page: '', v: chrome.runtime.getManifest().version
  };
  (level === 'error' ? console.error : console.warn)(`[PixPage] ${op}`, detail);
  return appendLog(entry);
}

// ---- 徽标 ----
function updateBadge(tabId, isActive) {
  chrome.action.setBadgeText({ tabId, text: isActive ? 'ON' : '' }).catch(() => {});
  if (isActive) chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563EB' }).catch(() => {});
}

function flashErrorBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: '!' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#DC2626' }).catch(() => {});
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 2500);
}

// ---- 兜底注入：扩展安装/更新前已打开的页面没有内容脚本 ----
async function injectContentScripts(tabId) {
  // 先保证顶层可用；子 Frame 跨域时 activeTab 可能无权限，失败只记录不影响主流程
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: CONTENT_FILES });
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: CONTENT_FILES });
  } catch (e) {
    bgLog('warn', 'inject.allFrames', e);
  }
}

/**
 * 切换当前活动 Tab 的拾取状态，返回 { ok, active?, error? }
 */
async function togglePickerInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { ok: false, error: '未找到当前标签页' };
  if (tab.url && RESTRICTED_URL.test(tab.url)) {
    flashErrorBadge(tab.id);
    return { ok: false, error: '浏览器内置页面与应用商店不允许运行扩展' };
  }

  const startedAt = Date.now();
  const send = () => chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PICKER' }, { frameId: 0 });
  let response = null;
  try {
    response = await send();
  } catch (firstError) {
    try {
      await injectContentScripts(tab.id);
      response = await send();
      bgLog('info', 'inject.fallback', { ms: Date.now() - startedAt });
    } catch (e) {
      bgLog('error', 'toggle.inject', e);
      flashErrorBadge(tab.id);
      return { ok: false, error: `无法在此页面启动：${e.message}` };
    }
  }

  if (response && typeof response.active === 'boolean') {
    updateBadge(tab.id, response.active);
    return { ok: true, active: response.active };
  }
  bgLog('warn', 'toggle.noResponse', response);
  return { ok: false, error: '页面未响应，请刷新页面后重试' };
}

// ---- 跨 Frame 中转 ----
async function relay(message, sender) {
  const tabId = sender.tab && sender.tab.id;
  if (!tabId) return { ok: false };
  const envelope = {
    action: 'PP_EVENT',
    type: message.type,
    payload: message.payload,
    from: sender.frameId,
    excludeSelf: Boolean(message.excludeSelf)
  };
  try {
    if (message.target === 'all') {
      await chrome.tabs.sendMessage(tabId, envelope);
      return { ok: true };
    }
    const frameId = message.target === 'top' ? 0 : message.target;
    if (typeof frameId !== 'number') return { ok: false };
    const res = await chrome.tabs.sendMessage(tabId, envelope, { frameId });
    return { ok: Boolean(res && res.ok) };
  } catch (e) {
    // 目标 Frame 已销毁属于正常情况（ping 探测依赖该返回值），不记日志
    return { ok: false };
  }
}

const sessionKey = tabId => `pp_session_${tabId}`;

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-picker') {
    const result = await togglePickerInActiveTab();
    if (!result.ok) bgLog('warn', 'command.toggle', result.error);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(sessionKey(tabId)).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 只接受本扩展自身的上下文（内容脚本 / popup）
  if (sender.id !== chrome.runtime.id) return false;
  const tabId = sender.tab && sender.tab.id;

  switch (message.action) {
    case 'PP_WHOAMI':
      sendResponse({ frameId: sender.frameId });
      return false;
    case 'PP_RELAY':
      relay(message, sender).then(sendResponse);
      return true;
    case 'PP_LOG':
      if (message.entry) appendLog({ ...message.entry, tab: tabId });
      sendResponse({ ok: true });
      return false;
    case 'PP_SAVE_SESSION':
      if (tabId && sender.frameId === 0) {
        chrome.storage.session.set({ [sessionKey(tabId)]: message.session }).catch(e => bgLog('warn', 'session.save', e));
      }
      sendResponse({ ok: true });
      return false;
    case 'PP_LOAD_SESSION':
      if (!tabId) { sendResponse({ session: null }); return false; }
      chrome.storage.session.get(sessionKey(tabId))
        .then(stored => sendResponse({ session: stored[sessionKey(tabId)] || null }))
        .catch(() => sendResponse({ session: null }));
      return true;
    case 'PICKER_STATUS_CHANGED':
      if (tabId && sender.frameId === 0) updateBadge(tabId, message.active);
      sendResponse({ ok: true });
      return false;
    case 'TRIGGER_TOGGLE_FROM_POPUP':
      togglePickerInActiveTab().then(sendResponse);
      return true;
    case 'PP_GET_LOGS':
      chrome.storage.local.get(LOG_KEY).then(stored => sendResponse({ logs: stored[LOG_KEY] || [] }));
      return true;
    case 'PP_CLEAR_LOGS':
      chrome.storage.local.remove(LOG_KEY).then(() => sendResponse({ ok: true }));
      return true;
    default:
      return false;
  }
});

self.addEventListener('error', event => bgLog('error', 'sw.error', event.error || event.message));
self.addEventListener('unhandledrejection', event => bgLog('error', 'sw.rejection', event.reason));
