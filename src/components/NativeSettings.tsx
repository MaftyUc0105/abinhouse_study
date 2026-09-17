import { useEffect, useState } from 'react';
import { db } from '../db/schema';
import { isNativeApp } from '../native/platform';
import {
  enableReminders,
  getReminderConfig,
  rescheduleReminders,
  sendTestNotification,
  setReminderConfig,
  type ReminderConfig,
} from '../native/reminders';
import { checkForUpdate, openDownload, type UpdateInfo } from '../native/update';
import { useToast } from './Toast';

const pad = (n: number) => String(n).padStart(2, '0');

/** 每日复习提醒设置（仅 App） */
export function ReminderSettings() {
  const [cfg, setCfg] = useState<ReminderConfig | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void getReminderConfig(db).then(setCfg);
  }, []);

  async function apply(next: ReminderConfig) {
    setMsg(null);
    setCfg(next);
    if (next.enabled) {
      const r = await enableReminders(db, next);
      if (r === 'denied') {
        setCfg({ ...next, enabled: false });
        setMsg({ ok: false, text: '没有通知权限。请到 手机设置 → 应用设置 → 复习本 → 通知管理，打开"允许通知"后再开启。' });
        return;
      }
      const plan = await rescheduleReminders(db);
      setMsg({
        ok: true,
        text: plan.length
          ? `已开启。下一次提醒：${plan[0].date.slice(5)} ${pad(next.hour)}:${pad(next.minute)}，${plan[0].count} 条待复习。`
          : '已开启。未来两周暂时没有待复习的内容，有新内容到期时会自动排上提醒。',
      });
    } else {
      await setReminderConfig(db, next);
      await rescheduleReminders(db);
      setMsg({ ok: true, text: '已关闭每日提醒。' });
    }
  }

  if (!cfg) return null;
  const time = `${pad(cfg.hour)}:${pad(cfg.minute)}`;

  return (
    <>
      <div className="section-title">每日复习提醒</div>
      <div className="card">
        <div className="setting-row">
          <span className="small">每天定时提醒今天要复习几条</span>
          <input
            type="checkbox"
            className="switch"
            checked={cfg.enabled}
            onChange={(e) => void apply({ ...cfg, enabled: e.target.checked })}
          />
        </div>
        <div className="setting-row">
          <span className="small">提醒时间</span>
          <input
            className="input"
            type="time"
            value={time}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              if (!Number.isFinite(h) || !Number.isFinite(m)) return;
              const next = { ...cfg, hour: h, minute: m };
              if (next.enabled) void apply(next);
              else {
                setCfg(next);
                void setReminderConfig(db, next);
              }
            }}
          />
        </div>
        {msg && <div className={msg.ok ? 'backup-ok small mt-8' : 'error mt-8'}>{msg.text}</div>}
        <button
          className="btn btn-sm mt-8"
          onClick={async () => {
            const r = await sendTestNotification();
            setMsg(
              r === 'scheduled'
                ? { ok: true, text: '已安排，1 分钟后会弹出一条测试通知。可以先切到桌面等着。' }
                : { ok: false, text: '没有通知权限。请到 手机设置 → 应用设置 → 复习本 → 通知管理，打开"允许通知"。' },
            );
          }}
        >
          发一条测试通知
        </button>
        <div className="hint mt-8">
          澎湃 OS 可能限制后台应用。如果到点没收到提醒：手机设置 → 应用设置 → 复习本，打开"自启动"，省电策略选"无限制"。
        </div>
      </div>
    </>
  );
}

/** 应用版本与检查更新（仅 App） */
export function UpdateSettings() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      setInfo(await checkForUpdate(__APP_VERSION__));
    } catch (e) {
      setError(e instanceof Error ? e.message : '检查更新失败，请检查网络');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-title">应用更新</div>
      <div className="card stack">
        <div className="small">当前版本 v{__APP_VERSION__}</div>
        {info &&
          (info.hasUpdate ? (
            <>
              <div className="small backup-ok">发现新版本 v{info.latest}</div>
              {info.notes && <div className="tiny" style={{ whiteSpace: 'pre-wrap' }}>{info.notes}</div>}
              <button className="btn btn-primary" onClick={() => void openDownload(info)}>
                下载新版本
              </button>
              <div className="hint">下载完成后点安装包覆盖安装，数据会保留。</div>
            </>
          ) : (
            <div className="small muted">已经是最新版本。</div>
          ))}
        {error && <div className="error">{error}</div>}
        {!info?.hasUpdate && (
          <button className="btn" disabled={busy} onClick={check}>
            {busy ? '检查中…' : '检查更新'}
          </button>
        )}
      </div>
    </>
  );
}

const LAST_UPDATE_CHECK = 'lastUpdateCheck';

/** App 启动时每天最多检查一次更新，有新版本时提示 */
export function UpdateNotifier() {
  const toast = useToast();
  useEffect(() => {
    if (!isNativeApp) return;
    let cancelled = false;
    (async () => {
      const last = (await db.meta.get(LAST_UPDATE_CHECK))?.value as number | undefined;
      if (last && Date.now() - last < 24 * 3600_000) return;
      try {
        const info = await checkForUpdate(__APP_VERSION__);
        await db.meta.put({ key: LAST_UPDATE_CHECK, value: Date.now() });
        if (!cancelled && info.hasUpdate) toast(`有新版本 v${info.latest}，到设置页更新`);
      } catch {
        /* 离线或 GitHub 不可达时静默 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);
  return null;
}
