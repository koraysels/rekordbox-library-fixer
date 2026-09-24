import Dexie, { type EntityTable } from 'dexie';
import type { MissingTrack, RelocationCandidate, RelocationResult, RelocationOptions } from '../types';

export interface StoredRelocationResult {
  id?: number;
  libraryPath: string;
  missingTracks: MissingTrack[];
  relocationCandidates: Map<string, RelocationCandidate[]>; // trackId -> candidates
  relocations: Map<string, string>; // trackId -> newLocation
  relocationResults: RelocationResult[];
  searchOptions: RelocationOptions;
  hasScanCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCloudSyncResult {
  id?: number;
  libraryPath: string;
  issues: any[];
  fixes: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredOwnershipResult {
  id?: number;
  libraryPath: string;
  issues: any[];
  fixes: any[];
  createdAt: Date;
  updatedAt: Date;
}

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

class RelocationsDatabase extends Dexie {
  relocationResults!: EntityTable<StoredRelocationResult, 'id'>;
  // Kept in the schema although nothing writes them any more: dropping a store
  // rewrites every install's database, and these hold nothing but cache.
  cloudSyncResults!: EntityTable<StoredCloudSyncResult, 'id'>;
  ownershipResults!: EntityTable<StoredOwnershipResult, 'id'>;
  relocationHistory!: EntityTable<RelocationHistoryEntry, 'id'>;

  constructor() {
    super('RekordboxRelocationsDB');

    // Define schema
    this.version(1).stores({
      relocationResults: '++id, libraryPath, updatedAt',
      cloudSyncResults: '++id, libraryPath, updatedAt',
      ownershipResults: '++id, libraryPath, updatedAt'
    });

    // Add history table in version 2
    this.version(2).stores({
      relocationResults: '++id, libraryPath, updatedAt',
      cloudSyncResults: '++id, libraryPath, updatedAt',
      ownershipResults: '++id, libraryPath, updatedAt',
      relocationHistory: '++id, libraryPath, trackId, timestamp, [libraryPath+timestamp]'
    });

    // Note: Map serialization is handled in the storage helper functions
  }
}


// Create the database instance
export const relocationsDb = new RelocationsDatabase();

// Database connection helper to ensure database is open and handle errors
async function ensureDatabaseConnection(): Promise<RelocationsDatabase> {
  try {
    // Check if database is already open
    if (relocationsDb.isOpen()) {
      return relocationsDb;
    }

    // If not open, try to open it
    await relocationsDb.open();
    return relocationsDb;
  } catch (error) {
    console.warn('Database connection issue, attempting to reopen:', error);

    // Close and reopen the database
    try {
      await relocationsDb.close();
    } catch (closeError) {
      console.warn('Error closing database:', closeError);
    }

    // Create a new instance if needed
    const newDb = new RelocationsDatabase();
    await newDb.open();
    return newDb;
  }
}

// Helper functions for relocation results
export const relocationStorage = {
  async saveRelocationResult(result: Omit<StoredRelocationResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const db = await ensureDatabaseConnection();
      const now = new Date();

      // Convert Maps to arrays for storage
      const storableResult = {
        ...result,
        relocationCandidates: Array.from(result.relocationCandidates.entries()),
        relocations: Array.from(result.relocations.entries())
      };

      // Check if record exists
      const existing = await db.relocationResults
        .where('libraryPath')
        .equals(result.libraryPath)
        .first();

      const recordToSave = existing
        ? { ...existing, ...storableResult, updatedAt: now }
        : { ...storableResult, createdAt: now, updatedAt: now };

      // Use put for better performance (handles both insert and update)
      await db.relocationResults.put(recordToSave as any);
    } catch (error) {
      console.error('Failed to save relocation result:', error);
      throw error;
    }
  },

  async getRelocationResult(libraryPath: string): Promise<StoredRelocationResult | null> {
    try {
      const db = await ensureDatabaseConnection();
      const result = await db.relocationResults
        .where('libraryPath')
        .equals(libraryPath)
        .first();

      if (result) {
        // Convert arrays back to Maps
        return {
          ...result,
          relocationCandidates: new Map(result.relocationCandidates as any),
          relocations: new Map(result.relocations as any)
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get relocation result:', error);
      return null;
    }
  },

  async deleteRelocationResult(libraryPath: string): Promise<void> {
    const result = await relocationsDb.relocationResults
      .where('libraryPath')
      .equals(libraryPath)
      .first();

    if (result?.id) {
      await relocationsDb.relocationResults.delete(result.id);
    }
  },

  async clearAllRelocationResults(): Promise<void> {
    await relocationsDb.relocationResults.clear();
  },


  // Bulk operations for improved performance
  async bulkSaveRelocationResults(results: Omit<StoredRelocationResult, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const now = new Date();

    // Prepare records for bulk insert/update
    const recordsToSave = await Promise.all(
      results.map(async (result) => {
        // Convert Maps to arrays for storage
        const storableResult = {
          ...result,
          relocationCandidates: Array.from(result.relocationCandidates.entries()),
          relocations: Array.from(result.relocations.entries())
        };

        const existing = await relocationsDb.relocationResults
          .where('libraryPath')
          .equals(result.libraryPath)
          .first();

        return existing
          ? { ...existing, ...storableResult, updatedAt: now }
          : { ...storableResult, createdAt: now, updatedAt: now };
      })
    );

    // Use bulkPut for better performance
    const db = await ensureDatabaseConnection();
    await db.relocationResults.bulkPut(recordsToSave as any);
  },
};

// Helper functions for cloud sync results
// Helper functions for relocation history
export const relocationHistoryStorage = {
  async saveRelocationHistoryEntry(entry: Omit<RelocationHistoryEntry, 'id'>): Promise<void> {
    try {
      const db = await ensureDatabaseConnection();
      await db.relocationHistory.add(entry);
    } catch (error) {
      console.error('Failed to save relocation history entry:', error);
      throw error;
    }
  },

  async getRelocationHistory(libraryPath: string, limit = 100): Promise<RelocationHistoryEntry[]> {
    try {
      const db = await ensureDatabaseConnection();
      return await db.relocationHistory
        .where('[libraryPath+timestamp]')
        .between([libraryPath, Dexie.minKey], [libraryPath, Dexie.maxKey])
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Failed to get relocation history:', error);
      return [];
    }
  },

  async clearRelocationHistory(libraryPath: string): Promise<void> {
    await relocationsDb.relocationHistory
      .where('libraryPath')
      .equals(libraryPath)
      .delete();
  },

  async clearAllRelocationHistory(): Promise<void> {
    await relocationsDb.relocationHistory.clear();
  },

  async getRelocationStats(libraryPath: string): Promise<{
    totalRelocations: number;
    autoRelocations: number;
    manualRelocations: number;
    averageConfidence: number;
    recentRelocations: number; // Last 24 hours
  }> {
    try {
      const db = await ensureDatabaseConnection();
      const history = await db.relocationHistory
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
    } catch (error) {
      console.error('Failed to get relocation stats:', error);
      return {
        totalRelocations: 0,
        autoRelocations: 0,
        manualRelocations: 0,
        averageConfidence: 0,
        recentRelocations: 0
      };
    }
  }
};
