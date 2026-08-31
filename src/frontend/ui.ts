/**
 * frontend/ui.ts
 * ------------------------------------------------------------------
 * 前端 UI 辅助：HTML 转义、弹窗、Toast 提示、星级评分、加载动画。
 * 所有动态生成的 HTML 都必须经过 escapeHtml 处理，防止 XSS。
 */

/** HTML 转义，防 XSS */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 创建元素（带 class 与内容） */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- Toast 消息 ---------- */

const toastRoot = () => document.getElementById('toast-root')!;

export function toast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const t = el('div', `toast ${type}`);
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  t.innerHTML = `<span>${icon}</span><span>${esc(message)}</span>`;
  toastRoot().appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 320);
  }, 2600);
}

/* ---------- 弹窗 ---------- */

interface ModalOptions {
  title: string;
  body: HTMLElement | string;
  footer?: HTMLElement | string;
  size?: 'small' | 'medium' | '';
  onClose?: () => void;
}

/** 打开一个弹窗，返回关闭函数 */
export function openModal(opts: ModalOptions): () => void {
  const root = document.getElementById('modal-root')!;
  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', `modal ${opts.size || ''}`);
  const header = el('div', 'modal-header');
  const h2 = el('h2', undefined, opts.title);
  const closeBtn = el('button', 'modal-close', '×');
  closeBtn.setAttribute('aria-label', '关闭');
  header.append(h2, closeBtn);

  const body = el('div', 'modal-body');
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else body.appendChild(opts.body);

  modal.append(header, body);
  if (opts.footer) {
    const footer = el('div', 'modal-footer');
    if (typeof opts.footer === 'string') footer.innerHTML = opts.footer;
    else footer.appendChild(opts.footer);
    modal.appendChild(footer);
  }
  backdrop.appendChild(modal);
  root.appendChild(backdrop);

  let closed = false;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    opts.onClose?.();
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  return close;
}

/* ---------- 星级评分 ---------- */

/** 生成星级评分组件。value: 0-5，readonly 时不响应点击 */
export function starsComponent(value: number, onRate?: (v: number) => void): HTMLElement {
  const wrap = el('span', 'stars');
  if (!onRate) wrap.classList.add('readonly');
  for (let i = 1; i <= 5; i++) {
    const s = el('span', 'star', '★');
    if (value >= i - 0.25) s.classList.add('on');
    if (onRate) {
      s.addEventListener('click', () => onRate(i));
      s.addEventListener('mouseenter', () => {
        wrap.querySelectorAll('.star').forEach((st, idx) => {
          st.classList.toggle('on', idx < i);
        });
      });
      s.addEventListener('mouseleave', () => {
        wrap.querySelectorAll('.star').forEach((st, idx) => {
          st.classList.toggle('on', idx < Math.round(value));
        });
      });
    }
    wrap.appendChild(s);
  }
  return wrap;
}

/* ---------- 加载动画 ---------- */

export function loadingElement(text = '加载中…'): HTMLElement {
  const box = el('div', 'loading');
  const spin = el('div', 'spinner');
  box.append(spin, el('div', undefined, text));
  return box;
}

/* ---------- 其他 ---------- */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

export function fmtRating(avg: number | null): string {
  return avg == null ? '—' : avg.toFixed(1);
}
