import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import FuzzySearch from 'fuzzy-search';
import { Logger } from './logger';

export interface MissingTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  originalLocation: string;
  size?: number;
  duration?: number;
  dateAdded?: string;
}

export interface RelocationCandidate {
  path: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'metadata' | 'size';
  confidence: number;
}

export interface RelocationOptions {
  searchPaths: string[];
  searchDepth: number;
  matchThreshold: number;
  includeSubdirectories: boolean;
  fileExtensions: string[];
}

export interface RelocationResult {
  trackId: string;
  oldLocation: string;
  newLocation?: string;
  success: boolean;
  candidates?: RelocationCandidate[];
  error?: string;
}

interface FileIndex {
  key: string;
  files: string[];
  fileNames: Array<{ path: string; name: string }>;
  fuzzy: FuzzySearch<{ path: string; name: string }>;
}

/** Is this location too damaged to name a file? */
function isDamagedLocation(location: string): boolean {
  const p = (location ?? '').trim();
  if (!p) { return true; }
  if (p.endsWith('/') || p.endsWith('\\')) { return true; }
  return !/\.[a-z0-9]{2,5}$/i.test(p);
}

/**
 * What to search for. Normally the filename the track used to have; when that
 * location is damaged, the track's title (with artist, when the title alone is
 * very short) taken from the library instead.
 */
export function searchTermFor(track: MissingTrack): string {
  if (!isDamagedLocation(track.originalLocation)) {
    return path.basename(track.originalLocation, path.extname(track.originalLocation));
  }
  const title = (track.name ?? '').trim();
  const artist = (track.artist ?? '').trim();
  if (!title) { return artist; }
  return title.length < 6 && artist ? `${artist} ${title}` : title;
}

export class TrackRelocator {
  private logger: Logger;
  private audioExtensions = ['.mp3', '.m4a', '.wav', '.flac', '.aiff', '.aif', '.ogg'];
  // Cached filesystem index — built once per (searchPaths+extensions+depth) and
  // reused across every track in a run so we don't re-glob the whole tree per track.
  private fileIndex: FileIndex | null = null;

  constructor() {
    this.logger = new Logger();
  }

  /** Key identifying an index: rebuild only when these inputs change. */
  private indexKey(options: RelocationOptions): string {
    return JSON.stringify({
      searchPaths: options.searchPaths,
      fileExtensions: options.fileExtensions,
      includeSubdirectories: options.includeSubdirectories,
      searchDepth: options.searchDepth,
    });
  }

  /**
   * Signal the start of a multi-track relocation run. Optional — a single
   * findRelocationCandidates call builds and reuses its own index too. Calling
   * this primes the index up front so the first track isn't slow.
   */
  async beginRelocationRun(options: RelocationOptions): Promise<void> {
    await this.getFileIndex(options);
  }

  /** Free the cached index so a large library's file list isn't retained. */
  endRelocationRun(): void {
    this.fileIndex = null;
  }

  /** Build (or reuse) the file index for the given options. */
  private async getFileIndex(options: RelocationOptions): Promise<FileIndex> {
    const key = this.indexKey(options);
    if (this.fileIndex && this.fileIndex.key === key) {
      return this.fileIndex;
    }

    const extensions = options.fileExtensions.length > 0
      ? options.fileExtensions
      : this.audioExtensions;

    const files: string[] = [];
    for (const searchPath of options.searchPaths) {
      if (!(await this.fileExists(searchPath))) {
        this.logger.warning('TRACK_RELOCATOR_PATH_NOT_FOUND', { searchPath });
        continue;
      }
      const globPattern = path.join(
        searchPath,
        options.includeSubdirectories ? '**' : '',
        `*.{${extensions.map(ext => ext.replace('.', '')).join(',')}}`
      );
      const found = await glob(globPattern, { maxDepth: options.searchDepth, nocase: true });
      files.push(...found);
    }

    const fileNames = files.map(file => ({
      path: file,
      name: path.basename(file, path.extname(file)),
    }));
    const fuzzy = new FuzzySearch(fileNames, ['name'], { caseSensitive: false, sort: true });

    this.fileIndex = { key, files, fileNames, fuzzy };
    this.logger.info('TRACK_RELOCATOR_INDEX_BUILT', { files: files.length });
    return this.fileIndex;
  }

