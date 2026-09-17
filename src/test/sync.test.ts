// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRepo } from '../db/repo';
import { StudyDB } from '../db/schema';
import { base64ToBytes, bytesToBase64, GitHubError, type GitApi, type TreeEntry } from '../sync/github';
import { syncWithRemote } from '../sync/sync';

const T = '2026-09-17';
let n = 0;
const fresh = () => new StudyDB(`sy_${Date.now()}_${n++}`);
const tick = () => new Promise((r) => setTimeout(r, 3));

function img(id: string, fill = 1) {
  return { id, blob: new Blob([new Uint8Array(40).fill(fill)], { type: 'image/jpeg' }), width: 4, height: 4 };
}

/** 内存版 GitHub：blob / tree / commit / ref，updateRef 要求快进 */
class FakeGitHub {
  blobs = new Map<string, Uint8Array>();
  trees = new Map<string, Map<string, string>>();
  commits = new Map<string, { tree: string; parents: string[] }>();
  ref: string | null = null;
  seq = 0;
  commitCount = 0;
  blobCreates = 0;
  /** 在下一次 updateRef 前执行（模拟另一台设备抢先推送） */
  beforeUpdateRef: (() => Promise<void>) | null = null;

  private id(prefix: string) {
    return `${prefix}${++this.seq}`;
  }

  api(): GitApi {
    return {
      getRepo: async () => ({ private: true, defaultBranch: 'main', canPush: true }),
      getHead: async () => (this.ref ? { commitSha: this.ref, treeSha: this.commits.get(this.ref)!.tree } : null),
      initRepo: async () => {
        const b = this.id('b');
        this.blobs.set(b, new TextEncoder().encode('# readme'));
        const t = this.id('t');
        this.trees.set(t, new Map([['README.md', b]]));
        const c = this.id('c');
        this.commits.set(c, { tree: t, parents: [] });
        this.ref = c;
      },
      getTree: async (sha) => new Map(this.trees.get(sha)!),
      getBlob: async (sha) => {
        const b = this.blobs.get(sha);
        if (!b) throw new GitHubError(404, 'no blob');
        return b;
      },
      createBlob: async (bytes) => {
        this.blobCreates++;
        const b = this.id('b');
        this.blobs.set(b, bytes.slice());
        return b;
      },
      createTree: async (base, entries: TreeEntry[]) => {
        const m = new Map(this.trees.get(base)!);
        for (const e of entries) {
          if (e.sha === null) m.delete(e.path);
          else m.set(e.path, e.sha);
        }
        const t = this.id('t');
        this.trees.set(t, m);
        return t;
      },
      createCommit: async (_msg, tree, parents) => {
        const c = this.id('c');
        this.commits.set(c, { tree, parents });
        return c;
      },
      updateRef: async (_branch, sha) => {
        if (this.beforeUpdateRef) {
          const f = this.beforeUpdateRef;
          this.beforeUpdateRef = null;
          await f();
        }
        if (this.commits.get(sha)!.parents[0] !== this.ref) throw new GitHubError(422, 'Update is not a fast forward');
        this.ref = sha;
        this.commitCount++;
      },
    };
  }

  files(): string[] {
    return [...this.trees.get(this.commits.get(this.ref!)!.tree)!.keys()].sort();
  }
}

