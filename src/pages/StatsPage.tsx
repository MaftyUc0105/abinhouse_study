import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useTodayQueue } from '../hooks/useTodayQueue';
import { addDays } from '../scheduler/dates';
import { useToday } from '../hooks/useToday';
import { dailyCounts, streak, subjectStats, upcomingLoad } from '../utils/stats';
import { formatBytes } from '../utils/image';

export function StatsPage() {
  const t = useToday();
  const q = useTodayQueue();
  const data = useLiveQuery(async () => {
    const [notes, cards, logs, imageCount, imageSize] = await Promise.all([
      db.notes.toArray(),
      db.cards.toArray(),
      db.reviewLogs.where('date').aboveOrEqual(addDays(t, -60)).toArray(),
      db.images.count(),
      (async () => {
        let s = 0;
        await db.images.each((i) => (s += i.size));
        return s;
      })(),
    ]);
    const allDates = await db.reviewLogs.orderBy('date').uniqueKeys();
    return { notes, cards, logs, imageCount, imageSize, allDates: allDates as string[] };
  }, [t]);

  if (!data) return <div className="page empty">加载中…</div>;

  const todayDone = data.logs.filter((l) => l.date === t).length;
  const days = streak(data.allDates, t);
  const load = upcomingLoad([...data.notes, ...data.cards], t, 7);
  const loadMax = Math.max(1, ...load.map((l) => l.count));
  const recent = dailyCounts(data.logs, t, 14);
  const recentMax = Math.max(1, ...recent.map((l) => l.count));
  const subs = subjectStats(data.notes, data.cards);
  const weekday = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="page">
      <div className="page-header">
        <h1>统计</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="num">{todayDone}</div>
          <div className="lbl">今日已复习</div>
        </div>
        <div className="stat-tile">
          <div className="num">{q.loading ? '–' : q.total}</div>
          <div className="lbl">今日剩余</div>
        </div>
        <div className="stat-tile">
          <div className="num">{days}</div>
          <div className="lbl">连续天数</div>
        </div>
      </div>

      <div className="section-title">未来 7 天复习负载</div>
      <div className="card stack">
        {load.map((l, i) => {
          const d = new Date(l.date + 'T00:00:00');
          return (
            <div key={l.date} className="bar-row">
              <span className="muted">{i === 0 ? '今天' : i === 1 ? '明天' : `周${weekday[d.getDay()]} ${l.date.slice(5)}`}</span>
              <div className="bar">
                <div style={{ width: `${(l.count / loadMax) * 100}%` }} />
              </div>
              <span className="center">{l.count}</span>
            </div>
          );
        })}
        <div className="tiny">第一行包含所有逾期条目。</div>
      </div>

      <div className="section-title">最近 14 天复习量</div>
      <div className="card stack">
        {recent.map((l) => (
          <div key={l.date} className="bar-row">
            <span className="muted">{l.date.slice(5)}</span>
            <div className="bar">
              <div style={{ width: `${(l.count / recentMax) * 100}%`, background: 'var(--ok)' }} />
            </div>
            <span className="center">{l.count}</span>
          </div>
        ))}
      </div>

      <div className="section-title">按科目</div>
      <div className="card">
        {subs.length === 0 ? (
          <div className="muted small">还没有数据</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr className="tiny" style={{ textAlign: 'left' }}>
                <th>科目</th>
                <th>笔记</th>
                <th>卡片</th>
                <th style={{ color: 'var(--danger)' }}>重点</th>
                <th style={{ color: 'var(--warn)' }}>注意</th>
                <th style={{ color: 'var(--ok)' }}>稳固</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.subject} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 0' }}>{s.subject}</td>
                  <td>{s.notes}</td>
                  <td>{s.cards}</td>
                  <td>{s.focus}</td>
                  <td>{s.attention}</td>
                  <td>{s.solid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">总量</div>
      <div className="card small">
        笔记 {data.notes.length} 条 · 卡片 {data.cards.length} 张 · 照片 {data.imageCount} 张（{formatBytes(data.imageSize)}）
      </div>
    </div>
  );
}
