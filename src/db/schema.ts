import Dexie, { type Table } from 'dexie';
import type { Card, ImageRecord, Note, ReviewLog, Settings, Subject } from './types';

export class StudyDB extends Dexie {
  notes!: Table<Note, string>;
  cards!: Table<Card, string>;
  images!: Table<ImageRecord, string>;
  reviewLogs!: Table<ReviewLog, number>;
  subjects!: Table<Subject, string>;
  settings!: Table<Settings, string>;

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
  }
}

export const db = new StudyDB();
