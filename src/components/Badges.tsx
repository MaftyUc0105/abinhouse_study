import { INTENSITY_LABEL, type Rating, type Scheduling } from '../db/types';
import { intensity } from '../scheduler/scheduler';
import { daysBetween } from '../scheduler/dates';

export function IntensityBadge({ recentRatings }: { recentRatings: Rating[] }) {
  const level = intensity(recentRatings);
  if (level === 'normal') return null;
  return <span className={`badge badge-${level}`}>{INTENSITY_LABEL[level]}</span>;
}

export function SubjectChip({ name }: { name: string }) {
  if (!name) return null;
  return <span className="chip">{name}</span>;
}

/** 到期状态：新 / 逾期 N 天 */
export function DueBadge({ item, today }: { item: Scheduling; today: string }) {
  if (item.reviewCount === 0) return <span className="badge badge-new">新</span>;
  const over = daysBetween(item.dueDate, today);
  if (over > 0) return <span className="badge badge-overdue">逾期 {over} 天</span>;
  return null;
}

export function StageDots({ stage, total }: { stage: number; total: number }) {
  const n = Math.min(stage, total);
  return (
    <span className="stage-dots" title={`第 ${stage} 档`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}
