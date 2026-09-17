/**
 * 所有写操作集中在这里，UI 不直接调 db.*.put。
 * 便于将来加云同步、软删除等。
 */
import { nanoid } from 'nanoid';
import { applyRating, initialScheduling } from '../scheduler/scheduler';
import { today } from '../scheduler/dates';
import { db as defaultDb, type StudyDB } from './schema';
import { ensureSettings, validateSettings } from './seedSettings';
import type {
  Card,
  ImageRecord,
  ImageSlot,
  ItemType,
  LocalDate,
  Note,
  Rating,
  ReviewLog,
  Scheduling,
  Settings,
} from './types';

/** 编辑器里待保存的图片；已入库的图片 id 与库中一致 */
export interface ImageInput {
  id: string;
  blob: Blob;
  width: number;
  height: number;
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

export function createRepo(db: StudyDB = defaultDb) {
  const allTables = [db.notes, db.cards, db.images, db.reviewLogs, db.subjects, db.settings];

  async function ensureSubject(name: string): Promise<void> {
    const n = name.trim();
    if (!n) return;
    const existing = await db.subjects.get(n);
    if (!existing) await db.subjects.put({ name: n, createdAt: Date.now() });
  }

  /** 让 owner+slot 下的图片与 items 一致：删多余、加新增、更新顺序 */
  async function syncImages(
    ownerType: ItemType,
    ownerId: string,
    slot: ImageSlot,
    items: ImageInput[],
  ): Promise<void> {
    const existing = await db.images.where({ ownerType, ownerId }).filter((i) => i.slot === slot).toArray();
    const keep = new Set(items.map((i) => i.id));
    const toDelete = existing.filter((i) => !keep.has(i.id)).map((i) => i.id);
    if (toDelete.length) await db.images.bulkDelete(toDelete);

    const existingMap = new Map(existing.map((i) => [i.id, i]));
    const now = Date.now();
    const records: ImageRecord[] = items.map((it, order) => {
      const prev = existingMap.get(it.id);
      return prev
        ? { ...prev, order }
        : {
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
          };
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
    await db.transaction('rw', db.notes, db.images, db.subjects, async () => {
      await db.notes.put(note);
      await syncImages('note', note.id, 'body', images);
      await ensureSubject(note.subject);
    });
    return note.id;
  }

  async function updateNote(id: string, input: NoteInput, images?: ImageInput[]) {
    await db.transaction('rw', db.notes, db.images, db.subjects, async () => {
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
  }

  async function deleteNote(id: string) {
    await db.transaction('rw', db.notes, db.cards, db.images, db.reviewLogs, async () => {
      const cardIds = await db.cards.where('noteId').equals(id).primaryKeys();
      await db.notes.delete(id);
      await db.cards.bulkDelete(cardIds);
      await db.images.where('ownerId').equals(id).delete();
      for (const cid of cardIds) await db.images.where('ownerId').equals(cid).delete();
      await db.reviewLogs.where('[itemType+itemId]').equals(['note', id]).delete();
      for (const cid of cardIds) await db.reviewLogs.where('[itemType+itemId]').equals(['card', cid]).delete();
    });
  }

  async function createCards(noteId: string, inputs: CardInput[], todayDate: LocalDate = today()) {
    const ids: string[] = [];
    await db.transaction('rw', db.cards, db.images, db.notes, async () => {
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
    return ids;
  }

  async function updateCard(id: string, input: CardInput) {
    await db.transaction('rw', db.cards, db.images, async () => {
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
  }

  async function deleteCard(id: string) {
    await db.transaction('rw', db.cards, db.images, db.reviewLogs, async () => {
      await db.cards.delete(id);
      await db.images.where('ownerId').equals(id).delete();
      await db.reviewLogs.where('[itemType+itemId]').equals(['card', id]).delete();
    });
  }

  async function setSuspended(type: ItemType, id: string, suspended: boolean) {
    const table = type === 'note' ? db.notes : db.cards;
    await table.update(id, { suspended, updatedAt: Date.now() });
  }

  /** 把条目重置为新条目（明天到期、stage 0），保留历史日志 */
  async function resetScheduling(type: ItemType, id: string, todayDate: LocalDate = today()) {
    const table = type === 'note' ? db.notes : db.cards;
    await table.update(id, { ...initialScheduling(todayDate), updatedAt: Date.now() });
  }

  /** 复习评分：更新调度状态并写一条日志。返回新的调度状态 */
  async function applyReview(
    type: ItemType,
    id: string,
    rating: Rating,
    todayDate: LocalDate = today(),
  ): Promise<Scheduling> {
    const table = type === 'note' ? db.notes : db.cards;
    return db.transaction('rw', table, db.reviewLogs, db.settings, async () => {
      const item = await table.get(id);
      if (!item) throw new Error('条目不存在');
      const cfg = await ensureSettings(db);
      const now = Date.now();
      const next = applyRating(item, rating, todayDate, cfg, now);
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
      await db.reviewLogs.add(log);
      return next;
    });
  }

  async function getSettings(): Promise<Settings> {
    return ensureSettings(db);
  }

  async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
    const err = validateSettings(patch);
    if (err) throw new Error(err);
    const current = await ensureSettings(db);
    const next: Settings = { ...current, ...patch, id: 'default' };
    await db.settings.put(next);
    return next;
  }

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
