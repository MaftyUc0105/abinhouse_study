import type { Intensity, LocalDate, Rating, Scheduling, Settings } from '../db/types';
import { addDays } from './dates';

/** 根据当前调度状态与评分，算出新的 stage 和间隔（天） */
export function nextInterval(
  s: Scheduling,
  rating: Rating,
  cfg: Settings,
): { stage: number; interval: number } {
  const top = cfg.ladder.length - 1;
  const ladderAt = (i: number) => cfg.ladder[Math.min(i, top)];

  switch (rating) {
    case 0:
      return { stage: 0, interval: 1 };
    case 1:
      return {
        stage: s.stage,
        interval: Math.max(1, Math.ceil(ladderAt(s.stage) * cfg.fuzzyShrink)),
      };
    case 2:
    case 3: {
      const stage = s.stage + (rating === 2 ? 1 : 2);
      let interval: number;
      if (stage <= top) {
        interval = cfg.ladder[stage];
      } else {
        const base = Math.max(s.lastInterval, cfg.ladder[top]);
        const steps = stage - Math.max(s.stage, top);
        interval = base * Math.pow(cfg.overflowFactor, Math.max(1, steps));
      }
      return { stage, interval: Math.min(Math.round(interval), cfg.maxInterval) };
    }
  }
}

export function applyRating(
  s: Scheduling,
  rating: Rating,
  todayDate: LocalDate,
  cfg: Settings,
  now: number = Date.now(),
): Scheduling {
  const { stage, interval } = nextInterval(s, rating, cfg);
  return {
    ...s,
    stage,
    dueDate: addDays(todayDate, interval),
    lastReviewedAt: now,
    lastInterval: interval,
    reviewCount: s.reviewCount + 1,
    lapseCount: s.lapseCount + (rating === 0 ? 1 : 0),
    recentRatings: [...s.recentRatings, rating].slice(-3),
  };
}

/** 新条目：次日到期 */
export function initialScheduling(todayDate: LocalDate): Scheduling {
  return {
    stage: 0,
    dueDate: addDays(todayDate, 1),
    lastReviewedAt: null,
    lastInterval: 0,
    reviewCount: 0,
    lapseCount: 0,
    recentRatings: [],
    suspended: false,
  };
}

/** 复习强度标签：看最近 3 次评分 */
export function intensity(recent: Rating[]): Intensity {
  if (recent.length === 0) return 'normal';
  const weak = recent.filter((r) => r <= 1).length;
  const forgot = recent.filter((r) => r === 0).length;
  if (forgot >= 2 || weak >= 3) return 'focus';
  if (weak >= 1) return 'attention';
  if (recent.length >= 3 && recent.every((r) => r >= 2)) return 'solid';
  return 'normal';
}

export const INTENSITY_WEIGHT: Record<Intensity, number> = {
  focus: 0,
  attention: 1,
  normal: 2,
  solid: 3,
};
