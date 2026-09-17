import { useEffect, useRef, useState } from 'react';
import { BackupShareButton } from '../components/BackupShare';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SyncSettings } from '../components/SyncSettings';
import { useToast } from '../components/Toast';
import { backupFileName, downloadBlob, exportBackup, importBackup, type ImportMode, type ImportResult } from '../db/backup';
import { repo } from '../db/repo';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { LAST_BACKUP_KEY, markBackedUp } from '../utils/backupShare';
import { validateSettings } from '../db/seedSettings';
import { useSettings } from '../hooks/useSettings';
import { formatBytes } from '../utils/image';

export function SettingsPage() {
  const s = useSettings();
  const toast = useToast();

  return (
    <div className="page">
      <div className="page-header">
        <h1>设置</h1>
      </div>
      <SyncSettings />
      <BackupSection />
      <StorageSection />
      <ScheduleSection key={s.updatedAt} />
      <div className="section-title">提醒</div>
      <div className="card small muted">
        网页应用无法在后台定时弹通知。建议在手机闹钟里设一个固定时间（比如每晚 8 点）打开本应用；已安装到桌面时，图标角标会显示待复习数。
      </div>
      <DangerSection onCleared={() => toast('已清空全部数据')} />
      <div className="section-title">关于</div>
      <div className="card small muted">
        艾宾浩斯复习本 v{__APP_VERSION__} · 数据保存在本机浏览器里；开启云端同步后会自动上传到你的 GitHub 私有仓库。
      </div>
    </div>
  );
}

