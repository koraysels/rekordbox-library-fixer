/**
 * Rekordbox stores streaming tracks with a made-up file path holding the
 * service and track id, for example `tidal:tracks:105015500`. They have no file
 * by design: they are not missing, not duplicates of anything on disk, and must
 * never be offered for deletion.
 */
const SERVICES: Record<string, string> = {
  tidal: 'TIDAL',
  spotify: 'Spotify',
  applemusic: 'Apple Music',
  apple: 'Apple Music',
  soundcloud: 'SoundCloud',
  beatport: 'Beatport',
  beatsource: 'Beatsource',
  deezer: 'Deezer',
  qobuz: 'Qobuz',
};

/** The streaming service behind a location, or null when it names a real file. */
export function streamingServiceOf(location: string | undefined): string | null {
  const tail = (location ?? '').trim().split('/').pop() ?? '';
  const match = tail.match(/^([a-z]+):[a-z]+:/i);
  if (!match) { return null; }
  const key = match[1].toLowerCase();
  return SERVICES[key] ?? match[1];
}

export function isStreamingTrack(location: string | undefined): boolean {
  return streamingServiceOf(location) !== null;
}
