import { createTable, column, primaryKey } from '@tanstack/db';

/**
 * TanStack DB Schema Definition for Rekordbox Library Manager
 * 
 * This defines type-safe database schemas for all persistent data:
 * - Duplicate detection results  
 * - Track relocator results
 * - Library session metadata
 */

// Duplicate detection results table
export const duplicateResults = createTable({
  name: 'duplicate_results',
  columns: {
    libraryPath: column.text('library_path').primaryKey(),
    duplicates: column.text('duplicates').notNull(),
    selectedDuplicates: column.text('selected_duplicates').notNull(),
    hasScanned: column.integer('has_scanned').notNull().default(0),
    scanOptions: column.text('scan_options').notNull(),
    createdAt: column.text('created_at').notNull(),
    updatedAt: column.text('updated_at').notNull(),
  },
});

// Track relocator results table  
export const trackRelocatorResults = createTable({
  name: 'track_relocator_results',
  columns: {
    libraryPath: column.text('library_path').primaryKey(),
    missingTracks: column.text('missing_tracks').notNull().default('[]'),
    relocationMappings: column.text('relocation_mappings').notNull().default('{}'),
    cloudSyncIssues: column.text('cloud_sync_issues').notNull().default('[]'),
    ownershipIssues: column.text('ownership_issues').notNull().default('[]'),
    searchOptions: column.text('search_options').notNull().default('{}'),
    hasScannerMissing: column.integer('has_scanned_missing').notNull().default(0),
    hasScannedCloud: column.integer('has_scanned_cloud').notNull().default(0),
    hasScannedOwnership: column.integer('has_scanned_ownership').notNull().default(0),
    createdAt: column.text('created_at').notNull(),
    updatedAt: column.text('updated_at').notNull(),
  },
});

// Library session metadata table
export const librarySessions = createTable({
  name: 'library_sessions',
  columns: {
    libraryPath: column.text('library_path').primaryKey(),
    libraryName: column.text('library_name'),
    trackCount: column.integer('track_count').default(0),
    playlistCount: column.integer('playlist_count').default(0),
    lastAccessed: column.text('last_accessed').notNull(),
    accessCount: column.integer('access_count').default(1),
  },
});

// Export schema for database initialization
export const schema = {
  duplicateResults,
  trackRelocatorResults,
  librarySessions,
};

// TypeScript types derived from schema
export type DuplicateResult = typeof duplicateResults.$inferSelect;
export type DuplicateResultInsert = typeof duplicateResults.$inferInsert;

export type TrackRelocatorResult = typeof trackRelocatorResults.$inferSelect;
export type TrackRelocatorResultInsert = typeof trackRelocatorResults.$inferInsert;

export type LibrarySession = typeof librarySessions.$inferSelect;
export type LibrarySessionInsert = typeof librarySessions.$inferInsert;