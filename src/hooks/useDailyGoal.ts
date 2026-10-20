import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/schema';
import type { DailyGoal } from '../db/types';
import { addDays } from '../scheduler/dates';
import { achievedInLast, goalProgress, goalStreak, hasGoal, type GoalProgress } from '../scheduler/goals';
import { useToday } from './useToday';

export interface DailyGoalState {
  loading: boolean;
  today: string;
  goal: DailyGoal | undefined;
  /** 今天已完成的复习次数 */
  reviewDone: number;
  progress: GoalProgress;
  /** 连续达成天数 */
  streak: number;
  /** 昨天往前 7 天的达成情况，不含今天 */
  last7: { achieved: number; planned: number };
  hasGoal: boolean;
}

export function useDailyGoal(): DailyGoalState {
  const today = useToday();
  const data = useLiveQuery(
    async () => ({
      goal: await db.dailyGoals.get(today),
      goals: await db.dailyGoals.toArray(),
      reviewDone: await db.reviewLogs.where('date').equals(today).count(),
    }),
    [today],
  );

  return useMemo(() => {
    if (!data) {
      return {
        loading: true,
        today,
        goal: undefined,
        reviewDone: 0,
        progress: goalProgress(undefined, 0),
        streak: 0,
        last7: { achieved: 0, planned: 0 },
        hasGoal: false,
      };
    }
    const progress = goalProgress(data.goal, data.reviewDone);
    return {
      loading: false,
      today,
      goal: data.goal,
      reviewDone: data.reviewDone,
      progress,
      streak: goalStreak(data.goals, today, progress.achieved),
      last7: achievedInLast(data.goals, addDays(today, -1), 7),
      hasGoal: hasGoal(data.goal),
    };
  }, [data, today]);
}