  async findMissingTracks(tracks: Map<string, any>): Promise<MissingTrack[]> {
    this.logger.info('TRACK_RELOCATOR_SCAN_START', { totalTracks: tracks.size });
    const missingTracks: MissingTrack[] = [];

    for (const [id, track] of tracks.entries()) {
      if (!track.location) {continue;}

      try {
        // Check if file exists at original location
        const exists = await this.fileExists(track.location);
        if (!exists) {
          missingTracks.push({
            id,
            name: track.name || 'Unknown',
            artist: track.artist || 'Unknown Artist',
            album: track.album,
            originalLocation: track.location,
            size: track.size,
            duration: track.duration,
            dateAdded: track.dateAdded
          });
        }
      } catch (error) {
        this.logger.error('TRACK_RELOCATOR_CHECK_FAILED', {
          trackId: id,
          location: track.location,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.logger.info('TRACK_RELOCATOR_SCAN_COMPLETE', {
      missingTracks: missingTracks.length,
      totalTracks: tracks.size
    });

    return missingTracks;
  }

  async findRelocationCandidates(
    track: MissingTrack,
    options: RelocationOptions
  ): Promise<RelocationCandidate[]> {
    const candidates: RelocationCandidate[] = [];
    // A damaged location gives a useless search term: a folder path yields the
    // folder name, a path cut short yields half a name. The track's own title
    // survives in the library, so search on that instead.
    const originalFileName = searchTermFor(track);

    this.logger.info('TRACK_RELOCATOR_SEARCH_START', {
      trackId: track.id,
      trackName: track.name,
      searchPaths: options.searchPaths.length
    });

    try {
      const { files, fileNames, fuzzy } = await this.getFileIndex(options);

      // 1. Exact filename match
      const exactMatch = files.find(file => {
        const fileName = path.basename(file, path.extname(file));
        return fileName.toLowerCase() === originalFileName.toLowerCase();
      });

      if (exactMatch) {
        candidates.push({
          path: exactMatch,
          score: 100,
          matchType: 'exact',
          confidence: 0.95
        });
      }

      // 2. Fuzzy filename matching
      const fuzzyMatches = fuzzy.search(originalFileName);
      for (let i = 0; i < Math.min(5, fuzzyMatches.length); i++) {
        const match = fuzzyMatches[i];
        if (candidates.some(c => c.path === match.path)) {continue;}

        const similarity = this.calculateStringSimilarity(originalFileName, match.name);
        if (similarity >= options.matchThreshold) {
          candidates.push({
            path: match.path,
            score: Math.round(similarity * 100),
            matchType: 'fuzzy',
            confidence: similarity * 0.8
          });
        }
      }

      // 3. Metadata-based matching (artist + title)
      if (track.artist && track.name) {
        const metadataMatches = fileNames.filter(file => {
          const fileName = file.name.toLowerCase();
          return fileName.includes(track.artist.toLowerCase()) &&
                 fileName.includes(track.name.toLowerCase());
        });

        for (const match of metadataMatches.slice(0, 3)) {
          if (candidates.some(c => c.path === match.path)) {continue;}

          candidates.push({
            path: match.path,
            score: 80,
            matchType: 'metadata',
            confidence: 0.7
          });
        }
      }

      // 4. File size matching (if available) — async to avoid blocking the main thread
      if (track.size) {
        const sizeMatches = await Promise.all(
          files.slice(0, 20)
            .filter(file => !candidates.some(c => c.path === file))
            .map(async file => {
              try {
                const stats = await fs.promises.stat(file);
                const sizeDifference = Math.abs(stats.size - track.size!) / track.size!;
                if (sizeDifference <= 0.05) {
                  return {
                    path: file,
                    score: Math.round((1 - sizeDifference) * 100),
                    matchType: 'size' as const,
                    confidence: 0.6
                  };
                }
              } catch {
                // Skip files that can't be accessed
              }
              return null;
            })
        );
        candidates.push(...sizeMatches.filter((m): m is NonNullable<typeof m> => m !== null));
      }
    } catch (error) {
      this.logger.error('TRACK_RELOCATOR_SEARCH_ERROR', {
        trackId: track.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Sort candidates by score (descending) and remove duplicates
    const uniqueCandidates = candidates
      .filter((candidate, index, self) =>
        self.findIndex(c => c.path === candidate.path) === index
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Return top 10 candidates

    this.logger.info('TRACK_RELOCATOR_SEARCH_COMPLETE', {
      trackId: track.id,
      candidatesFound: uniqueCandidates.length
    });

    return uniqueCandidates;
  }

  async relocateTrack(
    trackId: string,
    oldLocation: string,
    newLocation: string
  ): Promise<RelocationResult> {
    try {
      // Verify new location exists
      if (!(await this.fileExists(newLocation))) {
        return {
          trackId,
          oldLocation,
          success: false,
          error: 'New location does not exist'
        };
      }

      // Verify it's an audio file
      const ext = path.extname(newLocation).toLowerCase();
      if (!this.audioExtensions.includes(ext)) {
        return {
          trackId,
          oldLocation,
          success: false,
          error: 'File is not a supported audio format'
        };
      }

      this.logger.info('TRACK_RELOCATOR_RELOCATE_SUCCESS', {
        trackId,
        oldLocation,
        newLocation
      });

      return {
        trackId,
        oldLocation,
        newLocation,
        success: true
      };

    } catch (error) {
      this.logger.error('TRACK_RELOCATOR_RELOCATE_FAILED', {
        trackId,
        oldLocation,
        newLocation,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        trackId,
        oldLocation,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async batchRelocate(
    relocations: { trackId: string; oldLocation: string; newLocation: string }[]
  ): Promise<RelocationResult[]> {
    this.logger.info('TRACK_RELOCATOR_BATCH_START', { count: relocations.length });

    const results: RelocationResult[] = [];
    let successCount = 0;

    for (const relocation of relocations) {
      const result = await this.relocateTrack(
        relocation.trackId,
        relocation.oldLocation,
        relocation.newLocation
      );

      results.push(result);
      if (result.success) {successCount++;}

      // Add small delay to prevent overwhelming the file system
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.logger.info('TRACK_RELOCATOR_BATCH_COMPLETE', {
      total: relocations.length,
      successful: successCount,
      failed: relocations.length - successCount
    });

    return results;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {return 1.0;}

    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {matrix[0][i] = i;}
    for (let j = 0; j <= str2.length; j++) {matrix[j][0] = j;}

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}