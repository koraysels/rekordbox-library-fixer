/**
 * What an older Pioneer CDJ can and cannot play. Kept free of Node imports so the
 * renderer can use it too.
 *
 * FileType codes in rekordbox's djmdContent, checked two ways:
 *  - pyrekordbox 0.5.0, `masterdb/models.py` `FileType`: MP3=1, M4A/AAC=4, FLAC=5,
 *    ALAC=6, WAV=11, AIFF=12 (and 0 invalid, 3 mp4, 16 video).
 *  - a real master.db copy (read-only): 1 = .mp3 (10253 rows), 4 = .m4a (175),
 *    6 = .m4a (30, rekordbox separates 4 from 6 by codec), 11 = .wav, 12 = .aiff,
 *    0 = unreadable, 22/25 = tidal:/spotify: streaming locations.
 *  That library holds no FLAC, so 5 = FLAC rests on pyrekordbox alone; 6 = ALAC is
 *  corroborated only by pyrekordbox plus the observation that it is a second .m4a code.
 */
export type AudioFormat = 'mp3' | 'aac' | 'alac' | 'flac' | 'wav' | 'aiff' | 'other';

export interface AudioFacts {
  format: AudioFormat;
  sampleRate?: number;
  bitDepth?: number;
  isFloat?: boolean;
}

export type UnplayableReason =
  | { kind: 'format'; format: AudioFormat }
  | { kind: 'sampleRate'; hz: number; max: number }
  | { kind: 'bitDepth'; bits: number; max: number }
  | { kind: 'float' };

export interface PlayerProfile {
  id: 'cdj2000';
  label: string;
  formats: AudioFormat[];
  maxSampleRate: number;
  maxBitDepth: number;
  allowsFloat: boolean;
}

export const PLAYER_PROFILES: Record<PlayerProfile['id'], PlayerProfile> = {
  cdj2000: {
    id: 'cdj2000',
    label: 'CDJ-2000 / CDJ-2000NXS',
    formats: ['mp3', 'aac', 'wav', 'aiff'],
    maxSampleRate: 48000,
    maxBitDepth: 24,
    allowsFloat: false,
  },
};

export const DEFAULT_PLAYER: PlayerProfile['id'] = 'cdj2000';

export function whyUnplayable(facts: AudioFacts, profile: PlayerProfile): UnplayableReason[] {
  // A format the player cannot read at all makes its rate and depth beside the point.
  if (!profile.formats.includes(facts.format)) return [{ kind: 'format', format: facts.format }];
  const reasons: UnplayableReason[] = [];
  if (facts.sampleRate !== undefined && facts.sampleRate > profile.maxSampleRate) {
    reasons.push({ kind: 'sampleRate', hz: facts.sampleRate, max: profile.maxSampleRate });
  }
  if (facts.bitDepth !== undefined && facts.bitDepth > profile.maxBitDepth) {
    reasons.push({ kind: 'bitDepth', bits: facts.bitDepth, max: profile.maxBitDepth });
  }
  if (facts.isFloat && !profile.allowsFloat) reasons.push({ kind: 'float' });
  return reasons;
}

const FORMAT_NAMES: Record<AudioFormat, string> = {
  mp3: 'MP3',
  aac: 'AAC',
  alac: 'Apple Lossless (ALAC)',
  flac: 'FLAC',
  wav: 'WAV',
  aiff: 'AIFF',
  other: 'This format',
};

const khz = (hz: number) => `${Math.round((hz / 1000) * 10) / 10} kHz`;

export function describeReason(r: UnplayableReason): string {
  switch (r.kind) {
    case 'format':
      return `${FORMAT_NAMES[r.format]} isn't supported`;
    case 'sampleRate':
      return `${khz(r.hz)} — this player stops at ${khz(r.max)}`;
    case 'bitDepth':
      return `${r.bits}-bit — this player stops at ${r.max}-bit`;
    case 'float':
      return "32-bit float isn't supported";
  }
}

const BY_FILE_TYPE: Record<number, AudioFormat> = {
  1: 'mp3', 4: 'aac', 5: 'flac', 6: 'alac', 11: 'wav', 12: 'aiff',
};

function fromKind(kind: string | undefined): AudioFormat | undefined {
  const k = (kind ?? '').toLowerCase();
  if (!k) return undefined;
  if (k.includes('lossless')) return 'alac'; // before "mpeg-4"/"aac": ALAC Kinds can mention MPEG-4
  if (k.includes('flac')) return 'flac';
  if (k.includes('aiff')) return 'aiff';
  if (k.includes('wav')) return 'wav';
  if (k.includes('mp3')) return 'mp3';
  if (k.includes('aac') || k.includes('mpeg-4')) return 'aac';
  return undefined;
}

const BY_EXTENSION: Record<string, AudioFormat> = {
  mp3: 'mp3', aac: 'aac', flac: 'flac', wav: 'wav', aif: 'aiff', aiff: 'aiff',
};

export function formatFromLibrary(
  input: { location: string; fileType?: number; kind?: string },
): AudioFormat | 'unknown' {
  if (input.fileType !== undefined && BY_FILE_TYPE[input.fileType]) return BY_FILE_TYPE[input.fileType];
  const byKind = fromKind(input.kind);
  if (byKind) return byKind;
  const name = input.location.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  // .m4a/.mp4 hold AAC or ALAC; only the file itself can say which.
  if (ext === 'm4a' || ext === 'mp4') return 'unknown';
  return BY_EXTENSION[ext] ?? 'unknown';
}
