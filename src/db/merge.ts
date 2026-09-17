/**
 * 数据快照：构建、校验、合并。ZIP 备份与 GitHub 同步共用。
 */
import { isValidLocalDate } from '../scheduler/dates';
import type { StudyDB } from './schema';
import { DEFAULT_SETTINGS, validateSettings } from './seedSettings';
import type { Card, ImageRecord, Note, ReviewLog, Settings, Subject, Tombstone } from './types';

export type ImageMeta = Omit<ImageRecord, 'blob'>;
export type LogEntry = Omit<ReviewLog, 'id'>;

export interface Snapshot {
  notes: Note[];
  cards: Card[];
  images: ImageMeta[];
  reviewLogs: LogEntry[];
  subjects: Subject[];
  settings: Settings | null;
  tombstones: Tombstone[];
}

export interface MergeOptions {
  /** 是否按 updatedAt 合并设置（同步时是；ZIP 合并导入时否） */
  mergeSettings: boolean;
}

export interface MergeResult {
  notes: number;
  cards: number;
  images: number;
  reviewLogs: number;
  subjects: number;
  deleted: number;
  missingImages: number;
}

// ---------- 构建 ----------

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function logKey(l: Pick<ReviewLog, 'itemType' | 'itemId' | 'reviewedAt'>): string {
  return `${l.itemType}|${l.itemId}|${l.reviewedAt}`;
}

export function imageUpdatedAt(m: Pick<ImageRecord, 'createdAt' | 'updatedAt'>): number {
  return m.updatedAt ?? m.createdAt;
}

/** 读取本地全部数据，排好序，便于稳定序列化 */
export async function buildSnapshot(db: StudyDB): Promise<{ snapshot: Snapshot; blobs: Map<string, Blob> }> {
  const [notes, cards, images, logs, subjects, settings, tombstones] = await db.transaction('r', db.dataTables, () =>
    Promise.all([
      db.notes.toArray(),
      db.cards.toArray(),
      db.images.toArray(),
      db.reviewLogs.toArray(),
      db.subjects.toArray(),
      db.settings.get('default'),
      db.tombstones.toArray(),
    ]),
  );
  const blobs = new Map<string, Blob>();
  const metas: ImageMeta[] = images.map(({ blob, ...m }) => {
    blobs.set(m.id, blob);
    return m;
  });
  const reviewLogs: LogEntry[] = logs
    .map(({ id: _id, ...l }) => l)
    .sort((a, b) => a.reviewedAt - b.reviewedAt || (logKey(a) < logKey(b) ? -1 : 1));
  return {
    snapshot: {
      notes: notes.sort(byId),
      cards: cards.sort(byId),
      images: metas.sort(byId),
      reviewLogs,
      subjects: subjects.sort((a, b) => (a.name < b.name ? -1 : 1)),
      settings: settings ? { ...DEFAULT_SETTINGS, ...settings } : null,
      tombstones: tombstones.sort((a, b) => (a.key < b.key ? -1 : 1)),
    },
    blobs,
  };
}

