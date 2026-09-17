/**
 * 每日复习提醒（仅 App）：提前排好未来 14 天的本地通知，每条写明当天待复习数。
 * 数据变化、打开或切到后台时重新计算，保证数字大致准确。
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import type { StudyDB } from '../db/schema';
import { addDays, daysBetween, toLocalDate } from '../scheduler/dates';
import { onChange } from '../sync/changes';
import { isNativeApp } from './platform';

export const REMINDER_KEY = 'reminderConfig';
export const CHANNEL_ID = 'daily-review';
const BASE_ID = 7000;
const DAYS = 14;

export interface ReminderConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER: ReminderConfig = { enabled: false, hour: 20, minute: 0 };

export async function getReminderConfig(db: StudyDB): Promise<ReminderConfig> {
  const r = await db.meta.get(REMINDER_KEY);
  return { ...DEFAULT_REMINDER, ...((r?.value as Partial<ReminderConfig>) ?? {}) };
}

export async function setReminderConfig(db: StudyDB, cfg: ReminderConfig) {
  await db.meta.put({ key: REMINDER_KEY, value: cfg });
}

export interface PlannedReminder {
  id: number;
  at: Date;
  date: string;
  count: number;
  body: string;
}

/**
 * 计算未来每天的提醒内容（纯函数，便于测试）。
 * 某天的待复习数 = 到那天为止已到期、未暂停的条目数；为 0 的日子不提醒。
 */
export function planReminders(
  dueDates: string[],
  cfg: ReminderConfig,
  now: Date,
  examDate: string | null,
): PlannedReminder[] {
  const t = toLocalDate(now.getTime());
  const sorted = [...dueDates].sort();
  const out: PlannedReminder[] = [];
  for (let i = 0; i < DAYS; i++) {
    const date = addDays(t, i);
    const [y, m, d] = date.split('-').map(Number);
    const at = new Date(y, m - 1, d, cfg.hour, cfg.minute, 0, 0);
    if (at.getTime() <= now.getTime() + 30_000) continue;
    let count = 0;
    for (const due of sorted) {
      if (due <= date) count++;
      else break;
    }
    if (count === 0) continue;
    let body = `今天有 ${count} 条内容待复习`;
    if (examDate) {
      const left = daysBetween(date, examDate);
      if (left > 0) body += `，距考研还有 ${left} 天`;
    }
    out.push({ id: BASE_ID + i, at, date, count, body });
  }
  return out;
}

async function cancelAll() {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + DAYS);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
}

/** 按当前数据重新排定提醒 */
export async function rescheduleReminders(db: StudyDB): Promise<PlannedReminder[]> {
  if (!isNativeApp) return [];
  const cfg = await getReminderConfig(db);
  await cancelAll();
  if (!cfg.enabled) return [];
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return [];

  const [notes, cards, settings] = await Promise.all([
    db.notes.filter((n) => !n.suspended).toArray(),
    db.cards.filter((c) => !c.suspended).toArray(),
    db.settings.get('default'),
  ]);
  const plan = planReminders(
    [...notes.map((n) => n.dueDate), ...cards.map((c) => c.dueDate)],
    cfg,
    new Date(),
    settings?.examDate ?? null,
  );
  if (plan.length) {
    await LocalNotifications.schedule({
      notifications: plan.map((p) => ({
        id: p.id,
        title: '该复习啦',
        body: p.body,
        channelId: CHANNEL_ID,
        schedule: { at: p.at, allowWhileIdle: true },
        // 精确闹钟（清单里声明了 USE_EXACT_ALARM，安装即授予），否则系统可能推迟最多 1 小时。
        // 万一没有权限，插件会降级为普通闹钟，而不是跳转设置页。
        isExactNotification: true,
        isExactMandatory: false,
      })),
    });
  }
  return plan;
}

/** 开启提醒：请求通知权限，建立通知渠道 */
export async function enableReminders(db: StudyDB, cfg: ReminderConfig): Promise<'granted' | 'denied'> {
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') {
    await setReminderConfig(db, { ...cfg, enabled: false });
    return 'denied';
  }
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: '每日复习提醒',
    description: '每天定时提醒今天要复习的数量',
    importance: 4,
    visibility: 1,
  });
  await setReminderConfig(db, { ...cfg, enabled: true });
  await rescheduleReminders(db);
  return 'granted';
}

/** 启动自动重排：打开时、数据变化 5 秒后、切到后台时 */
export function startReminderScheduler(db: StudyDB): () => void {
  if (!isNativeApp) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => void rescheduleReminders(db).catch(() => {});
  run();
  const off = onChange(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 5000);
  });
  const onVis = () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(timer);
      run();
    }
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    clearTimeout(timer);
    off();
    document.removeEventListener('visibilitychange', onVis);
  };
}

const TEST_ID = BASE_ID + 99;

/** 1 分钟后发一条测试通知，用来确认通知没有被系统拦截 */
export async function sendTestNotification(): Promise<'scheduled' | 'denied'> {
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'denied';
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: '每日复习提醒',
    description: '每天定时提醒今天要复习的数量',
    importance: 4,
    visibility: 1,
  });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,
        title: '测试通知',
        body: '能看到这条，说明每日复习提醒可以正常弹出。',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 60_000), allowWhileIdle: true },
        isExactNotification: true,
        isExactMandatory: false,
      },
    ],
  });
  return 'scheduled';
}
