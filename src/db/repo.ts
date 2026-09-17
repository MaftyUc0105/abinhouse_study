/**
 * 所有写操作集中在这里，UI 不直接调 db.*.put。
 * 写入后调用 markDirty 触发自动同步；删除时写墓碑，防止多设备同步时复活。
 */
import { nanoid } from 'nanoid';
import { markDirty } from '../sync/changes';
import { applyRating, initialScheduling, pickScheduling } from '../scheduler/scheduler';
import { today } from '../scheduler/dates';
import { db as defaultDb, type StudyDB } from './schema';
import { ensureSettings, validateSettings } from './seedSettings';
import type {
  Card,
  ImageRecord,
  ImageSlot,
  ItemType,
  LocalDate,
  Mask,
  Note,
  Rating,
  ReviewLog,
  Scheduling,
  Settings,
  Tombstone,
} from './types';

/** 编辑器里待保存的图片；已入库的图片 id 与库中一致 */
export interface ImageInput {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  masks?: Mask[];
}

export interface NoteInput {
  title: string;
  subject: string;
  body: string;
  tags: string[];
}

export interface CardInput {
  question: string;
  answer: string;
  questionImages?: ImageInput[];
  answerImages?: ImageInput[];
}

export interface ReviewResult {
  next: Scheduling;
  prev: Scheduling;
  logId: number;
}

function sameMasks(a?: Mask[], b?: Mask[]): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

