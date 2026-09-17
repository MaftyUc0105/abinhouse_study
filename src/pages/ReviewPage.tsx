import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntensityBadge, SubjectChip } from '../components/Badges';
import { ImageGrid } from '../components/ImageGrid';
import { MarkdownView } from '../components/MarkdownView';
import { RatingBar } from '../components/RatingBar';
import { useToast } from '../components/Toast';
import { db } from '../db/schema';
import { RATING_LABEL, type Rating, type Settings } from '../db/types';
import { useImages } from '../hooks/useImages';
import { useReviewSession, type SessionItem } from '../hooks/useReviewSession';
import { useSettings } from '../hooks/useSettings';
import { useTodayQueue } from '../hooks/useTodayQueue';
import type { QueueItem } from '../scheduler/queue';
import { nextInterval } from '../scheduler/scheduler';

export function ReviewPage() {
  const q = useTodayQueue();
  const settings = useSettings();
  const [snapshot, setSnapshot] = useState<QueueItem[] | null>(null);

  if (!q.loading && snapshot === null) setSnapshot(q.items);
  if (snapshot === null) return <div className="page empty">加载中…</div>;
  return <ReviewSession initial={snapshot} settings={settings} />;
}

function ReviewSession({ initial, settings }: { initial: QueueItem[]; settings: Settings }) {
  const nav = useNavigate();
  const toast = useToast();
  const { state, current, finished, reveal, rate, acknowledge, later, skip } = useReviewSession(initial, settings);
  const total = state.items.length;
  const done = Math.min(state.index, total);

  if (initial.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-icon">🎉</div>
          <div>今天没有待复习的内容</div>
          <button className="btn mt-16" onClick={() => nav('/')}>
            返回
          </button>
        </div>
      </div>
    );
  }

  if (finished || !current) {
    const ratings: Rating[] = [0, 1, 2, 3];
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-icon">✅</div>
          <h2>本次复习完成</h2>
          <div className="muted">共评分 {state.rated} 条</div>
          <div className="row mt-16" style={{ justifyContent: 'center' }}>
            {ratings.map((r) => (
              <span key={r} className={`chip rating-label-${r}`}>
                {RATING_LABEL[r]} {state.counts[r]}
              </span>
            ))}
          </div>
          <button className="btn btn-primary btn-lg mt-16" onClick={() => nav('/')}>
            返回今日
          </button>
        </div>
      </div>
    );
  }

  const onRate = async (r: Rating) => {
    try {
      await rate(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败');
    }
  };

  return (
    <div className="page page-review">
      <div className="row-between mb-8">
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/')}>
          ‹ 退出
        </button>
        <span className="small muted">
          {done + 1} / {total}
        </span>
        <span style={{ width: 60 }} />
      </div>
      <div className="review-progress mb-8">
        <div style={{ width: `${(done / total) * 100}%` }} />
      </div>

      <ItemView key={`${current.type}:${current.id}:${state.index}`} item={current} revealed={state.revealed} settings={settings} />

      <div className="review-actions">
        <div className="review-actions-inner">
          {current.requeued ? (
            <button className="btn btn-primary btn-block btn-lg" onClick={acknowledge}>
              再看一遍，知道了
            </button>
          ) : !state.revealed ? (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button className="btn btn-soft" onClick={later}>
                稍后
              </button>
              <button className="btn btn-soft" onClick={skip}>
                跳过
              </button>
              <button className="btn btn-primary btn-lg grow" onClick={reveal}>
                显示内容
              </button>
            </div>
          ) : (
            <RatingBar
              onRate={onRate}
              disabled={state.busy}
              previews={{
                0: nextInterval(current, 0, settings).interval,
                1: nextInterval(current, 1, settings).interval,
                2: nextInterval(current, 2, settings).interval,
                3: nextInterval(current, 3, settings).interval,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ItemView({ item, revealed, settings }: { item: SessionItem; revealed: boolean; settings: Settings }) {
  const show = revealed || !!item.requeued;
  const note = useLiveQuery(() => db.notes.get(item.noteId), [item.noteId]);
  const card = useLiveQuery(() => (item.type === 'card' ? db.cards.get(item.id) : undefined), [item.type, item.id]);
  const bodyImages = useImages('note', item.type === 'note' ? item.id : undefined, 'body');
  const qImages = useImages('card', item.type === 'card' ? item.id : undefined, 'question');
  const aImages = useImages('card', item.type === 'card' ? item.id : undefined, 'answer');

  return (
    <div className="stack">
      <div className="row">
        <SubjectChip name={item.subject} />
        <IntensityBadge recentRatings={item.recentRatings} />
        <span className="tiny">
          第 {item.stage} 档 · 复习 {item.reviewCount} 次
          {item.lapseCount > 0 && ` · 忘 ${item.lapseCount} 次`}
        </span>
        {item.requeued && <span className="badge badge-overdue">刚才忘了，再看一遍</span>}
      </div>

      <div className="card">
        {item.type === 'card' && <div className="tiny mb-8">来自笔记：{item.noteTitle}</div>}
        <div className="review-title">{item.type === 'note' ? note?.title ?? item.title : card?.question ?? item.title}</div>
        {item.type === 'card' && qImages.length > 0 && (
          <div className="mt-8">
            <ImageGrid images={qImages} mode="grid" />
          </div>
        )}
      </div>

      {!show ? (
        <div className="empty small">先回忆一下，再点"显示内容"对照</div>
      ) : (
        <div className="card stack">
          {item.type === 'note' ? (
            <>
              {note?.body ? <MarkdownView markdown={note.body} /> : bodyImages.length === 0 && <span className="muted">（无内容）</span>}
              <ImageGrid images={bodyImages} />
              {note && note.tags.length > 0 && (
                <div className="row">
                  {note.tags.map((t) => (
                    <span key={t} className="chip">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {card?.answer ? <MarkdownView markdown={card.answer} /> : aImages.length === 0 && <span className="muted">（无答案）</span>}
              <ImageGrid images={aImages} />
            </>
          )}
          <div className="tiny">
            阶梯：{settings.ladder.join(' / ')} 天
          </div>
        </div>
      )}
    </div>
  );
}
