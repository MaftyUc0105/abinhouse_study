// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createRepo } from '../db/repo';
import { StudyDB } from '../db/schema';
import type { DailyGoal } from '../db/types';
import { achievedInLast, emptyGoal, goalProgress, goalStreak, hasGoal, parseTasks, settleGoal } from '../scheduler/goals';

const T = '2026-10-20';
let n = 0;
const fresh = () => new StudyDB(`goal_${Date.now()}_${n++}`);

function goal(date: string, over: Partial<DailyGoal> = {}): DailyGoal {
  return { ...emptyGoal(date, 1), ...over };
}
const task = (id: string, done = false) => ({ id, text: 't' + id, done });

describe('goalProgress', () => {
  it('没设目标时不算达成', () => {
    expect(goalProgress(undefined, 10).achieved).toBe(false);
    expect(goalProgress(goal(T), 10)).toMatchObject({ achieved: false, percent: 0, tasksTotal: 0 });
  });

  it('只设复习目标：到数才达成', () => {
    const g = goal(T, { reviewTarget: 40 });
    expect(goalProgress(g, 10)).toMatchObject({ achieved: false, percent: 0.25 });
    expect(goalProgress(g, 39).achieved).toBe(false);
    expect(goalProgress(g, 40)).toMatchObject({ achieved: true, percent: 1 });
    expect(goalProgress(g, 55).percent).toBe(1);
  });

  it('只设任务：全部勾完才达成', () => {
    const g = goal(T, { tasks: [task('a'), task('b')] });
    expect(goalProgress(g, 0)).toMatchObject({ achieved: false, tasksDone: 0, percent: 0 });
    const half = goal(T, { tasks: [task('a', true), task('b')] });
    expect(goalProgress(half, 0)).toMatchObject({ achieved: false, tasksDone: 1, percent: 0.5 });
    const all = goal(T, { tasks: [task('a', true), task('b', true)] });
    expect(goalProgress(all, 0)).toMatchObject({ achieved: true, percent: 1 });
  });

  it('复习目标与任务都要满足；复习算一个单位', () => {
    const g = goal(T, { reviewTarget: 10, tasks: [task('a', true)] });
    expect(goalProgress(g, 5)).toMatchObject({ achieved: false, percent: 0.75 });
    expect(goalProgress(g, 10).achieved).toBe(true);
    const g2 = goal(T, { reviewTarget: 10, tasks: [task('a')] });
    expect(goalProgress(g2, 10).achieved).toBe(false);
  });

  it('已结算的进度固定，不随后续复习变化', () => {
    const g = goal(T, { reviewTarget: 40, settledAt: 2, settledReviewDone: 12, achieved: false });
    expect(goalProgress(g, 99)).toMatchObject({ reviewDone: 12, achieved: false, settled: true });
  });
});

describe('settleGoal', () => {
  it('固定完成数并判定达成，重复结算不变', () => {
    const g = goal(T, { reviewTarget: 5, tasks: [task('a', true)] });
    const s = settleGoal(g, 7, 100);
    expect(s).toMatchObject({ settledAt: 100, settledReviewDone: 7, achieved: true });
    expect(settleGoal(s, 999, 200)).toBe(s);
    const miss = settleGoal(goal(T, { reviewTarget: 5 }), 3, 100);
    expect(miss.achieved).toBe(false);
  });
});

describe('goalStreak', () => {
  const g = (d: string, a: boolean) => goal(d, { reviewTarget: 1, achieved: a });

  it('今天达成时从今天数起', () => {
    const gs = [g('2026-10-18', true), g('2026-10-19', true)];
    expect(goalStreak(gs, T, true)).toBe(3);
  });

  it('今天还没达成时从昨天数，避免白天归零', () => {
    const gs = [g('2026-10-18', true), g('2026-10-19', true)];
    expect(goalStreak(gs, T, false)).toBe(2);
  });

  it('中间断掉就停住', () => {
    const gs = [g('2026-10-17', true), g('2026-10-19', true)];
    expect(goalStreak(gs, T, false)).toBe(1);
    expect(goalStreak([], T, false)).toBe(0);
    expect(goalStreak([g('2026-10-19', false)], T, false)).toBe(0);
  });
});

