import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/schema';
import { backupAndShare, getBackupReminder, shareFile, snoozeBackupReminder, type ShareOutcome } from '../utils/backupShare';
import { useToast } from './Toast';

/** "备份到微信"按钮：生成备份后调起系统分享；生成太慢被浏览器拦截时，提示再点一次 */
export function BackupShareButton({ className = 'btn btn-primary', label = '备份到微信 / 网盘' }: { className?: string; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);

  function report(r: ShareOutcome) {
    if (r.kind === 'shared') toast('已备份');
    else if (r.kind === 'downloaded') toast(`已保存到下载：${r.filename}`);
    else if (r.kind === 'cancelled') toast('已取消分享');
    else setPending(r.file);
  }

  async function run() {
    setBusy('准备备份…');
    try {
      report(await backupAndShare(db, (m) => setBusy(m)));
    } catch (e) {
      toast(e instanceof Error ? `备份失败：${e.message}` : '备份失败');
    } finally {
      setBusy(null);
    }
  }

  async function sharePending() {
    const f = pending;
    setPending(null);
    if (!f) return;
    try {
      report(await shareFile(db, f));
    } catch (e) {
      toast(e instanceof Error ? `分享失败：${e.message}` : '分享失败');
    }
  }

  if (pending) {
    return (
      <button className={className} onClick={sharePending}>
        备份文件已准备好，点这里分享
      </button>
    );
  }
  return (
    <button className={className} disabled={!!busy} onClick={run}>
      {busy ?? label}
    </button>
  );
}

/** 首页备份提醒：超过 7 天没备份也没同步时出现 */
export function BackupReminder() {
  const state = useLiveQuery(() => getBackupReminder(db), []);
  if (!state?.show) return null;
  return (
    <div className="card backup-reminder mb-8">
      <div className="small">
        <b>{state.days === null ? '还没有备份过' : `已经 ${state.days} 天没有备份`}</b>
        <div className="muted">数据只存在这台手机上，换手机或清理浏览器会丢失。发到微信"文件传输助手"保存一份。</div>
      </div>
      <div className="row mt-8" style={{ flexWrap: 'nowrap' }}>
        <BackupShareButton className="btn btn-primary btn-sm grow" label="现在备份" />
        <button className="btn btn-sm" onClick={() => void snoozeBackupReminder(db)}>
          明天再说
        </button>
      </div>
    </div>
  );
}
