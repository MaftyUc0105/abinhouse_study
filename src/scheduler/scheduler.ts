import type { Intensity, LocalDate, Rating, Scheduling, Settings } from '../db/types';
import { addDays, daysBetween } from './dates';

/** 调度上下文：用于到期日错开与考试封顶 */
export interface ScheduleContext {
  today: LocalDate;
  itemId: string;
}

/** 字符串 → 32 位无符号整数（FNV-1a），用于确定性抖动 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 间隔 ≥ 4 天时加 ±10%（最多 ±3 天）的确定性抖动。
 * 同一 seed 结果固定，保证按钮预览与实际排期一致。
 */
export function fuzzDays(interval: number, seed: string): number {
  if (interval < 4) return interval;
  const range = Math.min(3, Math.max(1, Math.round(interval * 0.1)));
  const offset = (hashString(seed) % (2 * range + 1)) - range;
  return Math.max(1, interval + offset);
}

/** 考试封顶：离考 daysLeft 天时，间隔不超过 ceil(daysLeft/2)；考后不封顶 */
export function examCap(interval: number, today: LocalDate, examDate: LocalDate | null): number {
  if (!examDate) return interval;
  const daysLeft = daysBetween(today, examDate);
  if (daysLeft <= 0) return interval;
  return Math.min(interval, Math.max(1, Math.ceil(daysLeft / 2)));
}

/** 按艾宾浩斯阶梯算出的基础 stage 与间隔（不含抖动与封顶） */
function baseInterval(s: Scheduling, rating: Rating, cfg: Settings): { stage: number; interval: number } {
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

/** 根据当前调度状态与评分，算出新的 stage 和间隔（天）。传入 ctx 时应用抖动与考试封顶 */
export function nextInterval(
  s: Scheduling,
  rating: Rating,
  cfg: Settings,
  ctx?: ScheduleContext,
): { stage: number; interval: number } {
  const { stage, interval: raw } = baseInterval(s, rating, cfg);
  if (!ctx) return { stage, interval: raw };
  let interval = cfg.fuzz ? fuzzDays(raw, `${ctx.itemId}:${s.reviewCount}`) : raw;
  interval = Math.min(interval, cfg.maxInterval);
  interval = examCap(interval, ctx.today, cfg.examDate ?? null);
  return { stage, interval };
}

export function applyRating(
  s: Scheduling,
  rating: Rating,
  todayDate: LocalDate,
  cfg: Settings,
  now: number = Date.now(),
  itemId?: string,
): Scheduling {
  const ctx = itemId ? { today: todayDate, itemId } : undefined;
  const { stage, interval } = nextInterval(s, rating, cfg, ctx);
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

/** 从条目中取出调度字段 */
export function pickScheduling(s: Scheduling): Scheduling {
  return {
    stage: s.stage,
    dueDate: s.dueDate,
    lastReviewedAt: s.lastReviewedAt,
    lastInterval: s.lastInterval,
    reviewCount: s.reviewCount,
    lapseCount: s.lapseCount,
    recentRatings: [...s.recentRatings],
    suspended: s.suspended,
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
