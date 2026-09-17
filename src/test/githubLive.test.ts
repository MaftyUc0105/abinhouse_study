// @vitest-environment node
/**
 * 对真实 GitHub 仓库的同步测试。默认跳过；需要时这样运行（令牌只经环境变量传入）：
 *   GH_LIVE_TOKEN=$(gh auth token) GH_LIVE_REPO=用户名/仓库 npx vitest run src/test/githubLive.test.ts
 * 注意：会向该仓库写入测试数据，只能指向专门的测试仓库或确认可以写入的数据仓库。
 */
import { describe, expect, it } from 'vitest';
import { createRepo } from '../db/repo';
import { StudyDB } from '../db/schema';
import { createGitHubApi } from '../sync/github';
import { syncWithRemote } from '../sync/sync';

const token = process.env.GH_LIVE_TOKEN;
const [owner, repo] = (process.env.GH_LIVE_REPO ?? '').split('/');

describe.skipIf(!token || !owner || !repo)('真实 GitHub 同步', () => {
  it('上传、另一台设备拉取、无变化不提交、删除传播', { timeout: 120_000 }, async () => {
    const api = createGitHubApi({ owner, repo, token: token! });
    const info = await api.getRepo();
    expect(info.private).toBe(true);

    const a = new StudyDB(`live_a_${Date.now()}`);
    const ra = createRepo(a);
    const blob = new Blob([new Uint8Array(2048).map((_, i) => i % 256)], { type: 'image/jpeg' });
    const noteId = await ra.createNote(
      { title: '联调测试笔记', subject: '测试', body: '同步验证', tags: [] },
      [{ id: `live-${Date.now()}`, blob, width: 10, height: 10, masks: [{ id: 'm', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }] }],
      '2026-09-17',
    );

    const r1 = await syncWithRemote(a, api);
    expect(r1.committed).toBe(true);
    expect(r1.uploadedImages).toBe(1);

    const r2 = await syncWithRemote(a, api);
    expect(r2.committed).toBe(false);

    const b = new StudyDB(`live_b_${Date.now()}`);
    const r3 = await syncWithRemote(b, api);
    expect(r3.pulled.notes).toBeGreaterThanOrEqual(1);
    const img = (await b.images.where('ownerId').equals(noteId).first())!;
    expect(img.blob.size).toBe(2048);
    expect(img.masks).toHaveLength(1);

    // 清理：删除测试笔记并同步，云端图片随之删除
    await createRepo(b).deleteNote(noteId);
    const r4 = await syncWithRemote(b, api);
    expect(r4.deletedImages).toBe(1);
    const r5 = await syncWithRemote(a, api);
    expect(r5.pulled.deleted).toBeGreaterThanOrEqual(1);
    expect(await a.notes.get(noteId)).toBeUndefined();
  });
});
