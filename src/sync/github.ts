/** GitHub Git Data API 的薄封装。同步逻辑只依赖 GitApi 接口，测试时可替换为内存实现。 */

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface RepoInfo {
  private: boolean;
  defaultBranch: string;
  canPush: boolean | null;
}

export interface TreeEntry {
  path: string;
  /** null 表示删除该路径 */
  sha: string | null;
}

export interface GitApi {
  getRepo(): Promise<RepoInfo>;
  /** 分支不存在或仓库为空时返回 null */
  getHead(branch: string): Promise<{ commitSha: string; treeSha: string } | null>;
  /** 空仓库初始化：创建一个 README 提交 */
  initRepo(branch: string): Promise<void>;
  /** 递归读取树，返回 文件路径 → blob sha */
  getTree(treeSha: string): Promise<Map<string, string>>;
  getBlob(sha: string): Promise<Uint8Array>;
  createBlob(bytes: Uint8Array): Promise<string>;
  createTree(baseTree: string, entries: TreeEntry[]): Promise<string>;
  createCommit(message: string, tree: string, parents: string[]): Promise<string>;
  /** 非强制更新分支；不是快进时抛出 422 */
  updateRef(branch: string, sha: string): Promise<void>;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createGitHubApi(cfg: GitHubConfig, fetchImpl: typeof fetch = (...a) => fetch(...a)): GitApi {
  const base = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchImpl(base + path, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = ((await res.json()) as { message?: string }).message ?? msg;
      } catch {
        /* ignore */
      }
      throw new GitHubError(res.status, msg);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  return {
    async getRepo() {
      const r = await fetchImpl(base, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${cfg.token}` },
      });
      if (!r.ok) throw new GitHubError(r.status, r.statusText);
      const j = (await r.json()) as { private: boolean; default_branch: string; permissions?: { push?: boolean } };
      return { private: j.private, defaultBranch: j.default_branch || 'main', canPush: j.permissions?.push ?? null };
    },

    async getHead(branch) {
      try {
        const ref = await call<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`);
        const commit = await call<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`);
        return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
      } catch (e) {
        if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return null;
        throw e;
      }
    },

    async initRepo(branch) {
      const text = '# 复习本数据\n\n由「艾宾浩斯复习本」自动同步，请勿手动修改。\n';
      await call(`/contents/README.md`, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'init',
          content: bytesToBase64(new TextEncoder().encode(text)),
          branch,
        }),
      });
    },

    async getTree(treeSha) {
      const t = await call<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(
        `/git/trees/${treeSha}?recursive=1`,
      );
      if (t.truncated) throw new GitHubError(500, '云端文件过多，无法读取完整目录');
      return new Map(t.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));
    },

    async getBlob(sha) {
      const b = await call<{ content: string; encoding: string }>(`/git/blobs/${sha}`);
      if (b.encoding !== 'base64') return new TextEncoder().encode(b.content);
      return base64ToBytes(b.content);
    },

    async createBlob(bytes) {
      const r = await call<{ sha: string }>(`/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: bytesToBase64(bytes), encoding: 'base64' }),
      });
      return r.sha;
    },

    async createTree(baseTree, entries) {
      const r = await call<{ sha: string }>(`/git/trees`, {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTree,
          tree: entries.map((e) => ({ path: e.path, mode: '100644', type: 'blob', sha: e.sha })),
        }),
      });
      return r.sha;
    },

    async createCommit(message, tree, parents) {
      const r = await call<{ sha: string }>(`/git/commits`, {
        method: 'POST',
        body: JSON.stringify({ message, tree, parents }),
      });
      return r.sha;
    },

    async updateRef(branch, sha) {
      await call(`/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha, force: false }),
      });
    },
  };
}
