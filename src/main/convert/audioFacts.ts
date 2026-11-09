import * as fs from 'fs';
import * as mm from 'music-metadata';
import { AudioFacts, AudioFormat, formatFromLibrary } from './playerProfiles';

const PCM_FORMATS: AudioFormat[] = ['wav', 'aiff', 'flac', 'alac'];
const HEAD_BYTES = 2 * 1024 * 1024;

/**
 * What the library already knows about a track, or null when the file itself
 * has to be asked: an m4a could be AAC or ALAC, and a lossless track needs its
 * bit depth, which an XML library never carries.
 */
export function factsFromLibrary(track: {
  location: string; fileType?: number; kind?: string; sampleRate?: number; bitDepth?: number;
}): AudioFacts | null {
  const format = formatFromLibrary(track);
  if (format === 'unknown') return null;
  if (PCM_FORMATS.includes(format) && !track.bitDepth) return null;
  const facts: AudioFacts = { format };
  if (track.sampleRate) facts.sampleRate = track.sampleRate;
  if (track.bitDepth) facts.bitDepth = track.bitDepth;
  return facts;
}

function formatFromHeader(container?: string, codec?: string): AudioFormat {
  const c = (codec ?? '').toLowerCase();
  const k = (container ?? '').toLowerCase();
  if (c.includes('alac') || c.includes('apple lossless')) return 'alac';
  if (k === 'flac' || c.includes('flac')) return 'flac';
  if (c.includes('layer 3') || c.includes('layer iii')) return 'mp3';
  if (c.includes('aac')) return 'aac';
  if (k === 'aiff' || k === 'aifc') return 'aiff';
  if (k.startsWith('wave') || k === 'wav') return 'wav';
  return 'other';
}

async function parse(buffer: Buffer, size: number) {
  return mm.parseBuffer(buffer, { size }, { duration: true, skipCovers: true });
}

/** Read the header of a file for its format, rate, depth and duration. */
export async function readFileFacts(
  filePath: string,
  headBytes: number = HEAD_BYTES,
): Promise<(AudioFacts & { durationSec: number }) | { unreachable: true }> {
  let head: Buffer;
  let size: number;
  try {
    const handle = await fs.promises.open(filePath, 'r');
    try {
      size = (await handle.stat()).size;
      head = Buffer.alloc(Math.min(size, headBytes));
      await handle.read(head, 0, head.length, 0);
    } finally {
      await handle.close();
    }
  } catch {
    return { unreachable: true };
  }

  try {
    const partial = size > head.length;
    let meta = await parse(head, size).catch(() => null);
    // mp3/aac durations are estimated from the bytes seen, so a head-only
    // parse can be confidently wrong; the other formats store it in the header.
    const estimated = !!meta && (meta.format.codec ?? '').toLowerCase().match(/layer|aac/) !== null
      && !meta.format.lossless;
    if (partial && (!meta || !meta.format.duration || estimated)) {
      meta = await parse(await fs.promises.readFile(filePath), size);
    }
    if (!meta) return { unreachable: true };
    const { container, codec, sampleRate, bitsPerSample, duration } = meta.format;
    const facts: AudioFacts & { durationSec: number } = {
      format: formatFromHeader(container, codec),
      durationSec: duration ?? 0,
    };
    if (sampleRate) facts.sampleRate = sampleRate;
    if (bitsPerSample) facts.bitDepth = bitsPerSample;
    if (/ieee_float|pcm float|float/i.test(codec ?? '')) facts.isFloat = true;
    return facts;
  } catch {
    return { unreachable: true };
  }
}
