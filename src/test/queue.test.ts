import { describe, expect, it } from 'vitest';
import type { Card, Note } from '../db/types';
import { initialScheduling } from '../scheduler/scheduler';
import { applyNewCap, buildQueue, sortQueue, type QueueItem } from '../scheduler/queue';

const T = '2026-09-17';

function note(id: string, over: Partial<Note> = {}): Note {
  return {
    id,
    title: id,
    subject: '政治',
    body: '',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    ...initialScheduling(T),
    dueDate: T,
    reviewCount: 1,
    ...over,
  };
}

function card(id: string, noteId: string, over: Partial<Card> = {}): Card {
  return {
    id,
    noteId,
    question: 'q' + id,
    answer: 'a',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...initialScheduling(T),
    dueDate: T,
    reviewCount: 1,
    ...over,
  };
}

describe('sortQueue', () => {
  it('过滤未到期与暂停项', () => {
    const items = buildQueue(
      [note('a', { dueDate: '2026-09-18' }), note('b', { suspended: true }), note('c')],
      [],
      T,
      0,
    );
    expect(items.map((i) => i.id)).toEqual(['c']);
  });

  it('逾期越久越靠前，新条目最后', () => {
    const items = buildQueue(
      [
        note('today'),
        note('over3', { dueDate: '2026-09-14' }),
        note('new', { reviewCount: 0, dueDate: '2026-09-10' }),
        note('over1', { dueDate: '2026-09-16' }),
      ],
      [],
      T,
      0,
    );
    expect(items.map((i) => i.id)).toEqual(['over3', 'over1', 'today', 'new']);
  });

  it('同逾期按强度：重点 > 注意 > 正常 > 稳固', () => {
    const items = buildQueue(
      [
        note('solid', { recentRatings: [2, 2, 3] }),
        note('normal', { recentRatings: [2] }),
        note('focus', { recentRatings: [0, 0] }),
        note('attention', { recentRatings: [1] }),
      ],
      [],
      T,
      0,
    );
    expect(items.map((i) => i.id)).toEqual(['focus', 'attention', 'normal', 'solid']);
  });

  it('卡片带上所属笔记的科目与标题；孤儿卡片被忽略', () => {
    const items = buildQueue([note('n1', { subject: '英语' })], [card('c1', 'n1'), card('c2', 'ghost')], T, 0);
    expect(items).toHaveLength(2);
    const c = items.find((i) => i.type === 'card')!;
    expect(c.subject).toBe('英语');
    expect(c.noteTitle).toBe('n1');
    expect(c.title).toBe('qc1');
  });
});

describe('applyNewCap', () => {
  it('只截断新条目，到期项不受影响', () => {
    const sorted: QueueItem[] = sortQueue(
      [
        note('due1'),
        note('due2'),
        note('n1', { reviewCount: 0 }),
        note('n2', { reviewCount: 0 }),
        note('n3', { reviewCount: 0 }),
      ].map((n) => ({ ...n, type: 'note' as const, noteId: n.id, noteTitle: n.title })),
      T,
    );
    expect(applyNewCap(sorted, 2).map((i) => i.id)).toEqual(['due1', 'due2', 'n1', 'n2']);
    expect(applyNewCap(sorted, 0)).toHaveLength(5);
  });
});
