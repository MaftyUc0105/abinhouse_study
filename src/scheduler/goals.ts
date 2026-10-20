/**
 * 每日目标：自己定今天要完成多少复习、要做哪几件事，当天结束时结算。
 * 这里只放纯函数，便于测试；读写数据库在 db/repo.ts。
 */
import type { DailyGoal, GoalTask, LocalDate } from '../db/types';
import { addDays } from './dates';

export interface GoalProgress {
  reviewDone: number;
  reviewTarget: number;
  tasksDone: number;
  tasksTotal: number;
  /** 复习目标与全部任务都完成 */
  achieved: boolean;
  /** 0–1，复习与任务按各自条目数加权 */
  percent: number;
  settled: boolean;
}

export function emptyGoal(date: LocalDate, now = Date.now()): DailyGoal {
  return { date, reviewTarget: 0, tasks: [], createdAt: now, updatedAt: now };
}

export function hasGoal(goal: DailyGoal | undefined): goal is DailyGoal {
  return !!goal && (goal.reviewTarget > 0 || goal.tasks.length > 0);
}

/** 计算进度。已结算的目标用结算时记下的复习数，不再随后续复习变化。 */
export function goalProgress(goal: DailyGoal | undefined, reviewDone: number): GoalProgress {
  if (!hasGoal(goal)) {
    return { reviewDone, reviewTarget: 0, tasksDone: 0, tasksTotal: 0, achieved: false, percent: 0, settled: false };
  }
  const settled = goal.settledAt !== undefined;
  const done = settled ? (goal.settledReviewDone ?? 0) : reviewDone;
  const tasksTotal = goal.tasks.length;
  const tasksDone = goal.tasks.filter((t) => t.done).length;
  const reviewOk = goal.reviewTarget === 0 || done >= goal.reviewTarget;
  const achieved = settled ? !!goal.achieved : reviewOk && tasksDone === tasksTotal;

  // 复习目标算一个单位，每件任务各算一个单位
  const unitsTotal = (goal.reviewTarget > 0 ? 1 : 0) + tasksTotal;
  const reviewUnit = goal.reviewTarget > 0 ? Math.min(1, done / goal.reviewTarget) : 0;
  const percent = unitsTotal === 0 ? 0 : Math.min(1, (reviewUnit + tasksDone) / unitsTotal);

  return { reviewDone: done, reviewTarget: goal.reviewTarget, tasksDone, tasksTotal, achieved, percent, settled };
}

/** 结算：把当天实际完成数固定下来，并判定是否达成 */
export function settleGoal(goal: DailyGoal, reviewDone: number, now = Date.now()): DailyGoal {
  if (goal.settledAt !== undefined) return goal;
  const p = goalProgress({ ...goal, settledAt: undefined }, reviewDone);
  return { ...goal, settledAt: now, settledReviewDone: reviewDone, achieved: p.achieved, updatedAt: now };
}

/**
 * 连续达成天数：从今天往前数。
 * 今天还没结算也没达成时不算断，从昨天开始数，避免白天看到连续归零。
 */
export function goalStreak(goals: Iterable<DailyGoal>, todayDate: LocalDate, todayAchieved: boolean): number {
  const achievedDates = new Set<LocalDate>();
  for (const g of goals) {
    if (g.achieved) achievedDates.add(g.date);
  }
  if (todayAchieved) achievedDates.add(todayDate);

  let d = achievedDates.has(todayDate) ? todayDate : addDays(todayDate, -1);
  let n = 0;
  while (achievedDates.has(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

/** 最近 days 天里设过目标且达成的天数 */
export function achievedInLast(goals: Iterable<DailyGoal>, todayDate: LocalDate, days: number): { achieved: number; planned: number } {
  const from = addDays(todayDate, -(days - 1));
  let achieved = 0;
  let planned = 0;
  for (const g of goals) {
    if (g.date < from || g.date > todayDate) continue;
    if (!hasGoal(g)) continue;
    planned += 1;
    if (g.achieved) achieved += 1;
  }
  return { achieved, planned };
}

export function makeTask(text: string, id: string): GoalTask {
  return { id, text: text.trim(), done: false };
}

/** 把多行文本拆成任务，每行一个，忽略空行和开头的符号 */
export function parseTasks(text: string, makeId: (i: number) => string): GoalTask[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^\s*[-*·•\d]+[.、)]?\s*/, '').trim())
    .filter(Boolean)
    .map((t, i) => makeTask(t, makeId(i)));
}
