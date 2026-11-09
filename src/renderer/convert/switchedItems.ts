import type { LibraryData } from '../types';
import type { ConvertPreviewItem, ConvertRunResult } from '../../main/ipcContract';

/** Which of the planned items a run actually switched, and what they became. */
export function switchedItems(items: ConvertPreviewItem[], result: ConvertRunResult): ConvertPreviewItem[] {
  // A failed library write changes nothing, whatever was converted on the way.
  if (result.error) { return []; }
  const failed = new Set(result.failed.map((f) => f.from));
  const conflicts = new Set(result.conflicts);
  const skipped = new Set((result.skipped ?? []).map((s) => s.trackId));
  const outcome: ConvertPreviewItem[] = [];
  for (const item of items) {
    if (item.readiness === 'conflict' || failed.has(item.from) || conflicts.has(item.from)) { continue; }
    const trackIds = item.trackIds.filter((id) => !skipped.has(id));
    if (trackIds.length > 0) { outcome.push({ ...item, trackIds }); }
  }
  return outcome;
}

const FILE_TYPE: Record<string, number> = { aiff: 12, wav: 11, mp3: 1 };
const KIND: Record<string, string> = { aiff: 'AIFF File', wav: 'WAV File', mp3: 'MP3 File' };

/**
 * The library held in memory, with converted tracks pointing at their new files —
 * what the database or XML now says. Without it, a rescan straight after a run
 * listed every track it had just converted, and other pages showed the old file.
 * Size is left alone: the run does not report it back, and a stale size beats a made-up one.
 */
export function applyConversionSwitches(library: LibraryData, switched: ConvertPreviewItem[]): LibraryData {
  if (switched.length === 0) { return library; }
  const tracks = new Map(library.tracks);
  for (const item of switched) {
    for (const id of item.trackIds) {
      const track = tracks.get(id);
      if (!track) { continue; }
      tracks.set(id, {
        ...track,
        location: item.to,
        fileType: FILE_TYPE[item.out.format],
        ...('kind' in track ? { kind: KIND[item.out.format] } : {}),
        bitrate: item.out.bitrateKbps,
        sampleRate: item.out.sampleRate,
        bitDepth: item.out.format === 'mp3' ? 16 : item.out.bitDepth,
      });
    }
  }
  return { ...library, tracks };
}
