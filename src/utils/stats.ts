import type { LocalDate, Note, Card, ReviewLog, Scheduling } from '../db/types';
import { addDays, daysBetween } from '../scheduler/dates';
import { intensity } from '../scheduler/scheduler';

/** 未来 N 天每日负载；逾期与今天合并到第 0 天 */
export function upcomingLoad(items: Scheduling[], todayDate: LocalDate, days = 7): { date: LocalDate; count: number }[] {
  const buckets = Array.from({ length: days }, (_, i) => ({ date: addDays(todayDate, i), count: 0 }));
  for (const it of items) {
    if (it.suspended) continue;
    const d = Math.max(0, daysBetween(todayDate, it.dueDate));
    if (d < days) buckets[d].count += 1;
  }
  return buckets;
}

export interface SubjectStat {
  subject: string;
  notes: number;
  cards: number;
  focus: number;
  attention: number;
  solid: number;
}

export function subjectStats(notes: Note[], cards: Card[]): SubjectStat[] {
  const map = new Map<string, SubjectStat>();
  const get = (s: string) => {
    const key = s || '未分类';
    let v = map.get(key);
    if (!v) {
      v = { subject: key, notes: 0, cards: 0, focus: 0, attention: 0, solid: 0 };
      map.set(key, v);
    }
    return v;
  };
  const noteSubject = new Map(notes.map((n) => [n.id, n.subject]));
  for (const n of notes) {
    const v = get(n.subject);
    v.notes += 1;
    bump(v, n);
  }
  for (const c of cards) {
    const v = get(noteSubject.get(c.noteId) ?? '');
    v.cards += 1;
    bump(v, c);
  }
  return [...map.values()].sort((a, b) => b.notes + b.cards - (a.notes + a.cards));
}

function bump(v: SubjectStat, s: Scheduling) {
  const lvl = intensity(s.recentRatings);
  if (lvl === 'focus') v.focus += 1;
  else if (lvl === 'attention') v.attention += 1;
  else if (lvl === 'solid') v.solid += 1;
}

/** 连续打卡天数：从今天（或昨天）往前数有复习记录的连续日期 */
export function streak(dates: Iterable<LocalDate>, todayDate: LocalDate): number {
  const set = new Set(dates);
  let d = set.has(todayDate) ? todayDate : addDays(todayDate, -1);
  let n = 0;
  while (set.has(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

/** 最近 N 天每日复习次数 */
export function dailyCounts(logs: ReviewLog[], todayDate: LocalDate, days = 14): { date: LocalDate; count: number }[] {
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(todayDate, i - days + 1), count: 0 }));
  const idx = new Map(out.map((o, i) => [o.date, i]));
  for (const l of logs) {
    const i = idx.get(l.date);
    if (i !== undefined) out[i].count += 1;
  }
  return out;
}
