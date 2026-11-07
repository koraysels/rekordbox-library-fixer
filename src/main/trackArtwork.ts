import * as fs from 'fs';
import * as mm from 'music-metadata';

interface Picture { format: string; data: Uint8Array; type?: string }

/** The cover as a data URL the renderer can show directly, or null. */
export function pictureToDataUrl(picture: Picture | undefined): string | null {
  if (!picture || picture.data.length === 0) { return null; }
  const format = picture.format.includes('/') ? picture.format : `image/${picture.format}`;
  return `data:${format};base64,${Buffer.from(picture.data).toString('base64')}`;
}

/**
 * The cover embedded in an audio file. Null when the file has none or cannot
 * be read — artwork is decoration, so it never fails loudly.
 */
export async function readTrackArtwork(filePath: string): Promise<string | null> {
  try {
    // parseFile is not in the build the main process resolves; read, then parse,
    // as the duplicate detector does.
    const buffer = await fs.promises.readFile(filePath);
    const metadata = await mm.parseBuffer(buffer, undefined, { duration: false, skipCovers: false });
    const pictures: Picture[] = metadata.common.picture ?? [];
    const front = pictures.find((p) => /front/i.test(p.type ?? '')) ?? pictures[0];
    return pictureToDataUrl(front);
  } catch {
    return null;
  }
}
