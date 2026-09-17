/**
 * 备份到微信 / 网盘，分两步：
 * 1. prepareBackupFile 生成备份文件（可能要几秒）
 * 2. 用户再点一次，shareBackupFile 调起系统分享，或 saveBackupFile 下载到手机
 * 分两步是因为浏览器要求分享必须紧跟用户点击，生成文件耗时太久会被静默拦截。
 */
import { backupFileName, downloadBlob, exportBackup, exportTextBackup, textBackupFileName, type Progress } from '../db/backup';
import type { StudyDB } from '../db/schema';

export const LAST_BACKUP_KEY = 'lastBackupAt';
export const BACKUP_SNOOZE_KEY = 'backupSnoozeUntil';
export const REMIND_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

export function canShareFile(file: File): boolean {
  const nav = navigator as ShareNavigator;
  try {
    return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export interface ShareSupport {
  /** 有 navigator.share */
  shareApi: boolean;
  /** 有 navigator.canShare */
  canShareApi: boolean;
  zip: boolean;
  txt: boolean;
  /** 已安装为桌面应用 */
  standalone: boolean;
  userAgent: string;
}

export function detectShareSupport(): ShareSupport {
  const nav = navigator as ShareNavigator;
  const zip = new File([new Uint8Array(1)], 'probe.zip', { type: 'application/zip' });
  const txt = new File(['x'], 'probe.txt', { type: 'text/plain' });
  let standalone = false;
  try {
    standalone = window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    /* ignore */
  }
  return {
    shareApi: typeof nav.share === 'function',
    canShareApi: typeof nav.canShare === 'function',
    zip: canShareFile(zip),
    txt: canShareFile(txt),
    standalone,
    userAgent: navigator.userAgent,
  };
}

/** 检测信息的一行摘要，出问题时让用户截图 */
export function describeShareSupport(s: ShareSupport): string {
  const browser =
    /MicroMessenger/i.test(s.userAgent)
      ? '微信内置浏览器'
      : /HuaweiBrowser/i.test(s.userAgent)
        ? '华为浏览器'
        : /MiuiBrowser|XiaoMi/i.test(s.userAgent)
          ? '小米浏览器'
          : /EdgA/i.test(s.userAgent)
            ? 'Edge'
            : /SamsungBrowser/i.test(s.userAgent)
              ? '三星浏览器'
              : /Firefox/i.test(s.userAgent)
                ? 'Firefox'
                : /Chrome\/(\d+)/i.test(s.userAgent)
                  ? `Chrome ${/Chrome\/(\d+)/i.exec(s.userAgent)![1]}`
                  : '未知浏览器';
  return [
    browser,
    s.standalone ? '桌面应用模式' : '网页模式',
    `分享接口${s.shareApi ? '有' : '无'}`,
    `文件分享${s.canShareApi ? '' : '检测接口无，'}${s.txt || s.zip ? `支持${s.zip ? ' zip' : ''}${s.txt ? ' txt' : ''}` : '不支持'}`,
  ].join(' · ');
}

export async function markBackedUp(db: StudyDB, at = Date.now()) {
  await db.meta.put({ key: LAST_BACKUP_KEY, value: at });
  await db.meta.delete(BACKUP_SNOOZE_KEY);
}

export interface PreparedBackup {
  file: File;
  /** 这个文件能否通过系统分享发出去 */
  shareable: boolean;
}

/** 生成备份文件：浏览器能分享 ZIP 就用 ZIP，只能分享文本就用 .txt，都不能就生成 ZIP 供下载 */
export async function prepareBackupFile(db: StudyDB, onProgress: Progress = () => {}): Promise<PreparedBackup> {
  const support = detectShareSupport();
  if (!support.zip && support.txt) {
    const blob = await exportTextBackup(db, onProgress);
    const file = new File([blob], textBackupFileName(), { type: 'text/plain' });
    return { file, shareable: canShareFile(file) };
  }
  const blob = await exportBackup(db, onProgress);
  const file = new File([blob], backupFileName(), { type: 'application/zip' });
  return { file, shareable: support.zip && canShareFile(file) };
}

export type ShareOutcome =
  | { kind: 'shared' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

/** 调起系统分享（必须在用户点击里直接调用） */
export async function shareBackupFile(db: StudyDB, file: File): Promise<ShareOutcome> {
  const nav = navigator as ShareNavigator;
  if (typeof nav.share !== 'function') return { kind: 'failed', message: '浏览器没有分享功能' };
  try {
    await nav.share({ files: [file], title: '复习本备份' });
    await markBackedUp(db);
    return { kind: 'shared' };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err?.name === 'AbortError') return { kind: 'cancelled' };
    return { kind: 'failed', message: `${err?.name ?? 'Error'}: ${err?.message ?? String(e)}` };
  }
}

/** 下载到手机 */
export async function saveBackupFile(db: StudyDB, file: File): Promise<void> {
  downloadBlob(file, file.name);
  await markBackedUp(db);
}

export interface BackupReminderState {
  show: boolean;
  /** 距离上次备份或同步的天数；从未备份时为 null */
  days: number | null;
}

/**
 * 是否提醒备份：有数据，且最近一次备份和最近一次成功同步都超过 7 天（从未备份时按最早一条笔记算），
 * 且不在"稍后提醒"期间。
 */
export async function getBackupReminder(db: StudyDB, now = Date.now()): Promise<BackupReminderState> {
  const [first, lastBackup, lastSync, snooze] = await Promise.all([
    db.notes.orderBy('updatedAt').first(),
    db.meta.get(LAST_BACKUP_KEY),
    db.meta.get('lastSyncAt'),
    db.meta.get(BACKUP_SNOOZE_KEY),
  ]);
  if (!first) return { show: false, days: null };
  if (typeof snooze?.value === 'number' && snooze.value > now) return { show: false, days: null };

  const backupAt = typeof lastBackup?.value === 'number' ? lastBackup.value : null;
  const syncAt = typeof lastSync?.value === 'number' ? lastSync.value : null;
  const protectedAt = Math.max(backupAt ?? 0, syncAt ?? 0);
  const oldest = (await db.notes.toArray()).reduce((m, n) => Math.min(m, n.createdAt), now);
  const since = protectedAt || oldest;
  const show = now - since >= REMIND_AFTER_DAYS * DAY;
  return { show, days: protectedAt ? Math.floor((now - protectedAt) / DAY) : null };
}

export async function snoozeBackupReminder(db: StudyDB, days = 1, now = Date.now()) {
  await db.meta.put({ key: BACKUP_SNOOZE_KEY, value: now + days * DAY });
}
