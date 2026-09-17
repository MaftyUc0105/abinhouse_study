import { Link, useNavigate } from 'react-router-dom';
import { DueBadge, IntensityBadge, SubjectChip } from '../components/Badges';
import { useBadge } from '../hooks/useBadge';
import { useTodayQueue } from '../hooks/useTodayQueue';

export function TodayPage() {
  const q = useTodayQueue();
  const nav = useNavigate();
  useBadge(q.total, !q.loading);

  return (
    <div className="page">
      <div className="page-header">
        <h1>今日复习</h1>
        <span className="tiny">{q.today}</span>
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
                <div className="banner-num">{q.total}</div>
                <div className="small">
                  条待复习
                  {q.overdue > 0 && <> · 逾期 {q.overdue}</>}
                  {q.newCount > 0 && <> · 新 {q.newCount}</>}
                </div>
              </div>
              <button className="btn btn-primary btn-lg" onClick={() => nav('/review')}>
                开始复习
              </button>
            </div>
          </div>

          <div className="section-title">队列（按紧急程度排序）</div>
          <div className="list">
            {q.items.map((it) => (
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
