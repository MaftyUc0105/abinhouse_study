import JSZip from 'jszip';
import { isValidLocalDate } from '../scheduler/dates';
import type { StudyDB } from './schema';
import { DEFAULT_SETTINGS, validateSettings } from './seedSettings';
import type { Card, ImageRecord, Note, ReviewLog, Settings, Subject } from './types';

export const BACKUP_APP = 'abinhouse_study';
export const BACKUP_VERSION = 1;

type ImageMeta = Omit<ImageRecord, 'blob'>;

export interface BackupJson {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  notes: Note[];
  cards: Card[];
  images: ImageMeta[];
  reviewLogs: ReviewLog[];
  subjects: Subject[];
  settings: Settings;
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

/** 兼容没有 Blob.arrayBuffer 的环境（旧浏览器 / jsdom） */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
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
  const [notes, cards, images, reviewLogs, subjects, settings] = await db.transaction(
    'r',
    [db.notes, db.cards, db.images, db.reviewLogs, db.subjects, db.settings],
    () =>
      Promise.all([
        db.notes.toArray(),
        db.cards.toArray(),
        db.images.toArray(),
        db.reviewLogs.toArray(),
        db.subjects.toArray(),
        db.settings.get('default'),
      ]),
  );

  const zip = new JSZip();
  const meta: ImageMeta[] = [];
  for (let i = 0; i < images.length; i++) {
    const { blob, ...rest } = images[i];
    meta.push(rest);
    zip.file(`images/${rest.id}.jpg`, await blobToArrayBuffer(blob), { compression: 'STORE' });
    if (i % 10 === 0) onProgress(`打包图片 ${i + 1}/${images.length}`, (i / Math.max(1, images.length)) * 0.5);
  }

  const json: BackupJson = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    notes,
    cards,
    images: meta,
    reviewLogs,
    subjects,
    settings: settings ?? DEFAULT_SETTINGS,
  };
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

// ---------- 校验 ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isNonNegInt(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0;
}
function isRatingArr(v: unknown): boolean {
  return Array.isArray(v) && v.every((r) => r === 0 || r === 1 || r === 2 || r === 3);
}

function validScheduling(v: Record<string, unknown>): boolean {
  return (
    isNonNegInt(v.stage) &&
    isValidLocalDate(v.dueDate) &&
    (v.lastReviewedAt === null || isNum(v.lastReviewedAt)) &&
    isNum(v.lastInterval) &&
    isNonNegInt(v.reviewCount) &&
    isNonNegInt(v.lapseCount) &&
    isRatingArr(v.recentRatings) &&
    typeof v.suspended === 'boolean'
  );
}

function validNote(v: unknown): v is Note {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    v.id.length > 0 &&
    isStr(v.title) &&
    isStr(v.subject) &&
    isStr(v.body) &&
    Array.isArray(v.tags) &&
    v.tags.every(isStr) &&
    isNum(v.createdAt) &&
    isNum(v.updatedAt) &&
    validScheduling(v)
  );
}

function validCard(v: unknown, noteIds: Set<string>): v is Card {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    v.id.length > 0 &&
    isStr(v.noteId) &&
    noteIds.has(v.noteId) &&
    isStr(v.question) &&
    isStr(v.answer) &&
    isNum(v.order) &&
    isNum(v.createdAt) &&
    isNum(v.updatedAt) &&
    validScheduling(v)
  );
}

function validImageMeta(v: unknown, ownerIds: Set<string>): v is ImageMeta {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    v.id.length > 0 &&
    (v.ownerType === 'note' || v.ownerType === 'card') &&
    isStr(v.ownerId) &&
    ownerIds.has(v.ownerId) &&
    (v.slot === 'body' || v.slot === 'question' || v.slot === 'answer') &&
    isNum(v.order) &&
    isNum(v.width) &&
    isNum(v.height) &&
    isNum(v.createdAt)
  );
}

function validLog(v: unknown, ids: Set<string>): v is ReviewLog {
  return (
    isRecord(v) &&
    (v.itemType === 'note' || v.itemType === 'card') &&
    isStr(v.itemId) &&
    ids.has(v.itemId) &&
    (v.rating === 0 || v.rating === 1 || v.rating === 2 || v.rating === 3) &&
    isNum(v.reviewedAt) &&
    isValidLocalDate(v.date) &&
    isNonNegInt(v.stageBefore) &&
    isNonNegInt(v.stageAfter) &&
    isNum(v.intervalDays) &&
    isValidLocalDate(v.dueBefore)
  );
}

export interface ParsedBackup {
  json: BackupJson;
  notes: Note[];
  cards: Card[];
  images: ImageRecord[];
  reviewLogs: ReviewLog[];
  subjects: Subject[];
  settings: Settings;
  missingImages: number;
  skipped: number;
}

