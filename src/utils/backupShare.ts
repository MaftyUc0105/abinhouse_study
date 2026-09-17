/**
 * 备份到微信 / 网盘：生成备份文件后调起系统分享；不支持分享时改为下载。
 * 同时记录本机最后一次备份时间，用于首页提醒。
 */
import { backupFileName, downloadBlob, exportBackup, exportTextBackup, textBackupFileName, type Progress } from '../db/backup';
import type { StudyDB } from '../db/schema';

export const LAST_BACKUP_KEY = 'lastBackupAt';
export const BACKUP_SNOOZE_KEY = 'backupSnoozeUntil';
export const REMIND_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export type ShareOutcome =
  | { kind: 'shared' }
  | { kind: 'downloaded'; filename: string }
  | { kind: 'cancelled' }
  /** 文件生成太久，浏览器要求再点一次才能分享 */
  | { kind: 'needsTap'; file: File };

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

export async function markBackedUp(db: StudyDB, at = Date.now()) {
  await db.meta.put({ key: LAST_BACKUP_KEY, value: at });
  await db.meta.delete(BACKUP_SNOOZE_KEY);
}

/** 分享一个已经准备好的文件（需要在用户点击中调用） */
export async function shareFile(db: StudyDB, file: File): Promise<ShareOutcome> {
  const nav = navigator as ShareNavigator;
  try {
    await nav.share!({ files: [file], title: '复习本备份' });
    await markBackedUp(db);
    return { kind: 'shared' };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'AbortError') return { kind: 'cancelled' };
    if (name === 'NotAllowedError') return { kind: 'needsTap', file };
    throw e;
  }
}

/**
 * 生成备份并分享。优先分享 ZIP（体积小）；浏览器不允许分享 ZIP 时改用 .txt 文本备份；
 * 都不能分享时下载 ZIP。
 */
export async function backupAndShare(db: StudyDB, onProgress: Progress = () => {}): Promise<ShareOutcome> {
  const probeZip = new File([new Uint8Array(1)], 'probe.zip', { type: 'application/zip' });
  const probeTxt = new File(['x'], 'probe.txt', { type: 'text/plain' });

  let file: File | null = null;
  if (canShareFile(probeZip)) {
    const blob = await exportBackup(db, onProgress);
    file = new File([blob], backupFileName(), { type: 'application/zip' });
  } else if (canShareFile(probeTxt)) {
    const blob = await exportTextBackup(db, onProgress);
    file = new File([blob], textBackupFileName(), { type: 'text/plain' });
  }

  if (file && canShareFile(file)) return shareFile(db, file);

  const blob = file ?? (await exportBackup(db, onProgress));
  const filename = file ? file.name : backupFileName();
  downloadBlob(blob, filename);
  await markBackedUp(db);
  return { kind: 'downloaded', filename };
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
