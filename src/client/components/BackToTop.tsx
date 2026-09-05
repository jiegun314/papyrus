/**
 * components/BackToTop.tsx —— 右下角「回到顶部」浮动按钮。
 * 页面向下滚动超出一定距离后浮现，点击平滑回到页首。
 */
import { useCallback, useEffect, useState } from 'react';

/** 滚动超过该像素高度时显示按钮 */
const SHOW_THRESHOLD = 480;

export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > SHOW_THRESHOLD;
      setShow((prev) => (prev === next ? prev : next));
    };
    // 页面初始渲染即可定位（例如从其他路由切回时仍处于滚动状态）
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      className={`back-to-top${show ? ' show' : ''}`}
      onClick={handleClick}
      title="回到顶部"
      aria-label="回到顶部"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
