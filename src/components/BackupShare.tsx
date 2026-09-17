import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/schema';
import { getBackupReminder, saveBackupToPhone, snoozeBackupReminder, type SavedBackup } from '../utils/backupShare';
import { formatBytes } from '../utils/image';

/** 保存备份到手机；结果和"没有开始下载"的备用链接显示在按钮下方 */
export function BackupPanel({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBackup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 回收上一次备份文件的临时地址
  useEffect(() => {
    return () => {
      if (saved) URL.revokeObjectURL(saved.url);
    };
  }, [saved]);

  async function save() {
    setError(null);
    setSaved(null);
    setBusy('正在生成备份…');
    try {
      setSaved(await saveBackupToPhone(db, (m) => setBusy(m)));
    } catch (e) {
      setError(`备份失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack backup-panel">
      <button className={`btn btn-primary ${compact ? 'btn-sm' : ''}`} disabled={!!busy} onClick={save}>
        {busy ?? '保存备份到手机'}
      </button>
      {saved && (
        <div className="small backup-ok">
          已保存到手机"下载"文件夹：<b>{saved.filename}</b>（{formatBytes(saved.size)}）。
          <div className="muted mt-8">
            要发到微信或网盘：点通知栏里的下载完成通知，或打开文件管理 → 下载，长按这个文件选"分享"。
          </div>
          <div className="mt-8">
            <a href={saved.url} download={saved.filename}>
              没有开始下载？点这里
            </a>
          </div>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

/** 首页备份提醒：超过 7 天没备份也没同步时出现 */
export function BackupReminder() {
  const state = useLiveQuery(() => getBackupReminder(db), []);
  const [justSaved, setJustSaved] = useState(false);
  // 保存后提醒条件立刻不成立，但保留卡片显示结果，直到离开页面
  useEffect(() => {
    if (state?.show) setJustSaved(true);
  }, [state?.show]);
  if (!state?.show && !justSaved) return null;
  return (
    <div className="card backup-reminder mb-8">
      <div className="row-between">
        <b className="small">
          {!state?.show ? '备份完成' : state.days === null ? '还没有备份过' : `已经 ${state.days} 天没有备份`}
        </b>
        {state?.show && (
          <button className="btn btn-ghost btn-sm" onClick={() => (setJustSaved(false), void snoozeBackupReminder(db))}>
            明天再说
          </button>
        )}
      </div>
      {state?.show && (
        <div className="small muted mb-8">数据只存在这台手机上，换手机或清理浏览器会丢失。保存一份备份，再发到微信"文件传输助手"。</div>
      )}
      <BackupPanel compact />
    </div>
  );
}
