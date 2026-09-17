import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DueBadge, IntensityBadge, SubjectChip } from '../components/Badges';
import { SyncStatus } from '../components/SyncStatus';
import { useBadge } from '../hooks/useBadge';
import { useSettings } from '../hooks/useSettings';
import { useTodayQueue } from '../hooks/useTodayQueue';
import { daysBetween } from '../scheduler/dates';

function ExamCountdown({ examDate, today }: { examDate: string | null; today: string }) {
  if (!examDate) return null;
  const d = daysBetween(today, examDate);
  if (d < 0) return null;
  return <span className="exam-countdown">{d === 0 ? '今天考试，加油' : `距考研 ${d} 天`}</span>;
}

export function TodayPage() {
  const q = useTodayQueue();
  const settings = useSettings();
  const nav = useNavigate();
  const [subject, setSubject] = useState('');
  useBadge(q.total, !q.loading);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of q.items) m.set(it.subject, (m.get(it.subject) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [q.items]);

  const active = subject && bySubject.some(([s]) => s === subject) ? subject : '';
  const items = active ? q.items.filter((i) => i.subject === active) : q.items;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>今日复习</h1>
          <div className="row" style={{ gap: 6 }}>
            <span className="tiny">{q.today}</span>
            <ExamCountdown examDate={settings.examDate} today={q.today} />
          </div>
        </div>
        <SyncStatus />
      </div>

      {q.loading ? (
        <div className="empty">加载中…</div>
      ) : q.total === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎉</div>
          <div>今天没有待复习的内容</div>
          <div className="small mt-8">
            去<Link to="/add">录入</Link>一些新知识点吧
          </div>
        </div>
      ) : (
        <>
          <div className="banner">
            <div className="row-between">
              <div>
                <div className="banner-num">{items.length}</div>
                <div className="small">
                  条待复习{active && `（${active}）`}
                  {!active && q.overdue > 0 && <> · 逾期 {q.overdue}</>}
                  {!active && q.newCount > 0 && <> · 新 {q.newCount}</>}
                </div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => nav(active ? `/review?subject=${encodeURIComponent(active)}` : '/review')}
              >
                开始复习
              </button>
            </div>
          </div>

          {bySubject.length > 1 && (
            <div className="scroll-x mt-8">
              <button className={`chip chip-btn${active === '' ? ' chip-active' : ''}`} onClick={() => setSubject('')}>
                全部 {q.total}
              </button>
              {bySubject.map(([s, n]) => (
                <button key={s} className={`chip chip-btn${active === s ? ' chip-active' : ''}`} onClick={() => setSubject(s)}>
                  {s || '未分类'} {n}
                </button>
              ))}
            </div>
          )}

          <div className="section-title">队列（按紧急程度排序）</div>
          <div className="list">
            {items.map((it) => (
              <Link key={`${it.type}:${it.id}`} to={`/notes/${it.noteId}`} className="card card-link">
                <div className="row-between">
                  <div className="grow">
                    <div className="ellipsis">
                      {it.type === 'card' && <span className="tiny">[卡片] </span>}
                      {it.title || '（无标题）'}
                    </div>
                    {it.type === 'card' && <div className="tiny ellipsis">来自：{it.noteTitle}</div>}
                  </div>
                </div>
                <div className="row mt-8">
                  <SubjectChip name={it.subject} />
                  <IntensityBadge recentRatings={it.recentRatings} />
                  <DueBadge item={it} today={q.today} />
                  <span className="tiny">第 {it.stage} 档</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
