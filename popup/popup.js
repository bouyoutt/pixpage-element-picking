// popup.js - 弹窗：启停拾取、展示真实状态与启动错误、导出诊断信息

document.addEventListener('DOMContentLoaded', async () => {
  const btnToggle = document.getElementById('btnToggle');
  const btnLabel = document.getElementById('btnLabel');
  const status = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const errorEl = document.getElementById('error');
  const btnDiag = document.getElementById('btnDiag');
  const logCount = document.getElementById('logCount');
  const version = chrome.runtime.getManifest().version;
  document.getElementById('version').textContent = `v${version}`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function render(active, count) {
    status.classList.toggle('is-active', active);
    statusText.textContent = active ? `拾取中${count ? ` · ${count}` : ''}` : '未启动';
    btnToggle.classList.toggle('is-active', active);
    btnLabel.textContent = active ? '结束拾取' : '开始拾取';
  }

  async function syncStatus() {
    if (!tab || !tab.id) return;
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'GET_PICKER_STATUS' }, { frameId: 0 });
      render(Boolean(res && res.active), (res && res.count) || 0);
    } catch (e) {
      // 页面尚未注入内容脚本：点击开始时 background 会兜底注入
      render(false, 0);
    }
  }

  async function syncLogCount() {
    const res = await chrome.runtime.sendMessage({ action: 'PP_GET_LOGS' });
    const errors = (res.logs || []).filter(entry => entry.level === 'error').length;
    logCount.textContent = errors ? `${errors} 条错误记录` : '';
  }

  btnToggle.addEventListener('click', async () => {
    btnToggle.disabled = true;
    showError('');
    const res = await chrome.runtime.sendMessage({ action: 'TRIGGER_TOGGLE_FROM_POPUP' });
    btnToggle.disabled = false;
    if (res && res.ok) {
      window.close();
      return;
    }
    showError((res && res.error) || '启动失败，请刷新页面后重试');
    syncLogCount();
  });

  btnDiag.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'PP_GET_LOGS' });
    const lines = (res.logs || []).slice(-80).map(entry => {
      const time = new Date(entry.t).toISOString();
      const where = [entry.frame, entry.page].filter(Boolean).join(' ');
      return `${time} [${entry.level}] ${entry.op} ${entry.msg}${where ? ` (${where})` : ''}${entry.stack ? `\n    ${entry.stack.replace(/\n/g, '\n    ')}` : ''}`;
    });
    const report = [
      `PixPage v${version}`,
      `UA: ${navigator.userAgent}`,
      `生成时间: ${new Date().toISOString()}`,
      '',
      lines.length ? lines.join('\n') : '(暂无日志)'
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      btnDiag.textContent = '已复制';
    } catch (e) {
      btnDiag.textContent = '复制失败';
    }
    setTimeout(() => { btnDiag.textContent = '复制诊断信息'; }, 1500);
  });

  await Promise.all([syncStatus(), syncLogCount()]);
});
