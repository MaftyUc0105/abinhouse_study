import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { ImageRecord, ImageSlot, ItemType } from '../db/types';

export function useImages(ownerType: ItemType, ownerId: string | undefined, slot: ImageSlot): ImageRecord[] {
  const imgs = useLiveQuery(
    () =>
      ownerId
        ? db.images
            .where({ ownerType, ownerId })
            .filter((i) => i.slot === slot)
            .sortBy('order')
        : Promise.resolve([] as ImageRecord[]),
    [ownerType, ownerId, slot],
  );
  return imgs ?? [];
}