/** 键排序后的 JSON，保证不同设备对同样数据得到同样文本 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Blob)) {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]));
    }
    return v;
  });
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
function isUnit(v: unknown): boolean {
  return isNum(v) && v >= 0 && v <= 1;
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

function validMasks(v: unknown): boolean {
  if (v === undefined) return true;
  return (
    Array.isArray(v) &&
    v.every((m) => isRecord(m) && isStr(m.id) && isUnit(m.x) && isUnit(m.y) && isUnit(m.w) && isUnit(m.h))
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
    isNum(v.createdAt) &&
    (v.updatedAt === undefined || isNum(v.updatedAt)) &&
    validMasks(v.masks)
  );
}

function validLog(v: unknown, ids: Set<string>): v is LogEntry {
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

function validTombstone(v: unknown): v is Tombstone {
  return isRecord(v) && isStr(v.key) && /^(note|card|image):.+/.test(v.key) && isNum(v.deletedAt);
}

/** 校验来自备份或云端的原始快照；无效条目被跳过并计数 */
export function validateSnapshot(raw: Record<string, unknown>): { snapshot: Snapshot; skipped: number } {
  for (const k of ['notes', 'cards', 'images', 'reviewLogs', 'subjects']) {
    if (!Array.isArray(raw[k])) throw new Error(`数据缺少 ${k}`);
  }
  let skipped = 0;
  const keep = (ok: boolean) => ok || (skipped++, false);

  const notes = (raw.notes as unknown[]).filter((n) => keep(validNote(n))) as Note[];
  const noteIds = new Set(notes.map((n) => n.id));
  const cards = (raw.cards as unknown[]).filter((c) => keep(validCard(c, noteIds))) as Card[];
  const ownerIds = new Set([...noteIds, ...cards.map((c) => c.id)]);
  const images = (raw.images as unknown[]).filter((i) => keep(validImageMeta(i, ownerIds))) as ImageMeta[];
  const reviewLogs = (raw.reviewLogs as unknown[])
    .filter((l) => keep(validLog(l, ownerIds)))
    .map((l) => {
      const { id: _id, ...rest } = l as ReviewLog;
      return rest;
    });
  const subjects = (raw.subjects as unknown[]).filter(
    (s): s is Subject => isRecord(s) && isStr(s.name) && s.name.length > 0 && isNum(s.createdAt),
  );
  const tombstones = Array.isArray(raw.tombstones) ? (raw.tombstones as unknown[]).filter(validTombstone) : [];

  let settings: Settings | null = null;
  if (isRecord(raw.settings)) {
    const rs = raw.settings as Partial<Settings>;
    if (!validateSettings(rs)) settings = { ...DEFAULT_SETTINGS, ...rs, id: 'default', updatedAt: isNum(rs.updatedAt) ? rs.updatedAt : 0 };
  }

  return { snapshot: { notes, cards, images, reviewLogs, subjects, settings, tombstones }, skipped };
}

// ---------- 合并 ----------

/**
 * 把快照合并进本地数据库：
 * - 笔记/卡片/图片：同 id 取 updatedAt 大者；墓碑 deletedAt ≥ updatedAt 的视为已删除
 * - 日志按 (itemType,itemId,reviewedAt) 去重；科目取并集；墓碑取并集
 * fetchImage 在事务外调用（可以是网络请求）
 */
