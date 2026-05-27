/** Extensions recognised as lossless audio formats. */
export const LOSSLESS_EXTENSIONS: readonly string[] = ['.flac', '.wav', '.aiff', '.aif'];

/**
 * Returns `true` when the file extension indicates a lossless audio format.
 *
 * Rekordbox may store lossless VBR files with BitRate = 0, so comparing raw
 * bitrate numbers would incorrectly rank a 320 kbps MP3 above a FLAC.
 * Use this to tier tracks before comparing bitrate/size scores.
 */
export function isLossless(location: string): boolean {
  const ext = '.' + (location.split('.').pop()?.toLowerCase() ?? '');
  return LOSSLESS_EXTENSIONS.includes(ext);
}
