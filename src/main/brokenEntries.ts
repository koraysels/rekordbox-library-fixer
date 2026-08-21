import * as fs from 'fs';

export type BrokenReason = 'folder' | 'streaming' | 'truncated' | 'missing' | 'empty';

export interface BrokenEntry {
  trackId: string;
  name: string;
  artist: string;
  location: string;
  reason: BrokenReason;
}

const REASON_TEXT: Record<BrokenReason, string> = {
  folder: 'Points at a folder, not a file',
  streaming: 'A streaming track, with no file on disk',
  truncated: 'The path was cut short and names no file',
  missing: 'The file is not there any more',
  empty: 'No location at all',
};

export function describeReason(reason: BrokenReason): string {
  return REASON_TEXT[reason];
}

/**
 * Why a track's location cannot be a playable file, or null when it looks fine.
 *
 * Rekordbox libraries accumulate entries that point at nothing usable: folders
 * left by bad imports, paths cut off mid-name (often at an "&"), and streaming
 * tracks whose Location is a made-up file path. They clutter the collection and
 * confuse duplicate detection, but they are not the same as a track whose file
 * merely moved — that is what the relocator is for.
 */
export function diagnoseLocation(
  location: string | undefined,
  exists: (p: string) => boolean = fs.existsSync
): BrokenReason | null {
  const path = (location ?? '').trim();
  if (!path) { return 'empty'; }
  if (path.endsWith('/') || path.endsWith('\\')) { return 'folder'; }
  if (/^[a-z]+:[a-z]+:/i.test(path.split('/').pop() ?? '')) { return 'streaming'; }
  if (!/\.[a-z0-9]{2,5}$/i.test(path)) { return 'truncated'; }
  if (!exists(path)) { return 'missing'; }
  return null;
}

/**
 * Find entries that can never resolve to a file. Tracks whose file is simply
 * missing are excluded: those are relocatable, and removing them would throw
 * away cues and playlist membership the user still wants.
 */
export function findBrokenEntries(
  tracks: Iterable<{ id: string; name?: string; artist?: string; location?: string }>,
  exists: (p: string) => boolean = fs.existsSync
): BrokenEntry[] {
  const broken: BrokenEntry[] = [];
  for (const track of tracks) {
    const reason = diagnoseLocation(track.location, exists);
    if (!reason || reason === 'missing') { continue; }
    broken.push({
      trackId: track.id,
      name: track.name ?? '',
      artist: track.artist ?? '',
      location: track.location ?? '',
      reason,
    });
  }
  return broken;
}
