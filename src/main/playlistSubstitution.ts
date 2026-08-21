/**
 * When a duplicate set is resolved, the removed tracks must not simply
 * vanish from playlists — every playlist that referenced any version of the
 * song must keep it, now pointing at the single kept track. This rewrites
 * playlist track-id lists in place: each removed id is replaced by its kept
 * id, and the resulting list is de-duplicated while preserving the order of
 * first appearance (so a playlist that already contained the kept track
 * doesn't gain a second entry).
 *
 * @param playlists  the (possibly nested) playlist tree; `tracks` arrays are rewritten in place
 * @param replacement  removedTrackId -> keptTrackId
 */
export function substitutePlaylistTrackIds(
  playlists: Array<{ tracks?: string[]; children?: any[] }>,
  replacement: Map<string, string>
): void {
  for (const playlist of playlists) {
    if (playlist.tracks) {
      const seen = new Set<string>();
      const rewritten: string[] = [];
      for (const id of playlist.tracks) {
        const mapped = replacement.get(id) ?? id;
        if (!seen.has(mapped)) {
          seen.add(mapped);
          rewritten.push(mapped);
        }
      }
      playlist.tracks = rewritten;
    }
    if (playlist.children && playlist.children.length > 0) {
      substitutePlaylistTrackIds(playlist.children, replacement);
    }
  }
}
