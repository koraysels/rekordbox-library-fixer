import Dexie, { type EntityTable } from 'dexie';

export interface StoredDuplicateResult {
  id?: number;
  libraryPath: string;
  duplicates: any[];
  selectedDuplicates: string[];
  hasScanned: boolean;
  scanOptions: any;
  createdAt: Date;
  updatedAt: Date;
}

class DuplicatesDatabase extends Dexie {
  duplicateResults!: EntityTable<StoredDuplicateResult, 'id'>;

  constructor() {
    super('RekordboxDuplicatesDB');

    // Define schema
    this.version(1).stores({
      duplicateResults: '++id, libraryPath, updatedAt'
    });
  }
}

// Create the database instance
export const db = new DuplicatesDatabase();

// Helper functions for database operations
export const duplicateStorage = {
  async saveDuplicateResult(result: Omit<StoredDuplicateResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();

    // Check if record exists
    const existing = await db.duplicateResults
      .where('libraryPath')
      .equals(result.libraryPath)
      .first();

    const recordToSave = existing
      ? { ...existing, ...result, updatedAt: now }
      : { ...result, createdAt: now, updatedAt: now };

    // Use put for better performance (handles both insert and update)
    await db.duplicateResults.put(recordToSave);
  },

  async getDuplicateResult(libraryPath: string): Promise<StoredDuplicateResult | null> {
    const result = await db.duplicateResults
      .where('libraryPath')
      .equals(libraryPath)
      .first();

    return result || null;
  },

  async deleteDuplicateResult(libraryPath: string): Promise<void> {
    const result = await db.duplicateResults
      .where('libraryPath')
      .equals(libraryPath)
      .first();

    if (result?.id) {
      await db.duplicateResults.delete(result.id);
    }
  },

  async clearAllResults(): Promise<void> {
    await db.duplicateResults.clear();
  },

  async getAllLibraryPaths(): Promise<string[]> {
    const results = await db.duplicateResults
      .orderBy('updatedAt')
      .reverse()
      .toArray();

    return results.map(r => r.libraryPath);
  },

  async getResultsCount(): Promise<number> {
    return await db.duplicateResults.count();
  },


  // Bulk operations for improved performance
  async bulkSaveDuplicateResults(results: Omit<StoredDuplicateResult, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const now = new Date();

    // Prepare records for bulk insert/update
    const recordsToSave = await Promise.all(
      results.map(async (result) => {
        const existing = await db.duplicateResults
          .where('libraryPath')
          .equals(result.libraryPath)
          .first();

        return existing
          ? { ...existing, ...result, updatedAt: now }
          : { ...result, createdAt: now, updatedAt: now };
      })
    );

    // Use bulkPut for better performance
    await db.duplicateResults.bulkPut(recordsToSave);
  },
};