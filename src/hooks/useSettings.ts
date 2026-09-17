import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../db/schema';
import { DEFAULT_SETTINGS, ensureSettings } from '../db/seedSettings';
import type { Settings } from '../db/types';

export function useSettings(): Settings {
  useEffect(() => {
    void ensureSettings(db);
  }, []);
  const s = useLiveQuery(() => db.settings.get('default'), []);
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
}