describe('achievedInLast / parseTasks / hasGoal', () => {
  it('只统计设过目标的天', () => {
    const gs = [
      goal('2026-10-18', { reviewTarget: 1, achieved: true }),
      goal('2026-10-19', { reviewTarget: 1, achieved: false }),
      goal('2026-10-20', { tasks: [task('a')], achieved: true }),
      goal('2026-10-01', { reviewTarget: 1, achieved: true }),
      goal('2026-10-17'),
    ];
    expect(achievedInLast(gs, T, 7)).toEqual({ achieved: 2, planned: 3 });
  });

  it('多行文本拆成任务，去掉序号和空行', () => {
    const ts = parseTasks('1. 背单词 50 个\n\n- 政治第三章\n  • 数学真题一套\n   \n', (i) => `id${i}`);
    expect(ts.map((t) => t.text)).toEqual(['背单词 50 个', '政治第三章', '数学真题一套']);
    expect(ts[0]).toMatchObject({ id: 'id0', done: false });
  });

  it('空目标不算目标', () => {
    expect(hasGoal(goal(T))).toBe(false);
    expect(hasGoal(goal(T, { reviewTarget: 1 }))).toBe(true);
    expect(hasGoal(goal(T, { tasks: [task('a')] }))).toBe(true);
    expect(hasGoal(undefined)).toBe(false);
  });
});

describe('repo 每日目标', () => {
  let db: StudyDB;
  let repo: ReturnType<typeof createRepo>;
  beforeEach(() => {
    db = fresh();
    repo = createRepo(db);
  });

  it('保存、勾任务、结算', async () => {
    await repo.saveGoal(T, { reviewTarget: 2, tasks: parseTasks('背单词\n做题', (i) => `t${i}`) });
    const noteId = await repo.createNote({ title: 'n', subject: 's', body: 'x', tags: [] }, [], T);
    await repo.applyReview('note', noteId, 2, T);
    expect(await repo.countReviewsOn(T)).toBe(1);

    await repo.setGoalTaskDone(T, 't0', true);
    let g = (await repo.getGoal(T))!;
    expect(goalProgress(g, 1)).toMatchObject({ tasksDone: 1, achieved: false });

    await repo.setGoalTaskDone(T, 't1', true);
    await repo.applyReview('note', noteId, 2, T);
    g = (await repo.getGoal(T))!;
    expect(goalProgress(g, await repo.countReviewsOn(T)).achieved).toBe(true);

    const settled = (await repo.settleGoalFor(T))!;
    expect(settled).toMatchObject({ settledReviewDone: 2, achieved: true });
  });

  it('settleDueGoals 只结算今天之前的，空目标跳过', async () => {
    await repo.saveGoal('2026-10-18', { reviewTarget: 1, tasks: [] });
    await repo.saveGoal('2026-10-19', { reviewTarget: 0, tasks: [] }); // 空目标
    await repo.saveGoal(T, { reviewTarget: 1, tasks: [] });
    expect(await repo.settleDueGoals(T)).toBe(1);
    expect((await repo.getGoal('2026-10-18'))!.achieved).toBe(false);
    expect((await repo.getGoal('2026-10-19'))!.settledAt).toBeUndefined();
    expect((await repo.getGoal(T))!.settledAt).toBeUndefined();
    expect(await repo.settleDueGoals(T)).toBe(0);
  });

  it('重新编辑已结算的目标会取消结算', async () => {
    await repo.saveGoal('2026-10-18', { reviewTarget: 1, tasks: [] });
    await repo.settleDueGoals(T);
    expect((await repo.getGoal('2026-10-18'))!.settledAt).toBeDefined();
    await repo.saveGoal('2026-10-18', { reviewTarget: 3, tasks: [] });
    expect((await repo.getGoal('2026-10-18'))!.settledAt).toBeUndefined();
  });
});
