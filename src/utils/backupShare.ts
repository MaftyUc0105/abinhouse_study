/**
 * 备份保存到手机：生成 ZIP 后下载到"下载"文件夹。
 * 想发到微信或网盘，再从下载通知或文件管理里分享（部分浏览器不允许网页直接分享文件）。
 * 同时记录本机最后一次备份时间，用于首页提醒。
 */
import { backupFileName, exportBackup, type Progress } from '../db/backup';
import type { StudyDB } from '../db/schema';

export const LAST_BACKUP_KEY = 'lastBackupAt';
export const BACKUP_SNOOZE_KEY = 'backupSnoozeUntil';
export const REMIND_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export async function markBackedUp(db: StudyDB, at = Date.now()) {
  await db.meta.put({ key: LAST_BACKUP_KEY, value: at });
  await db.meta.delete(BACKUP_SNOOZE_KEY);
}

export interface SavedBackup {
  /** 备份文件的临时地址，供"没有开始下载？点这里"使用；调用方负责回收 */
  url: string;
  filename: string;
  size: number;
}

/** 生成 ZIP 备份并触发下载 */
export async function saveBackupToPhone(db: StudyDB, onProgress: Progress = () => {}): Promise<SavedBackup> {
  const blob = await exportBackup(db, onProgress);
  const filename = backupFileName();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  await markBackedUp(db);
  return { url, filename, size: blob.size };
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
