/** 收集打卡图要显示的数据 */
import type { StudyDB } from '../db/schema';
import type { LocalDate } from '../db/types';
import { daysBetween } from '../scheduler/dates';
import { goalProgress, goalStreak } from '../scheduler/goals';

export interface ShareCardData {
  date: LocalDate;
  dateLabel: string;
  weekdayLabel: string;
  daysToExam: number | null;
  achieved: boolean;
  hasGoal: boolean;
  reviewDone: number;
  reviewTarget: number;
  tasks: { text: string; done: boolean }[];
  tasksDone: number;
  /** 连续达成天数 */
  streak: number;
  /** 有复习记录的总天数 */
  studyDays: number;
  totalReviews: number;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatCardDate(date: LocalDate): { dateLabel: string; weekdayLabel: string } {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return { dateLabel: `${m} 月 ${d} 日`, weekdayLabel: WEEKDAYS[dt.getDay()] };
}

export async function buildShareCardData(db: StudyDB, today: LocalDate): Promise<ShareCardData> {
  const [goal, goals, reviewDone, settings, totalReviews, allDates] = await Promise.all([
    db.dailyGoals.get(today),
    db.dailyGoals.toArray(),
    db.reviewLogs.where('date').equals(today).count(),
    db.settings.get('default'),
    db.reviewLogs.count(),
    db.reviewLogs.orderBy('date').uniqueKeys(),
  ]);

  const p = goalProgress(goal, reviewDone);
  const examDate = settings?.examDate ?? null;

  return {
    date: today,
    ...formatCardDate(today),
    daysToExam: examDate ? Math.max(0, daysBetween(today, examDate)) : null,
    achieved: p.achieved,
    hasGoal: p.reviewTarget > 0 || p.tasksTotal > 0,
    reviewDone: p.reviewDone,
    reviewTarget: p.reviewTarget,
    tasks: (goal?.tasks ?? []).map((t) => ({ text: t.text, done: t.done })),
    tasksDone: p.tasksDone,
    streak: goalStreak(goals, today, p.achieved),
    studyDays: (allDates as string[]).length,
    totalReviews,
  };
}
