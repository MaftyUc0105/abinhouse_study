/**
 * 本地数据变更通知。repo 写入后调用 markDirty，自动同步监听 onChange。
 * 单独成文件，避免 repo 与同步模块互相引用。
 */
import type { StudyDB } from '../db/schema';

type Listener = () => void;
const listeners = new Set<Listener>();

export const DIRTY_KEY = 'syncDirty';

export async function markDirty(db: StudyDB): Promise<void> {
  try {
    await db.meta.put({ key: DIRTY_KEY, value: true });
  } catch {
    /* meta 表不可用时忽略 */
  }
  for (const l of listeners) l();
}

export function onChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
