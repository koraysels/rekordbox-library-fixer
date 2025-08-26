import { createDatabase } from '@tanstack/db';
import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import { schema } from './schema';

/**
 * TanStack DB Client Setup
 * 
 * Creates a type-safe database client with proper configuration
 * for Rekordbox Library Manager persistence needs.
 */

// Create SQLite database instance
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'rekordbox-library-manager.sqlite');

console.log(`📁 TanStack DB location: ${dbPath}`);

const sqlite = new Database(dbPath);

// Configure SQLite for optimal performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('cache_size = 1000');
sqlite.pragma('temp_store = memory');

// Create TanStack DB client
export const db = createDatabase({
  connection: sqlite,
  schema,
});

/**
 * Initialize database tables and indexes
 */
export function initializeDatabase(): void {
  console.log('🔄 Initializing TanStack DB tables...');
  
  // TanStack DB will automatically create tables based on schema
  // We just need to ensure indexes are created for performance
  
  sqlite.exec(`
    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_duplicate_results_updated 
    ON duplicate_results(updated_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_track_relocator_updated 
    ON track_relocator_results(updated_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_library_sessions_accessed 
    ON library_sessions(last_accessed DESC);
  `);
  
  console.log('✅ TanStack DB initialized successfully');
}

/**
 * Database utility functions
 */
export const dbUtils = {
  vacuum: () => {
    console.log('🧹 Running database vacuum...');
    sqlite.exec('VACUUM');
    console.log('✅ Database vacuum completed');
  },

  getStats: () => {
    const stats = sqlite.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM duplicate_results) as duplicate_results_count,
        (SELECT COUNT(*) FROM track_relocator_results) as track_relocator_results_count,
        (SELECT COUNT(*) FROM library_sessions) as library_sessions_count
    `).get() as any;

    // Get database file size
    const fs = require('fs');
    let sizeKB = 0;
    try {
      const stats_fs = fs.statSync(dbPath);
      sizeKB = Math.round(stats_fs.size / 1024);
    } catch (error) {
      console.warn('Could not get database size:', error);
    }

    return {
      duplicateResultsCount: stats.duplicate_results_count || 0,
      trackRelocatorResultsCount: stats.track_relocator_results_count || 0,
      librarySessionsCount: stats.library_sessions_count || 0,
      databaseSizeKB: sizeKB,
    };
  },

  close: () => {
    console.log('🔒 Closing TanStack DB connection');
    sqlite.close();
  },
};