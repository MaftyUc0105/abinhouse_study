import type { Card, ItemType, LocalDate, Note, Scheduling } from '../db/types';
import { daysBetween } from './dates';
import { INTENSITY_WEIGHT, intensity } from './scheduler';

/** 今日队列中的一项：笔记或卡片的统一视图 */
export interface QueueItem extends Scheduling {
  type: ItemType;
  id: string;
  /** 笔记标题 / 卡片问题 */
  title: string;
  subject: string;
  /** 卡片所属笔记 id（笔记本身为自己的 id） */
  noteId: string;
  /** 卡片所属笔记标题 */
  noteTitle: string;
}

export function noteToQueueItem(n: Note): QueueItem {
  return {
    type: 'note',
    id: n.id,
    title: n.title,
    subject: n.subject,
    noteId: n.id,
    noteTitle: n.title,
    stage: n.stage,
    dueDate: n.dueDate,
    lastReviewedAt: n.lastReviewedAt,
    lastInterval: n.lastInterval,
    reviewCount: n.reviewCount,
    lapseCount: n.lapseCount,
    recentRatings: n.recentRatings,
    suspended: n.suspended,
  };
}

export function cardToQueueItem(c: Card, note: Pick<Note, 'id' | 'title' | 'subject'>): QueueItem {
  return {
    type: 'card',
    id: c.id,
    title: c.question,
    subject: note.subject,
    noteId: note.id,
    noteTitle: note.title,
    stage: c.stage,
    dueDate: c.dueDate,
    lastReviewedAt: c.lastReviewedAt,
    lastInterval: c.lastInterval,
    reviewCount: c.reviewCount,
    lapseCount: c.lapseCount,
    recentRatings: c.recentRatings,
    suspended: c.suspended,
  };
}

export function isNew(i: Scheduling): boolean {
  return i.reviewCount === 0;
}

/**
 * 今日队列排序：
 * 1. 逾期天数多者在前（新条目视为 -1，排最后）
 * 2. 同逾期按强度：重点 > 注意 > 正常 > 稳固
 * 3. 同强度按 dueDate 早者在前
 */
export function sortQueue(items: QueueItem[], todayDate: LocalDate): QueueItem[] {
  return items
    .filter((i) => !i.suspended && i.dueDate <= todayDate)
    .sort((a, b) => {
      const oa = isNew(a) ? -1 : daysBetween(a.dueDate, todayDate);
      const ob = isNew(b) ? -1 : daysBetween(b.dueDate, todayDate);
      if (oa !== ob) return ob - oa;
      const wa = INTENSITY_WEIGHT[intensity(a.recentRatings)];
      const wb = INTENSITY_WEIGHT[intensity(b.recentRatings)];
      if (wa !== wb) return wa - wb;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });
}

/** 每日新条目上限：只截断从未复习过的条目，到期项永不截断。cap = 0 表示不限 */
export function applyNewCap(sorted: QueueItem[], cap: number): QueueItem[] {
  if (cap <= 0) return sorted;
  let newSeen = 0;
  return sorted.filter((i) => {
    if (!isNew(i)) return true;
    newSeen += 1;
    return newSeen <= cap;
  });
}

export function buildQueue(
  notes: Note[],
  cards: Card[],
  todayDate: LocalDate,
  dailyNewCap: number,
): QueueItem[] {
  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const items: QueueItem[] = notes.map(noteToQueueItem);
  for (const c of cards) {
    const n = noteMap.get(c.noteId);
    if (n) items.push(cardToQueueItem(c, n));
  }
  return applyNewCap(sortQueue(items, todayDate), dailyNewCap);
}
