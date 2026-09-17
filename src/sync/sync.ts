/**
 * 与 GitHub 私有仓库双向同步：
 * 拉取 data.json 合并进本地 → 生成本地快照 → 上传新图片与 data.json → 一次提交 → 快进更新分支。
 * 期间若另一台设备先推送（422），从头重试。
 */
import { blobToArrayBuffer } from '../db/backup';
import { buildSnapshot, canonicalJson, mergeSnapshot, validateSnapshot, type MergeResult } from '../db/merge';
import type { StudyDB } from '../db/schema';
import { DIRTY_KEY } from './changes';
import { GitHubError, type GitApi } from './github';

export const SYNC_APP = 'abinhouse_study';
export const SYNC_VERSION = 2;
export const DATA_PATH = 'data.json';
export const imagePath = (id: string) => `images/${id}.jpg`;

export interface SyncConfig {
  owner: string;
  repo: string;
  token: string;
  auto: boolean;
}

export const CONFIG_KEY = 'syncConfig';
export const LAST_SYNC_KEY = 'lastSyncAt';

export async function getSyncConfig(db: StudyDB): Promise<SyncConfig | null> {
  const r = await db.meta.get(CONFIG_KEY);
  const v = r?.value as SyncConfig | undefined;
  return v && v.owner && v.repo && v.token ? v : null;
}

export async function setSyncConfig(db: StudyDB, cfg: SyncConfig | null): Promise<void> {
  if (cfg) await db.meta.put({ key: CONFIG_KEY, value: cfg });
  else await db.meta.delete(CONFIG_KEY);
}

export interface SyncReport {
  committed: boolean;
  pulled: MergeResult;
  uploadedImages: number;
  deletedImages: number;
  attempts: number;
}

export type SyncProgress = (msg: string) => void;

const utf8 = new TextEncoder();
const utf8d = new TextDecoder();

/** 把 GitHub 错误翻译成用户能看懂的话 */
export function describeSyncError(e: unknown): string {
  if (e instanceof GitHubError) {
    if (e.status === 401) return '令牌无效或已过期，请重新填写';
    if (e.status === 403) return '令牌没有这个仓库的读写权限（需要 Contents: Read and write）';
    if (e.status === 404) return '找不到仓库：检查仓库名，或令牌没有授权这个仓库';
    return `GitHub 返回错误 ${e.status}：${e.message}`;
  }
  if (e instanceof TypeError) return '网络连接失败';
  return e instanceof Error ? e.message : String(e);
}

export async function syncWithRemote(db: StudyDB, api: GitApi, onProgress: SyncProgress = () => {}): Promise<SyncReport> {
  // 开始时清掉 dirty：同步期间的新写入会重新标记，触发下一轮
  await db.meta.put({ key: DIRTY_KEY, value: false });
  try {
    onProgress('连接仓库…');
    const info = await api.getRepo();
    const branch = info.defaultBranch;

    for (let attempt = 1; attempt <= 3; attempt++) {
      let head = await api.getHead(branch);
      if (!head) {
        onProgress('初始化仓库…');
        await api.initRepo(branch);
        head = await api.getHead(branch);
        if (!head) throw new Error('仓库初始化失败');
      }
      const tree = await api.getTree(head.treeSha);

      // 1. 拉取
      onProgress('下载云端数据…');
      let remoteText: string | null = null;
      const dataSha = tree.get(DATA_PATH);
      let pulled: MergeResult = { notes: 0, cards: 0, images: 0, reviewLogs: 0, subjects: 0, deleted: 0, missingImages: 0 };
      if (dataSha) {
        remoteText = utf8d.decode(await api.getBlob(dataSha));
        const raw = JSON.parse(remoteText) as Record<string, unknown>;
        if (raw.app !== SYNC_APP) throw new Error('仓库里的 data.json 不是本应用的数据');
        if (typeof raw.version === 'number' && raw.version > SYNC_VERSION) throw new Error('云端数据来自更新版本的应用，请先刷新应用');
        const { snapshot } = validateSnapshot(raw);
        let n = 0;
        pulled = await mergeSnapshot(
          db,
          snapshot,
          async (m) => {
            const sha = tree.get(imagePath(m.id));
            if (!sha) return null;
            onProgress(`下载图片 ${++n}…`);
            return new Blob([await api.getBlob(sha)], { type: 'image/jpeg' });
          },
          { mergeSettings: true },
        );
      }

      // 2. 生成本地快照
      const { snapshot, blobs } = await buildSnapshot(db);
      const text = canonicalJson({ app: SYNC_APP, version: SYNC_VERSION, ...snapshot });
      const deadImages = new Set(snapshot.tombstones.filter((t) => t.key.startsWith('image:')).map((t) => t.key.slice(6)));
      const uploads = [...blobs.keys()].filter((id) => !tree.has(imagePath(id)));
      const deletions = [...tree.keys()].filter((p) => {
        const m = /^images\/(.+)\.jpg$/.exec(p);
        return m && deadImages.has(m[1]) && !blobs.has(m[1]);
      });

      if (text === remoteText && uploads.length === 0 && deletions.length === 0) {
        await db.meta.put({ key: LAST_SYNC_KEY, value: Date.now() });
        return { committed: false, pulled, uploadedImages: 0, deletedImages: 0, attempts: attempt };
      }

      // 3. 上传
      const entries: { path: string; sha: string | null }[] = [];
      for (let i = 0; i < uploads.length; i++) {
        onProgress(`上传图片 ${i + 1}/${uploads.length}…`);
        const bytes = new Uint8Array(await blobToArrayBuffer(blobs.get(uploads[i])!));
        entries.push({ path: imagePath(uploads[i]), sha: await api.createBlob(bytes) });
      }
      if (text !== remoteText) {
        onProgress('上传数据…');
        entries.push({ path: DATA_PATH, sha: await api.createBlob(utf8.encode(text)) });
      }
      for (const p of deletions) entries.push({ path: p, sha: null });

      const newTree = await api.createTree(head.treeSha, entries);
      const commit = await api.createCommit(
        `同步：${snapshot.notes.length} 笔记 · ${snapshot.cards.length} 卡片 · ${blobs.size} 照片`,
        newTree,
        [head.commitSha],
      );
      try {
        await api.updateRef(branch, commit);
      } catch (e) {
        if (e instanceof GitHubError && (e.status === 422 || e.status === 409) && attempt < 3) {
          onProgress('云端有新改动，重新合并…');
          continue;
        }
        throw e;
      }
      await db.meta.put({ key: LAST_SYNC_KEY, value: Date.now() });
      return { committed: true, pulled, uploadedImages: uploads.length, deletedImages: deletions.length, attempts: attempt };
    }
    throw new Error('多次重试仍冲突，请稍后再试');
  } catch (e) {
    await db.meta.put({ key: DIRTY_KEY, value: true });
    throw e;
  }
}
