// content/relink.js - SPA DOM 重建 / 页面刷新后的元素重连引擎与路由工具
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const dom = PP.dom;
  const STRONG_ATTRS = [
    'data-testid', 'data-qa', 'data-action', 'data-test', 'data-cy',
    'id', 'name', 'placeholder', 'alt', 'title', 'aria-label'
  ];

  // ---- 路由工具 ----
  function normalizeRoute(p) {
    const [documentPath, hash = ''] = String(p).split('#');
    return documentPath.split('?')[0].replace(/\/+$/, '') + '#' + hash.split('?')[0].replace(/\/+$/, '');
  }

  function isRouteDifferent(targetPath, currentPath = dom.currentPath()) {
    if (!targetPath || !currentPath) return false;
    return normalizeRoute(targetPath) !== normalizeRoute(currentPath);
  }

  function getRouteName(path) {
    if (!path) return '原页面';
    const part = path.includes('#') ? path.split('#')[1] : path;
    const segs = part.split('?')[0].split('/').filter(Boolean);
    return segs[segs.length - 1] || '原页面';
  }

  // 仅在同一文档内切换 SPA 路由，绝不整页跳转到其他站点
  function navigateToRoute(targetPath) {
    if (!targetPath) return;
    try {
      if (targetPath.includes('#')) {
        const targetHash = '#' + targetPath.split('#')[1];
        if (window.location.hash !== targetHash) window.location.hash = targetHash;
      } else if (window.history && window.history.pushState) {
        window.history.pushState(null, '', targetPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (e) {
      PP.log.warn('relink.navigate', e);
    }
  }

  // ---- 候选校验 ----
  function isValidCandidate(el, data) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE || dom.isPluginNode(el)) return false;
    if (el.tagName.toLowerCase() !== data.tag.toLowerCase()) return false;
    if (!dom.isElementVisible(el)) return false;
    // 坚决禁止将 body / html / 全局挂载节点当作目标
    if (el === document.body || el === document.documentElement) return false;
    if (el.id && ['app', 'root', '__nuxt', 'layout', 'main'].includes(el.id.toLowerCase())) return false;

    const g = data.geometry;
    if (g && g.width > 0 && g.height > 0) {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const originalFull = g.width >= vw * 0.85 && g.height >= vh * 0.85;
      const candidateFull = rect.width >= vw * 0.85 && rect.height >= vh * 0.85;
      if (candidateFull && !originalFull) return false;
      // 面积膨胀超过 30 倍的粗粒度父级节点剔除
      if (g.width < vw * 0.6 && g.height < vh * 0.6 &&
          rect.width * rect.height > g.width * g.height * 30 && rect.width * rect.height > 60000) {
        return false;
      }
    }
    return true;
  }

  // 弹窗内拾取的元素不能重连到弹窗外的同名节点，反之亦然（修复「元素信息映射到弹窗上」）
  function isModalConsistent(el, data) {
    const fp = data.locatorFingerprint;
    if (!fp || fp.version < 2 || !data.context) return true;
    return Boolean(dom.findModal(el)) === Boolean(data.context.isInsideModal);
  }

  function textSimilarity(left, right) {
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.includes(right) || right.includes(left)) {
      return Math.min(left.length, right.length) / Math.max(left.length, right.length);
    }
    const tokens = text => new Set(text.split(/[\s,，;；|/]+/).filter(token => token.length > 1));
    const leftTokens = tokens(left);
    const rightTokens = tokens(right);
    if (leftTokens.size && rightTokens.size) {
      let common = 0;
      leftTokens.forEach(token => { if (rightTokens.has(token)) common++; });
      const similarity = common / Math.max(leftTokens.size, rightTokens.size);
      if (similarity > 0) return similarity;
    }
    // 中文及无空格业务文本使用双字符片段兜底，允许表格行中金额/日期局部变化
    const bigrams = text => {
      const compact = text.replace(/\s+/g, '');
      const grams = new Set();
      for (let i = 0; i < compact.length - 1; i++) grams.add(compact.substring(i, i + 2));
      return grams;
    };
    const leftGrams = bigrams(left);
    const rightGrams = bigrams(right);
    if (!leftGrams.size || !rightGrams.size) return 0;
    let common = 0;
    leftGrams.forEach(gram => { if (rightGrams.has(gram)) common++; });
    return common / Math.max(leftGrams.size, rightGrams.size);
  }

  function evaluateIdentity(el, data) {
    const fp = data.locatorFingerprint || {};
    const hasFingerprint = Boolean(data.locatorFingerprint);
    const originalAttributes = fp.stableAttributes || data.attributes || {};
    let score = 0;
    let hasStrongIdentity = false;
    let hardConflict = false;

    STRONG_ATTRS.forEach(name => {
      // 旧会话保存的是完整 attributes，动态组件 ID 不应被误当作稳定身份
      if (!hasFingerprint && name === 'id' && !(data.selectors && data.selectors.id)) return;
      const originalValue = originalAttributes[name];
      if (!originalValue) return;
      if ((el.getAttribute(name) || '') === originalValue) {
        score += 240;
        hasStrongIdentity = true;
      } else {
        hardConflict = true;
      }
    });

    const originalText = dom.normalizeText(fp.text || data.fullText || data.text || '');
    const candidateText = dom.normalizeText(el.innerText || el.textContent || '');
    const similarity = textSimilarity(originalText, candidateText);
    if (originalText) {
      if (similarity === 1) score += 160;
      else if (similarity >= 0.65) score += Math.round(90 * similarity);
      else if (!hasStrongIdentity && data.selectors && data.selectors.xpath) hardConflict = true;
    }

    const expectedClasses = Array.isArray(fp.classes) && fp.classes.length
      ? fp.classes
      : String((data.attributes && data.attributes.class) || '').split(/\s+/).filter(Boolean);
    const candidateClasses = dom.stableClasses(el.classList);
    const classOverlap = expectedClasses.filter(cls => candidateClasses.includes(cls)).length;
    score += classOverlap * 24;
    if (expectedClasses.length > 0 && classOverlap === 0) score -= 45;

    let current = el.parentElement;
    (Array.isArray(fp.ancestors) ? fp.ancestors : []).forEach(expected => {
      if (!current) return;
      if (current.tagName.toLowerCase() === expected.tag) score += 6;
      if (expected.id) score += current.id === expected.id ? 100 : -80;
      if (expected.role) score += current.getAttribute('role') === expected.role ? 35 : -20;
      const actualClasses = dom.stableClasses(current.classList);
      score += (expected.classes || []).filter(cls => actualClasses.includes(cls)).length * 15;
      score += Math.round(textSimilarity(
        dom.normalizeText(expected.text || ''),
        dom.normalizeText(current.innerText || current.textContent || '')
      ) * 55);
      current = current.parentElement;
    });

    return { score, hardConflict, hasStrongIdentity, textSimilarity: similarity };
  }

  function isSemanticCandidate(el, data) {
    if (!isValidCandidate(el, data) || !isModalConsistent(el, data)) return false;
    const identity = evaluateIdentity(el, data);
    if (identity.hardConflict) return false;
    if (!data.locatorFingerprint) {
      const originalText = dom.normalizeText(data.fullText || data.text || '');
      if (!originalText) return true;
      return textSimilarity(originalText, dom.normalizeText(el.innerText || el.textContent || '')) >= 0.65;
    }
    return identity.hasStrongIdentity || identity.textSimilarity >= 0.65 || identity.score >= 45;
  }

  // 只在通过语义校验的候选中择优；全部不通过时返回 null，绝不退回 candidates[0]
  function selectBest(candidates, data) {
    const accepted = candidates.filter(el => isSemanticCandidate(el, data));
    if (accepted.length <= 1) return accepted[0] || null;
    const g = data.geometry || {};
    let best = null;
    let minPenalty = Infinity;
    accepted.forEach(el => {
      const rect = el.getBoundingClientRect();
      let penalty = -evaluateIdentity(el, data).score * 2;
      if (g.width && g.height) penalty += (Math.abs(rect.width - g.width) + Math.abs(rect.height - g.height)) * 2;
      if (g.left !== undefined && g.top !== undefined) penalty += Math.hypot(rect.left - g.left, rect.top - g.top);
      if (penalty < minPenalty) {
        minPenalty = penalty;
        best = el;
      }
    });
    return best;
  }

  function queryAll(selector) {
    try { return Array.from(document.querySelectorAll(selector)); } catch (e) { return []; }
  }

  /**
   * 在当前文档中寻回与采集数据对应的存活节点。
   * ignoreRoute=true 用于定位流程中路由已切换完成后的强制查找。
   */
  function findLivingElement(data, ignoreRoute = false) {
    if (!data || !data.tag) return null;
    if (!ignoreRoute && data.context && isRouteDifferent(data.context.path)) return null;
    const selectors = data.selectors || {};

    const strategies = [
      () => selectors.testId && queryAll(selectors.testId),
      () => selectors.id && queryAll(selectors.id),
      () => {
        if (!selectors.xpath) return null;
        try {
          const snapshot = document.evaluate(selectors.xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const nodes = [];
          for (let i = 0; i < snapshot.snapshotLength; i++) nodes.push(snapshot.snapshotItem(i));
          return nodes;
        } catch (e) { return null; }
      },
      () => selectors.attr && queryAll(selectors.attr),
      () => {
        const targetText = data.fullText || data.text;
        if (!targetText) return null;
        return queryAll(data.tag).filter(el => {
          const t = dom.normalizeText(el.innerText || el.textContent || '', 2000);
          return t === targetText || (data.text && (t === data.text || (el.children.length === 0 && t.includes(data.text))));
        });
      },
      () => selectors.precisePath && queryAll(selectors.precisePath),
      () => selectors.fullPath && queryAll(selectors.fullPath)
    ];

    for (const strategy of strategies) {
      const candidates = strategy();
      if (!candidates || candidates.length === 0) continue;
      const best = selectBest(candidates, data);
      if (best) return best;
    }
    return null;
  }

  PP.relink = {
    isRouteDifferent, getRouteName, navigateToRoute,
    isValidCandidate, isSemanticCandidate, findLivingElement
  };
})();
