import { useEffect } from 'react';
import { repo } from '../db/repo';
import { useToday } from './useToday';

/** 跨过零点或重新打开应用时，把昨天及更早没结算的目标结算掉 */
export function useSettleGoals() {
  const today = useToday();
  useEffect(() => {
    void repo.settleDueGoals(today).catch(() => {});
  }, [today]);
}
