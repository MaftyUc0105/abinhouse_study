import dayjs from 'dayjs';
import type { LocalDate } from '../db/types';

const FMT = 'YYYY-MM-DD';

export function today(): LocalDate {
  return dayjs().format(FMT);
}

export function toLocalDate(ts: number): LocalDate {
  return dayjs(ts).format(FMT);
}

export function addDays(date: LocalDate, n: number): LocalDate {
  return dayjs(date).add(n, 'day').format(FMT);
}

/** b - a，单位天。b 晚于 a 时为正 */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return dayjs(b).startOf('day').diff(dayjs(a).startOf('day'), 'day');
}

export function isValidLocalDate(s: unknown): s is LocalDate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayjs(s).isValid();
}

/** 用于展示：今天 / 明天 / 3 天后 / 逾期 2 天 */
export function describeDue(due: LocalDate, base: LocalDate = today()): string {
  const d = daysBetween(base, due);
  if (d === 0) return '今天';
  if (d === 1) return '明天';
  if (d > 1) return `${d} 天后`;
  if (d === -1) return '逾期 1 天';
  return `逾期 ${-d} 天`;
}
