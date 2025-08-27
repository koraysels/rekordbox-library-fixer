import Dexie, { type EntityTable } from 'dexie';

export interface RelocationHistoryEntry {
  id?: number;
  libraryPath: string;
  trackId: string;
  trackName: string;
  trackArtist: string;
  originalLocation: string;
  newLocation: string;
  relocationMethod: 'auto' | 'manual';
  confidence?: number; // For auto relocations
  timestamp: Date;
  xmlUpdated?: boolean; // Whether the Rekordbox XML was updated
  backupCreated?: boolean; // Whether a backup was created
}

class HistoryDatabase extends Dexie {
  relocationHistory!: EntityTable<RelocationHistoryEntry, 'id'>;
  
  constructor() {
    super('RekordboxHistoryDB');
    
    // Define schema
    this.version(1).stores({
      relocationHistory: '++id, libraryPath, timestamp'
    });
  }
}

// Create the database instance
export const historyDb = new HistoryDatabase();

// Helper functions for history operations (following duplicates pattern)
export const historyStorage = {
  async addRelocationEntry(entry: Omit<RelocationHistoryEntry, 'id'>): Promise<void> {
    await historyDb.relocationHistory.add(entry);
  },

  async getRelocationHistory(libraryPath: string, limit = 100): Promise<RelocationHistoryEntry[]> {
    return await historyDb.relocationHistory
      .where('libraryPath')
      .equals(libraryPath)
      .reverse()
      .sortBy('timestamp')
      .then(results => results.slice(0, limit));
  },

  async getRelocationStats(libraryPath: string): Promise<{
    totalRelocations: number;
    autoRelocations: number;
    manualRelocations: number;
    averageConfidence: number;
    recentRelocations: number; // Last 24 hours
  }> {
    const history = await historyDb.relocationHistory
      .where('libraryPath')
      .equals(libraryPath)
      .toArray();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const autoRelocations = history.filter(entry => entry.relocationMethod === 'auto');
    const manualRelocations = history.filter(entry => entry.relocationMethod === 'manual');
    const recentRelocations = history.filter(entry => entry.timestamp > oneDayAgo);

    const averageConfidence = autoRelocations.length > 0
      ? autoRelocations.reduce((sum, entry) => sum + (entry.confidence || 0), 0) / autoRelocations.length
      : 0;

    return {
      totalRelocations: history.length,
      autoRelocations: autoRelocations.length,
      manualRelocations: manualRelocations.length,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      recentRelocations: recentRelocations.length
    };
  },

  async clearRelocationHistory(libraryPath: string): Promise<void> {
    await historyDb.relocationHistory
      .where('libraryPath')
      .equals(libraryPath)
      .delete();
  },

  async clearAllHistory(): Promise<void> {
    await historyDb.relocationHistory.clear();
  }
};