export async function mergeSnapshot(
  db: StudyDB,
  snap: Snapshot,
  fetchImage: (meta: ImageMeta) => Promise<Blob | null>,
  opts: MergeOptions,
): Promise<MergeResult> {
  const result: MergeResult = { notes: 0, cards: 0, images: 0, reviewLogs: 0, subjects: 0, deleted: 0, missingImages: 0 };

  // 合并后的墓碑
  const localTombs = await db.tombstones.toArray();
  const tombs = new Map(localTombs.map((t) => [t.key, t.deletedAt]));
  for (const t of snap.tombstones) tombs.set(t.key, Math.max(tombs.get(t.key) ?? 0, t.deletedAt));
  const deletedAfter = (key: string, updatedAt: number) => (tombs.get(key) ?? -1) >= updatedAt;

  // 事务外下载本地缺少的图片
  const localImageIds = new Set(await db.images.toCollection().primaryKeys());
  const downloaded = new Map<string, Blob>();
  for (const m of snap.images) {
    if (localImageIds.has(m.id) || deletedAfter(`image:${m.id}`, imageUpdatedAt(m))) continue;
    const blob = await fetchImage(m);
    if (blob) downloaded.set(m.id, blob);
    else result.missingImages += 1;
  }

  await db.transaction('rw', db.dataTables, async () => {
    await db.tombstones.bulkPut([...tombs].map(([key, deletedAt]) => ({ key, deletedAt })));

    // 笔记
    for (const r of snap.notes) {
      if (deletedAfter(`note:${r.id}`, r.updatedAt)) continue;
      const cur = await db.notes.get(r.id);
      if (!cur || r.updatedAt > cur.updatedAt) {
        await db.notes.put(r);
        result.notes += 1;
      }
    }
    // 卡片
    for (const r of snap.cards) {
      if (deletedAfter(`card:${r.id}`, r.updatedAt)) continue;
      const cur = await db.cards.get(r.id);
      if (!cur || r.updatedAt > cur.updatedAt) {
        await db.cards.put(r);
        result.cards += 1;
      }
    }
    // 图片
    for (const m of snap.images) {
      if (deletedAfter(`image:${m.id}`, imageUpdatedAt(m))) continue;
      const cur = await db.images.get(m.id);
      if (cur) {
        if (imageUpdatedAt(m) > imageUpdatedAt(cur)) {
          await db.images.put({ ...cur, ...m, blob: cur.blob, size: cur.blob.size });
          result.images += 1;
        }
      } else {
        const blob = downloaded.get(m.id);
        if (blob) {
          await db.images.put({ ...m, blob, size: blob.size });
          result.images += 1;
        }
      }
    }

    // 应用墓碑到本地
    for (const [key, deletedAt] of tombs) {
      const idx = key.indexOf(':');
      const kind = key.slice(0, idx);
      const id = key.slice(idx + 1);
      if (kind === 'note') {
        const cur = await db.notes.get(id);
        if (cur && deletedAt >= cur.updatedAt) {
          await db.notes.delete(id);
          result.deleted += 1;
        }
      } else if (kind === 'card') {
        const cur = await db.cards.get(id);
        if (cur && deletedAt >= cur.updatedAt) {
          await db.cards.delete(id);
          result.deleted += 1;
        }
      } else if (kind === 'image') {
        const cur = await db.images.get(id);
        if (cur && deletedAt >= imageUpdatedAt(cur)) {
          await db.images.delete(id);
          result.deleted += 1;
        }
      }
    }

    // 清理孤儿：笔记已不存在的卡片、主人不存在的图片
    const noteIds = new Set(await db.notes.toCollection().primaryKeys());
    const orphanCards = (await db.cards.toArray()).filter((c) => !noteIds.has(c.noteId)).map((c) => c.id);
    if (orphanCards.length) await db.cards.bulkDelete(orphanCards);
    const cardIds = new Set(await db.cards.toCollection().primaryKeys());
    const alive = (type: string, id: string) => (type === 'note' ? noteIds.has(id) : cardIds.has(id));
    const orphanImages = (await db.images.toArray()).filter((i) => !alive(i.ownerType, i.ownerId)).map((i) => i.id);
    if (orphanImages.length) await db.images.bulkDelete(orphanImages);

    // 日志
    const localLogs = await db.reviewLogs.toArray();
    const orphanLogs = localLogs.filter((l) => !alive(l.itemType, l.itemId)).map((l) => l.id!);
    if (orphanLogs.length) await db.reviewLogs.bulkDelete(orphanLogs);
    const seen = new Set(localLogs.map(logKey));
    const newLogs: LogEntry[] = [];
    for (const l of snap.reviewLogs) {
      const k = logKey(l);
      if (seen.has(k) || !alive(l.itemType, l.itemId)) continue;
      seen.add(k);
      newLogs.push(l);
    }
    if (newLogs.length) await db.reviewLogs.bulkAdd(newLogs as ReviewLog[]);
    result.reviewLogs = newLogs.length;

    // 科目
    for (const s of snap.subjects) {
      if (!(await db.subjects.get(s.name))) {
        await db.subjects.put(s);
        result.subjects += 1;
      }
    }

    // 设置
    if (opts.mergeSettings && snap.settings) {
      const cur = await db.settings.get('default');
      if (!cur || snap.settings.updatedAt > (cur.updatedAt ?? 0)) await db.settings.put(snap.settings);
    }
  });

  return result;
}
