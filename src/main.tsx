import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { isNativeApp } from './native/platform';
import App from './App';
import { db } from './db/schema';
import './styles/global.css';

// App 里网页文件打包在安装包内，不需要 service worker
if (!isNativeApp) registerSW({ immediate: true });

// 开发模式下暴露数据库句柄，便于在控制台调试 / 端到端测试
if (import.meta.env.DEV) (window as unknown as { __db: typeof db }).__db = db;

// 申请持久存储，降低安卓在空间紧张时清理 IndexedDB 的风险
navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
