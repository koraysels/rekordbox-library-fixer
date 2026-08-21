import Dexie, { type EntityTable } from 'dexie';

/** One line of detail inside an operation — what happened to a single item. */
export interface ActivityDetail {
  action: 'merged' | 'trashed' | 'relocated' | 'copied' | 'moved' | 'failed';
  trackName?: string;
  from?: string;
  to?: string;
  error?: string;
}

/** One library-changing operation, with its per-item detail lines. */
export interface ActivityEntry {
  id?: number;
  libraryPath: string;
  timestamp: Date;
  type: 'duplicate-merge' | 'relocation' | 'consolidate' | 'filter-move' | 'xml-save';
  summary: string;
  backupPath?: string;
  details: ActivityDetail[];
}

/** Keep the log useful without letting it grow without bound. */
export const MAX_ENTRIES_PER_LIBRARY = 500;

class DuplicationHistoryDatabase extends Dexie {
  activity!: EntityTable<ActivityEntry, 'id'>;

  constructor() {
    super('RekordboxDuplicationHistoryDB');
    this.version(1).stores({
      activity: '++id, libraryPath, timestamp, type',
    });
  }
}

let db: DuplicationHistoryDatabase | null = null;
function getDb(): DuplicationHistoryDatabase {
  if (!db) { db = new DuplicationHistoryDatabase(); }
  return db;
}

const listeners: ((libraryPath: string) => void)[] = [];

export const duplicationHistoryEvents = {
  onUpdate(callback: (libraryPath: string) => void) {
    listeners.push(callback);
    return () => {
      const i = listeners.indexOf(callback);
      if (i > -1) { listeners.splice(i, 1); }
    };
  },
  notify(libraryPath: string) {
    listeners.forEach((cb) => cb(libraryPath));
  },
};

export const duplicationHistoryStorage = {
  /** Record one operation. Never throws: logging must not break the action. */
  async record(entry: Omit<ActivityEntry, 'id'>): Promise<void> {
    try {
      const database = getDb();
      await database.activity.add(entry as ActivityEntry);
      await this.prune(entry.libraryPath);
      duplicationHistoryEvents.notify(entry.libraryPath);
    } catch (error) {
      console.error('Failed to record activity:', error);
    }
  },

  /** Newest first. */
  async list(libraryPath: string, limit = MAX_ENTRIES_PER_LIBRARY): Promise<ActivityEntry[]> {
    try {
      const entries = await getDb().activity.where('libraryPath').equals(libraryPath).toArray();
      return entries
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to read activity history:', error);
      return [];
    }
  },

  /** Drop the oldest entries beyond MAX_ENTRIES_PER_LIBRARY. */
  async prune(libraryPath: string): Promise<void> {
    try {
      const entries = await getDb().activity.where('libraryPath').equals(libraryPath).toArray();
      if (entries.length <= MAX_ENTRIES_PER_LIBRARY) { return; }
      const excess = entries
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(0, entries.length - MAX_ENTRIES_PER_LIBRARY)
        .map((e) => e.id!)
        .filter((id) => id !== undefined);
      await getDb().activity.bulkDelete(excess);
    } catch (error) {
      console.error('Failed to prune activity history:', error);
    }
  },

  async clear(libraryPath: string): Promise<void> {
    try {
      await getDb().activity.where('libraryPath').equals(libraryPath).delete();
      duplicationHistoryEvents.notify(libraryPath);
    } catch (error) {
      console.error('Failed to clear activity history:', error);
    }
  },
};
