import * as fs from 'fs';
import * as mm from 'music-metadata';
import { AudioFacts, AudioFormat, formatFromLibrary } from './playerProfiles';

const PCM_FORMATS: AudioFormat[] = ['wav', 'aiff', 'flac', 'alac'];

/**
 * What the library already knows about a track, or null when the file itself
 * has to be asked: an m4a could be AAC or ALAC, and a lossless track needs its
 * bit depth, which an XML library never carries.
 */
export function factsFromLibrary(track: {
  location: string; fileType?: number; kind?: string; sampleRate?: number; bitDepth?: number;
}): AudioFacts | null {
  const format = formatFromLibrary(track);
  if (format === 'unknown') {return null;}
  if (PCM_FORMATS.includes(format) && !track.bitDepth) {return null;}
  const facts: AudioFacts = { format };
  if (track.sampleRate) {facts.sampleRate = track.sampleRate;}
  if (track.bitDepth) {facts.bitDepth = track.bitDepth;}
  return facts;
}

function formatFromHeader(container?: string, codec?: string): AudioFormat {
  const c = (codec ?? '').toLowerCase();
  const k = (container ?? '').toLowerCase();
  if (c.includes('alac') || c.includes('apple lossless')) {return 'alac';}
  if (k === 'flac' || c.includes('flac')) {return 'flac';}
  if (c.includes('layer 3') || c.includes('layer iii')) {return 'mp3';}
  if (c.includes('aac')) {return 'aac';}
  if (k === 'aiff' || k === 'aifc') {return 'aiff';}
  if (k.startsWith('wave') || k === 'wav') {return 'wav';}
  return 'other';
}

type ParseFile = (filePath: string, options?: mm.IOptions) => Promise<mm.IAudioMetadata>;

/**
 * `parseFile` seeks: it reads the headers (and for MP3 without a Xing frame, the frames)
 * from disk instead of loading the file, so a 2 GB WAV costs what a 2 MB one does. It is in
 * the package's Node build, which is what Node and Electron's main process resolve; the
 * renderer's tsconfig resolves the browser build, whose types leave it out, hence the cast.
 */
const parseFile: ParseFile = (filePath, options) =>
  (mm as unknown as { parseFile: ParseFile }).parseFile(filePath, options);

export type FileFacts = AudioFacts & { durationSec: number; bitrateKbps?: number };
/**
 * `unreachable`: the file is not there or cannot be opened — fixed with Track Relocation.
 * `unreadable`: the file is there, but its audio could not be made sense of.
 */
export type FileFactsResult = FileFacts | { unreachable: true } | { unreadable: true };

export const isReadable = (r: FileFactsResult): r is FileFacts =>
  !('unreachable' in r) && !('unreadable' in r);

/** Read a file's format, rate, depth, bitrate and duration from its headers. */
export async function readFileFacts(filePath: string): Promise<FileFactsResult> {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return { unreachable: true };
  }

  let meta: mm.IAudioMetadata;
  try {
    meta = await parseFile(filePath, { duration: true, skipCovers: true });
  } catch {
    return { unreadable: true };
  }
  const { container, codec, sampleRate, bitsPerSample, duration, bitrate } = meta.format;
  const facts: FileFacts = {
    format: formatFromHeader(container, codec),
    durationSec: duration ?? 0,
  };
  if (sampleRate) {facts.sampleRate = sampleRate;}
  if (bitsPerSample) {facts.bitDepth = bitsPerSample;}
  if (bitrate) {facts.bitrateKbps = bitrate / 1000;}
  if (/ieee_float|pcm float|float/i.test(codec ?? '')) {facts.isFloat = true;}
  return facts;
}
