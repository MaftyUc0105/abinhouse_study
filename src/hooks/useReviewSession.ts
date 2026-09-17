import { useCallback, useState } from 'react';
import { repo } from '../db/repo';
import type { Rating, Settings } from '../db/types';
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

export function useReviewSession(initial: QueueItem[], settings: Settings) {
  const [state, setState] = useState<SessionState>({
    items: initial,
    index: 0,
    revealed: false,
    counts: { 0: 0, 1: 0, 2: 0, 3: 0 },
    busy: false,
    rated: 0,
  });

  const current = state.items[state.index];
  const finished = state.index >= state.items.length;

  const reveal = useCallback(() => setState((s) => ({ ...s, revealed: true })), []);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || state.busy) return;
      setState((s) => ({ ...s, busy: true }));
      try {
        const next = await repo.applyReview(current.type, current.id, rating);
        setState((s) => {
          const items = s.items.slice();
          // 忘了：当次会话末尾再过一遍（重现那次不再重复入队，也不再写评分）
          if (rating === 0 && settings.forgotSameDay && !current.requeued) {
            items.push({ ...current, ...next, requeued: true });
          }
          return {
            ...s,
            items,
            index: s.index + 1,
            revealed: false,
            busy: false,
            counts: current.requeued ? s.counts : { ...s.counts, [rating]: s.counts[rating] + 1 },
            rated: current.requeued ? s.rated : s.rated + 1,
          };
        });
      } catch (e) {
        setState((s) => ({ ...s, busy: false }));
        throw e;
      }
    },
    [current, state.busy, settings.forgotSameDay],
  );

  /** 重现项只是再看一遍，不写评分 */
  const acknowledge = useCallback(() => {
    setState((s) => ({ ...s, index: s.index + 1, revealed: false }));
  }, []);

  /** 稍后：移到队列末尾 */
  const later = useCallback(() => {
    setState((s) => {
      if (s.index >= s.items.length) return s;
      const items = s.items.slice();
      const [it] = items.splice(s.index, 1);
      items.push(it);
      return { ...s, items, revealed: false };
    });
  }, []);

  /** 跳过：本次会话不再出现 */
  const skip = useCallback(() => {
    setState((s) => {
      if (s.index >= s.items.length) return s;
      const items = s.items.slice();
      items.splice(s.index, 1);
      return { ...s, items, revealed: false };
    });
  }, []);

  return { state, current, finished, reveal, rate, acknowledge, later, skip };
}
