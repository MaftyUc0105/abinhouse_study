import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db/schema';
import {
  describeShareSupport,
  detectShareSupport,
  getBackupReminder,
  prepareBackupFile,
  saveBackupFile,
  shareBackupFile,
  snoozeBackupReminder,
  type PreparedBackup,
} from '../utils/backupShare';
import { formatBytes } from '../utils/image';

type Result = { ok: boolean; text: string } | null;

/**
 * 两步备份：先生成文件，再由用户点"分享到微信"或"保存到手机"。
 * 结果直接显示在按钮下方，不用一闪而过的提示。
 */
export function BackupPanel({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedBackup | null>(null);
  const [result, setResult] = useState<Result>(null);
  const support = useMemo(() => detectShareSupport(), []);

  async function prepare() {
    setResult(null);
    setBusy('准备备份…');
    try {
      setPrepared(await prepareBackupFile(db, (m) => setBusy(m)));
    } catch (e) {
      setResult({ ok: false, text: `生成备份失败：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!prepared) return;
    setResult(null);
    const r = await shareBackupFile(db, prepared.file);
    if (r.kind === 'shared') setResult({ ok: true, text: '已发出。记得在微信里确认文件收到了。' });
    else if (r.kind === 'cancelled') setResult({ ok: false, text: '分享已取消，可以再点一次。' });
    else setResult({ ok: false, text: `分享失败（${r.message}）。请改用"保存到手机"，再在微信里发送这个文件。` });
  }

  async function save() {
    if (!prepared) return;
    setResult(null);
    try {
      await saveBackupFile(db, prepared.file);
      setResult({
        ok: true,
        text: `已开始下载 ${prepared.file.name}。如果通知栏没有出现下载，说明这个浏览器在应用模式下不能下载，请用 Chrome 打开网页版再试。`,
      });
    } catch (e) {
      setResult({ ok: false, text: `下载失败：${e instanceof Error ? e.message : String(e)}` });
    }
  }

  const size = compact ? 'btn-sm' : '';

  return (
    <div className="stack backup-panel">
      {!prepared ? (
        <button className={`btn btn-primary ${size}`} disabled={!!busy} onClick={prepare}>
          {busy ?? '准备备份文件'}
        </button>
      ) : (
        <>
          <div className="small">
            备份文件已准备好：<b>{prepared.file.name}</b>（{formatBytes(prepared.file.size)}）
          </div>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {prepared.shareable && (
              <button className={`btn btn-primary grow ${size}`} onClick={share}>
                分享到微信 / 网盘
              </button>
            )}
            <button className={`btn grow ${size}`} onClick={save}>
              保存到手机
            </button>
          </div>
          {!prepared.shareable && (
            <div className="hint">这个浏览器不支持直接分享文件，请先保存到手机，再在微信里发送。</div>
          )}
        </>
      )}
      {result && <div className={result.ok ? 'backup-ok small' : 'error'}>{result.text}</div>}
      <div className="tiny">检测：{describeShareSupport(support)}</div>
    </div>
  );
}

/** 首页备份提醒：超过 7 天没备份也没同步时出现 */
export function BackupReminder() {
  const state = useLiveQuery(() => getBackupReminder(db), []);
  if (!state?.show) return null;
  return (
    <div className="card backup-reminder mb-8">
      <div className="row-between">
        <b className="small">{state.days === null ? '还没有备份过' : `已经 ${state.days} 天没有备份`}</b>
        <button className="btn btn-ghost btn-sm" onClick={() => void snoozeBackupReminder(db)}>
          明天再说
        </button>
      </div>
      <div className="small muted mb-8">数据只存在这台手机上，换手机或清理浏览器会丢失。发到微信"文件传输助手"保存一份。</div>
      <BackupPanel compact />
    </div>
  );
}
