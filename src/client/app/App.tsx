/**
 * app/App.tsx —— 应用外壳：顶部导航 + 路由 + 全局「添加书籍」弹窗。
 */
import { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AddBookModal } from '../features/douban/AddBookModal';
import { LendingsPage } from '../features/lendings/LendingsPage';
import { ShelfPage } from '../features/shelf/ShelfPage';
import { TagsPage } from '../features/tags/TagsPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { PapyrusMark } from '../components/PapyrusMark';
import { useRefresh } from './refresh';

function navClass(isActive: boolean): string {
  return `nav-tab${isActive ? ' active' : ''}`;
}

export function App() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [addOpen, setAddOpen] = useState(false);

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
            <PapyrusMark className="brand-icon" />
            <span className="brand-name">Papyrus</span>
            <span className="brand-sub">个人书斋</span>
          </Link>
          <nav className="nav-tabs">
            <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
              书架
            </NavLink>
            <NavLink to="/lendings" className={({ isActive }) => navClass(isActive)}>
              借阅记录
            </NavLink>
            <NavLink to="/tags" className={({ isActive }) => navClass(isActive)}>
              标签
            </NavLink>
            <NavLink to="/categories" className={({ isActive }) => navClass(isActive)}>
              分类
            </NavLink>
          </nav>
          <div className="header-actions">
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              ＋ 添加书籍
            </button>
          </div>
        </div>
      </header>

      <main id="app" className="app-main">
        <Routes>
          <Route path="/" element={<ShelfPage />} />
          <Route path="/lendings" element={<LendingsPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AddBookModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={handleBookSaved} />
    </>
  );
}
