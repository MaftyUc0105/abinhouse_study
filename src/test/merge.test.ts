// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSnapshot, canonicalJson, mergeSnapshot } from '../db/merge';
import { createRepo } from '../db/repo';
import { StudyDB } from '../db/schema';

const T = '2026-09-17';
let n = 0;
const fresh = () => new StudyDB(`mg_${Date.now()}_${n++}`);
const tick = () => new Promise((r) => setTimeout(r, 3));

function img(id: string) {
  return { id, blob: new Blob([new Uint8Array(30).fill(1)], { type: 'image/jpeg' }), width: 4, height: 4 };
}

/** 把 from 的快照合并进 to（模拟一次同步拉取） */
async function pull(from: StudyDB, to: StudyDB) {
  const { snapshot, blobs } = await buildSnapshot(from);
  return mergeSnapshot(to, snapshot, async (m) => blobs.get(m.id) ?? null, { mergeSettings: true });
}

describe('mergeSnapshot', () => {
  it('拉取新笔记、卡片、图片、日志、设置', async () => {
    const a = fresh();
    const b = fresh();
    const ra = createRepo(a);
    const id = await ra.createNote({ title: 'n', subject: '英语', body: '', tags: [] }, [img('i1')], T);
    const [cid] = await ra.createCards(id, [{ question: 'q', answer: 'a' }], T);
    await ra.applyReview('card', cid, 2, T);
    await ra.updateSettings({ examDate: '2026-12-20' });

    const r = await pull(a, b);
    expect(r).toMatchObject({ notes: 1, cards: 1, images: 1, reviewLogs: 1, subjects: 1, missingImages: 0 });
    expect((await b.images.get('i1'))!.blob.size).toBe(30);
    expect((await b.settings.get('default'))!.examDate).toBe('2026-12-20');

    // 再拉一次没有变化
    const again = await pull(a, b);
    expect(again).toMatchObject({ notes: 0, cards: 0, images: 0, reviewLogs: 0, deleted: 0 });
  });

  it('删除通过墓碑传播，不会被旧数据复活', async () => {
    const a = fresh();
    const b = fresh();
    const ra = createRepo(a);
    const rb = createRepo(b);
    const id = await ra.createNote({ title: 'n', subject: 's', body: '', tags: [] }, [img('x')], T);
    await ra.createCards(id, [{ question: 'q', answer: '' }], T);
    await pull(a, b);

    await tick();
    await rb.deleteNote(id);
    // A 仍有旧数据，B 拉 A：不能复活
    await pull(a, b);
    expect(await b.notes.count()).toBe(0);
    expect(await b.images.count()).toBe(0);
    // A 拉 B：删除传播过去，包括卡片、图片、日志
    const r = await pull(b, a);
    expect(r.deleted).toBeGreaterThan(0);
    expect(await a.notes.count()).toBe(0);
    expect(await a.cards.count()).toBe(0);
    expect(await a.images.count()).toBe(0);
  });

  it('删除之后在另一台设备上修改过的条目保留', async () => {
    const a = fresh();
    const b = fresh();
    const ra = createRepo(a);
    const id = await ra.createNote({ title: 'n', subject: 's', body: '', tags: [] }, [], T);
    await pull(a, b);
    await createRepo(b).deleteNote(id);
    await tick();
    await ra.updateNote(id, { title: '改过', subject: 's', body: '', tags: [] });
    await pull(a, b);
    expect((await b.notes.get(id))?.title).toBe('改过');
  });

  it('双向评分合并：新者为准，日志并集', async () => {
    const a = fresh();
    const b = fresh();
    const ra = createRepo(a);
    const rb = createRepo(b);
    const n1 = await ra.createNote({ title: '1', subject: 's', body: '', tags: [] }, [], T);
    const n2 = await ra.createNote({ title: '2', subject: 's', body: '', tags: [] }, [], T);
    await pull(a, b);
    await tick();
    await ra.applyReview('note', n1, 3, '2026-09-18');
    await tick();
    await rb.applyReview('note', n2, 0, '2026-09-18');
    await pull(a, b);
    await pull(b, a);
    for (const d of [a, b]) {
      expect((await d.notes.get(n1))!.stage).toBe(2);
      expect((await d.notes.get(n2))!.lapseCount).toBe(1);
      expect(await d.reviewLogs.count()).toBe(2);
    }
    // 两边快照序列化完全一致
    const ja = canonicalJson((await buildSnapshot(a)).snapshot);
    const jb = canonicalJson((await buildSnapshot(b)).snapshot);
    expect(ja).toBe(jb);
  });

  it('遮挡修改按 updatedAt 合并，不重新下载图片', async () => {
    const a = fresh();
    const b = fresh();
    const ra = createRepo(a);
    const id = await ra.createNote({ title: 't', subject: 's', body: '', tags: [] }, [img('p')], T);
    await pull(a, b);
    await tick();
    const mask = { id: 'm', x: 0.1, y: 0.2, w: 0.3, h: 0.1 };
    await ra.updateNote(id, { title: 't', subject: 's', body: '', tags: [] }, [{ ...img('p'), masks: [mask] }]);
    let fetched = 0;
    const { snapshot } = await buildSnapshot(a);
    await mergeSnapshot(b, snapshot, async () => (fetched++, null), { mergeSettings: true });
    expect(fetched).toBe(0);
    expect((await b.images.get('p'))!.masks).toEqual([mask]);
  });

  it('canonicalJson 与键顺序无关', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe(canonicalJson({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 }));
  });
});
