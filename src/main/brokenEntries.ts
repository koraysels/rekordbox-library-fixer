import * as fs from 'fs';

export type BrokenReason = 'folder' | 'streaming' | 'truncated' | 'missing' | 'empty';

/**
 * A streaming track has no file by design — it is not damaged and must never be
 * offered for removal. Doing so would delete a user's TIDAL collection.
 */
export function isStreamingEntry(reason: BrokenReason | null): boolean {
  return reason === 'streaming';
}

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
 * Find entries whose location is damaged: a folder, a path cut short, or no
 * location at all.
 *
 * Two kinds are deliberately excluded. A merely missing file is relocatable, so
 * removing it would throw away cues and playlist membership. Streaming tracks
 * have no file by design and are not damaged at all — offering to remove them
 * would delete the user's TIDAL collection.
 */
export function findBrokenEntries(
  tracks: Iterable<{ id: string; name?: string; artist?: string; location?: string }>,
  exists: (p: string) => boolean = fs.existsSync
): BrokenEntry[] {
  const broken: BrokenEntry[] = [];
  for (const track of tracks) {
    const reason = diagnoseLocation(track.location, exists);
    if (!reason || reason === 'missing' || reason === 'streaming') { continue; }
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
