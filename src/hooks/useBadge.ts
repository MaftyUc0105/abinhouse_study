import { useEffect } from 'react';

/** 已安装的 PWA 图标角标显示待复习数 */
export function useBadge(count: number, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
      else nav.clearAppBadge?.()?.catch(() => {});
    } catch {
      /* 不支持则忽略 */
    }
  }, [count, ready]);
}
