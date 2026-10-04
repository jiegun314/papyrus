/**
 * main.tsx —— React 应用入口（Vite 加载 /src/main.tsx）。
 */
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './app/App';
import { antdTheme } from './app/antdTheme';
import { RefreshProvider } from './app/refresh';
import { isSnapshotMode } from './app/snapshot';
import { ToastProvider } from './components/Toast';
import './styles/style.css';

// 全局异常兜底（网络错误时给出提示，行为与旧版一致）
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
});

// 离线快照：用 file:// 打开的单文件，没有服务端路由，故改用 HashRouter；
// 同时给 body 打上标记，由样式隐藏所有写操作入口（只读浏览）。
const snapshot = isSnapshotMode();
if (snapshot) document.body.classList.add('snapshot-mode');
const Router = snapshot ? HashRouter : BrowserRouter;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('未找到 #root 挂载点');

createRoot(rootEl).render(
  <StrictMode>
    {/* antd 主题：token 全部取自现有设计变量，保证 antd 组件与手写界面同色系（不引 reset） */}
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <ToastProvider>
        <RefreshProvider>
          <Router>
            <App />
          </Router>
        </RefreshProvider>
      </ToastProvider>
    </ConfigProvider>
  </StrictMode>
);