export function createRepo(db: StudyDB = defaultDb) {
  const allTables = db.dataTables;
  const touched = () => markDirty(db);

  function tomb(key: string, now = Date.now()): Tombstone {
    return { key, deletedAt: now };
  }

  async function ensureSubject(name: string): Promise<void> {
    const n = name.trim();
    if (!n) return;
    const existing = await db.subjects.get(n);
    if (!existing) await db.subjects.put({ name: n, createdAt: Date.now() });
  }

  /** 让 owner+slot 下的图片与 items 一致：删多余、加新增、更新顺序与遮挡 */
  async function syncImages(
    ownerType: ItemType,
    ownerId: string,
    slot: ImageSlot,
    items: ImageInput[],
  ): Promise<void> {
    const existing = await db.images.where({ ownerType, ownerId }).filter((i) => i.slot === slot).toArray();
    const keep = new Set(items.map((i) => i.id));
    const toDelete = existing.filter((i) => !keep.has(i.id)).map((i) => i.id);
    const now = Date.now();
    if (toDelete.length) {
      await db.images.bulkDelete(toDelete);
      await db.tombstones.bulkPut(toDelete.map((id) => tomb(`image:${id}`, now)));
    }

    const existingMap = new Map(existing.map((i) => [i.id, i]));
    const records: ImageRecord[] = [];
    items.forEach((it, order) => {
      const prev = existingMap.get(it.id);
      if (prev) {
        if (prev.order === order && sameMasks(prev.masks, it.masks)) return;
        records.push({ ...prev, order, masks: it.masks ?? [], updatedAt: now });
      } else {
        records.push({
          id: it.id,
          ownerType,
          ownerId,
          slot,
          order,
          blob: it.blob,
          width: it.width,
          height: it.height,
          size: it.blob.size,
          createdAt: now,
          updatedAt: now,
          masks: it.masks ?? [],
        });
      }
    });
    if (records.length) await db.images.bulkPut(records);
  }

  async function createNote(input: NoteInput, images: ImageInput[] = [], todayDate: LocalDate = today()) {
    const now = Date.now();
    const note: Note = {
      id: nanoid(),
      title: input.title.trim(),
      subject: input.subject.trim(),
      body: input.body,
      tags: normalizeTags(input.tags),
      createdAt: now,
      updatedAt: now,
      ...initialScheduling(todayDate),
    };
    await db.transaction('rw', db.notes, db.images, db.subjects, db.tombstones, async () => {
      await db.notes.put(note);
      await syncImages('note', note.id, 'body', images);
      await ensureSubject(note.subject);
    });
    await touched();
    return note.id;
  }

  async function updateNote(id: string, input: NoteInput, images?: ImageInput[]) {
    await db.transaction('rw', db.notes, db.images, db.subjects, db.tombstones, async () => {
      const note = await db.notes.get(id);
      if (!note) throw new Error('笔记不存在');
      await db.notes.put({
        ...note,
        title: input.title.trim(),
        subject: input.subject.trim(),
        body: input.body,
        tags: normalizeTags(input.tags),
        updatedAt: Date.now(),
      });
      if (images) await syncImages('note', id, 'body', images);
      await ensureSubject(input.subject);
    });
    await touched();
  }

  async function deleteNote(id: string) {
    await db.transaction('rw', [db.notes, db.cards, db.images, db.reviewLogs, db.tombstones], async () => {
      const now = Date.now();
      const cardIds = await db.cards.where('noteId').equals(id).primaryKeys();
      const ownerIds = [id, ...cardIds];
      const imageIds = await db.images.where('ownerId').anyOf(ownerIds).primaryKeys();
      await db.tombstones.bulkPut([
        tomb(`note:${id}`, now),
        ...cardIds.map((c) => tomb(`card:${c}`, now)),
        ...imageIds.map((i) => tomb(`image:${i}`, now)),
      ]);
      await db.notes.delete(id);
      await db.cards.bulkDelete(cardIds);
      await db.images.bulkDelete(imageIds);
      await db.reviewLogs.where('[itemType+itemId]').equals(['note', id]).delete();
      for (const cid of cardIds) await db.reviewLogs.where('[itemType+itemId]').equals(['card', cid]).delete();
    });
    await touched();
  }

  async function createCards(noteId: string, inputs: CardInput[], todayDate: LocalDate = today()) {
    const ids: string[] = [];
    await db.transaction('rw', db.cards, db.images, db.notes, db.tombstones, async () => {
      const note = await db.notes.get(noteId);
      if (!note) throw new Error('笔记不存在');
      const existingCount = await db.cards.where('noteId').equals(noteId).count();
      const now = Date.now();
      for (let i = 0; i < inputs.length; i++) {
        const c = inputs[i];
        const card: Card = {
          id: nanoid(),
          noteId,
          question: c.question.trim(),
          answer: c.answer.trim(),
          order: existingCount + i,
          createdAt: now,
          updatedAt: now,
          ...initialScheduling(todayDate),
        };
        await db.cards.put(card);
        await syncImages('card', card.id, 'question', c.questionImages ?? []);
        await syncImages('card', card.id, 'answer', c.answerImages ?? []);
        ids.push(card.id);
      }
    });
    await touched();
    return ids;
  }

  async function updateCard(id: string, input: CardInput) {
    await db.transaction('rw', db.cards, db.images, db.tombstones, async () => {
      const card = await db.cards.get(id);
      if (!card) throw new Error('卡片不存在');
      await db.cards.put({
        ...card,
        question: input.question.trim(),
        answer: input.answer.trim(),
        updatedAt: Date.now(),
      });
      if (input.questionImages) await syncImages('card', id, 'question', input.questionImages);
      if (input.answerImages) await syncImages('card', id, 'answer', input.answerImages);
    });
    await touched();
  }

  async function deleteCard(id: string) {
    await db.transaction('rw', db.cards, db.images, db.reviewLogs, db.tombstones, async () => {
      const now = Date.now();
      const imageIds = await db.images.where('ownerId').equals(id).primaryKeys();
      await db.tombstones.bulkPut([tomb(`card:${id}`, now), ...imageIds.map((i) => tomb(`image:${i}`, now))]);
      await db.cards.delete(id);
      await db.images.bulkDelete(imageIds);
      await db.reviewLogs.where('[itemType+itemId]').equals(['card', id]).delete();
    });
    await touched();
  }

  async function setSuspended(type: ItemType, id: string, suspended: boolean) {
    const table = type === 'note' ? db.notes : db.cards;
    await table.update(id, { suspended, updatedAt: Date.now() });
    await touched();
  }

  /** 把条目重置为新条目（明天到期、stage 0），保留历史日志 */
  async function resetScheduling(type: ItemType, id: string, todayDate: LocalDate = today()) {
    const table = type === 'note' ? db.notes : db.cards;
    await table.update(id, { ...initialScheduling(todayDate), updatedAt: Date.now() });
    await touched();
  }

  /** 复习评分：更新调度状态并写一条日志 */
  async function applyReview(
    type: ItemType,
    id: string,
    rating: Rating,
    todayDate: LocalDate = today(),
  ): Promise<ReviewResult> {
    const table = type === 'note' ? db.notes : db.cards;
    const result = await db.transaction('rw', table, db.reviewLogs, db.settings, async () => {
      const item = await table.get(id);
      if (!item) throw new Error('条目不存在');
      const cfg = await ensureSettings(db);
      const now = Date.now();
      const prev = pickScheduling(item);
      const next = applyRating(prev, rating, todayDate, cfg, now, id);
      await table.update(id, { ...next, updatedAt: now });
      const log: ReviewLog = {
        itemType: type,
        itemId: id,
        rating,
        reviewedAt: now,
        date: todayDate,
        stageBefore: item.stage,
        stageAfter: next.stage,
        intervalDays: next.lastInterval,
        dueBefore: item.dueDate,
      };
      const logId = (await db.reviewLogs.add(log)) as number;
      return { next, prev, logId };
    });
    await touched();
    return result;
  }

  /** 撤销一次评分：恢复评分前的调度状态并删除日志 */
  async function undoReview(type: ItemType, id: string, prev: Scheduling, logId: number) {
    const table = type === 'note' ? db.notes : db.cards;
    await db.transaction('rw', table, db.reviewLogs, async () => {
      const item = await table.get(id);
      if (item) await table.update(id, { ...pickScheduling(prev), updatedAt: Date.now() });
      await db.reviewLogs.delete(logId);
    });
    await touched();
  }

  async function getSettings(): Promise<Settings> {
    return ensureSettings(db);
  }

  async function updateSettings(patch: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings> {
    const err = validateSettings(patch);
    if (err) throw new Error(err);
    const current = await ensureSettings(db);
    const next: Settings = { ...current, ...patch, id: 'default', updatedAt: Date.now() };
    await db.settings.put(next);
    await touched();
    return next;
  }

  /** 清空本机数据（不写墓碑：之后再同步会从云端恢复） */
  async function clearAll() {
    await db.transaction('rw', allTables, async () => {
      for (const t of allTables) await t.clear();
    });
  }

  return {
    db,
    ensureSubject,
    syncImages,
    createNote,
    updateNote,
    deleteNote,
    createCards,
    updateCard,
    deleteCard,
    setSuspended,
    resetScheduling,
    applyReview,
    undoReview,
    getSettings,
    updateSettings,
    clearAll,
  };
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const v = t.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export const repo = createRepo();
