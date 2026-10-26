// content/selector.js - 智能复合选择器与定位器生成引擎
(function() {
  if (window.__PixPagePicker.__skip) return;

  const { isStableId, stableClasses: filterCleanClasses } = window.__PixPagePicker.dom;

  /**
   * 转义 XPath 字符串
   */
  function escapeXPathString(str) {
    if (!str.includes('"')) return `"${str}"`;
    if (!str.includes("'")) return `'${str}'`;
    return `concat("${str.replace(/"/g, '", \'"\', "')}")`;
  }

  /**
   * 生成精确的基于兄弟层级索引的结构化 CSS 选择器 (用于 SPA 页面切回后的活节点精准寻回)
   */
  function generatePrecisePath(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
    const parts = [];
    let curr = el;
    let depth = 0;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && depth < 8) {
      if (curr === document.body || curr === document.documentElement) break;
      const tag = curr.tagName.toLowerCase();
      if (curr.id && isStableId(curr.id)) {
        parts.unshift(`${tag}#${curr.id}`);
        break; // 遇到稳定 ID 作为根锚点截断
      }

      // 计算当前元素在父级中同名标签的索引 :nth-of-type(k)
      let index = 1;
      let sibling = curr.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === curr.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const cleanClasses = filterCleanClasses(curr.classList);
      const classSuffix = cleanClasses.length > 0 ? `.${cleanClasses[0]}` : '';
      parts.unshift(`${tag}${classSuffix}:nth-of-type(${index})`);

      curr = curr.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  /**
   * 生成复合定位选择器
   */
  function generateSelectors(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) {
      return { css: '', xpath: '', playwright: '', fullPath: '' };
    }

    const tagName = el.tagName.toLowerCase();
    const selectors = {
      testId: null,
      id: null,
      xpath: null,
      playwright: null,
      attr: null,
      css: null,
      fullPath: null
    };

    // 1. 测试标识 (data-testid, data-qa, data-action, data-test)
    const testAttrs = ['data-testid', 'data-qa', 'data-action', 'data-test', 'data-cy'];
    for (const attr of testAttrs) {
      if (el.hasAttribute(attr)) {
        const val = el.getAttribute(attr);
        selectors.testId = `[${attr}="${val}"]`;
        selectors.playwright = `page.locator('[${attr}="${val}"]')`;
        break;
      }
    }

    // 2. 稳定语义 ID
    if (el.id && isStableId(el.id)) {
      selectors.id = `#${el.id}`;
      if (!selectors.playwright) {
        selectors.playwright = `page.locator('#${el.id}')`;
      }
    }

    // 3. 语义文本 XPath & Playwright locator (适用于 button, a, span, label 等文本元素)
    const rawText = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (rawText && rawText.length > 0 && rawText.length <= 50) {
      const cleanText = rawText.replace(/"/g, '\\"');
      // 关键防线：增加 not(.//${tagName}) 确保仅匹配同名标签中的叶子节点，严禁匹配包含子同名标签的父级大容器 (如 div#app)
      selectors.xpath = `//${tagName}[not(.//${tagName}) and contains(normalize-space(.), ${escapeXPathString(rawText)})]`;
      if (!selectors.playwright) {
        selectors.playwright = `page.locator("${tagName}:has-text('${cleanText}')")`;
      }
    }

    // 4. 输入类与关键语义属性定位器 (placeholder / name / alt / title / aria-label)
    if (['input', 'textarea', 'select'].includes(tagName)) {
      if (el.placeholder) {
        selectors.attr = `${tagName}[placeholder="${el.placeholder}"]`;
        if (!selectors.playwright) {
          selectors.playwright = `page.getByPlaceholder("${el.placeholder}")`;
        }
      } else if (el.name) {
        selectors.attr = `${tagName}[name="${el.name}"]`;
        if (!selectors.playwright) {
          selectors.playwright = `page.locator('${tagName}[name="${el.name}"]')`;
        }
      }
    } else if (el.getAttribute('alt')) {
      const altVal = el.getAttribute('alt');
      selectors.attr = `${tagName}[alt="${altVal}"]`;
      if (!selectors.playwright) {
        selectors.playwright = tagName === 'img' ? `page.getByAltText("${altVal}")` : `page.locator('${tagName}[alt="${altVal}"]')`;
      }
    } else if (el.getAttribute('title')) {
      const titleVal = el.getAttribute('title');
      selectors.attr = `${tagName}[title="${titleVal}"]`;
      if (!selectors.playwright) {
        selectors.playwright = `page.getByTitle("${titleVal}")`;
      }
    } else if (el.getAttribute('aria-label')) {
      const ariaVal = el.getAttribute('aria-label');
      selectors.attr = `${tagName}[aria-label="${ariaVal}"]`;
      if (!selectors.playwright) {
        selectors.playwright = `page.getByLabel("${ariaVal}")`;
      }
    }

    // 5. 过滤后的干净类名
    const cleanClasses = filterCleanClasses(el.classList);
    if (cleanClasses.length > 0) {
      selectors.css = `${tagName}.${cleanClasses.slice(0, 3).join('.')}`;
    } else {
      selectors.css = tagName;
    }

    // 6. 祖先路径链路 (向父级回溯 2~3 层构建稳定链路)
    const pathParts = [];
    let curr = el;
    let depth = 0;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && depth < 3) {
      if (curr === document.body || curr === document.documentElement) break;
      const tag = curr.tagName.toLowerCase();
      let part = tag;
      if (curr.id && isStableId(curr.id)) {
        part += `#${curr.id}`;
        pathParts.unshift(part);
        break; // 遇到有效 ID 可作为根起点终止
      } else {
        const cls = filterCleanClasses(curr.classList);
        if (cls.length > 0) {
          part += `.${cls[0]}`;
        }
      }
      pathParts.unshift(part);
      curr = curr.parentElement;
      depth++;
    }
    selectors.fullPath = pathParts.join(' > ');
    selectors.precisePath = generatePrecisePath(el);

    // 默认兜底 Playwright 定位器
    if (!selectors.playwright) {
      selectors.playwright = `page.locator("${selectors.testId || selectors.id || selectors.css || tagName}")`;
    }

    // 如果处于 iframe 内部，自动生成跨 frame 定位的 Playwright 语句
    const isIframe = (window !== window.top);
    if (isIframe) {
      let frameQuery = 'iframe';
      if (window.name) {
        frameQuery = `iframe[name="${window.name}"]`;
      } else {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 2) {
          frameQuery = `iframe[src*="${lastPart}"]`;
        }
      }
      const innerTarget = selectors.testId || selectors.id || selectors.css || tagName;
      selectors.playwrightFrame = `page.frameLocator('${frameQuery}').locator('${innerTarget}')`;
    }

    return selectors;
  }

  window.__PixPagePicker.generateSelectors = generateSelectors;
  window.__PixPagePicker.generatePrecisePath = generatePrecisePath;
})();
