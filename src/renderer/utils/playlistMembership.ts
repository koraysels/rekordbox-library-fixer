import type { Playlist } from '../types';

/**
 * Count how many playlists each track belongs to, and collect the playlist
 * names. Folders (type 'FOLDER') are containers, not real playlists, so their
 * own `tracks` array (normally empty) is ignored for the count; their children
 * are still walked. A track appearing twice in the same playlist counts once.
 */
export function countPlaylistMembership(
  playlists: Playlist[]
): Map<string, { count: number; names: string[] }> {
  const membership = new Map<string, { count: number; names: string[] }>();

  const walk = (nodes: Playlist[]) => {
    for (const node of nodes) {
      if (node.type !== 'FOLDER' && node.tracks && node.tracks.length > 0) {
        const seenInThisPlaylist = new Set<string>();
        for (const trackId of node.tracks) {
          if (seenInThisPlaylist.has(trackId)) { continue; }
          seenInThisPlaylist.add(trackId);
          const entry = membership.get(trackId) ?? { count: 0, names: [] };
          entry.count += 1;
          entry.names.push(node.name);
          membership.set(trackId, entry);
        }
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(playlists);
  return membership;
}
