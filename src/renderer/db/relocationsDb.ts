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

class RelocationsDatabase extends Dexie {
  relocationResults!: EntityTable<StoredRelocationResult, 'id'>;
  cloudSyncResults!: EntityTable<StoredCloudSyncResult, 'id'>;
  ownershipResults!: EntityTable<StoredOwnershipResult, 'id'>;
  
  constructor() {
    super('RekordboxRelocationsDB');
    
    // Define schema
    this.version(1).stores({
      relocationResults: '++id, libraryPath, updatedAt',
      cloudSyncResults: '++id, libraryPath, updatedAt',
      ownershipResults: '++id, libraryPath, updatedAt'
    });
    
    // Note: Map serialization is handled in the storage helper functions
  }
}

// Class to handle Map serialization
class StoredRelocationResultClass implements StoredRelocationResult {
  id?: number;
  libraryPath: string = '';
  missingTracks: MissingTrack[] = [];
  relocationCandidates: Map<string, RelocationCandidate[]> = new Map();
  relocations: Map<string, string> = new Map();
  relocationResults: RelocationResult[] = [];
  searchOptions: RelocationOptions = {
    searchPaths: [],
    searchDepth: 3,
    matchThreshold: 0.7,
    includeSubdirectories: true,
    fileExtensions: ['.mp3', '.m4a', '.wav', '.flac', '.aiff', '.aif', '.ogg']
  };
  hasScanCompleted: boolean = false;
  createdAt: Date = new Date();
  updatedAt: Date = new Date();
  
  // Custom serialization for Maps
  toJSON() {
    return {
      ...this,
      relocationCandidates: Array.from(this.relocationCandidates.entries()),
      relocations: Array.from(this.relocations.entries())
    };
  }
  
  static fromJSON(json: any): StoredRelocationResultClass {
    const instance = new StoredRelocationResultClass();
    Object.assign(instance, json);
    instance.relocationCandidates = new Map(json.relocationCandidates || []);
    instance.relocations = new Map(json.relocations || []);
    return instance;
  }
}

// Create the database instance
export const relocationsDb = new RelocationsDatabase();

// Helper functions for relocation results
export const relocationStorage = {
  async saveRelocationResult(result: Omit<StoredRelocationResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    
    // Convert Maps to arrays for storage
    const storableResult = {
      ...result,
      relocationCandidates: Array.from(result.relocationCandidates.entries()),
      relocations: Array.from(result.relocations.entries())
    };
    
    // Check if record exists
    const existing = await relocationsDb.relocationResults
      .where('libraryPath')
      .equals(result.libraryPath)
      .first();
    
    if (existing) {
      // Update existing record
      await relocationsDb.relocationResults.update(existing.id!, {
        ...storableResult,
        updatedAt: now
      });
    } else {
      // Create new record
      await relocationsDb.relocationResults.add({
        ...storableResult,
        createdAt: now,
        updatedAt: now
      });
    }
  },
  
  async getRelocationResult(libraryPath: string): Promise<StoredRelocationResult | null> {
    const result = await relocationsDb.relocationResults
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
  }
};

// Helper functions for cloud sync results
export const cloudSyncStorage = {
  async saveCloudSyncResult(result: Omit<StoredCloudSyncResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    
    // Check if record exists
    const existing = await relocationsDb.cloudSyncResults
      .where('libraryPath')
      .equals(result.libraryPath)
      .first();
    
    if (existing) {
      // Update existing record
      await relocationsDb.cloudSyncResults.update(existing.id!, {
        ...result,
        updatedAt: now
      });
    } else {
      // Create new record
      await relocationsDb.cloudSyncResults.add({
        ...result,
        createdAt: now,
        updatedAt: now
      });
    }
  },
  
  async getCloudSyncResult(libraryPath: string): Promise<StoredCloudSyncResult | null> {
    const result = await relocationsDb.cloudSyncResults
      .where('libraryPath')
      .equals(libraryPath)
      .first();
    
    return result || null;
  },
  
  async deleteCloudSyncResult(libraryPath: string): Promise<void> {
    const result = await relocationsDb.cloudSyncResults
      .where('libraryPath')
      .equals(libraryPath)
      .first();
    
    if (result?.id) {
      await relocationsDb.cloudSyncResults.delete(result.id);
    }
  },
  
  async clearAllCloudSyncResults(): Promise<void> {
    await relocationsDb.cloudSyncResults.clear();
  }
};

// Helper functions for ownership results
export const ownershipStorage = {
  async saveOwnershipResult(result: Omit<StoredOwnershipResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    
    // Check if record exists
    const existing = await relocationsDb.ownershipResults
      .where('libraryPath')
      .equals(result.libraryPath)
      .first();
    
    if (existing) {
      // Update existing record
      await relocationsDb.ownershipResults.update(existing.id!, {
        ...result,
        updatedAt: now
      });
    } else {
      // Create new record
      await relocationsDb.ownershipResults.add({
        ...result,
        createdAt: now,
        updatedAt: now
      });
    }
  },
  
  async getOwnershipResult(libraryPath: string): Promise<StoredOwnershipResult | null> {
    const result = await relocationsDb.ownershipResults
      .where('libraryPath')
      .equals(libraryPath)
      .first();
    
    return result || null;
  },
  
  async deleteOwnershipResult(libraryPath: string): Promise<void> {
    const result = await relocationsDb.ownershipResults
      .where('libraryPath')
      .equals(libraryPath)
      .first();
    
    if (result?.id) {
      await relocationsDb.ownershipResults.delete(result.id);
    }
  },
  
  async clearAllOwnershipResults(): Promise<void> {
    await relocationsDb.ownershipResults.clear();
  }
};