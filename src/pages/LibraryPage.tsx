import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IntensityBadge, StageDots, SubjectChip } from '../components/Badges';
import { db } from '../db/schema';
import type { Note } from '../db/types';
import { useSettings } from '../hooks/useSettings';
import { describeDue, today } from '../scheduler/dates';
import { plainPreview } from '../utils/markdown';

type Sort = 'due' | 'updated' | 'created';

export function LibraryPage() {
  const settings = useSettings();
  const t = today();
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<string>('');
  const [sort, setSort] = useState<Sort>('due');

  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('name').toArray(), []) ?? [];
  const cardCounts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.cards.each((c) => m.set(c.noteId, (m.get(c.noteId) ?? 0) + 1));
    return m;
  }, []);
  const imageCounts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.images.each((i) => {
      if (i.ownerType === 'note') m.set(i.ownerId, (m.get(i.ownerId) ?? 0) + 1);
    });
    return m;
  }, []);

  const list = useMemo(() => {
    if (!notes) return [];
    const kw = search.trim().toLowerCase();
    let arr = notes.filter((n) => (!subject || n.subject === subject));
    if (kw) {
      arr = arr.filter(
        (n) =>
          n.title.toLowerCase().includes(kw) ||
          n.body.toLowerCase().includes(kw) ||
          n.tags.some((tg) => tg.toLowerCase().includes(kw)),
      );
    }
    const cmp: Record<Sort, (a: Note, b: Note) => number> = {
      due: (a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : b.updatedAt - a.updatedAt),
      updated: (a, b) => b.updatedAt - a.updatedAt,
      created: (a, b) => b.createdAt - a.createdAt,
    };
    return arr.sort(cmp[sort]);
  }, [notes, search, subject, sort]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>知识库</h1>
        <span className="tiny">{notes ? `${notes.length} 条笔记` : ''}</span>
      </div>
      <div className="search-row">
        <input className="input" placeholder="搜索标题 / 内容 / 标签" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ width: 120 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="due">按到期</option>
          <option value="updated">最近更新</option>
          <option value="created">最近创建</option>
        </select>
      </div>
      {subjects.length > 0 && (
        <div className="scroll-x mb-8">
          <button className={`chip chip-btn${subject === '' ? ' chip-active' : ''}`} onClick={() => setSubject('')}>
            全部
          </button>
          {subjects.map((s) => (
            <button key={s.name} className={`chip chip-btn${subject === s.name ? ' chip-active' : ''}`} onClick={() => setSubject(s.name)}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {!notes ? (
        <div className="empty">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div>{notes.length === 0 ? '还没有笔记' : '没有匹配的笔记'}</div>
          {notes.length === 0 && (
            <div className="small mt-8">
              去<Link to="/add">录入</Link>第一条吧
            </div>
          )}
        </div>
      ) : (
        <div className="list">
          {list.map((n) => {
            const cards = cardCounts?.get(n.id) ?? 0;
            const imgs = imageCounts?.get(n.id) ?? 0;
            const preview = plainPreview(n.body, 60);
            return (
              <Link key={n.id} to={`/notes/${n.id}`} className="card card-link">
                <div className="row-between">
                  <div className="ellipsis grow">{n.title || '（无标题）'}</div>
                  <StageDots stage={n.stage} total={settings.ladder.length} />
                </div>
                {preview && <div className="tiny clamp-2 mt-8">{preview}</div>}
                <div className="row mt-8">
                  <SubjectChip name={n.subject} />
                  <IntensityBadge recentRatings={n.recentRatings} />
                  {n.suspended ? (
                    <span className="badge badge-normal">已暂停</span>
                  ) : (
                    <span className={`tiny${n.dueDate < t ? ' rating-label-0' : ''}`}>
                      {n.reviewCount === 0 ? '新 · ' : ''}
                      {describeDue(n.dueDate, t)}
                    </span>
                  )}
                  {cards > 0 && <span className="tiny">🗂 {cards}</span>}
                  {imgs > 0 && <span className="tiny">📷 {imgs}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
