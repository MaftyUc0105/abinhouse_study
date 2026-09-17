// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { importBackup, parseBackup } from '../db/backup';
import { buildSnapshot } from '../db/merge';
import { bytesToBase64 } from '../utils/base64';
import { createRepo } from '../db/repo';
import { StudyDB } from '../db/schema';
import { getBackupReminder, markBackedUp, snoozeBackupReminder } from '../utils/backupShare';

const T = '2026-09-17';
const DAY = 86_400_000;
let n = 0;
const fresh = () => new StudyDB(`bs_${Date.now()}_${n++}`);

/** 构造旧版 .txt 文本备份（照片 base64 内嵌） */
async function textBackup(db: StudyDB): Promise<Blob> {
  const { snapshot, blobs } = await buildSnapshot(db);
  const imageData: Record<string, string> = {};
  for (const [id, b] of blobs) imageData[id] = bytesToBase64(new Uint8Array(await b.arrayBuffer()));
  return new Blob([JSON.stringify({ app: 'abinhouse_study', version: 2, exportedAt: Date.now(), ...snapshot, imageData })], { type: 'text/plain' });
}

function img(id: string, bytes = 5000) {
  return { id, blob: new Blob([new Uint8Array(bytes).map((_, i) => (i * 13) % 256)], { type: 'image/jpeg' }), width: 4, height: 4 };
}

describe('兼容导入 .txt 文本备份', () => {
  it('覆盖导入后笔记、照片内容、遮挡、日志完整还原', async () => {
    const src = fresh();
    const repo = createRepo(src);
    const mask = { id: 'm', x: 0.1, y: 0.2, w: 0.3, h: 0.1 };
    const id = await repo.createNote({ title: '文本备份', subject: '政治', body: 'b', tags: [] }, [{ ...img('a'), masks: [mask] }, img('b', 70000)], T);
    const [cid] = await repo.createCards(id, [{ question: 'q', answer: 'a' }], T);
    await repo.applyReview('card', cid, 2, T);

    const blob = await textBackup(src);

    const dst = fresh();
    const r = await importBackup(dst, blob, 'replace');
    expect(r).toMatchObject({ notes: 1, cards: 1, images: 2, reviewLogs: 1, missingImages: 0, skipped: 0 });
    const a = (await dst.images.get('a'))!;
    const b = (await dst.images.get('b'))!;
    expect(a.masks).toEqual([mask]);
    expect(b.blob.size).toBe(70000);
    const orig = new Uint8Array(await (await src.images.get('b'))!.blob.arrayBuffer());
    expect(new Uint8Array(await b.blob.arrayBuffer())).toEqual(orig);
  });

  it('非法文本被拒绝，缺少图片数据时计为缺图', async () => {
    await expect(parseBackup(new Blob(['hello']))).rejects.toThrow('不是有效的备份文件');
    const src = fresh();
    await createRepo(src).createNote({ title: 't', subject: 's', body: '', tags: [] }, [img('x')], T);
    const json = JSON.parse(await (await textBackup(src)).text());
    delete json.imageData.x;
    const p = await parseBackup(new Blob([JSON.stringify(json)]));
    expect(p.missingImages).toBe(1);
  });
});

describe('备份提醒', () => {
  it('没有数据不提醒；笔记满 7 天未备份才提醒；备份或同步后不提醒；稍后提醒生效', async () => {
    const db = fresh();
    const now = Date.now();
    expect((await getBackupReminder(db, now)).show).toBe(false);

    await createRepo(db).createNote({ title: 't', subject: 's', body: '', tags: [] }, [], T);
    expect((await getBackupReminder(db, now)).show).toBe(false);
    const later = now + 8 * DAY;
    expect(await getBackupReminder(db, later)).toEqual({ show: true, days: null });

    await markBackedUp(db, now + 2 * DAY);
    expect(await getBackupReminder(db, later)).toEqual({ show: false, days: 6 });
    expect(await getBackupReminder(db, now + 10 * DAY)).toEqual({ show: true, days: 8 });

    await db.meta.put({ key: 'lastSyncAt', value: now + 9 * DAY });
    expect((await getBackupReminder(db, now + 10 * DAY)).show).toBe(false);

    await db.meta.delete('lastSyncAt');
    await snoozeBackupReminder(db, 1, now + 10 * DAY);
    expect((await getBackupReminder(db, now + 10 * DAY + 3600_000)).show).toBe(false);
    expect((await getBackupReminder(db, now + 11 * DAY + 60_000)).show).toBe(true);
  });
});
