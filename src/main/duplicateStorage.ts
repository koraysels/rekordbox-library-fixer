import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

export interface StoredDuplicateResult {
  libraryPath: string;
  duplicates: any[];
  selectedDuplicates: string[];
  hasScanned: boolean;
  scanOptions: any;
  createdAt: string;
  updatedAt: string;
}

export class DuplicateStorage {
  private db: Database.Database;
  private userDataPath: string;
  private ownsDatabase: boolean;

  constructor(database?: Database.Database) {
    if (database) {
      // Use provided database instance (from PersistenceManager)
      this.db = database;
      this.ownsDatabase = false;
      this.userDataPath = app.getPath('userData');
    } else {
      // Create own database instance (legacy compatibility)
      this.userDataPath = app.getPath('userData');
      const dbPath = path.join(this.userDataPath, 'duplicates.sqlite');

      console.log(`📁 SQLite database location: ${dbPath}`);
      this.db = new Database(dbPath);
      this.ownsDatabase = true;
    }
    
    this.initializeDatabase();
    if (this.ownsDatabase) {
      console.log('🗄️ SQLite database initialized successfully');
    }
  }

  private initializeDatabase() {
    // Create duplicates table with library_path as primary key for isolation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS duplicate_results (
        library_path TEXT PRIMARY KEY,
        duplicates TEXT NOT NULL,
        selected_duplicates TEXT NOT NULL,
        has_scanned INTEGER NOT NULL DEFAULT 0,
        scan_options TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_library_path_updated ON duplicate_results(library_path, updated_at);
    `);
  }

  public saveDuplicateResult(result: Omit<StoredDuplicateResult, 'createdAt' | 'updatedAt'>): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO duplicate_results 
      (library_path, duplicates, selected_duplicates, has_scanned, scan_options, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM duplicate_results WHERE library_path = ?), ?), ?)
    `);

    stmt.run(
      result.libraryPath,
      JSON.stringify(result.duplicates),
      JSON.stringify(result.selectedDuplicates),
      result.hasScanned ? 1 : 0,
      JSON.stringify(result.scanOptions),
      result.libraryPath, // for COALESCE to get existing created_at
      now, // created_at if new record
      now  // updated_at always new
    );
  }

  public getDuplicateResult(libraryPath: string): StoredDuplicateResult | null {
    const stmt = this.db.prepare(`
      SELECT * FROM duplicate_results 
      WHERE library_path = ?
    `);

    const row = stmt.get(libraryPath) as any;

    if (!row) {
      return null;
    }

    return {
      libraryPath: row.library_path,
      duplicates: JSON.parse(row.duplicates),
      selectedDuplicates: JSON.parse(row.selected_duplicates),
      hasScanned: Boolean(row.has_scanned),
      scanOptions: JSON.parse(row.scan_options),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public deleteDuplicateResult(libraryPath: string): void {
    const stmt = this.db.prepare('DELETE FROM duplicate_results WHERE library_path = ?');
    stmt.run(libraryPath);
  }

  public clearAllResults(): void {
    this.db.exec('DELETE FROM duplicate_results');
  }

  public getAllLibraryPaths(): string[] {
    const stmt = this.db.prepare('SELECT library_path FROM duplicate_results ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => row.library_path);
  }

  public getResultsCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM duplicate_results');
    const row = stmt.get() as any;
    return row.count;
  }

  public close(): void {
    this.db.close();
  }
}
