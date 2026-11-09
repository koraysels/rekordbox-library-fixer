/**
 * Decides what a conversion produces: output name, output audio facts, ffmpeg arguments,
 * whether an existing file at the output path can be reused, and which library entries
 * share a file. Kept free of Node imports (no fs, no path) so the renderer can use it too.
 */
import type { AudioFacts, PlayerProfile } from './playerProfiles';

export type TargetFormat = 'aiff' | 'wav' | 'mp3';

export interface OutputFacts {
  format: TargetFormat;
  sampleRate: number;
  bitDepth?: number;
  bitrateKbps: number;
}

const MP3_KBPS = 320;
/** Verification tolerance: a converted file's duration may differ by this much. */
const DURATION_TOLERANCE_SEC = 0.05;

const nfc = (s: string) => s.normalize('NFC');

/** Cap the rate but stay in the same family: 88.2/176.4 kHz -> 44.1, everything else -> the cap. */
function cappedRate(rate: number, max: number): number {
  if (rate <= max) return rate;
  return rate % 44100 === 0 ? 44100 : max;
}

export function outputFacts(
  source: AudioFacts & { sampleRate: number },
  profile: PlayerProfile,
  target: TargetFormat,
): OutputFacts {
  const sampleRate = cappedRate(source.sampleRate, profile.maxSampleRate);
  if (target === 'mp3') return { format: target, sampleRate, bitrateKbps: MP3_KBPS };
  const bitDepth = source.isFloat
    ? Math.min(24, profile.maxBitDepth)
    : Math.min(source.bitDepth || 16, profile.maxBitDepth);
  return {
    format: target,
    sampleRate,
    bitDepth,
    bitrateKbps: Math.round((sampleRate * bitDepth * 2) / 1000),
  };
}

const EXTENSION: Record<TargetFormat, string> = { aiff: '.aif', wav: '.wav', mp3: '.mp3' };

function bitDepthChanged(source: AudioFacts, out: OutputFacts): boolean {
  return out.bitDepth !== undefined && (!!source.isFloat || (source.bitDepth !== undefined && source.bitDepth !== out.bitDepth));
}

function rateChanged(source: AudioFacts, out: OutputFacts): boolean {
  return source.sampleRate !== undefined && source.sampleRate !== out.sampleRate;
}

const kHz = (hz: number) => `${Math.round((hz / 1000) * 10) / 10} kHz`;

export function outputPath(sourcePath: string, source: AudioFacts, out: OutputFacts): string {
  const path = nfc(sourcePath);
  const sep = path.includes('\\') ? '\\' : '/';
  const slash = path.lastIndexOf(sep);
  const dot = path.lastIndexOf('.');
  const stem = dot > slash + 1 ? path.slice(0, dot) : path;
  const ext = EXTENSION[out.format];
  const plain = stem + ext;
  if (plain.toLowerCase() !== path.toLowerCase()) return plain;

  const parts: string[] = [];
  if (bitDepthChanged(source, out)) parts.push(`${out.bitDepth}-bit`);
  if (rateChanged(source, out)) parts.push(kHz(out.sampleRate));
  return `${stem} (${parts.length ? parts.join(', ') : 'converted'})${ext}`;
}

export function ffmpegArgs(input: string, output: string, out: OutputFacts, source: AudioFacts): string[] {
  const args = ['-hide_banner', '-nostdin', '-y', '-i', input, '-map', '0:a:0', '-map_metadata', '0'];

  if (out.format === 'aiff') {
    args.push('-c:a', out.bitDepth === 24 ? 'pcm_s24be' : 'pcm_s16be',
      '-map', '0:v?', '-c:v', 'copy', '-write_id3v2', '1', '-id3v2_version', '3');
  } else if (out.format === 'wav') {
    args.push('-c:a', out.bitDepth === 24 ? 'pcm_s24le' : 'pcm_s16le');
  } else {
    args.push('-c:a', 'libmp3lame', '-b:a', `${MP3_KBPS}k`,
      '-map', '0:v?', '-c:v', 'copy', '-id3v2_version', '3', '-write_xing', '1');
  }

  if (rateChanged(source, out) || bitDepthChanged(source, out)) {
    args.push('-af', `aresample=${out.sampleRate}:resampler=swr:filter_size=64:dither_method=triangular_hp`);
  }

  args.push('-f', out.format, output);
  return args;
}

export type Readiness = 'new' | 'reusable' | 'conflict';

export function outputReadiness(
  existing: { exists: boolean; facts?: AudioFacts & { durationSec?: number } },
  out: OutputFacts,
  sourceDurationSec: number,
): Readiness {
  if (!existing.exists) return 'new';
  const f = existing.facts;
  if (
    f &&
    f.format === out.format &&
    f.sampleRate === out.sampleRate &&
    f.bitDepth === out.bitDepth &&
    f.durationSec !== undefined &&
    Math.abs(f.durationSec - sourceDurationSec) <= DURATION_TOLERANCE_SEC
  ) return 'reusable';
  return 'conflict';
}

/** Entries pointing at one file switch together, so group them by NFC-normalised path. */
export function groupBySharedFile<T extends { id: string; location: string }>(tracks: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const t of tracks) {
    const key = nfc(t.location);
    const list = groups.get(key);
    if (list) list.push(t); else groups.set(key, [t]);
  }
  return groups;
}
