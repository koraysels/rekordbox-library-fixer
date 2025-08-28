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

export class TrackRelocator {
  private logger: Logger;
  private audioExtensions = ['.mp3', '.m4a', '.wav', '.flac', '.aiff', '.aif', '.ogg'];

  constructor() {
    this.logger = new Logger();
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
    const originalFileName = path.basename(track.originalLocation, path.extname(track.originalLocation));

    this.logger.info('TRACK_RELOCATOR_SEARCH_START', {
      trackId: track.id,
      trackName: track.name,
      searchPaths: options.searchPaths.length
    });

    for (const searchPath of options.searchPaths) {
      try {
        if (!(await this.fileExists(searchPath))) {
          this.logger.warning('TRACK_RELOCATOR_PATH_NOT_FOUND', { searchPath });
          continue;
        }

        // Build glob pattern for audio files
        const extensions = options.fileExtensions.length > 0
          ? options.fileExtensions
          : this.audioExtensions;

        const globPattern = path.join(
          searchPath,
          options.includeSubdirectories ? '**' : '',
          `*.{${extensions.map(ext => ext.replace('.', '')).join(',')}}`
        );

        const files = await glob(globPattern, {
          maxDepth: options.searchDepth,
          nocase: true
        });

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
        const fileNames = files.map(file => ({
          path: file,
          name: path.basename(file, path.extname(file))
        }));

        const fuzzySearcher = new FuzzySearch(fileNames, ['name'], {
          caseSensitive: false,
          sort: true
        });

        const fuzzyMatches = fuzzySearcher.search(originalFileName);
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

        // 4. File size matching (if available)
        if (track.size) {
          for (const file of files.slice(0, 20)) { // Limit to avoid performance issues
            if (candidates.some(c => c.path === file)) {continue;}

            try {
              const stats = fs.statSync(file);
              const sizeDifference = Math.abs(stats.size - track.size) / track.size;

              if (sizeDifference <= 0.05) { // Within 5% size difference
                candidates.push({
                  path: file,
                  score: Math.round((1 - sizeDifference) * 100),
                  matchType: 'size',
                  confidence: 0.6
                });
              }
            } catch {
              // Skip files that can't be accessed
            }
          }
        }

      } catch (error) {
        this.logger.error('TRACK_RELOCATOR_SEARCH_ERROR', {
          searchPath,
          trackId: track.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
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