function BackupSection() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const lastBackup = useLiveQuery(async () => (await db.meta.get(LAST_BACKUP_KEY))?.value as number | undefined, []);

  async function doExport() {
    setBusy('准备导出…');
    try {
      const blob = await exportBackup(db, (m) => setBusy(m));
      downloadBlob(blob, backupFileName());
      await markBackedUp(db);
      toast(`已导出 ${formatBytes(blob.size)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : '导出失败');
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    const f = pendingFile;
    setPendingFile(null);
    if (!f) return;
    setBusy('读取备份…');
    setResult(null);
    try {
      const r = await importBackup(db, f, mode, (m) => setBusy(m));
      setResult(r);
      toast('导入完成');
    } catch (e) {
      toast(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="section-title">备份</div>
      <div className="card stack">
        <BackupShareButton />
        <div className="hint">
          上次备份：{lastBackup ? new Date(lastBackup).toLocaleString('zh-CN', { hour12: false }) : '从未'}。
          点按钮后在分享菜单里选微信 →"文件传输助手"。超过 7 天没备份，首页会提醒。
        </div>
        <button className="btn" disabled={!!busy} onClick={doExport}>
          导出 ZIP 到下载
        </button>
        <div className="row">
          <label className="row small">
            <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> 合并
          </label>
          <label className="row small">
            <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> 覆盖本机
          </label>
        </div>
        <button className="btn" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          导入备份…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.txt,application/zip,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (f) setPendingFile(f);
          }}
        />
        <div className="hint">
          支持 .zip 和 .txt 备份。从微信恢复时，先在微信里打开备份文件并"保存到手机"，再在这里选择它。
          合并：同一条笔记以修改时间较新的为准，不覆盖本机设置。覆盖：先清空本机再导入。
        </div>
        {busy && <div className="small muted">{busy}</div>}
        {result && (
          <div className="small">
            导入：笔记 {result.notes} · 卡片 {result.cards} · 照片 {result.images} · 记录 {result.reviewLogs}
            {result.missingImages > 0 && <span className="error"> · 缺图 {result.missingImages}</span>}
            {result.skipped > 0 && <span className="error"> · 跳过无效 {result.skipped}</span>}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={pendingFile !== null}
        title={mode === 'replace' ? '覆盖本机数据？' : '合并导入？'}
        message={
          mode === 'replace'
            ? `将清空本机全部数据，再导入「${pendingFile?.name ?? ''}」。此操作不可撤销。`
            : `将把「${pendingFile?.name ?? ''}」合并到本机数据。`
        }
        confirmText="导入"
        danger={mode === 'replace'}
        onConfirm={doImport}
        onCancel={() => setPendingFile(null)}
      />
    </>
  );
}

function StorageSection() {
  const [info, setInfo] = useState<{ usage: number; quota: number; persisted: boolean | null } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        const persisted = (await navigator.storage?.persisted?.()) ?? null;
        setInfo({ usage: est?.usage ?? 0, quota: est?.quota ?? 0, persisted });
      } catch {
        setInfo(null);
      }
    })();
  }, []);
  return (
    <>
      <div className="section-title">存储</div>
      <div className="card small">
        {info ? (
          <>
            已用 {formatBytes(info.usage)}
            {info.quota > 0 && <> / 可用约 {formatBytes(info.quota)}</>}
            <div className="tiny mt-8">
              {info.persisted === true
                ? '已获得持久存储权限，浏览器不会自动清理。'
                : '尚未获得持久存储权限。把应用添加到主屏幕后通常会自动获得；请定期导出备份。'}
            </div>
          </>
        ) : (
          '无法读取存储信息'
        )}
      </div>
    </>
  );
}

function ScheduleSection() {
  const s = useSettings();
  const toast = useToast();
  const [ladder, setLadder] = useState(s.ladder.join(', '));
  const [overflow, setOverflow] = useState(String(s.overflowFactor));
  const [fuzzy, setFuzzy] = useState(String(s.fuzzyShrink));
  const [cap, setCap] = useState(String(s.dailyNewCap));
  const [maxI, setMaxI] = useState(String(s.maxInterval));
  const [forgotSameDay, setForgot] = useState(s.forgotSameDay);
  const [fuzz, setFuzz] = useState(s.fuzz);
  const [examDate, setExamDate] = useState(s.examDate ?? '');
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const patch = {
      ladder: ladder
        .split(/[,，\s]+/)
        .filter(Boolean)
        .map(Number),
      overflowFactor: Number(overflow),
      fuzzyShrink: Number(fuzzy),
      dailyNewCap: Number(cap),
      maxInterval: Number(maxI),
      forgotSameDay,
      fuzz,
      examDate: examDate || null,
    };
    const e = validateSettings(patch);
    if (e) return setErr(e);
    setErr(null);
    try {
      await repo.updateSettings(patch);
      toast('已保存');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '保存失败');
    }
  }

  return (
    <>
      <div className="section-title">复习参数</div>
      <div className="card">
        <div className="field mb-8">
          <label>考研日期</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            {examDate && (
              <button className="btn btn-sm" onClick={() => setExamDate('')}>
                清除
              </button>
            )}
          </div>
          <div className="hint">设置后首页显示倒计时。离考 N 天时，复习间隔最长为 N/2 天，保证每条内容考前还能再复习，且越临考越密。</div>
        </div>
        <div className="field">
          <label>艾宾浩斯阶梯（天，逗号分隔，递增）</label>
          <input className="input" value={ladder} onChange={(e) => setLadder(e.target.value)} />
        </div>
        <div className="setting-row">
          <span className="small">超出阶梯后间隔乘数</span>
          <input className="input" inputMode="decimal" value={overflow} onChange={(e) => setOverflow(e.target.value)} />
        </div>
        <div className="setting-row">
          <span className="small">评"模糊"时间隔缩短系数</span>
          <input className="input" inputMode="decimal" value={fuzzy} onChange={(e) => setFuzzy(e.target.value)} />
        </div>
        <div className="setting-row">
          <span className="small">每日新条目上限（0 = 不限）</span>
          <input className="input" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
        </div>
        <div className="setting-row">
          <span className="small">间隔上限（天）</span>
          <input className="input" inputMode="numeric" value={maxI} onChange={(e) => setMaxI(e.target.value)} />
        </div>
        <div className="setting-row">
          <span className="small">到期日小幅错开（避免同一天堆积）</span>
          <input type="checkbox" className="switch" checked={fuzz} onChange={(e) => setFuzz(e.target.checked)} />
        </div>
        <div className="setting-row">
          <span className="small">评"忘了"后当次会话再看一遍</span>
          <input type="checkbox" className="switch" checked={forgotSameDay} onChange={(e) => setForgot(e.target.checked)} />
        </div>
        {err && <div className="error mt-8">{err}</div>}
        <button className="btn btn-primary btn-block mt-8" onClick={save}>
          保存参数
        </button>
      </div>
    </>
  );
}

function DangerSection({ onCleared }: { onCleared: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="section-title">危险操作</div>
      <div className="card">
        <button className="btn btn-danger" onClick={() => setOpen(true)}>
          清空全部数据
        </button>
        <div className="hint mt-8">删除本机所有笔记、卡片、照片、复习记录和设置。清空前请先导出备份。</div>
      </div>
      <ConfirmDialog
        open={open}
        title="清空全部数据？"
        message="此操作不可撤销。确定已经导出过备份了吗？"
        confirmText="清空"
        danger
        onConfirm={async () => {
          setOpen(false);
          await repo.clearAll();
          onCleared();
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
