// content/ui-shadow.js - 每个 Frame 的 Shadow DOM 覆盖层：悬停高亮、拾取篮常驻框、Toast、剪贴板
// 首次激活时才创建宿主节点（懒加载），未使用插件的页面不会多出任何 DOM。
(function() {
  const PP = window.__PixPagePicker;
  if (PP.__skip) return;

  const dom = PP.dom;

  class Overlay {
    constructor() {
      this.host = null;
      this.root = null;
      this.mask = null;
      this.tip = null;
      this.pinLayer = null;
      this.toastEl = null;
      this.toastTimer = null;
      this.pinEls = new Map();
    }

    ensure() {
      if (this.root) {
        // 部分 SPA 会整体替换 <html> 的子节点，宿主丢失时重新挂载
        if (!this.host.isConnected) document.documentElement.appendChild(this.host);
        return this.root;
      }
      this.host = document.createElement('div');
      this.host.id = dom.HOST_ID;
      this.host.setAttribute('style', 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;');
      this.root = this.host.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = PP.uiStyles;
      this.root.appendChild(style);

      this.pinLayer = this.el('div', 'pp-pins');
      this.mask = this.el('div', 'pp-mask');
      this.tip = this.el('div', 'pp-tip');
      this.tip.setAttribute('aria-hidden', 'true');
      this.toastEl = this.el('div', 'pp-toast');
      this.toastEl.setAttribute('role', 'status');
      this.toastEl.setAttribute('aria-live', 'polite');
      this.root.append(this.pinLayer, this.mask, this.tip, this.toastEl);

      document.documentElement.appendChild(this.host);
      return this.root;
    }

    el(tag, className) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      return node;
    }

    showHover(el, info) {
      this.ensure();
      const rect = el.getBoundingClientRect();
      Object.assign(this.mask.style, {
        top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`
      });
      this.mask.classList.add('is-visible');
      this.mask.classList.toggle('is-selected', Boolean(info.selected));

      const tag = `<${el.tagName.toLowerCase()}${info.classHint || ''}>`;
      const layer = info.layerTotal > 1 ? ` · 层 ${info.layerIndex + 1}/${info.layerTotal}` : '';
      const hint = info.selected ? '已在拾取篮 · 点击移除' : '点击加入';
      this.tip.innerHTML = '';
      const tagSpan = this.el('span', 'pp-tip-tag');
      tagSpan.textContent = tag;
      const sizeSpan = this.el('span', 'pp-tip-size');
      sizeSpan.textContent = `${Math.round(rect.width)}×${Math.round(rect.height)}${layer}`;
      const hintSpan = this.el('span', `pp-tip-hint${info.selected ? ' is-selected' : ''}`);
      hintSpan.textContent = hint;
      this.tip.append(tagSpan, sizeSpan, hintSpan);

      let top = rect.top - 30;
      if (top < 6) top = Math.min(rect.bottom + 6, window.innerHeight - 30);
      this.tip.style.top = `${Math.max(6, top)}px`;
      this.tip.style.left = `${Math.max(6, Math.min(rect.left, window.innerWidth - 240))}px`;
      this.tip.classList.add('is-visible');
    }

    hideHover() {
      if (!this.mask) return;
      this.mask.classList.remove('is-visible');
      this.tip.classList.remove('is-visible');
    }

    /** entries: [{ id, idx, rect, occluded }]，未出现在 entries 中的框会被移除 */
    drawPins(entries) {
      if (!entries.length && !this.pinEls.size) return;
      this.ensure();
      const seen = new Set();
      entries.forEach(entry => {
        seen.add(entry.id);
        let box = this.pinEls.get(entry.id);
        if (!box) {
          box = this.el('div', 'pp-pin');
          const badge = this.el('div', 'pp-pin-badge');
          box.appendChild(badge);
          this.pinLayer.appendChild(box);
          this.pinEls.set(entry.id, box);
        }
        const { rect } = entry;
        Object.assign(box.style, {
          top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`
        });
        box.classList.toggle('is-occluded', entry.occluded);
        box.classList.toggle('is-below', rect.top < 24);
        box.firstChild.textContent = `${entry.idx + 1}${entry.occluded ? ' · 被遮挡' : ''}`;
        box.title = '';
      });
      this.pinEls.forEach((box, id) => {
        if (!seen.has(id)) {
          box.remove();
          this.pinEls.delete(id);
        }
      });
    }

    pulse(id) {
      const box = this.pinEls.get(id);
      if (!box) return;
      box.classList.remove('is-pulse');
      void box.offsetWidth;
      box.classList.add('is-pulse');
      setTimeout(() => box.classList.remove('is-pulse'), 1300);
    }

    toast(msg, tone = 'ok') {
      if (window !== window.top) {
        PP.runtime.bus.send('top', 'toast', { msg, tone });
        return;
      }
      this.ensure();
      const iconName = tone === 'error' || tone === 'warn' ? 'alert' : tone === 'info' ? 'info' : 'check';
      this.toastEl.className = `pp-toast tone-${tone}`;
      this.toastEl.innerHTML = PP.icon(iconName, 16);
      const text = document.createElement('span');
      text.textContent = msg;
      this.toastEl.appendChild(text);
      void this.toastEl.offsetWidth;
      this.toastEl.classList.add('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toastEl.classList.remove('is-visible'), tone === 'error' ? 4000 : 2400);
    }

    async copy(text, successMsg) {
      if (!text) return false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          this.toast(successMsg);
          return true;
        }
      } catch (e) {
        PP.log.debug('clipboard.writeText', e);
      }
      // iframe 受 Permissions-Policy 限制时，execCommand 在用户手势内仍可用
      try {
        this.ensure();
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        this.root.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        if (ok) {
          this.toast(successMsg);
          return true;
        }
      } catch (e) {
        PP.log.warn('clipboard.execCommand', e);
      }
      PP.log.error('clipboard.failed', { length: text.length });
      this.toast('复制失败，请检查浏览器剪贴板权限', 'error');
      return false;
    }

    hideToast() {
      clearTimeout(this.toastTimer);
      if (this.toastEl) this.toastEl.classList.remove('is-visible');
    }

    clear() {
      this.hideHover();
      this.drawPins([]);
    }

    destroy() {
      clearTimeout(this.toastTimer);
      if (this.host) this.host.remove();
      this.host = null;
      this.root = null;
      this.pinEls.clear();
    }
  }

  PP.overlay = new Overlay();
})();
