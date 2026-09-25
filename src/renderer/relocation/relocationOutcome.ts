import type { LibraryData, MissingTrack, RelocationResult } from '../types';
import { duplicationHistoryStorage } from '../db/duplicationHistoryDb';
import { historyStorage, historyEvents } from '../db/historyDb';

/** What a relocation run reported back, whichever way it was started. */
export interface RelocationRun {
  libraryPath: string;
  /** Auto-relocation also reports a confidence and the name it matched on. */
  results: Array<RelocationResult & { confidence?: number; trackName?: string }>;
  tracksUpdated?: number;
  backupPath?: string;
  method: 'manual' | 'auto';
}

const isDatabase = (libraryPath: string) => /\.db$/i.test(libraryPath);

/**
 * Say which library changed and how to see it.
 *
 * "XML updated" was wrong for a database-backed collection, which is written
 * directly — and a DJ who is told the XML changed goes looking in the wrong
 * place for the fix they just made.
 */
export function describeRelocationWrite(run: {
  libraryPath: string;
  tracksUpdated?: number;
  backupPath?: string;
}): string {
  if (!run.tracksUpdated) { return ''; }
  const database = isDatabase(run.libraryPath);
  const backup = run.backupPath?.split('/').pop();
  return `\n${database ? 'Written into the rekordbox database' : 'XML updated'}`
    + ` for ${run.tracksUpdated} track${run.tracksUpdated > 1 ? 's' : ''}.`
    + (backup ? `\nBacked up first: ${backup}` : '')
    + (database ? '\nReopen rekordbox to see it.' : '');
}

/**
 * The library held in memory, with the tracks that were found again pointing at
 * their new files. Returns the same object when nothing moved, so a caller can
 * skip a re-render.
 */
export function withRelocatedTracks(
  libraryData: LibraryData | null,
  results: RelocationResult[]
): LibraryData | null {
  if (!libraryData) { return libraryData; }
  const moved = results.filter((r) => r.success && r.newLocation);
  if (moved.length === 0) { return libraryData; }

  const tracks = new Map(libraryData.tracks);
  for (const result of moved) {
    const track = tracks.get(result.trackId);
    if (track) { tracks.set(result.trackId, { ...track, location: result.newLocation }); }
  }
  return { ...libraryData, tracks };
}

/**
 * Record a run in both histories: the activity history the History tab reads,
 * and the per-track relocation history. Failures here are logged and swallowed
 * — losing the record of a change is bad, but failing the change that already
 * happened on disk is worse.
 */
export async function recordRelocationRun(
  run: RelocationRun,
  missingTracks: MissingTrack[]
): Promise<void> {
  const succeeded = run.results.filter((r) => r.success);

  void duplicationHistoryStorage.record({
    libraryPath: run.libraryPath,
    timestamp: new Date(),
    type: 'relocation',
    summary: `Relocated ${succeeded.length} of ${run.results.length} track${run.results.length !== 1 ? 's' : ''}`,
    backupPath: run.backupPath,
    details: run.results.map((r) => ({
      action: r.success ? ('relocated' as const) : ('failed' as const),
      from: r.oldLocation,
      to: r.newLocation,
      error: r.error,
    })),
  });

  if (!run.libraryPath || succeeded.length === 0) { return; }

  try {
    for (const result of succeeded) {
      const track = missingTracks.find((t) => t.id === result.trackId);
      if (!track) { continue; }
      await historyStorage.addRelocationEntry({
        libraryPath: run.libraryPath,
        trackId: result.trackId,
        trackName: result.trackName || track.name,
        trackArtist: track.artist,
        confidence: result.confidence,
        originalLocation: result.oldLocation,
        newLocation: result.newLocation ?? '',
        relocationMethod: run.method,
        timestamp: new Date(),
        xmlUpdated: !!run.tracksUpdated,
        backupCreated: !!run.backupPath,
      });
    }
    historyEvents.notifyHistoryUpdate(run.libraryPath);
  } catch (error) {
    console.error('❌ Failed to save relocation history:', error);
  }
}
