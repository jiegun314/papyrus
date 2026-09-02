/**
 * main.tsx —— React 应用入口（Vite 加载 /src/main.tsx）。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { RefreshProvider } from './app/refresh';
import { ToastProvider } from './components/Toast';
import './styles/style.css';

// 全局异常兜底（网络错误时给出提示，行为与旧版一致）
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('未找到 #root 挂载点');

createRoot(rootEl).render(
  <StrictMode>
    <ToastProvider>
      <RefreshProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </RefreshProvider>
    </ToastProvider>
  </StrictMode>
);
