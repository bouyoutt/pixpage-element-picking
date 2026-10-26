// content/dom-utils.js - 公共 DOM 工具：稳定标识过滤、弹窗识别、可见性与遮挡检测、URL 脱敏
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const HOST_ID = 'pixpage-inspector-host';
  // 浮层类名需同时满足定位条件（fixed/absolute），避免把 .ant-dropdown-trigger 这类页面内触发器误判为弹窗
  const LAYER_TOKEN = /(^|[-_])(modal|dialog|drawer|popup|popover|popper|dropdown|overlay|layer)([-_]{1,2}(wrap|wrapper|content|container|root|panel|menu|body|main))?$/i;
  const SENSITIVE_QUERY_KEYS = [
    'token', 'tokenrefreshat', 'access_token', 'refresh_token', 'refreshtoken',
    'auth', 'ticket', 'session', 'jwt', 'sign', 'signature', 'password', 'secret'
  ];

  function isPluginNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return node.id === HOST_ID || Boolean(node.closest && node.closest('#' + HOST_ID));
  }

  // 过滤如 :r1:, el-id-1234, id_98234, uuid, 长十六进制哈希
  function isStableId(id) {
    if (!id || typeof id !== 'string') return false;
    if (/^(:r|el-id-|rc-|_)/.test(id)) return false;
    if (/\d{4,}/.test(id)) return false;
    if (/^[a-f0-9]{8,}/i.test(id)) return false;
    return true;
  }

  // 过滤 Vue scoped hash、css-in-js 随机串等动态类名
  function stableClasses(classList) {
    if (!classList || classList.length === 0) return [];
    return Array.from(classList).filter(cls => {
      if (!cls || typeof cls !== 'string') return false;
      if (/^[a-z0-9_-]{8,}$/i.test(cls) && /\d/.test(cls)) return false;
      if (/^(_|css-|v-|jsx-|ng-)/.test(cls)) return false;
      if (cls.includes('__') && cls.length > 20) return false;
      return true;
    });
  }

  function normalizeText(value, maxLength = 180) {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ');
    return normalized.length > maxLength ? normalized.substring(0, maxLength) : normalized;
  }

  function describeElement(el) {
    if (!el || !el.tagName) return '';
    const idPart = isStableId(el.id) ? `#${el.id}` : '';
    const cls = stableClasses(el.classList).slice(0, 2);
    return `${el.tagName.toLowerCase()}${idPart}${cls.length ? '.' + cls.join('.') : ''}`;
  }

  function isLayerContainer(el) {
    if (el.tagName === 'DIALOG') return true;
    const role = el.getAttribute('role');
    if (role === 'dialog' || role === 'alertdialog' || el.getAttribute('aria-modal') === 'true') return true;
    const tokens = Array.from(el.classList || []);
    if (!tokens.some(token => LAYER_TOKEN.test(token))) return false;
    const position = window.getComputedStyle(el).position;
    return position === 'fixed' || position === 'absolute';
  }

  /** 返回元素所在的弹窗/抽屉/下拉浮层容器，不在浮层内返回 null */
  function findModal(el) {
    for (let curr = el ? el.parentElement : null; curr; curr = curr.parentElement) {
      if (curr === document.body || curr === document.documentElement) break;
      if (isLayerContainer(curr)) return curr;
    }
    return null;
  }

  function modalTitle(modal) {
    if (!modal) return '';
    const labelId = modal.getAttribute('aria-labelledby');
    const labelEl = labelId ? document.getElementById(labelId) : null;
    if (labelEl) return normalizeText(labelEl.textContent, 40);
    if (modal.getAttribute('aria-label')) return normalizeText(modal.getAttribute('aria-label'), 40);
    const titleEl = modal.querySelector('[class*="title"], h1, h2, h3, h4');
    return titleEl ? normalizeText(titleEl.textContent, 40) : '';
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (el.offsetParent === null && style.position !== 'fixed' && style.position !== 'sticky') return false;
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  /**
   * 判断元素在当前视口中的真实可见状态：
   * visible 可见 / occluded 被弹窗或遮罩完全盖住 / offscreen 在视口外 / hidden 不可见
   */
  function occlusionState(el) {
    if (!isElementVisible(el)) return 'hidden';
    const rect = el.getBoundingClientRect();
    const left = Math.max(rect.left, 0);
    const right = Math.min(rect.right, window.innerWidth);
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    if (right - left < 1 || bottom - top < 1) return 'offscreen';
    const w = right - left;
    const h = bottom - top;
    const points = [[left + w / 2, top + h / 2], [left + w * 0.2, top + h * 0.2], [left + w * 0.8, top + h * 0.8]];
    for (const [x, y] of points) {
      const hit = document.elementsFromPoint(x, y).find(node => !isPluginNode(node));
      // 命中自身、后代或祖先（自身 pointer-events:none 时）都视为未被遮挡
      if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return 'visible';
    }
    return 'occluded';
  }

  /** 过滤并脱敏 URL 中的长 Token 及敏感凭证 */
  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const isRelative = !rawUrl.includes('://');
      const urlObj = new URL(isRelative ? 'http://pixpage.local' + (rawUrl.startsWith('/') ? '' : '/') + rawUrl : rawUrl);
      for (const key of Array.from(urlObj.searchParams.keys())) {
        if (SENSITIVE_QUERY_KEYS.includes(key.toLowerCase())) urlObj.searchParams.delete(key);
      }
      // hash 内部可能携带 query 参数 (例如 #/Analysis?token=xxx)
      if (urlObj.hash && urlObj.hash.includes('?')) {
        const [hashPath, hashQuery] = urlObj.hash.split('?');
        const hashParams = new URLSearchParams(hashQuery);
        for (const key of Array.from(hashParams.keys())) {
          if (SENSITIVE_QUERY_KEYS.includes(key.toLowerCase())) hashParams.delete(key);
        }
        const cleanQuery = hashParams.toString();
        urlObj.hash = cleanQuery ? `${hashPath}?${cleanQuery}` : hashPath;
      }
      if (isRelative) return urlObj.pathname + urlObj.search + urlObj.hash;
      return urlObj.origin + urlObj.pathname + urlObj.search + urlObj.hash;
    } catch (e) {
      return rawUrl.replace(/([?&])(token|tokenRefreshAt|access_token|auth|ticket|jwt)=[^&#]*/gi, '$1');
    }
  }

  function currentPath() {
    return sanitizeUrl(window.location.pathname + window.location.hash);
  }

  // 同一 iframe 文档重建后用于重新认领元素：origin + pathname + name
  function frameKey() {
    if (window === window.top) return 'top';
    try {
      return `${window.location.origin}${window.location.pathname}|${window.name || ''}`;
    } catch (e) {
      return '';
    }
  }

  PP.dom = {
    HOST_ID, isPluginNode, isStableId, stableClasses, normalizeText, describeElement,
    findModal, modalTitle, isElementVisible, occlusionState, sanitizeUrl, currentPath, frameKey
  };
})();
