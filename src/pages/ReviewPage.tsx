import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IntensityBadge, SubjectChip } from '../components/Badges';
import { ImageGrid } from '../components/ImageGrid';
import { MarkdownView } from '../components/MarkdownView';
import { RatingBar } from '../components/RatingBar';
import { useToast } from '../components/Toast';
import { db } from '../db/schema';
import { RATING_LABEL, type ImageRecord, type Rating, type Settings } from '../db/types';
import { useImages } from '../hooks/useImages';
import { useReviewSession, type SessionItem } from '../hooks/useReviewSession';
import { useSettings } from '../hooks/useSettings';
import { useToday } from '../hooks/useToday';
import { useTodayQueue } from '../hooks/useTodayQueue';
import type { QueueItem } from '../scheduler/queue';
import { nextInterval } from '../scheduler/scheduler';

export function ReviewPage() {
  const q = useTodayQueue();
  const settings = useSettings();
  const [params] = useSearchParams();
  const subject = params.get('subject');
  const [snapshot, setSnapshot] = useState<QueueItem[] | null>(null);

  if (!q.loading && snapshot === null) setSnapshot(subject ? q.items.filter((i) => i.subject === subject) : q.items);
  if (snapshot === null) return <div className="page empty">加载中…</div>;
  return <ReviewSession initial={snapshot} settings={settings} subject={subject} />;
}

const hasMasks = (imgs: ImageRecord[]) => imgs.filter((i) => (i.masks?.length ?? 0) > 0);

function ReviewSession({ initial, settings, subject }: { initial: QueueItem[]; settings: Settings; subject: string | null }) {
  const nav = useNavigate();
  const toast = useToast();
  const t = useToday();
  const { state, current, finished, reveal, rate, acknowledge, later, skip, undo, canUndo } = useReviewSession(initial, settings);
  const total = state.items.length;
  const done = Math.min(state.index, total);

  const onRate = async (r: Rating) => {
    try {
      await rate(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败');
    }
  };
  const onUndo = async () => {
    try {
      await undo();
      toast('已撤销');
    } catch (e) {
      toast(e instanceof Error ? e.message : '撤销失败');
    }
  };

  // 电脑快捷键：空格/回车 显示，1–4 评分，Z 撤销，L 稍后
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (document.querySelector('.lightbox, .mask-editor')) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        if (canUndo) void onUndo();
        return;
      }
      if (!current) return;
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        if (current.requeued) acknowledge();
        else if (!state.revealed) reveal();
      } else if (['1', '2', '3', '4'].includes(k) && state.revealed && !current.requeued && !state.busy) {
        void onRate((Number(k) - 1) as Rating);
      } else if (k === 'l' && !state.revealed && !current.requeued) {
        later();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const header = (
    <div className="row-between mb-8">
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/')}>
        ‹ 退出
      </button>
      <span className="small muted">
        {subject && <>{subject} · </>}
        {finished ? `${total} / ${total}` : `${done + 1} / ${total}`}
      </span>
      <button className="btn btn-ghost btn-sm" disabled={!canUndo || state.busy} onClick={onUndo} title="撤销上一步（Z）">
        ↶ 撤销
      </button>
    </div>
  );

  if (initial.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-icon">🎉</div>
          <div>{subject ? `「${subject}」今天没有待复习的内容` : '今天没有待复习的内容'}</div>
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
        {header}
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

  const ctx = { today: t, itemId: current.id };

  return (
    <div className="page page-review">
      {header}
      <div className="review-progress mb-8">
        <div style={{ width: `${(done / total) * 100}%` }} />
      </div>

      <ItemView key={`${current.type}:${current.id}:${state.index}`} item={current} revealed={state.revealed} />

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
                0: nextInterval(current, 0, settings, ctx).interval,
                1: nextInterval(current, 1, settings, ctx).interval,
                2: nextInterval(current, 2, settings, ctx).interval,
                3: nextInterval(current, 3, settings, ctx).interval,
              }}
            />
          )}
          <div className="kbd-hint">空格 显示 · 1–4 评分 · Z 撤销 · L 稍后</div>
        </div>
      </div>
    </div>
  );
}

function ItemView({ item, revealed }: { item: SessionItem; revealed: boolean }) {
  const show = revealed || !!item.requeued;
  const note = useLiveQuery(() => db.notes.get(item.noteId), [item.noteId]);
  const card = useLiveQuery(() => (item.type === 'card' ? db.cards.get(item.id) : undefined), [item.type, item.id]);
  const bodyImages = useImages('note', item.type === 'note' ? item.id : undefined, 'body');
  const qImages = useImages('card', item.type === 'card' ? item.id : undefined, 'question');
  const aImages = useImages('card', item.type === 'card' ? item.id : undefined, 'answer');

  // 有遮挡的图片在揭晓前就显示（遮住状态），用来自测
  const preBody = hasMasks(bodyImages);
  const preAnswer = hasMasks(aImages);

  return (
    <div className="stack">
      <div className="row">
        <SubjectChip name={item.subject} />
        <IntensityBadge recentRatings={item.recentRatings} />
        <span className="tiny">
          第 {item.stage} 档 · 复习 {item.reviewCount} 次{item.lapseCount > 0 && ` · 忘 ${item.lapseCount} 次`}
        </span>
        {item.requeued && <span className="badge badge-overdue">刚才忘了，再看一遍</span>}
      </div>

      <div className="card">
        {item.type === 'card' && <div className="tiny mb-8">来自笔记：{item.noteTitle}</div>}
        <div className="review-title">{item.type === 'note' ? (note?.title ?? item.title) : (card?.question ?? item.title)}</div>
        {item.type === 'card' && qImages.length > 0 && (
          <div className="mt-8">
            <ImageGrid images={qImages} mode="grid" maskMode="test" allRevealed={show} />
          </div>
        )}
      </div>

      {item.type === 'note' ? (
        show || preBody.length > 0 ? (
          <div className="card stack">
            {show && (note?.body ? <MarkdownView markdown={note.body} /> : bodyImages.length === 0 && <span className="muted">（无内容）</span>)}
            <ImageGrid images={show ? bodyImages : preBody} maskMode="test" allRevealed={show} />
            {show && note && note.tags.length > 0 && (
              <div className="row">
                {note.tags.map((tg) => (
                  <span key={tg} className="chip">
                    #{tg}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty small">先回忆一下，再点"显示内容"对照</div>
        )
      ) : show || preAnswer.length > 0 ? (
        <div className="card stack">
          {show && (card?.answer ? <MarkdownView markdown={card.answer} /> : aImages.length === 0 && <span className="muted">（无答案）</span>)}
          <ImageGrid images={show ? aImages : preAnswer} maskMode="test" allRevealed={show} />
        </div>
      ) : (
        <div className="empty small">先回忆一下，再点"显示内容"对照</div>
      )}
    </div>
  );
}
