import * as fs from 'fs';
import * as path from 'path';
import { Track } from './rekordboxParser';
import { isLossless } from './audioQuality';

export interface ConsolidateOptions {
  destination: string;
  mode: 'copy' | 'move';
  conflictResolution: 'skip' | 'overwrite' | 'quality';
  preferLossless?: boolean;
}

export interface ConsolidateProgress {
  current: number;
  total: number;
  currentFile: string;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface ConsolidateResult {
  succeeded: number;
  skipped: number;
  failed: number;
  errors: { file: string; error: string }[];
  locationUpdates: Record<string, string>; // old path → new path
}

export interface ConsolidatePreview {
  total: number;
  conflicts: number;
  missing: number;
  totalSizeBytes: number;
}

export class LibraryConsolidator {
  private findCommonRoot(locations: string[]): string {
    if (locations.length === 0) return path.sep;
    const parts = locations.map(loc => path.dirname(loc).split(path.sep));
    const first = parts[0];
    const common: string[] = [];
    for (let i = 0; i < first.length; i++) {
      if (parts.every(p => p[i] === first[i])) {
        common.push(first[i]);
      } else break;
    }
    const result = common.join(path.sep);
    return result || path.sep;
  }

  destPath(srcLocation: string, commonRoot: string, destination: string): string {
    const relative = path.relative(commonRoot, srcLocation);
    return path.join(destination, relative);
  }

  // Quick quality score from extension + file size — no async metadata needed.
  private qualityScore(location: string, preferLossless = false): number {
    try {
      const size = fs.statSync(location).size;
      return (preferLossless && isLossless(location) ? 1_000_000 : 0) + size / 1_000_000;
    } catch {
      return 0;
    }
  }

  preview(tracks: Track[], destination: string): ConsolidatePreview {
    const locations = tracks.map(t => t.location).filter(Boolean) as string[];
    const commonRoot = this.findCommonRoot(locations);

    let conflicts = 0;
    let missing = 0;
    let totalSizeBytes = 0;

    for (const track of tracks) {
      if (!track.location) continue;
      if (!fs.existsSync(track.location)) { missing++; continue; }
      if (track.size) totalSizeBytes += track.size;
      const dest = this.destPath(track.location, commonRoot, destination);
      if (fs.existsSync(dest) && path.resolve(track.location) !== path.resolve(dest)) {
        conflicts++;
      }
    }

    return { total: locations.length, conflicts, missing, totalSizeBytes };
  }

  consolidate(
    tracks: Track[],
    options: ConsolidateOptions,
    onProgress: (p: ConsolidateProgress) => void,
    cancelToken: { cancelled: boolean }
  ): ConsolidateResult {
    const locations = tracks.map(t => t.location).filter(Boolean) as string[];
    const commonRoot = this.findCommonRoot(locations);
    const result: ConsolidateResult = {
      succeeded: 0, skipped: 0, failed: 0,
      errors: [], locationUpdates: {},
    };

    const eligible = tracks.filter(t => t.location);
    const total = eligible.length;
    let current = 0;

    for (const track of eligible) {
      if (cancelToken.cancelled) break;

      current++;
      const src = track.location as string;
      const dest = this.destPath(src, commonRoot, options.destination);

      onProgress({
        current, total,
        currentFile: path.basename(src),
        succeeded: result.succeeded,
        skipped: result.skipped,
        failed: result.failed,
      });

      try {
        if (!fs.existsSync(src)) {
          result.skipped++;
          continue;
        }

        // Already at destination
        if (path.resolve(src) === path.resolve(dest)) {
          result.skipped++;
          result.locationUpdates[src] = dest;
          continue;
        }

        if (fs.existsSync(dest)) {
          if (options.conflictResolution === 'skip') {
            result.skipped++;
            result.locationUpdates[src] = dest;
            continue;
          }
          if (options.conflictResolution === 'quality') {
            if (this.qualityScore(dest, options.preferLossless) >= this.qualityScore(src, options.preferLossless)) {
              result.skipped++;
              result.locationUpdates[src] = dest;
              continue;
            }
            // src wins — fall through to overwrite
          }
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });

        if (options.mode === 'copy') {
          fs.copyFileSync(src, dest);
        } else {
          // Try rename first (fast, same volume); fall back to copy+delete
          try {
            fs.renameSync(src, dest);
          } catch {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
          }
        }

        result.succeeded++;
        result.locationUpdates[src] = dest;
      } catch (err) {
        result.failed++;
        result.errors.push({
          file: src,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return result;
  }
}
