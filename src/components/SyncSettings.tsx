import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/schema';
import { createGitHubApi } from '../sync/github';
import { reloadSyncConfig, syncNow } from '../sync/runner';
import { describeSyncError, getSyncConfig, setSyncConfig, type SyncConfig } from '../sync/sync';
import { formatBytes } from '../utils/image';
import { useSyncStatus } from './SyncStatus';
import { useToast } from './Toast';

const DEFAULT_REPO = 'MaftyUc0105/abinhouse_study_data';
const REPO_LIMIT_WARN = 700 * 1024 * 1024;

function fmtTime(ts: number | null) {
  if (!ts) return '从未';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SyncSettings() {
  const toast = useToast();
  const status = useSyncStatus();
  const [cfg, setCfg] = useState<SyncConfig | null | undefined>(undefined);
  const [repoName, setRepoName] = useState(DEFAULT_REPO);
  const [token, setToken] = useState('');
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const imageBytes = useLiveQuery(async () => {
    let s = 0;
    await db.images.each((i) => (s += i.size));
    return s;
  }, []);

  useEffect(() => {
    void getSyncConfig(db).then((c) => {
      setCfg(c);
      if (c) {
        setRepoName(`${c.owner}/${c.repo}`);
        setAuto(c.auto);
      }
    });
  }, []);

  function parseRepo(): { owner: string; repo: string } | null {
    const m = /^\s*(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\s*\/?$/.exec(repoName);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  async function saveAndTest() {
    setMsg(null);
    const r = parseRepo();
    if (!r) return setMsg('仓库格式应为 用户名/仓库名');
    const tk = token.trim() || cfg?.token;
    if (!tk) return setMsg('请填写令牌');
    setBusy(true);
    try {
      const info = await createGitHubApi({ ...r, token: tk }).getRepo();
      if (!info.private) {
        setMsg('这个仓库是公开的，任何人都能看到你的笔记。请改用私有仓库。');
        return;
      }
      if (info.canPush === false) {
        setMsg('令牌只有读取权限，请把 Contents 权限设为 Read and write。');
        return;
      }
      const next: SyncConfig = { ...r, token: tk, auto };
      await setSyncConfig(db, next);
      setCfg(next);
      setToken('');
      await reloadSyncConfig(db);
      toast('连接成功，开始同步');
      await syncNow(db);
      toast('同步完成');
    } catch (e) {
      setMsg(describeSyncError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto(v: boolean) {
    setAuto(v);
    if (!cfg) return;
    const next = { ...cfg, auto: v };
    await setSyncConfig(db, next);
    setCfg(next);
    await reloadSyncConfig(db);
  }

  async function runNow() {
    setMsg(null);
    try {
      const r = await syncNow(db);
      if (r) {
        const p = r.pulled;
        const got = p.notes + p.cards + p.images + p.reviewLogs + p.deleted;
        toast(r.committed || got ? `同步完成：拉取 ${got} 项，上传照片 ${r.uploadedImages} 张` : '已是最新');
      }
    } catch (e) {
      setMsg(describeSyncError(e));
    }
  }

  async function disconnect() {
    await setSyncConfig(db, null);
    setCfg(null);
    await reloadSyncConfig(db);
    toast('已断开，本机数据保留');
  }

  if (cfg === undefined) return null;

  return (
    <>
      <div className="section-title" id="sync">
        云端同步（GitHub 私有仓库）
      </div>
      <div className="card stack">
        {cfg && (
          <div className="small">
            状态：
            <b className={`sync-${status.phase}`}>
              {status.phase === 'syncing'
                ? status.progress ?? '同步中'
                : status.phase === 'error'
                  ? '失败'
                  : status.phase === 'dirty'
                    ? '有未同步的改动'
                    : '已同步'}
            </b>
            <span className="tiny"> · 上次 {fmtTime(status.lastSyncAt)}</span>
            {status.error && <div className="error mt-8">{status.error}</div>}
          </div>
        )}
        <div className="field">
          <label>仓库</label>
          <input className="input" value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="用户名/仓库名" />
        </div>
        <div className="field">
          <label>访问令牌{cfg && <span className="tiny">（已保存 ····{cfg.token.slice(-4)}，留空则不修改）</span>}</label>
          <input
            className="input"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
          />
        </div>
        <div className="setting-row">
          <span className="small">自动同步（打开应用、改动 20 秒后、切到后台时）</span>
          <input type="checkbox" className="switch" checked={auto} onChange={(e) => void toggleAuto(e.target.checked)} />
        </div>
        {msg && <div className="error">{msg}</div>}
        <div className="row">
          <button className="btn btn-primary grow" disabled={busy || status.phase === 'syncing'} onClick={saveAndTest}>
            {cfg ? '保存并测试' : '连接并同步'}
          </button>
          {cfg && (
            <button className="btn grow" disabled={status.phase === 'syncing'} onClick={runNow}>
              立即同步
            </button>
          )}
        </div>
        {cfg && (
          <button className="btn btn-ghost btn-sm" onClick={disconnect}>
            断开同步（不删除任何数据）
          </button>
        )}
        {imageBytes !== undefined && (
          <div className="tiny">
            照片共 {formatBytes(imageBytes)}。GitHub 建议单个仓库不超过 1 GB。
            {imageBytes > REPO_LIMIT_WARN && <span className="error"> 已接近上限，建议删除不再需要的照片。</span>}
          </div>
        )}
        <details className="small muted">
          <summary>如何获取令牌</summary>
          <ol className="howto">
            <li>电脑或手机浏览器登录 GitHub，打开 Settings → Developer settings → Personal access tokens → Fine-grained tokens。</li>
            <li>点 Generate new token，有效期选 1 年。</li>
            <li>Repository access 选 Only select repositories，只勾选数据仓库。</li>
            <li>Permissions → Repository permissions → Contents 选 Read and write，其余保持默认。</li>
            <li>生成后复制令牌，粘贴到上面的输入框。</li>
          </ol>
          <div className="tiny">令牌只保存在这台设备上，不会进入同步数据和备份文件。手机丢失时到 GitHub 撤销该令牌即可。</div>
        </details>
      </div>
    </>
  );
}
