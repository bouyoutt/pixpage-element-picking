// content/prompt-builder.js - 拾取篮 → AI Prompt / JSON 的统一构建器（1 个与 N 个元素共用同一模板）
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const PRESETS = {
    none: { label: '仅上下文', task: '' },
    debug: {
      label: '排查交互问题',
      task: '请根据下列元素的定位信息、状态与 HTML 片段，分析交互异常（如点击无响应、元素不可见、弹窗未出现）的可能原因，并给出排查步骤与修复建议。'
    },
    playwright: {
      label: '生成 Playwright 脚本',
      task: '请按元素顺序编写 Playwright (TypeScript) 测试脚本：优先使用标注为「唯一匹配」的定位器；位于 iframe 内的元素使用 frameLocator；为关键步骤补充等待与断言。'
    },
    style: {
      label: '排查样式问题',
      task: '请根据元素的计算样式、尺寸、所属容器与 HTML 片段，分析布局或样式异常（错位、遮挡、不居中、层级）的原因，并给出 CSS 修复方案。'
    }
  };

  // 选择一个比内容中最长反引号串更长的分隔符，保证 Markdown 不被破坏
  function fenceFor(text, min) {
    const runs = String(text).match(/`+/g) || [];
    const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
    return '`'.repeat(Math.max(min, longest + 1));
  }

  function code(value) {
    const text = String(value);
    const fence = fenceFor(text, 1);
    const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
    return `${fence}${pad}${text}${pad}${fence}`;
  }

  function codeBlock(lang, value) {
    const fence = fenceFor(value, 3);
    return `${fence}${lang}\n${value}\n${fence}`;
  }

  function quote(text, max = 60) {
    const clean = String(text || '').trim().replace(/\s+/g, ' ');
    return clean.length > max ? `「${clean.substring(0, max - 1)}…」` : `「${clean}」`;
  }

  function matchLabel(count) {
    if (count === undefined) return '';
    if (count === 1) return '（唯一匹配）';
    if (count === 0) return '（当前文档未匹配）';
    return `（匹配 ${count} 个，需配合容器收窄）`;
  }

  function elementTitle(data) {
    let title = `<${data.tag}>`;
    if (data.text) title += ` ${quote(data.text, 30)}`;
    else if (data.attributes && data.attributes.placeholder) title += ` placeholder=${quote(data.attributes.placeholder, 30)}`;
    else if (data.attributes && (data.attributes['aria-label'] || data.attributes.title || data.attributes.alt)) {
      title += ` ${quote(data.attributes['aria-label'] || data.attributes.title || data.attributes.alt, 30)}`;
    }
    return title;
  }

  function locationLine(ctx) {
    const parts = [];
    if (ctx.isIframe) parts.push(`iframe ${code(ctx.frameName ? `name=${ctx.frameName}` : ctx.frameUrl)}`);
    if (ctx.isInsideModal) {
      parts.push(`弹窗/浮层${ctx.modalTitle ? ` ${quote(ctx.modalTitle, 30)}` : ''} ${code(ctx.modalDesc || ctx.parentContainer)}`);
    } else {
      parts.push(`容器 ${code(ctx.parentContainer || '页面主视口')}`);
    }
    return parts.join(' → ');
  }

  function stateLine(data) {
    const states = [];
    states.push(data.disabled ? '已禁用' : '可交互');
    if (data.checked !== null && data.checked !== undefined) states.push(data.checked ? '已勾选' : '未勾选');
    if (data.value !== null && data.value !== undefined && data.value !== '') states.push(`value=${code(data.value)}`);
    if (data.role) states.push(`role=${code(data.role)}`);
    return states.join('，');
  }

  function elementSection(item, idx, preset) {
    const data = item.data;
    const ctx = data.context || {};
    const sel = data.selectors || {};
    const counts = data.matchCounts || {};
    const lines = [`### [${idx + 1}] ${elementTitle(data)}`];

    if (item.note && item.note.trim()) lines.push(`- 备注: ${item.note.trim()}`);
    lines.push(`- 位置: ${locationLine(ctx)}`);
    lines.push(`- 状态: ${stateLine(data)}`);

    const primary = sel.playwrightFrame || sel.playwright;
    if (primary) lines.push(`- 推荐定位: ${code(primary)}`);
    const alternatives = [
      ['Test ID', sel.testId, counts.testId],
      ['ID', sel.id, counts.id],
      ['XPath', sel.xpath, counts.xpath],
      ['属性', sel.attr, counts.attr],
      ['CSS', sel.fullPath || sel.css, sel.fullPath ? counts.fullPath : counts.css]
    ].filter(([, value]) => value);
    if (alternatives.length) {
      lines.push('- 备选定位:');
      alternatives.forEach(([label, value, count]) => lines.push(`  - ${label}: ${code(value)}${matchLabel(count)}`));
    }
    if (data.ancestorChain) lines.push(`- 祖先链: ${code(data.ancestorChain)}`);
    const g = data.geometry || {};
    lines.push(`- 尺寸位置: ${g.width}×${g.height}px @ (${g.x}, ${g.y})，视口 ${ctx.viewportWidth}×${ctx.viewportHeight}`);

    if (preset === 'style' && data.computedStyle) {
      const cs = data.computedStyle;
      lines.push(`- 计算样式: ${code(`display:${cs.display}; position:${cs.position}; z-index:${cs.zIndex}; opacity:${cs.opacity}; visibility:${cs.visibility}; pointer-events:${cs.pointerEvents}`)}`);
    }
    if (data.htmlSnippet) {
      lines.push('- HTML 片段:');
      lines.push('');
      lines.push(codeBlock('html', data.htmlSnippet));
    }
    return lines.join('\n');
  }

  function pageLines(items) {
    const first = items[0].data.context || {};
    const lines = ['## 页面环境'];
    lines.push(`- 页面: ${first.pageTitle ? quote(first.pageTitle, 60) + ' ' : ''}${code(first.topUrl || first.url)}`);
    const frames = new Map();
    items.forEach(item => {
      const ctx = item.data.context || {};
      if (ctx.isIframe) frames.set(ctx.frameUrl, ctx.frameName);
    });
    frames.forEach((name, url) => lines.push(`- iframe: ${name ? `name=${code(name)} ` : ''}${code(url)}`));
    const otherPages = new Set(items.map(item => (item.data.context || {}).topPath || (item.data.context || {}).path));
    if (otherPages.size > 1) lines.push(`- 注意: 元素来自 ${otherPages.size} 个不同路由，请按备注与顺序理解操作流程`);
    return lines;
  }

  /**
   * items: [{ data, note }]；options: { question, preset }
   */
  function buildPrompt(items, options = {}) {
    if (!items || items.length === 0) return '';
    const preset = PRESETS[options.preset] ? options.preset : 'none';
    const question = (options.question || '').trim();
    const lines = ['# 页面元素上下文（由 PixPage 采集）', ''];

    if (PRESETS[preset].task || question) {
      lines.push('## 任务');
      if (PRESETS[preset].task) lines.push(PRESETS[preset].task);
      if (question) {
        if (PRESETS[preset].task) lines.push('');
        lines.push(question);
      }
      lines.push('');
    }

    lines.push(...pageLines(items), '');
    lines.push(`## 目标元素（共 ${items.length} 个，按选取顺序）`, '');
    items.forEach((item, idx) => {
      lines.push(elementSection(item, idx, preset), '');
    });
    return lines.join('\n').trimEnd() + '\n';
  }

  function buildJSON(items, options = {}) {
    const elements = (items || []).map((item, idx) => {
      const { locatorFingerprint, fullText, ...rest } = item.data;
      return { index: idx + 1, note: item.note || '', ...rest };
    });
    return JSON.stringify({
      tool: 'PixPage',
      version: PP.runtime.version,
      preset: options.preset || 'none',
      question: (options.question || '').trim(),
      count: elements.length,
      elements
    }, null, 2);
  }

  PP.prompt = { PRESETS, buildPrompt, buildJSON };
})();
