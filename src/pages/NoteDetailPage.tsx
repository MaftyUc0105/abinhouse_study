import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IntensityBadge, StageDots, SubjectChip } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ImageGrid } from '../components/ImageGrid';
import { MarkdownView } from '../components/MarkdownView';
import { useToast } from '../components/Toast';
import { repo } from '../db/repo';
import { db } from '../db/schema';
import { RATING_LABEL, type Card, type ItemType, type ReviewLog } from '../db/types';
import { useImages } from '../hooks/useImages';
import { useSettings } from '../hooks/useSettings';
import { describeDue, today } from '../scheduler/dates';

type Confirm =
  | { kind: 'deleteNote' }
  | { kind: 'deleteCard'; id: string }
  | { kind: 'reset'; type: ItemType; id: string }
  | null;

export function NoteDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const t = today();
  const note = useLiveQuery(() => db.notes.get(id), [id]);
  const cards = useLiveQuery(() => db.cards.where('noteId').equals(id).sortBy('order'), [id]) ?? [];
  const images = useImages('note', id, 'body');
  const logs =
    useLiveQuery(async () => {
      const cardIds = await db.cards.where('noteId').equals(id).primaryKeys();
      const keys: [ItemType, string][] = [['note', id], ...cardIds.map((c) => ['card', c] as [ItemType, string])];
      const arr = await db.reviewLogs.where('[itemType+itemId]').anyOf(keys).toArray();
      return arr.sort((a, b) => b.reviewedAt - a.reviewedAt);
    }, [id]) ?? [];
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [showLogs, setShowLogs] = useState(false);

  if (note === undefined) return <div className="page empty">加载中…</div>;
  if (!note) return <div className="page empty">笔记不存在</div>;

  const cardMap = new Map(cards.map((c) => [c.id, c]));

  async function doConfirm() {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    try {
      if (c.kind === 'deleteNote') {
        await repo.deleteNote(id);
        toast('已删除');
        nav('/library', { replace: true });
      } else if (c.kind === 'deleteCard') {
        await repo.deleteCard(c.id);
        toast('已删除卡片');
      } else {
        await repo.resetScheduling(c.type, c.id);
        toast('已重置为新条目，明天开始复习');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>
          ‹ 返回
        </button>
        <div className="row">
          <Link className="btn btn-sm" to={`/edit/note/${id}`}>
            编辑
          </Link>
          <Link className="btn btn-sm" to={`/notes/${id}/split`}>
            拆分卡片
          </Link>
        </div>
      </div>

      <h1>{note.title || '（无标题）'}</h1>
      <div className="row mb-8">
        <SubjectChip name={note.subject} />
        <IntensityBadge recentRatings={note.recentRatings} />
        {note.tags.map((tg) => (
          <span key={tg} className="chip">
            #{tg}
          </span>
        ))}
      </div>
      <div className="card">
        <div className="row-between">
          <div className="small">
            <StageDots stage={note.stage} total={settings.ladder.length} /> 第 {note.stage} 档
          </div>
          <div className="small">
            {note.suspended ? (
              <span className="badge badge-normal">已暂停</span>
            ) : (
              <>
                下次：<b>{describeDue(note.dueDate, t)}</b>
              </>
            )}
          </div>
        </div>
        <div className="tiny mt-8">
          复习 {note.reviewCount} 次 · 忘了 {note.lapseCount} 次 · 上次间隔 {note.lastInterval} 天
        </div>
        <div className="row mt-8">
          <button className="btn btn-sm" onClick={() => repo.setSuspended('note', id, !note.suspended)}>
            {note.suspended ? '恢复复习' : '暂停复习'}
          </button>
          <button className="btn btn-sm" onClick={() => setConfirm({ kind: 'reset', type: 'note', id })}>
            重置进度
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => setConfirm({ kind: 'deleteNote' })}>
            删除
          </button>
        </div>
      </div>

      <div className="section-title">内容</div>
      <div className="card stack">
        {note.body ? <MarkdownView markdown={note.body} /> : images.length === 0 && <span className="muted">（无文字内容）</span>}
        <ImageGrid images={images} />
      </div>

      <div className="section-title">
        问答卡片（{cards.length}）
        {cards.length === 0 && (
          <>
            {' '}
            · <Link to={`/notes/${id}/split`}>去拆分</Link>
          </>
        )}
      </div>
      <div className="list">
        {cards.map((c) => (
          <CardRow key={c.id} card={c} today={t} ladder={settings.ladder.length} onDelete={() => setConfirm({ kind: 'deleteCard', id: c.id })} onReset={() => setConfirm({ kind: 'reset', type: 'card', id: c.id })} />
        ))}
      </div>

      <div className="section-title">
        复习记录（{logs.length}）
        {logs.length > 0 && (
          <>
            {' '}
            ·{' '}
            <a href="#" onClick={(e) => (e.preventDefault(), setShowLogs((v) => !v))}>
              {showLogs ? '收起' : '展开'}
            </a>
          </>
        )}
      </div>
      {showLogs && logs.length > 0 && (
        <div className="card timeline">
          {logs.map((l) => (
            <LogRow key={l.id} log={l} card={l.itemType === 'card' ? cardMap.get(l.itemId) : undefined} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'deleteNote' ? '删除这条笔记？' : confirm?.kind === 'deleteCard' ? '删除这张卡片？' : '重置复习进度？'
        }
        message={
          confirm?.kind === 'deleteNote'
            ? '会同时删除它的卡片、照片和复习记录，不可恢复。'
            : confirm?.kind === 'deleteCard'
              ? '会同时删除它的照片和复习记录，不可恢复。'
              : '回到第 0 档，明天重新开始，历史记录保留。'
        }
        confirmText={confirm?.kind === 'reset' ? '重置' : '删除'}
        danger={confirm?.kind !== 'reset'}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function CardRow({
  card,
  today: t,
  ladder,
  onDelete,
  onReset,
}: {
  card: Card;
  today: string;
  ladder: number;
  onDelete: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const qImages = useImages('card', card.id, 'question');
  const aImages = useImages('card', card.id, 'answer');
  return (
    <div className="card">
      <div className="row-between" onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer' }}>
        <div className="grow" style={{ whiteSpace: 'pre-wrap' }}>
          {card.question || '（无问题）'}
        </div>
        <span className="tiny">{open ? '▲' : '▼'}</span>
      </div>
      <div className="row mt-8">
        <StageDots stage={card.stage} total={ladder} />
        <IntensityBadge recentRatings={card.recentRatings} />
        <span className="tiny">
          {card.suspended ? '已暂停' : `${card.reviewCount === 0 ? '新 · ' : ''}${describeDue(card.dueDate, t)}`} · 复习 {card.reviewCount} 次
        </span>
        {qImages.length > 0 && <span className="tiny">📷 {qImages.length}</span>}
      </div>
      {open && (
        <div className="stack mt-8">
          {qImages.length > 0 && <ImageGrid images={qImages} mode="grid" />}
          <div className="small muted">答案：</div>
          {card.answer ? <MarkdownView markdown={card.answer} className="small" /> : aImages.length === 0 && <span className="tiny">（空）</span>}
          <ImageGrid images={aImages} mode="grid" />
          <div className="row">
            <Link className="btn btn-sm" to={`/edit/card/${card.id}`}>
              编辑
            </Link>
            <button className="btn btn-sm" onClick={() => repo.setSuspended('card', card.id, !card.suspended)}>
              {card.suspended ? '恢复' : '暂停'}
            </button>
            <button className="btn btn-sm" onClick={onReset}>
              重置
            </button>
            <button className="btn btn-sm btn-danger" onClick={onDelete}>
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ log, card }: { log: ReviewLog; card?: Card }) {
  return (
    <div className="timeline-item">
      <span className="tiny">{log.date}</span>
      <span className={`rating-label rating-label-${log.rating}`}>{RATING_LABEL[log.rating]}</span>
      <span className="tiny ellipsis">
        {log.itemType === 'card' ? `卡片「${(card?.question ?? '已删除').slice(0, 12)}」· ` : ''}
        第 {log.stageBefore}→{log.stageAfter} 档 · 间隔 {log.intervalDays} 天
      </span>
    </div>
  );
}