export async function parseBackup(file: Blob, onProgress: Progress = () => {}): Promise<ParsedBackup> {
  onProgress('读取压缩包…', 0);
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
  if (!isRecord(json) || json.app !== BACKUP_APP) throw new Error('不是本应用的备份文件');
  if (json.version !== BACKUP_VERSION) throw new Error(`备份版本 ${String(json.version)} 不受支持`);
  for (const k of ['notes', 'cards', 'images', 'reviewLogs', 'subjects']) {
    if (!Array.isArray(json[k])) throw new Error(`备份缺少 ${k}`);
  }

  let skipped = 0;
  const notes = (json.notes as unknown[]).filter((n) => validNote(n) || (skipped++, false)) as Note[];
  const noteIds = new Set(notes.map((n) => n.id));
  const cards = (json.cards as unknown[]).filter((c) => validCard(c, noteIds) || (skipped++, false)) as Card[];
  const ownerIds = new Set([...noteIds, ...cards.map((c) => c.id)]);
  const metas = (json.images as unknown[]).filter((i) => validImageMeta(i, ownerIds) || (skipped++, false)) as ImageMeta[];
  const reviewLogs = (json.reviewLogs as unknown[]).filter((l) => validLog(l, ownerIds) || (skipped++, false)) as ReviewLog[];
  const subjects = (json.subjects as unknown[]).filter(
    (s): s is Subject => isRecord(s) && isStr(s.name) && s.name.length > 0 && isNum(s.createdAt),
  );
  const rawSettings = isRecord(json.settings) ? (json.settings as Partial<Settings>) : {};
  const settings: Settings = validateSettings(rawSettings) ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, ...rawSettings, id: 'default' };

  const images: ImageRecord[] = [];
  let missingImages = 0;
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const f = zip.file(`images/${m.id}.jpg`);
    if (!f) {
      missingImages += 1;
      continue;
    }
    const buf = await f.async('arraybuffer');
    const blob = new Blob([buf], { type: 'image/jpeg' });
    images.push({ ...m, blob, size: blob.size });
    if (i % 10 === 0) onProgress(`读取图片 ${i + 1}/${metas.length}`, (i / Math.max(1, metas.length)) * 0.8);
  }

  return { json: json as unknown as BackupJson, notes, cards, images, reviewLogs, subjects, settings, missingImages, skipped };
}

export async function importBackup(
  db: StudyDB,
  file: Blob,
  mode: ImportMode,
  onProgress: Progress = () => {},
): Promise<ImportResult> {
  const p = await parseBackup(file, onProgress);
  onProgress('写入数据库…', 0.85);

  const tables = [db.notes, db.cards, db.images, db.reviewLogs, db.subjects, db.settings];
  const result: ImportResult = {
    notes: 0,
    cards: 0,
    images: 0,
    reviewLogs: 0,
    subjects: 0,
    missingImages: p.missingImages,
    skipped: p.skipped,
  };

  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      for (const t of tables) await t.clear();
      await db.notes.bulkPut(p.notes);
      await db.cards.bulkPut(p.cards);
      await db.images.bulkPut(p.images);
      await db.reviewLogs.bulkAdd(p.reviewLogs.map(({ id: _id, ...l }) => l));
      await db.subjects.bulkPut(p.subjects);
      await db.settings.put(p.settings);
      result.notes = p.notes.length;
      result.cards = p.cards.length;
      result.images = p.images.length;
      result.reviewLogs = p.reviewLogs.length;
      result.subjects = p.subjects.length;
      return;
    }

    // merge：同 id 取 updatedAt 大者
    const newerNotes: Note[] = [];
    for (const n of p.notes) {
      const cur = await db.notes.get(n.id);
      if (!cur || n.updatedAt > cur.updatedAt) newerNotes.push(n);
    }
    await db.notes.bulkPut(newerNotes);
    result.notes = newerNotes.length;

    const newerCards: Card[] = [];
    for (const c of p.cards) {
      const cur = await db.cards.get(c.id);
      if (!cur || c.updatedAt > cur.updatedAt) newerCards.push(c);
    }
    await db.cards.bulkPut(newerCards);
    result.cards = newerCards.length;

    const newImages: ImageRecord[] = [];
    for (const img of p.images) {
      if (!(await db.images.get(img.id))) newImages.push(img);
    }
    await db.images.bulkPut(newImages);
    result.images = newImages.length;

    const existingLogs = await db.reviewLogs.toArray();
    const seen = new Set(existingLogs.map((l) => `${l.itemType}|${l.itemId}|${l.reviewedAt}`));
    const newLogs: ReviewLog[] = [];
    for (const { id: _id, ...l } of p.reviewLogs) {
      const key = `${l.itemType}|${l.itemId}|${l.reviewedAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        newLogs.push(l);
      }
    }
    await db.reviewLogs.bulkAdd(newLogs);
    result.reviewLogs = newLogs.length;

    const newSubjects: Subject[] = [];
    for (const s of p.subjects) {
      if (!(await db.subjects.get(s.name))) newSubjects.push(s);
    }
    await db.subjects.bulkPut(newSubjects);
    result.subjects = newSubjects.length;
    // merge 模式不覆盖本机设置
  });

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
