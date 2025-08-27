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
    
    console.log('🗄️ RekordboxHistoryDB initialized');
  }
}

// Lazy database instance creation
let historyDb: HistoryDatabase | null = null;

function getHistoryDb(): HistoryDatabase {
  if (!historyDb) {
    console.log('🗄️ Creating HistoryDatabase instance...');
    historyDb = new HistoryDatabase();
  }
  return historyDb;
}

// Simple event emitter for history updates
const historyEventListeners: ((libraryPath: string) => void)[] = [];

export const historyEvents = {
  onHistoryUpdate: (callback: (libraryPath: string) => void) => {
    historyEventListeners.push(callback);
    return () => {
      const index = historyEventListeners.indexOf(callback);
      if (index > -1) {
        historyEventListeners.splice(index, 1);
      }
    };
  },
  
  notifyHistoryUpdate: (libraryPath: string) => {
    historyEventListeners.forEach(callback => callback(libraryPath));
  }
};

// Helper functions for history operations (following duplicates pattern)
export const historyStorage = {
  async addRelocationEntry(entry: Omit<RelocationHistoryEntry, 'id'>): Promise<void> {
    console.log('📝 Adding history entry for:', entry.trackName, 'from library:', entry.libraryPath);
    try {
      const db = getHistoryDb();
      const result = await db.relocationHistory.add(entry);
      console.log('✅ History entry added with ID:', result);
      
      // Notify listeners that history was updated
      historyEvents.notifyHistoryUpdate(entry.libraryPath);
    } catch (error) {
      console.error('❌ Failed to add history entry:', error);
      throw error;
    }
  },

  async getRelocationHistory(libraryPath: string, limit = 100): Promise<RelocationHistoryEntry[]> {
    console.log(`🔍 Getting history for library: ${libraryPath}`);
    try {
      const db = getHistoryDb();
      const results = await db.relocationHistory
        .where('libraryPath')
        .equals(libraryPath)
        .reverse()
        .sortBy('timestamp')
        .then(results => results.slice(0, limit));
      console.log(`📋 Found ${results.length} history entries`);
      return results;
    } catch (error) {
      console.error('❌ Failed to get history:', error);
      return [];
    }
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