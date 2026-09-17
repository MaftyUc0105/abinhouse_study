import { useEffect, useState } from 'react';
import { today } from '../scheduler/dates';

/** 当前本地日期；跨过零点或应用回到前台时自动更新 */
export function useToday(): string {
  const [t, setT] = useState(today);

  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => setT((prev) => (prev === today() ? prev : today()));
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, next.getTime() - now.getTime());
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return t;
}
