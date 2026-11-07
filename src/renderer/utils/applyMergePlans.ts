import type { LibraryData, Playlist } from '../types';

export interface MergePlan { keepId: string; removeIds: string[] }

/**
 * What a database merge did, applied to the library the app holds in memory.
 *
 * The merge changes master.db, but the app scans the copy it loaded. Without
 * this, a rescan straight after resolving found every set it had just merged.
 * Mirrors the writer: removed entries go, and playlists that listed them point
 * at the kept track instead, listing it once.
 */
export function applyMergePlans(library: LibraryData, plans: MergePlan[]): LibraryData {
  const keptFor = new Map<string, string>();
  for (const plan of plans) {
    for (const id of plan.removeIds) { keptFor.set(id, plan.keepId); }
  }

  const tracks = new Map(library.tracks);
  for (const id of keptFor.keys()) { tracks.delete(id); }

  const repoint = (playlist: Playlist): Playlist => ({
    ...playlist,
    tracks: [...new Set(playlist.tracks.map((id) => keptFor.get(id) ?? id))],
    ...(playlist.children ? { children: playlist.children.map(repoint) } : {}),
  });

  return { ...library, tracks, playlists: library.playlists.map(repoint) };
}
