// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createRepo } from '../db/repo';
import { StudyDB } from '../db/schema';

const T = '2026-09-17';
let repo: ReturnType<typeof createRepo>;
let db: StudyDB;
let counter = 0;

function img(id: string, bytes = 10) {
  return { id, blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), width: 10, height: 10 };
}

beforeEach(async () => {
  db = new StudyDB(`test_${Date.now()}_${counter++}`);
  repo = createRepo(db);
});

describe('repo', () => {
  it('创建笔记：调度初始化、科目入表、图片入库', async () => {
    const id = await repo.createNote({ title: ' 标题 ', subject: '政治', body: 'x', tags: ['a', 'a', ' b '] }, [img('i1'), img('i2')], T);
    const n = (await db.notes.get(id))!;
    expect(n.title).toBe('标题');
    expect(n.tags).toEqual(['a', 'b']);
    expect(n.dueDate).toBe('2026-09-18');
    expect(await db.subjects.get('政治')).toBeTruthy();
    const imgs = await db.images.where({ ownerType: 'note', ownerId: id }).sortBy('order');
    expect(imgs.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(imgs[0].size).toBe(10);
  });

  it('syncImages：删除、新增、重排', async () => {
    const id = await repo.createNote({ title: 't', subject: 's', body: '', tags: [] }, [img('i1'), img('i2')], T);
    await repo.updateNote(id, { title: 't', subject: 's', body: '', tags: [] }, [img('i3'), img('i1')]);
    const imgs = await db.images.where({ ownerType: 'note', ownerId: id }).sortBy('order');
    expect(imgs.map((i) => i.id)).toEqual(['i3', 'i1']);
  });

  it('applyReview 更新状态并写日志', async () => {
    const id = await repo.createNote({ title: 't', subject: 's', body: '', tags: [] }, [], T);
    const next = await repo.applyReview('note', id, 2, '2026-09-18');
    expect(next.stage).toBe(1);
    expect(next.dueDate).toBe('2026-09-20');
    const logs = await db.reviewLogs.where('[itemType+itemId]').equals(['note', id]).toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ rating: 2, stageBefore: 0, stageAfter: 1, intervalDays: 2, date: '2026-09-18', dueBefore: '2026-09-18' });
  });

  it('deleteNote 级联删除卡片、图片、日志', async () => {
    const id = await repo.createNote({ title: 't', subject: 's', body: '', tags: [] }, [img('n')], T);
    const [cid] = await repo.createCards(id, [{ question: 'q', answer: 'a', questionImages: [img('cq')] }], T);
    await repo.applyReview('card', cid, 3, T);
    await repo.deleteNote(id);
    expect(await db.notes.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
    expect(await db.images.count()).toBe(0);
    expect(await db.reviewLogs.count()).toBe(0);
  });

  it('createCards 顺序递增', async () => {
    const id = await repo.createNote({ title: 't', subject: 's', body: '', tags: [] }, [], T);
    await repo.createCards(id, [{ question: 'a', answer: '' }, { question: 'b', answer: '' }], T);
    await repo.createCards(id, [{ question: 'c', answer: '' }], T);
    const cards = await db.cards.where('noteId').equals(id).sortBy('order');
    expect(cards.map((c) => [c.question, c.order])).toEqual([['a', 0], ['b', 1], ['c', 2]]);
  });

  it('updateSettings 校验阶梯', async () => {
    await expect(repo.updateSettings({ ladder: [1, 1] })).rejects.toThrow('递增');
    const s = await repo.updateSettings({ ladder: [1, 3, 9], dailyNewCap: 5 });
    expect(s.ladder).toEqual([1, 3, 9]);
    expect((await repo.getSettings()).dailyNewCap).toBe(5);
  });
});
