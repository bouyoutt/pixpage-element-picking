// content/extractor.js - 元素参数、几何尺寸与上下文抽取器
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const dom = PP.dom;
  const REDACTED = '[已脱敏]';
  // 注入 Prompt 的属性白名单之外的噪声属性
  const NOISY_ATTRS = new Set(['style']);

  /** 密码框、信用卡、一次性验证码等输入框的值绝不能进入 Prompt */
  function isSensitiveField(el) {
    if (!el || !el.getAttribute) return false;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'password') return true;
    const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (/^(cc-|one-time-code|current-password|new-password)/.test(autocomplete)) return true;
    const hint = `${el.getAttribute('name') || ''} ${el.id || ''}`.toLowerCase();
    return /(password|passwd|pwd|secret|token|cvv|cvc|otp)/.test(hint);
  }

  /** 探测最近的弹窗/浮层容器与业务语义容器 */
  function detectParentContainer(el) {
    const modal = dom.findModal(el);
    let semantic = null;
    for (let curr = el ? el.parentElement : null; curr && curr !== document.body; curr = curr.parentElement) {
      const cls = typeof curr.className === 'string' ? curr.className : '';
      const tag = curr.tagName.toLowerCase();
      if (/card|panel|section|container|table|form|chart|view/i.test(cls) ||
          dom.isStableId(curr.id) || ['section', 'article', 'form', 'table', 'aside'].includes(tag)) {
        semantic = curr;
        break;
      }
    }
    return {
      isInsideModal: Boolean(modal),
      modalDesc: modal ? dom.describeElement(modal) : '',
      modalTitle: dom.modalTitle(modal),
      containerDesc: modal ? dom.describeElement(modal) : (semantic ? dom.describeElement(semantic) : '页面主视口 (Root)')
    };
  }

  function extractAttributes(el, sensitive) {
    const attrs = {};
    if (!el || !el.attributes) return attrs;
    for (const attr of Array.from(el.attributes)) {
      if (NOISY_ATTRS.has(attr.name)) continue;
      let val = attr.value;
      if (sensitive && attr.name === 'value') val = REDACTED;
      if (val && val.length > 120) val = val.substring(0, 117) + '...';
      attrs[attr.name] = val;
    }
    return attrs;
  }

  /** 裁剪后的 outerHTML：保留标签与前若干个子节点，脱敏 value、去除 style */
  function buildHtmlSnippet(el, sensitive) {
    try {
      const clone = el.cloneNode(true);
      const scrub = node => {
        node.removeAttribute && node.removeAttribute('style');
        if (sensitive && node.hasAttribute && node.hasAttribute('value')) node.setAttribute('value', REDACTED);
        Array.from(node.querySelectorAll ? node.querySelectorAll('svg, script, style') : [])
          .forEach(child => child.replaceWith(document.createComment(` ${child.tagName.toLowerCase()} `)));
      };
      scrub(clone);
      Array.from(clone.querySelectorAll('*')).forEach(node => node.removeAttribute('style'));
      let html = clone.outerHTML.replace(/\s+/g, ' ').replace(/> </g, '><');
      if (html.length > 600) html = html.substring(0, 580) + ' …(已截断)';
      return html;
    } catch (e) {
      PP.log.warn('extract.htmlSnippet', e);
      return '';
    }
  }

  function buildAncestorChain(el) {
    const chain = [];
    for (let curr = el.parentElement, depth = 0; curr && curr !== document.body && depth < 4; curr = curr.parentElement, depth++) {
      chain.unshift(dom.describeElement(curr));
    }
    return chain.join(' > ');
  }

  /** 统计 CSS / XPath 选择器在当前文档中的命中数量，帮助 AI 判断定位器是否唯一 */
  function countMatches(selectors) {
    const counts = {};
    const css = { testId: selectors.testId, id: selectors.id, attr: selectors.attr, css: selectors.css, fullPath: selectors.fullPath };
    Object.keys(css).forEach(key => {
      if (!css[key]) return;
      try { counts[key] = document.querySelectorAll(css[key]).length; } catch (e) { /* 非法选择器忽略 */ }
    });
    if (selectors.xpath) {
      try {
        counts.xpath = document.evaluate(selectors.xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
      } catch (e) { /* 非法表达式忽略 */ }
    }
    return counts;
  }

  // 文本定位器命中多个元素时，推荐定位改用唯一匹配的 CSS 选择器
  function preferUniqueLocator(selectors, counts) {
    if (!selectors.playwright || !selectors.playwright.includes(':has-text(') || !(counts.xpath > 1)) return;
    const unique = ['testId', 'id', 'attr', 'fullPath', 'css'].find(key => selectors[key] && counts[key] === 1);
    if (unique) selectors.playwright = `page.locator(${JSON.stringify(selectors[unique])})`;
  }

  /**
   * 保存用于 SPA DOM 重建后重连的轻量语义指纹。
   * 不依赖坐标或 nth-of-type，避免跨路由时把相同结构位置的其他节点误认为原元素。
   */
  function extractLocatorFingerprint(el) {
    const stableAttrNames = [
      'data-testid', 'data-qa', 'data-action', 'data-test', 'data-cy',
      'id', 'name', 'placeholder', 'alt', 'title', 'aria-label', 'role', 'type'
    ];
    const stableAttributes = {};
    stableAttrNames.forEach(name => {
      const value = el.getAttribute && el.getAttribute(name);
      if (!value || (name === 'id' && !dom.isStableId(value))) return;
      stableAttributes[name] = dom.normalizeText(value, 120);
    });

    const ancestors = [];
    for (let curr = el.parentElement, depth = 0; curr && curr !== document.body && depth < 5; curr = curr.parentElement, depth++) {
      ancestors.push({
        tag: curr.tagName.toLowerCase(),
        id: dom.isStableId(curr.id) ? curr.id : '',
        role: curr.getAttribute('role') || '',
        classes: dom.stableClasses(curr.classList).slice(0, 4),
        text: dom.normalizeText(curr.innerText || curr.textContent || '')
      });
    }

    return {
      version: 2,
      text: dom.normalizeText(el.innerText || el.textContent || ''),
      classes: dom.stableClasses(el.classList).slice(0, 4),
      stableAttributes,
      ancestors
    };
  }

  /** 提取完整的元素定位、参数与环境上下文 */
  function extractElementInfo(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    const startedAt = performance.now();

    const rect = el.getBoundingClientRect();
    const tagName = el.tagName.toLowerCase();
    const containerInfo = detectParentContainer(el);
    const sensitive = isSensitiveField(el);

    const visibleText = dom.normalizeText(el.innerText || el.textContent || '', 2000);
    const shortText = visibleText.length > 80 ? visibleText.substring(0, 77) + '...' : visibleText;

    let value = el.value !== undefined && typeof el.value !== 'object' ? String(el.value) : null;
    if (sensitive && value) value = REDACTED;
    // 只有复选框/单选框的 checked 有意义
    const isCheckable = tagName === 'input' && /^(checkbox|radio)$/i.test(el.type || '');
    const isChecked = isCheckable ? el.checked : null;
    const isDisabled = el.disabled !== undefined ? el.disabled : (el.getAttribute('aria-disabled') === 'true');
    const style = window.getComputedStyle(el);

    const selectors = PP.generateSelectors ? PP.generateSelectors(el) : {};
    const matchCounts = countMatches(selectors);
    preferUniqueLocator(selectors, matchCounts);
    const isIframe = window !== window.top;
    const cleanPageUrl = dom.sanitizeUrl(window.location.href);

    const data = {
      tag: tagName,
      text: shortText,
      fullText: visibleText,
      value,
      checked: isChecked,
      disabled: isDisabled,
      sensitive,
      role: el.getAttribute('role') || '',
      htmlSnippet: buildHtmlSnippet(el, sensitive),
      ancestorChain: buildAncestorChain(el),
      geometry: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        dpr: window.devicePixelRatio || 1
      },
      // 排查样式问题最常用的计算样式
      computedStyle: {
        display: style.display,
        position: style.position,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        cursor: style.cursor
      },
      selectors,
      matchCounts,
      attributes: extractAttributes(el, sensitive),
      locatorFingerprint: extractLocatorFingerprint(el),
      context: {
        url: cleanPageUrl,
        path: dom.currentPath(),
        pageTitle: document.title,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        parentContainer: containerInfo.containerDesc,
        isInsideModal: containerInfo.isInsideModal,
        modalDesc: containerInfo.modalDesc,
        modalTitle: containerInfo.modalTitle,
        isIframe,
        frameUrl: isIframe ? cleanPageUrl : '',
        frameName: window.name || '',
        frameKey: dom.frameKey()
      }
    };

    const cost = Math.round(performance.now() - startedAt);
    if (cost > 50) PP.log.info('extract.slow', { tag: tagName, ms: cost });
    return data;
  }

  PP.extractElementInfo = extractElementInfo;
  PP.sanitizeUrl = dom.sanitizeUrl;
})();
