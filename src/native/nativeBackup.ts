/** App 里的备份：写入文件后调起系统分享，或保存到"文档/复习本备份" */
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { backupFileName, blobToArrayBuffer, exportBackup, type Progress } from '../db/backup';
import type { StudyDB } from '../db/schema';
import { bytesToBase64 } from '../utils/base64';
import { markBackedUp } from '../utils/backupShare';

export const BACKUP_FOLDER = '复习本备份';

async function backupBase64(db: StudyDB, onProgress: Progress) {
  const blob = await exportBackup(db, onProgress);
  onProgress('写入文件…', 0.95);
  const data = bytesToBase64(new Uint8Array(await blobToArrayBuffer(blob)));
  return { data, size: blob.size, filename: backupFileName() };
}

export interface NativeBackupResult {
  kind: 'shared' | 'saved' | 'cancelled';
  filename: string;
  size: number;
  /** 保存到手机时的位置说明 */
  location?: string;
}

/** 生成备份并调起系统分享（可选微信、网盘等） */
export async function shareBackupNative(db: StudyDB, onProgress: Progress = () => {}): Promise<NativeBackupResult> {
  const { data, size, filename } = await backupBase64(db, onProgress);
  const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  try {
    await Share.share({ title: '复习本备份', files: [written.uri], dialogTitle: '发送备份到' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return { kind: 'cancelled', filename, size };
    throw e;
  }
  await markBackedUp(db);
  return { kind: 'shared', filename, size };
}

/** 生成备份并保存到 手机存储/Documents/复习本备份/ */
export async function saveBackupNative(db: StudyDB, onProgress: Progress = () => {}): Promise<NativeBackupResult> {
  const { data, size, filename } = await backupBase64(db, onProgress);
  await Filesystem.writeFile({
    path: `${BACKUP_FOLDER}/${filename}`,
    data,
    directory: Directory.Documents,
    recursive: true,
  });
  await markBackedUp(db);
  return { kind: 'saved', filename, size, location: `文件管理 → 文档（Documents）→ ${BACKUP_FOLDER}` };
}
