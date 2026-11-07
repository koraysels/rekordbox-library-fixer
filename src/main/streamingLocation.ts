/**
 * Rekordbox gives a streaming track a made-up location holding the service and
 * track id, for example `tidal:tracks:105015500`. Shared so the relocator, the
 * broken-entry scan and the renderer's cached missing list agree on what has no
 * file by design. Kept free of Node imports so the renderer can use it too.
 */
export function isStreamingLocation(location: string | undefined): boolean {
  const tail = (location ?? '').trim().split('/').pop() ?? '';
  return /^[a-z]+:[a-z]+:/i.test(tail);
}
