import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { getSyncStatus, subscribeSyncStatus } from '../sync/runner';

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}

const LABEL = {
  off: '☁ 未开启同步',
  idle: '☁ 已同步',
  dirty: '☁ 待同步',
  syncing: '⟳ 同步中',
  error: '⚠ 同步失败',
} as const;

/** 今日页右上角的同步状态，点击进入设置 */
export function SyncStatus() {
  const s = useSyncStatus();
  return (
    <Link to="/settings#sync" className={`sync-status sync-${s.phase}`} title={s.error ?? s.progress ?? ''}>
      {LABEL[s.phase]}
    </Link>
  );
}
