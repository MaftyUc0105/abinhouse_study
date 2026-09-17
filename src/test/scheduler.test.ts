import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../db/seedSettings';
import type { Scheduling } from '../db/types';
import { addDays, daysBetween, describeDue } from '../scheduler/dates';
import { applyRating, initialScheduling, intensity, nextInterval } from '../scheduler/scheduler';

const cfg = DEFAULT_SETTINGS; // ladder [1,2,4,7,15,30,60]
const T = '2026-09-17';

function at(stage: number, extra: Partial<Scheduling> = {}): Scheduling {
  return { ...initialScheduling(T), stage, reviewCount: 1, lastInterval: cfg.ladder[Math.min(stage, 6)], ...extra };
}

describe('dates', () => {
  it('addDays 跨月跨年', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-09-15', '2026-09-17')).toBe(2);
    expect(daysBetween('2026-09-17', '2026-09-15')).toBe(-2);
  });
  it('describeDue', () => {
    expect(describeDue('2026-09-17', T)).toBe('今天');
    expect(describeDue('2026-09-18', T)).toBe('明天');
    expect(describeDue('2026-09-20', T)).toBe('3 天后');
    expect(describeDue('2026-09-15', T)).toBe('逾期 2 天');
  });
});

describe('initialScheduling', () => {
  it('新条目次日到期', () => {
    const s = initialScheduling(T);
    expect(s.dueDate).toBe('2026-09-18');
    expect(s.stage).toBe(0);
    expect(s.reviewCount).toBe(0);
  });
});

describe('nextInterval', () => {
  it('忘了 → stage 0，次日', () => {
    expect(nextInterval(at(4), 0, cfg)).toEqual({ stage: 0, interval: 1 });
  });
  it('模糊 → stage 不变，间隔缩短，最少 1 天', () => {
    expect(nextInterval(at(0), 1, cfg)).toEqual({ stage: 0, interval: 1 });
    expect(nextInterval(at(3), 1, cfg)).toEqual({ stage: 3, interval: 5 }); // ceil(7*0.7)=5
  });
  it('记得 → stage+1', () => {
    expect(nextInterval(at(0), 2, cfg)).toEqual({ stage: 1, interval: 2 });
    expect(nextInterval(at(5), 2, cfg)).toEqual({ stage: 6, interval: 60 });
  });
  it('很熟 → stage+2', () => {
    expect(nextInterval(at(0), 3, cfg)).toEqual({ stage: 2, interval: 4 });
  });
  it('超出阶梯顶端按乘数翻倍，封顶 maxInterval', () => {
    expect(nextInterval(at(6), 2, cfg)).toEqual({ stage: 7, interval: 120 });
    expect(nextInterval(at(6), 3, cfg)).toEqual({ stage: 8, interval: 180 }); // 240 封顶 180
    expect(nextInterval(at(7, { lastInterval: 120 }), 2, cfg)).toEqual({ stage: 8, interval: 180 });
    expect(nextInterval(at(5), 3, cfg)).toEqual({ stage: 7, interval: 120 }); // 跨过顶端
  });
});

describe('applyRating', () => {
  it('更新 dueDate、计数与最近评分', () => {
    const s = applyRating(at(1, { recentRatings: [2, 2, 2] }), 0, T, cfg, 123);
    expect(s.stage).toBe(0);
    expect(s.dueDate).toBe('2026-09-18');
    expect(s.lastReviewedAt).toBe(123);
    expect(s.lastInterval).toBe(1);
    expect(s.reviewCount).toBe(2);
    expect(s.lapseCount).toBe(1);
    expect(s.recentRatings).toEqual([2, 2, 0]);
  });
});

describe('intensity', () => {
  it('四档边界', () => {
    expect(intensity([])).toBe('normal');
    expect(intensity([2])).toBe('normal');
    expect(intensity([2, 2])).toBe('normal');
    expect(intensity([2, 2, 3])).toBe('solid');
    expect(intensity([2, 1, 2])).toBe('attention');
    expect(intensity([0])).toBe('attention');
    expect(intensity([0, 2, 0])).toBe('focus');
    expect(intensity([1, 1, 1])).toBe('focus');
  });
});
