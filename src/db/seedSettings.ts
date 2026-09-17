import type { StudyDB } from './schema';
import { isValidLocalDate } from '../scheduler/dates';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  id: 'default',
  ladder: [1, 2, 4, 7, 15, 30, 60],
  overflowFactor: 2,
  fuzzyShrink: 0.7,
  dailyNewCap: 0,
  forgotSameDay: true,
  maxInterval: 180,
  fuzz: true,
  examDate: null,
  updatedAt: 0,
};

/** 校验并规范化用户输入的设置；返回错误信息或 null */
export function validateSettings(s: Partial<Settings>): string | null {
  if (s.ladder !== undefined) {
    if (!Array.isArray(s.ladder) || s.ladder.length === 0) return '阶梯至少要有一档';
    for (let i = 0; i < s.ladder.length; i++) {
      const v = s.ladder[i];
      if (!Number.isInteger(v) || v < 1) return '阶梯每一档必须是正整数（天）';
      if (i > 0 && v <= s.ladder[i - 1]) return '阶梯必须严格递增';
    }
  }
  if (s.overflowFactor !== undefined && !(s.overflowFactor >= 1 && s.overflowFactor <= 10))
    return '超阶梯乘数应在 1 到 10 之间';
  if (s.fuzzyShrink !== undefined && !(s.fuzzyShrink > 0 && s.fuzzyShrink <= 1))
    return '模糊缩短系数应在 0 到 1 之间';
  if (s.dailyNewCap !== undefined && !(Number.isInteger(s.dailyNewCap) && s.dailyNewCap >= 0))
    return '每日新条目上限必须是非负整数';
  if (s.maxInterval !== undefined && !(Number.isInteger(s.maxInterval) && s.maxInterval >= 1))
    return '间隔上限必须是正整数';
  if (s.examDate !== undefined && s.examDate !== null && !isValidLocalDate(s.examDate)) return '考试日期格式不正确';
  return null;
}

export async function ensureSettings(db: StudyDB): Promise<Settings> {
  const existing = await db.settings.get('default');
  if (existing) return { ...DEFAULT_SETTINGS, ...existing };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
