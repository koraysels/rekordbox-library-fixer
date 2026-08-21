import { aiffToWav } from './aiffToWav';

/** Must mirror src/main/mediaProtocol.ts: whole path = one encoded segment. */
export const mediaUrl = (location: string): string =>
  `media:///${encodeURIComponent(location)}`;

const AIFF_RE = /\.aiff?$/i;

export async function resolveAudioSrc(
  location: string
): Promise<{ src: string; revoke: (() => void) | null }> {
  const url = mediaUrl(location);
  if (!AIFF_RE.test(location)) {
    return { src: url, revoke: null };
  }
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('File missing or unreadable');
  }
  if (!res.ok) { throw new Error('File missing or unreadable'); }
  const wav = aiffToWav(await res.arrayBuffer());
  const blobUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  return { src: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
}
