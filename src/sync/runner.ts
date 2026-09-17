/**
 * 同步调度：互斥执行、状态广播、自动触发（启动、写入后防抖、切到后台、网络恢复）。
 */
import type { StudyDB } from '../db/schema';
import { DIRTY_KEY, onChange } from './changes';
import { createGitHubApi } from './github';
import { describeSyncError, getSyncConfig, LAST_SYNC_KEY, syncWithRemote, type SyncReport } from './sync';

export type SyncPhase = 'off' | 'idle' | 'dirty' | 'syncing' | 'error';

export interface SyncStatusValue {
  phase: SyncPhase;
  lastSyncAt: number | null;
  error: string | null;
  progress: string | null;
}

let status: SyncStatusValue = { phase: 'off', lastSyncAt: null, error: null, progress: null };
const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatusValue {
  return status;
}
export function subscribeSyncStatus(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function setStatus(patch: Partial<SyncStatusValue>) {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

const configListeners = new Set<() => Promise<unknown>>();

let running: Promise<SyncReport | null> | null = null;
let again = false;

/** 立即同步；已在同步时排队一次。未配置返回 null */
export function syncNow(db: StudyDB): Promise<SyncReport | null> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const cfg = await getSyncConfig(db);
    if (!cfg) {
      setStatus({ phase: 'off', progress: null });
      return null;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus({ phase: 'dirty', error: '离线，联网后自动同步', progress: null });
      return null;
    }
    setStatus({ phase: 'syncing', error: null, progress: '准备同步…' });
    try {
      const report = await syncWithRemote(db, createGitHubApi(cfg), (msg) => setStatus({ progress: msg }));
      const dirty = (await db.meta.get(DIRTY_KEY))?.value === true;
      setStatus({ phase: dirty ? 'dirty' : 'idle', lastSyncAt: Date.now(), error: null, progress: null });
      return report;
    } catch (e) {
      setStatus({ phase: 'error', error: describeSyncError(e), progress: null });
      throw e;
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow(db).catch(() => {});
    }
  });
  return running;
}

const DEBOUNCE_MS = 20_000;

/** 启动自动同步，返回清理函数 */
export function startAutoSync(db: StudyDB): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cfgAuto = false;
  const run = () => void syncNow(db).catch(() => {});
  const isDirty = async () => (await db.meta.get(DIRTY_KEY))?.value === true;

  const refreshConfig = async () => {
    const cfg = await getSyncConfig(db);
    cfgAuto = !!cfg?.auto;
    const last = (await db.meta.get(LAST_SYNC_KEY))?.value as number | undefined;
    if (!cfg) setStatus({ phase: 'off', lastSyncAt: last ?? null });
    else if (status.phase === 'off') setStatus({ phase: (await isDirty()) ? 'dirty' : 'idle', lastSyncAt: last ?? null });
    return cfg;
  };

  configListeners.add(refreshConfig);
  void refreshConfig().then((cfg) => {
    if (cfg?.auto) run();
  });

  const offChange = onChange(() => {
    if (status.phase === 'idle') setStatus({ phase: 'dirty' });
    if (!cfgAuto) return;
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  });

  const onHidden = async () => {
    if (document.visibilityState === 'hidden' && cfgAuto && (await isDirty())) {
      clearTimeout(timer);
      run();
    }
  };
  const onOnline = async () => {
    if (cfgAuto && (await isDirty())) run();
  };
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('online', onOnline);

  return () => {
    clearTimeout(timer);
    configListeners.delete(refreshConfig);
    offChange();
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('online', onOnline);
  };
}

/** 设置页修改配置后调用，刷新自动同步开关与状态 */
export async function reloadSyncConfig(db: StudyDB) {
  const cfg = await getSyncConfig(db);
  if (!cfg) setStatus({ phase: 'off', error: null, progress: null });
  else if (status.phase === 'off') setStatus({ phase: 'idle', error: null });
  for (const l of configListeners) await l();
}
