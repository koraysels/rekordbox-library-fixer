import { isStreamingLocation } from '../../main/streamingLocation';

/**
 * Drops streaming tracks from a missing list. The scan already skips them, but a
 * list cached before it did is restored as-is, so TIDAL tracks kept showing up
 * as missing (and "unlocatable") until the user rescanned.
 */
export function withoutStreamingTracks<T extends { originalLocation?: string }>(tracks: T[]): T[] {
  return tracks.filter((track) => !isStreamingLocation(track.originalLocation));
}
