import Dexie, { type Table } from 'dexie';
import type { Card, ImageRecord, MetaRecord, Note, ReviewLog, Settings, Subject, Tombstone } from './types';

export class StudyDB extends Dexie {
  notes!: Table<Note, string>;
  cards!: Table<Card, string>;
  images!: Table<ImageRecord, string>;
  reviewLogs!: Table<ReviewLog, number>;
  subjects!: Table<Subject, string>;
  settings!: Table<Settings, string>;
  tombstones!: Table<Tombstone, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = 'abinhouse_study') {
    super(name);
    this.version(1).stores({
      notes: 'id, subject, dueDate, stage, updatedAt, *tags',
      cards: 'id, noteId, dueDate, stage',
      images: 'id, [ownerType+ownerId], ownerId',
      reviewLogs: '++id, [itemType+itemId], date, reviewedAt',
      subjects: 'name',
      settings: 'id',
    });
    this.version(2).stores({
      tombstones: 'key, deletedAt',
      meta: 'key',
    });
  }

  /** 参与同步和备份的数据表（不含 meta） */
  get dataTables() {
    return [this.notes, this.cards, this.images, this.reviewLogs, this.subjects, this.settings, this.tombstones];
  }
}

export const db = new StudyDB();
