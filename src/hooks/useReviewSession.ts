import { useCallback, useRef, useState } from 'react';
import { repo } from '../db/repo';
import type { Rating, Scheduling, Settings } from '../db/types';
import type { QueueItem } from '../scheduler/queue';

export interface SessionItem extends QueueItem {
  /** 忘了 之后当次会话内再出现的一次 */
  requeued?: boolean;
}

export interface SessionState {
  items: SessionItem[];
  index: number;
  revealed: boolean;
  counts: Record<Rating, number>;
  busy: boolean;
  /** 本次会话真正评分的次数（不含 requeued 重现） */
  rated: number;
}

interface HistoryEntry {
  state: SessionState;
  /** 评分操作才有；稍后、跳过、重现确认只回退会话状态 */
  review?: { item: SessionItem; prev: Scheduling; logId: number };
}

export function useReviewSession(initial: QueueItem[], settings: Settings) {
  const [state, setState] = useState<SessionState>({
    items: initial,
    index: 0,
    revealed: false,
    counts: { 0: 0, 1: 0, 2: 0, 3: 0 },
    busy: false,
    rated: 0,
  });
  const history = useRef<HistoryEntry[]>([]);
  const [historyLen, setHistoryLen] = useState(0);

  const push = (entry: HistoryEntry) => {
    history.current.push(entry);
    setHistoryLen(history.current.length);
  };

  const current = state.items[state.index];
  const finished = state.index >= state.items.length;

  const reveal = useCallback(() => setState((s) => ({ ...s, revealed: true })), []);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || state.busy || current.requeued) return;
      const snapshot = { ...state, revealed: true, busy: false };
      setState((s) => ({ ...s, busy: true }));
      try {
        const { next, prev, logId } = await repo.applyReview(current.type, current.id, rating);
        push({ state: snapshot, review: { item: current, prev, logId } });
        setState((s) => {
          const items = s.items.slice();
          // 当次会话末尾再过一遍（只看不评分）
          if (rating === 0 && settings.forgotSameDay) {
            items.push({ ...current, ...next, requeued: true });
          }
          return {
            ...s,
            items,
            index: s.index + 1,
            revealed: false,
            busy: false,
            counts: { ...s.counts, [rating]: s.counts[rating] + 1 },
            rated: s.rated + 1,
          };
        });
      } catch (e) {
        setState((s) => ({ ...s, busy: false }));
        throw e;
      }
    },
    [current, state, settings.forgotSameDay],
  );

  /** 重现项只是再看一遍，不写评分 */
  const acknowledge = useCallback(() => {
    push({ state });
    setState((s) => ({ ...s, index: s.index + 1, revealed: false }));
  }, [state]);

  /** 稍后：移到队列末尾 */
  const later = useCallback(() => {
    if (state.index >= state.items.length) return;
    push({ state });
    setState((s) => {
      const items = s.items.slice();
      const [it] = items.splice(s.index, 1);
      items.push(it);
      return { ...s, items, revealed: false };
    });
  }, [state]);

  /** 跳过：本次会话不再出现 */
  const skip = useCallback(() => {
    if (state.index >= state.items.length) return;
    push({ state });
    setState((s) => {
      const items = s.items.slice();
      items.splice(s.index, 1);
      return { ...s, items, revealed: false };
    });
  }, [state]);

  /** 撤销上一步；若是评分，同时恢复数据库里的调度状态并删除日志 */
  const undo = useCallback(async () => {
    if (state.busy) return;
    const entry = history.current.pop();
    setHistoryLen(history.current.length);
    if (!entry) return;
    if (entry.review) {
      setState((s) => ({ ...s, busy: true }));
      try {
        const { item, prev, logId } = entry.review;
        await repo.undoReview(item.type, item.id, prev, logId);
      } catch (e) {
        history.current.push(entry);
        setHistoryLen(history.current.length);
        setState((s) => ({ ...s, busy: false }));
        throw e;
      }
    }
    setState({ ...entry.state, busy: false });
  }, [state.busy]);

  return { state, current, finished, reveal, rate, acknowledge, later, skip, undo, canUndo: historyLen > 0 };
}
