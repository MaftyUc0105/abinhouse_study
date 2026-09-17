import JSZip from 'jszip';
import { markDirty } from '../sync/changes';
import { base64ToBytes } from '../utils/base64';
import { buildSnapshot, mergeSnapshot, validateSnapshot, type ImageMeta, type Snapshot } from './merge';
import type { StudyDB } from './schema';
import type { ImageRecord, ReviewLog } from './types';

export const BACKUP_APP = 'abinhouse_study';
export const BACKUP_VERSION = 2;
const SUPPORTED_VERSIONS = [1, 2];

export interface BackupJson extends Snapshot {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  notes: number;
  cards: number;
  images: number;
  reviewLogs: number;
  subjects: number;
  /** 元数据存在但 zip 里缺图 */
  missingImages: number;
  /** 校验不通过被跳过的条目数 */
  skipped: number;
}

export type Progress = (msg: string, ratio?: number) => void;

/** 兼容没有 Blob.arrayBuffer 的环境 */
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error ?? new Error('读取图片失败'));
    fr.readAsArrayBuffer(blob);
  });
}

export async function exportBackup(db: StudyDB, onProgress: Progress = () => {}): Promise<Blob> {
  onProgress('读取数据…', 0);
  const { snapshot, blobs } = await buildSnapshot(db);

  const zip = new JSZip();
  let i = 0;
  for (const [id, blob] of blobs) {
    zip.file(`images/${id}.jpg`, await blobToArrayBuffer(blob), { compression: 'STORE' });
    if (i % 10 === 0) onProgress(`打包图片 ${i + 1}/${blobs.size}`, (i / Math.max(1, blobs.size)) * 0.5);
    i++;
  }

  const json: BackupJson = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: Date.now(), ...snapshot };
  zip.file('backup.json', JSON.stringify(json), { compression: 'DEFLATE' });

  onProgress('生成压缩包…', 0.6);
  return zip.generateAsync({ type: 'blob' }, (m) => onProgress('生成压缩包…', 0.6 + (m.percent / 100) * 0.4));
}

export function backupFileName(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `abinhouse_backup_${y}-${m}-${d}.zip`;
}

export interface ParsedBackup {
  snapshot: Snapshot;
  images: ImageRecord[];
  missingImages: number;
  skipped: number;
}

function checkHeader(json: unknown): Record<string, unknown> {
  if (typeof json !== 'object' || json === null || (json as { app?: unknown }).app !== BACKUP_APP)
    throw new Error('不是本应用的备份文件');
  const version = (json as { version?: unknown }).version;
  if (!SUPPORTED_VERSIONS.includes(version as number)) throw new Error(`备份版本 ${String(version)} 不受支持`);
  return json as Record<string, unknown>;
}

/** 按照片元数据取出图片内容；取不到的计为缺图 */
async function collectImages(
  metas: ImageMeta[],
  read: (m: ImageMeta) => Promise<Uint8Array | ArrayBuffer | null>,
  onProgress: Progress,
): Promise<{ images: ImageRecord[]; kept: ImageMeta[]; missingImages: number }> {
  const images: ImageRecord[] = [];
  const kept: ImageMeta[] = [];
  let missingImages = 0;
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const data = await read(m);
    if (!data) {
      missingImages += 1;
      continue;
    }
    const blob = new Blob([data], { type: 'image/jpeg' });
    images.push({ ...m, blob, size: blob.size });
    kept.push(m);
    if (i % 10 === 0) onProgress(`读取图片 ${i + 1}/${metas.length}`, (i / Math.max(1, metas.length)) * 0.8);
  }
  return { images, kept, missingImages };
}

/** 解析备份文件，自动识别 ZIP 与文本（.txt，照片 base64 内嵌在 imageData）两种格式 */
export async function parseBackup(file: Blob, onProgress: Progress = () => {}): Promise<ParsedBackup> {
  onProgress('读取备份…', 0);
  const head = new Uint8Array(await blobToArrayBuffer(file.slice(0, 2)));
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK"

  if (!isZip) {
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(await blobToArrayBuffer(file)));
    } catch {
      throw new Error('不是有效的备份文件（需要 .zip 或 .txt 备份）');
    }
    const raw = checkHeader(json);
    const { snapshot, skipped } = validateSnapshot(raw);
    const data = (typeof raw.imageData === 'object' && raw.imageData !== null ? raw.imageData : {}) as Record<string, unknown>;
    const { images, kept, missingImages } = await collectImages(
      snapshot.images,
      async (m) => {
        const b64 = data[m.id];
        if (typeof b64 !== 'string') return null;
        try {
          return base64ToBytes(b64);
        } catch {
          return null;
        }
      },
      onProgress,
    );
    return { snapshot: { ...snapshot, images: kept }, images, missingImages, skipped };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('不是有效的 ZIP 备份文件');
  }
  const entry = zip.file('backup.json');
  if (!entry) throw new Error('压缩包里没有 backup.json');
  let json: unknown;
  try {
    json = JSON.parse(await entry.async('string'));
  } catch {
    throw new Error('backup.json 不是合法 JSON');
  }
  const { snapshot, skipped } = validateSnapshot(checkHeader(json));
  const { images, kept, missingImages } = await collectImages(
    snapshot.images,
    async (m) => {
      const f = zip.file(`images/${m.id}.jpg`);
      return f ? f.async('arraybuffer') : null;
    },
    onProgress,
  );
  return { snapshot: { ...snapshot, images: kept }, images, missingImages, skipped };
}

export async function importBackup(
  db: StudyDB,
  file: Blob,
  mode: ImportMode,
  onProgress: Progress = () => {},
): Promise<ImportResult> {
  const p = await parseBackup(file, onProgress);
  const s = p.snapshot;
  onProgress('写入数据库…', 0.85);

  let result: ImportResult;
  if (mode === 'replace') {
    await db.transaction('rw', db.dataTables, async () => {
      for (const t of db.dataTables) await t.clear();
      await db.notes.bulkPut(s.notes);
      await db.cards.bulkPut(s.cards);
      await db.images.bulkPut(p.images);
      await db.reviewLogs.bulkAdd(s.reviewLogs as ReviewLog[]);
      await db.subjects.bulkPut(s.subjects);
      await db.tombstones.bulkPut(s.tombstones);
      if (s.settings) await db.settings.put(s.settings);
    });
    result = {
      notes: s.notes.length,
      cards: s.cards.length,
      images: p.images.length,
      reviewLogs: s.reviewLogs.length,
      subjects: s.subjects.length,
      missingImages: p.missingImages,
      skipped: p.skipped,
    };
  } else {
    const blobs = new Map(p.images.map((i) => [i.id, i.blob]));
    const r = await mergeSnapshot(db, s, async (m) => blobs.get(m.id) ?? null, { mergeSettings: false });
    result = { ...r, missingImages: p.missingImages + r.missingImages, skipped: p.skipped };
  }

  await markDirty(db);
  onProgress('完成', 1);
  return result;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
