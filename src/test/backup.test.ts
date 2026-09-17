// @vitest-environment node
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup, parseBackup } from '../db/backup';
import { createRepo } from '../db/repo';
import { StudyDB } from '../db/schema';

const T = '2026-09-17';
let n = 0;
const fresh = () => new StudyDB(`bk_${Date.now()}_${n++}`);

function img(id: string, bytes = 20) {
  return { id, blob: new Blob([new Uint8Array(bytes).fill(7)], { type: 'image/jpeg' }), width: 4, height: 4 };
}

async function seed(db: StudyDB) {
  const repo = createRepo(db);
  const noteId = await repo.createNote({ title: 'n', subject: '政治', body: 'b', tags: ['t'] }, [img('i1'), img('i2')], T);
  const [cardId] = await repo.createCards(noteId, [{ question: 'q', answer: 'a', answerImages: [img('i3')] }], T);
  await repo.applyReview('note', noteId, 2, '2026-09-18');
  await repo.applyReview('card', cardId, 0, '2026-09-18');
  await repo.updateSettings({ dailyNewCap: 7 });
  return { repo, noteId, cardId };
}

let src: StudyDB;
beforeEach(() => {
  src = fresh();
});

describe('backup', () => {
  it('导出 → 覆盖导入 round-trip', async () => {
    const { noteId } = await seed(src);
    const blob = await exportBackup(src);
    expect(blob.size).toBeGreaterThan(0);

    const dst = fresh();
    await createRepo(dst).createNote({ title: 'old', subject: 's', body: '', tags: [] }, [], T);
    const r = await importBackup(dst, blob, 'replace');
    expect(r).toMatchObject({ notes: 1, cards: 1, images: 3, reviewLogs: 2, subjects: 1, missingImages: 0, skipped: 0 });
    expect(await dst.notes.count()).toBe(1);
    expect((await dst.notes.get(noteId))!.stage).toBe(1);
    const imgs = await dst.images.toArray();
    expect(imgs.map((i) => i.size).sort()).toEqual([20, 20, 20]);
    expect(imgs.every((i) => i.blob.size === 20)).toBe(true);
    expect((await dst.settings.get('default'))!.dailyNewCap).toBe(7);
  });

  it('合并导入：同 id 取较新者，日志去重，不覆盖设置', async () => {
    const { repo, noteId } = await seed(src);
    const blob = await exportBackup(src);

    // 本机继续修改：标题更新（更新时间更晚）
    await new Promise((r) => setTimeout(r, 5));
    await repo.updateNote(noteId, { title: 'newer', subject: '政治', body: 'b', tags: [] });
    await repo.updateSettings({ dailyNewCap: 3 });

    const r = await importBackup(src, blob, 'merge');
    expect(r.notes).toBe(0);
    expect(r.reviewLogs).toBe(0);
    expect(r.images).toBe(0);
    expect((await src.notes.get(noteId))!.title).toBe('newer');
    expect(await src.reviewLogs.count()).toBe(2);
    expect((await src.settings.get('default'))!.dailyNewCap).toBe(3);

    // 备份里较新的会覆盖本机
    const dst = fresh();
    await importBackup(dst, blob, 'replace');
    await new Promise((r) => setTimeout(r, 5));
    await createRepo(dst).updateNote(noteId, { title: 'from-backup-side', subject: '政治', body: 'b', tags: [] });
    const blob2 = await exportBackup(dst);
    const r2 = await importBackup(src, blob2, 'merge');
    expect(r2.notes).toBe(1);
    expect((await src.notes.get(noteId))!.title).toBe('from-backup-side');
  });

  it('缺图被计数，无效条目被跳过', async () => {
    await seed(src);
    const blob = await exportBackup(src);
    const zip = await JSZip.loadAsync(blob);
    zip.remove('images/i2.jpg');
    const json = JSON.parse(await zip.file('backup.json')!.async('string'));
    json.cards.push({ id: 'bad', noteId: 'ghost' });
    json.notes.push({ id: 'bad-note', title: 1 });
    zip.file('backup.json', JSON.stringify(json));
    const patched = await zip.generateAsync({ type: 'blob' });

    const p = await parseBackup(patched);
    expect(p.missingImages).toBe(1);
    expect(p.skipped).toBe(2);
    expect(p.images).toHaveLength(2);
  });

  it('拒绝非法文件', async () => {
    await expect(parseBackup(new Blob(['hello']))).rejects.toThrow('ZIP');
    const zip = new JSZip();
    zip.file('backup.json', JSON.stringify({ app: 'other', version: 1 }));
    await expect(parseBackup(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('本应用');
  });
});