describe('base64', () => {
  it('往返一致（含大于分块的数据）', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});

describe('syncWithRemote', () => {
  it('两台设备：录入、拉取、删除、评分后数据一致；无变化不提交', async () => {
    const gh = new FakeGitHub();
    const a = fresh();
    const b = fresh();
    const ra = createRepo(a);
    const rb = createRepo(b);

    const n1 = await ra.createNote({ title: '一', subject: '政治', body: 'x', tags: [] }, [img('p1'), img('p2', 2)], T);
    const n2 = await ra.createNote({ title: '二', subject: '英语', body: 'y', tags: [] }, [], T);
    const r1 = await syncWithRemote(a, gh.api());
    expect(r1.committed).toBe(true);
    expect(r1.uploadedImages).toBe(2);
    expect(gh.files()).toEqual(['README.md', 'data.json', 'images/p1.jpg', 'images/p2.jpg']);

    // A 再同步：无变化
    const r1b = await syncWithRemote(a, gh.api());
    expect(r1b.committed).toBe(false);
    const commits = gh.commitCount;

    // B 首次同步拉到全部
    const r2 = await syncWithRemote(b, gh.api());
    expect(r2.pulled.notes).toBe(2);
    expect(r2.pulled.images).toBe(2);
    expect(r2.committed).toBe(false);
    expect(gh.commitCount).toBe(commits);
    expect((await b.images.get('p2'))!.blob.size).toBe(40);

    // B 删除笔记一，A 给笔记二评分
    await tick();
    await rb.deleteNote(n1);
    await tick();
    await ra.applyReview('note', n2, 2, '2026-09-18');

    await syncWithRemote(b, gh.api());
    expect(gh.files()).toEqual(['README.md', 'data.json']);
    await syncWithRemote(a, gh.api());
    await syncWithRemote(b, gh.api());

    for (const d of [a, b]) {
      expect(await d.notes.count()).toBe(1);
      expect(await d.images.count()).toBe(0);
      expect((await d.notes.get(n2))!.stage).toBe(1);
      expect(await d.reviewLogs.count()).toBe(1);
    }
    const before = gh.commitCount;
    expect((await syncWithRemote(a, gh.api())).committed).toBe(false);
    expect((await syncWithRemote(b, gh.api())).committed).toBe(false);
    expect(gh.commitCount).toBe(before);
  });

  it('推送冲突（422）时重新合并并重试成功', async () => {
    const gh = new FakeGitHub();
    const a = fresh();
    const b = fresh();
    await createRepo(a).createNote({ title: 'A', subject: 's', body: '', tags: [] }, [], T);
    await createRepo(b).createNote({ title: 'B', subject: 's', body: '', tags: [] }, [img('bp')], T);
    await syncWithRemote(b, gh.api());

    const c = fresh();
    await createRepo(c).createNote({ title: 'C', subject: 's', body: '', tags: [] }, [], T);
    // A 推送前，C 抢先推送
    gh.beforeUpdateRef = async () => {
      await syncWithRemote(c, gh.api());
    };
    const r = await syncWithRemote(a, gh.api());
    expect(r.attempts).toBe(2);
    expect(r.committed).toBe(true);

    await syncWithRemote(b, gh.api());
    const titles = (await b.notes.toArray()).map((x) => x.title).sort();
    expect(titles).toEqual(['A', 'B', 'C']);
  });

  it('空仓库自动初始化；遮挡修改只更新 data.json 不重传图片', async () => {
    const gh = new FakeGitHub();
    const a = fresh();
    const ra = createRepo(a);
    const id = await ra.createNote({ title: 't', subject: 's', body: '', tags: [] }, [img('q')], T);
    await syncWithRemote(a, gh.api());
    expect(gh.ref).not.toBeNull();
    const blobs = gh.blobCreates;
    await tick();
    await ra.updateNote(id, { title: 't', subject: 's', body: '', tags: [] }, [{ ...img('q'), masks: [{ id: 'm', x: 0, y: 0, w: 0.5, h: 0.5 }] }]);
    const r = await syncWithRemote(a, gh.api());
    expect(r.committed).toBe(true);
    expect(r.uploadedImages).toBe(0);
    expect(gh.blobCreates - blobs).toBe(1);

    const b = fresh();
    await syncWithRemote(b, gh.api());
    expect((await b.images.get('q'))!.masks).toHaveLength(1);
  });

  it('失败时保留待同步标记', async () => {
    const gh = new FakeGitHub();
    const a = fresh();
    await createRepo(a).createNote({ title: 't', subject: 's', body: '', tags: [] }, [], T);
    const api = gh.api();
    api.createCommit = async () => {
      throw new GitHubError(403, 'forbidden');
    };
    await expect(syncWithRemote(a, api)).rejects.toThrow('forbidden');
    expect((await a.meta.get('syncDirty'))?.value).toBe(true);
  });
});
