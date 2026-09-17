import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/schema';
import { useToday } from './useToday';
import { buildQueue, isNew, type QueueItem } from '../scheduler/queue';
import { useSettings } from './useSettings';

export interface TodayQueue {
  loading: boolean;
  items: QueueItem[];
  total: number;
  overdue: number;
  newCount: number;
  today: string;
}

export function useTodayQueue(): TodayQueue {
  const settings = useSettings();
  const t = useToday();
  const data = useLiveQuery(async () => {
    const notes = await db.notes.where('dueDate').belowOrEqual(t).toArray();
    const cards = await db.cards.where('dueDate').belowOrEqual(t).toArray();
    const missing = [...new Set(cards.map((c) => c.noteId))].filter((id) => !notes.some((n) => n.id === id));
    const extra = (await db.notes.bulkGet(missing)).filter((n): n is NonNullable<typeof n> => !!n);
    return { notes: [...notes, ...extra], cards };
  }, [t]);

  return useMemo(() => {
    if (!data) return { loading: true, items: [], total: 0, overdue: 0, newCount: 0, today: t };
    const items = buildQueue(data.notes, data.cards, t, settings.dailyNewCap);
    return {
      loading: false,
      items,
      total: items.length,
      overdue: items.filter((i) => !isNew(i) && i.dueDate < t).length,
      newCount: items.filter(isNew).length,
      today: t,
    };
  }, [data, settings.dailyNewCap, t]);
}
