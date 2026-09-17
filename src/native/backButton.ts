import { App } from '@capacitor/app';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from './platform';

/** 浮层（大图、遮挡编辑、确认框）打开时，返回键先关闭浮层 */
const OVERLAY_SELECTOR = '.lightbox, .mask-editor, .overlay';

/**
 * 安卓返回键：
 * 1. 有浮层 → 发送 Escape，由浮层自己关闭
 * 2. 不在首页 → 返回上一页（没有历史时回首页）
 * 3. 在首页 → 退到后台（不结束应用）
 */
export function useNativeBackButton() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!isNativeApp) return;
    const handle = App.addListener('backButton', ({ canGoBack }) => {
      if (document.querySelector(OVERLAY_SELECTOR)) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      if (loc.pathname !== '/') {
        if (canGoBack && window.history.length > 1) nav(-1);
        else nav('/', { replace: true });
        return;
      }
      void App.minimizeApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [nav, loc.pathname]);
}
