/** WAV and AIFF — lossless and universally supported on CDJ hardware. */
export const UNIVERSAL_LOSSLESS_EXTENSIONS: readonly string[] = ['.wav', '.aiff', '.aif'];

/** FLAC — lossless but CDJ support depends on hardware generation. */
export const FLAC_EXTENSIONS: readonly string[] = ['.flac'];

export const LOSSLESS_EXTENSIONS: readonly string[] = [...FLAC_EXTENSIONS, ...UNIVERSAL_LOSSLESS_EXTENSIONS];

function ext(location: string): string {
  return '.' + (location.split('.').pop()?.toLowerCase() ?? '');
}

/** WAV/AIFF: lossless AND universally CDJ-compatible — always preferred over lossy. */
export function isUniversalLossless(location: string): boolean {
  return UNIVERSAL_LOSSLESS_EXTENSIONS.includes(ext(location));
}

/** FLAC: lossless but CDJ support varies — only prefer when user explicitly opts in. */
export function isFlac(location: string): boolean {
  return ext(location) === '.flac';
}

/** Returns `true` for any lossless format (FLAC, WAV, AIFF). */
export function isLossless(location: string): boolean {
  return LOSSLESS_EXTENSIONS.includes(ext(location));
}
