/**
 * app/App.tsx —— 应用外壳：顶部导航 + 路由 + 全局「添加书籍」弹窗。
 */
import { FolderTree, Library, Plus, Tags } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AddBookModal } from '../features/douban/AddBookModal';
import { BackToTop } from '../components/BackToTop';
import { ShelfPage } from '../features/shelf/ShelfPage';
import { TagsPage } from '../features/tags/TagsPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { useRefresh } from './refresh';
import logoUrl from '../assets/logo.png';

function navClass(isActive: boolean): string {
  return `nav-tab${isActive ? ' active' : ''}`;
}

/** 滑动高亮块的位置与宽度（由激活按钮实测得到） */
interface NavIndicator {
  x: number;
  w: number;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const refresh = useRefresh();
  const [addOpen, setAddOpen] = useState(false);

  // 导航高亮不是画在按钮上，而是一块独立的高亮块，
  // 切换路由时用 transform 平移过去，形成「滑动」效果。
  const navRef = useRef<HTMLElement | null>(null);
  const [indicator, setIndicator] = useState<NavIndicator | null>(null);

  const measureNav = useCallback(() => {
    const active = navRef.current?.querySelector<HTMLElement>('.nav-tab.active');
    if (!active) return;
    setIndicator({ x: active.offsetLeft, w: active.offsetWidth });
  }, []);

  // 路由变化后（按钮的 active 类已更新）在绘制前重新量位，切换即滑动
  useLayoutEffect(() => {
    measureNav();
  }, [measureNav, location.pathname]);

  useEffect(() => {
    window.addEventListener('resize', measureNav);
    // 字体加载完成后按钮宽度会变，补量一次
    if (document.fonts) document.fonts.ready.then(measureNav).catch(() => {});
    return () => window.removeEventListener('resize', measureNav);
  }, [measureNav]);

  /** 「保存到书架」成功后：跳回书架并触发全局数据刷新 */
  const handleBookSaved = () => {
    setAddOpen(false);
    navigate('/');
    refresh();
  };

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand" title="返回书架">
            <img src={logoUrl} className="brand-icon" alt="Papyrus" />
          </Link>
          <nav className="nav-tabs" ref={navRef}>
            {indicator ? (
              <span
                className="nav-tabs-indicator"
                aria-hidden="true"
                style={{ transform: `translateX(${indicator.x}px)`, width: `${indicator.w}px` }}
              />
            ) : null}
            <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
              <Library size={15} />
              <span className="nav-tab-text">书架</span>
            </NavLink>
            <NavLink to="/tags" className={({ isActive }) => navClass(isActive)}>
              <Tags size={15} />
              <span className="nav-tab-text">标签</span>
            </NavLink>
            <NavLink to="/categories" className={({ isActive }) => navClass(isActive)}>
              <FolderTree size={15} />
              <span className="nav-tab-text">分类</span>
            </NavLink>
          </nav>
          <div className="header-actions">
            {/* 图标按钮：圆形加号，悬停 / 聚焦时浮出「添加书籍」气泡 */}
            <button
              type="button"
              className="btn btn-primary btn-icon-only"
              onClick={() => setAddOpen(true)}
              aria-label="添加书籍"
            >
              <Plus size={18} strokeWidth={2.4} />
              <span className="btn-tooltip" role="tooltip">
                添加书籍
              </span>
            </button>
          </div>
        </div>
      </header>

      <main id="app" className="app-main">
        <Routes>
          <Route path="/" element={<ShelfPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AddBookModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={handleBookSaved} />

      <BackToTop />
    </>
  );
}
