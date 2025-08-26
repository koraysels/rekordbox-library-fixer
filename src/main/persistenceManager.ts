import { db, initializeDatabase, dbUtils } from './database/client';
import { eq } from '@tanstack/db';
import { 
  duplicateResults, 
  trackRelocatorResults, 
  librarySessions,
  type DuplicateResult,
  type DuplicateResultInsert,
  type TrackRelocatorResult,
  type TrackRelocatorResultInsert,
  type LibrarySession,
  type LibrarySessionInsert,
} from './database/schema';

/**
 * Unified persistence manager using TanStack DB
 * 
 * Provides type-safe database operations for all persistent data:
 * - Duplicate detection results
 * - Track relocator data
 * - Library session metadata
 */
export class PersistenceManager {
  
  constructor() {
    initializeDatabase();
    console.log('🗄️ TanStack DB Persistence Manager initialized successfully');
  }

  // === Duplicate Results Operations ===
  
  public saveDuplicateResult(data: {
    libraryPath: string;
    duplicates: any[];
    selectedDuplicates: string[];
    hasScanned: boolean;
    scanOptions: any;
  }): void {
    const now = new Date().toISOString();
    
    // Try to get existing record for created_at preservation
    const existing = db
      .select()
      .from(duplicateResults)
      .where(eq(duplicateResults.libraryPath, data.libraryPath))
      .get();

    const record: DuplicateResultInsert = {
      libraryPath: data.libraryPath,
      duplicates: JSON.stringify(data.duplicates),
      selectedDuplicates: JSON.stringify(data.selectedDuplicates),
      hasScanned: data.hasScanned ? 1 : 0,
      scanOptions: JSON.stringify(data.scanOptions),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    db
      .insert(duplicateResults)
      .values(record)
      .onConflictDoUpdate({
        target: duplicateResults.libraryPath,
        set: {
          duplicates: record.duplicates,
          selectedDuplicates: record.selectedDuplicates,
          hasScanned: record.hasScanned,
          scanOptions: record.scanOptions,
          updatedAt: record.updatedAt,
        },
      })
      .run();
  }

  public getDuplicateResult(libraryPath: string): {
    libraryPath: string;
    duplicates: any[];
    selectedDuplicates: string[];
    hasScanned: boolean;
    scanOptions: any;
    createdAt: string;
    updatedAt: string;
  } | null {
    const result = db
      .select()
      .from(duplicateResults)
      .where(eq(duplicateResults.libraryPath, libraryPath))
      .get();

    if (!result) return null;

    return {
      libraryPath: result.libraryPath,
      duplicates: JSON.parse(result.duplicates),
      selectedDuplicates: JSON.parse(result.selectedDuplicates),
      hasScanned: Boolean(result.hasScanned),
      scanOptions: JSON.parse(result.scanOptions),
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  public deleteDuplicateResult(libraryPath: string): void {
    db
      .delete(duplicateResults)
      .where(eq(duplicateResults.libraryPath, libraryPath))
      .run();
  }

  // === Track Relocator Operations ===

  public saveTrackRelocatorResult(data: {
    libraryPath: string;
    missingTracks?: any[];
    relocationMappings?: Record<string, string>;
    cloudSyncIssues?: any[];
    ownershipIssues?: any[];
    searchOptions?: any;
    hasScannerMissing?: boolean;
    hasScannedCloud?: boolean;
    hasScannedOwnership?: boolean;
  }): void {
    const now = new Date().toISOString();
    
    // Get existing record to merge with new data
    const existing = db
      .select()
      .from(trackRelocatorResults)
      .where(eq(trackRelocatorResults.libraryPath, data.libraryPath))
      .get();

    const record: TrackRelocatorResultInsert = {
      libraryPath: data.libraryPath,
      missingTracks: data.missingTracks ? JSON.stringify(data.missingTracks) : existing?.missingTracks || '[]',
      relocationMappings: data.relocationMappings ? JSON.stringify(data.relocationMappings) : existing?.relocationMappings || '{}',
      cloudSyncIssues: data.cloudSyncIssues ? JSON.stringify(data.cloudSyncIssues) : existing?.cloudSyncIssues || '[]',
      ownershipIssues: data.ownershipIssues ? JSON.stringify(data.ownershipIssues) : existing?.ownershipIssues || '[]',
      searchOptions: data.searchOptions ? JSON.stringify(data.searchOptions) : existing?.searchOptions || '{}',
      hasScannerMissing: data.hasScannerMissing !== undefined ? (data.hasScannerMissing ? 1 : 0) : existing?.hasScannerMissing || 0,
      hasScannedCloud: data.hasScannedCloud !== undefined ? (data.hasScannedCloud ? 1 : 0) : existing?.hasScannedCloud || 0,
      hasScannedOwnership: data.hasScannedOwnership !== undefined ? (data.hasScannedOwnership ? 1 : 0) : existing?.hasScannedOwnership || 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    db
      .insert(trackRelocatorResults)
      .values(record)
      .onConflictDoUpdate({
        target: trackRelocatorResults.libraryPath,
        set: {
          missingTracks: record.missingTracks,
          relocationMappings: record.relocationMappings,
          cloudSyncIssues: record.cloudSyncIssues,
          ownershipIssues: record.ownershipIssues,
          searchOptions: record.searchOptions,
          hasScannerMissing: record.hasScannerMissing,
          hasScannedCloud: record.hasScannedCloud,
          hasScannedOwnership: record.hasScannedOwnership,
          updatedAt: record.updatedAt,
        },
      })
      .run();
  }

  public getTrackRelocatorResult(libraryPath: string): {
    libraryPath: string;
    missingTracks: any[];
    relocationMappings: Record<string, string>;
    cloudSyncIssues: any[];
    ownershipIssues: any[];
    searchOptions: any;
    hasScannerMissing: boolean;
    hasScannedCloud: boolean;
    hasScannedOwnership: boolean;
    createdAt: string;
    updatedAt: string;
  } | null {
    const result = db
      .select()
      .from(trackRelocatorResults)
      .where(eq(trackRelocatorResults.libraryPath, libraryPath))
      .get();

    if (!result) return null;

    return {
      libraryPath: result.libraryPath,
      missingTracks: JSON.parse(result.missingTracks),
      relocationMappings: JSON.parse(result.relocationMappings),
      cloudSyncIssues: JSON.parse(result.cloudSyncIssues),
      ownershipIssues: JSON.parse(result.ownershipIssues),
      searchOptions: JSON.parse(result.searchOptions),
      hasScannerMissing: Boolean(result.hasScannerMissing),
      hasScannedCloud: Boolean(result.hasScannedCloud),
      hasScannedOwnership: Boolean(result.hasScannedOwnership),
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  public deleteTrackRelocatorResult(libraryPath: string): void {
    db
      .delete(trackRelocatorResults)
      .where(eq(trackRelocatorResults.libraryPath, libraryPath))
      .run();
  }

  // === Library Session Management ===
  
  public recordLibraryAccess(libraryPath: string, libraryName?: string, trackCount?: number, playlistCount?: number): void {
    const now = new Date().toISOString();
    
    // Get existing record for merging access count
    const existing = db
      .select()
      .from(librarySessions)
      .where(eq(librarySessions.libraryPath, libraryPath))
      .get();

    const record: LibrarySessionInsert = {
      libraryPath,
      libraryName: libraryName || existing?.libraryName || null,
      trackCount: trackCount || existing?.trackCount || 0,
      playlistCount: playlistCount || existing?.playlistCount || 0,
      lastAccessed: now,
      accessCount: existing ? (existing.accessCount || 0) + 1 : 1,
    };

    db
      .insert(librarySessions)
      .values(record)
      .onConflictDoUpdate({
        target: librarySessions.libraryPath,
        set: {
          libraryName: record.libraryName,
          trackCount: record.trackCount,
          playlistCount: record.playlistCount,
          lastAccessed: record.lastAccessed,
          accessCount: record.accessCount,
        },
      })
      .run();
  }

  public getRecentLibraries(limit: number = 10): LibrarySession[] {
    return db
      .select()
      .from(librarySessions)
      .orderBy((session) => session.lastAccessed)
      .limit(limit)
      .all();
  }

  // === Database Utilities ===
  
  public vacuum(): void {
    dbUtils.vacuum();
  }

  public getStats() {
    return dbUtils.getStats();
  }

  public close(): void {
    dbUtils.close();
  }
}