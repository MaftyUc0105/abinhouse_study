import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../db/seedSettings';
import type { Scheduling } from '../db/types';
import { addDays, daysBetween, describeDue } from '../scheduler/dates';
import { applyRating, examCap, fuzzDays, initialScheduling, intensity, nextInterval } from '../scheduler/scheduler';

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

describe('fuzzDays', () => {
  it('间隔 < 4 不抖动', () => {
    for (const i of [1, 2, 3]) expect(fuzzDays(i, 'x')).toBe(i);
  });
  it('确定性，且在 ±10% / ±3 天内', () => {
    for (const interval of [4, 7, 15, 30, 60, 120]) {
      const range = Math.min(3, Math.max(1, Math.round(interval * 0.1)));
      const seen = new Set<number>();
      for (let k = 0; k < 200; k++) {
        const v = fuzzDays(interval, `id${k}`);
        expect(fuzzDays(interval, `id${k}`)).toBe(v);
        expect(Math.abs(v - interval)).toBeLessThanOrEqual(range);
        seen.add(v);
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });
});

describe('examCap', () => {
  it('离考越近间隔越短，考后不封顶', () => {
    expect(examCap(60, '2026-11-20', '2026-12-20')).toBe(15);
    expect(examCap(10, '2026-12-16', '2026-12-20')).toBe(2);
    expect(examCap(10, '2026-12-19', '2026-12-20')).toBe(1);
    expect(examCap(10, '2026-12-20', '2026-12-20')).toBe(10);
    expect(examCap(10, '2026-12-25', '2026-12-20')).toBe(10);
    expect(examCap(10, '2026-01-01', null)).toBe(10);
    expect(examCap(5, '2026-11-20', '2026-12-20')).toBe(5);
  });
});

describe('nextInterval with context', () => {
  it('预览与 applyRating 一致，并应用考试封顶', () => {
    const c = { ...cfg, examDate: '2026-10-17' };
    const s = at(5);
    const ctx = { today: T, itemId: 'abc' };
    const preview = nextInterval(s, 2, c, ctx);
    expect(preview.interval).toBe(15); // 60 天被 30 天离考封顶到 15
    const applied = applyRating(s, 2, T, c, 1, 'abc');
    expect(applied.lastInterval).toBe(preview.interval);
    expect(applied.dueDate).toBe(addDays(T, preview.interval));
  });
  it('关闭 fuzz 时与基础间隔相同', () => {
    const c = { ...cfg, fuzz: false };
    expect(nextInterval(at(4), 2, c, { today: T, itemId: 'q' }).interval).toBe(30);
  });
});
