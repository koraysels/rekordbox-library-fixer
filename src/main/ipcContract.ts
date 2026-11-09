/**
 * The contract between the two processes.
 *
 * Both sides import these: `preload.ts` types what it exposes, the renderer
 * types `window.electronAPI` from the same file, and the handlers type their
 * arguments from it. It lives under `src/main` because that is where the
 * bridge is defined; the renderer's import is type-only and disappears at
 * build time. Keeping one copy is the point — the renderer used to
 * declare its own shapes, and a field the main process stopped sending stayed
 * in the renderer's type, so the code that read it compiled and got undefined.
 */

import type { AudioFacts, PlayerProfile, UnplayableReason } from './convert/playerProfiles';
import type { OutputFacts, Readiness, TargetFormat } from './convert/conversionPlan';
import type { SwitchSkip } from './convert/applyConversions';
import type { FfmpegStatus } from './convert/ffmpegBinary';

export type { TargetFormat, FfmpegStatus };

/** Anything crossing the bridge is structured-cloned, so Dates arrive as strings. */
export type Serialized<T> = T extends Date ? string
  : T extends Array<infer U> ? Array<Serialized<U>>
  : T extends Map<infer K, infer V> ? Map<K, Serialized<V>>
  : T extends object ? { [K in keyof T]: Serialized<T[K]> }
  : T;

export interface IpcResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** A track as it crosses the bridge. Loose on purpose: the XML and the
 *  database carry different subsets, and neither side gains from pretending
 *  otherwise. What every caller may rely on is named. */
export interface TrackPayload {
  id: string;
  name: string;
  artist: string;
  location: string;
  album?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  size?: number;
  bitrate?: number;
  duration?: number;
  fileType?: number;
  bitDepth?: number;
  rating?: number;
  dateAdded?: string | Date;
  dateModified?: string | Date;
  [field: string]: unknown;
}

export interface DuplicateSet {
  id: string;
  tracks: TrackPayload[];
  matchType: 'fingerprint' | 'metadata';
  confidence: number;
  filesMissing?: boolean;
  pathPreferences?: string[];
}

export interface ScanOptionsPayload {
  useFingerprint: boolean;
  useMetadata: boolean;
  metadataFields: string[];
  pathPreferences?: string[];
  preferLossless?: boolean;
  tracks?: TrackPayload[];
}

export interface ScanProgressPayload {
  operationId?: string;
  type?: 'start' | 'progress' | 'complete';
  current: number;
  total: number;
  trackName?: string;
  setsFound: number;
}

export interface MergePlanPayload {
  keepId: string;
  removeIds: string[];
}

export interface BrokenEntryPayload {
  trackId: string;
  name: string;
  artist: string;
  location: string;
  reason: string;
}

/** An entry left alone by a removal, and why — reported so a run that removed
 *  fewer entries than it listed does not look like a failure. */
export interface KeptEntry {
  trackId: string;
  reason: string;
}

export interface RelocationPayload {
  trackId: string;
  oldLocation: string;
  newLocation: string;
}

export interface RelocationResultPayload {
  trackId: string;
  oldLocation: string;
  /** Empty when nothing was found — a failure still says where it looked. */
  newLocation?: string;
  success: boolean;
  error?: string;
  confidence?: number;
  trackName?: string;
}

export interface RelocateProgressPayload {
  operationId?: string;
  type: 'start' | 'searching' | 'found' | 'low-confidence' | 'not-found'
    | 'updating-xml' | 'complete' | 'cancelled' | 'error';
  total: number;
  current: number;
  successCount?: number;
  trackName?: string;
  trackArtist?: string;
  confidence?: number;
  newLocation?: string;
  message: string;
  error?: string;
}

export interface FoundLibraryPayload {
  kind: 'database' | 'xml';
  path: string;
  label: string;
  size: number;
  modified: string;
}

export interface BackupPayload {
  path: string;
  libraryPath?: string;
  size: number;
  created: string;
}

export interface OperationProgress {
  operationId: string;
  current: number;
  total: number;
  message?: string;
  trackName?: string;
}

export interface FilterRulePayload {
  field: 'artist' | 'album' | 'genre' | 'rating' | 'bpm' | 'year' | 'format';
  op: 'contains' | 'equals' | 'gte' | 'lte';
  value: string;
}

/** Unsubscribes an event listener registered through the bridge. */
export type Unsubscribe = () => void;

/** The app's own update, as the main process reports it on 'update-status'. */
export type UpdateStatusPayload =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'up-to-date'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  /** Found, but this copy cannot replace itself (opened from Downloads or a disk image). */
  | { state: 'manual'; version: string; url: string }
  | { state: 'error'; message: string };

// ---- Format conversion ----

export type PlayerProfileId = PlayerProfile['id'];

/** One file the chosen player cannot play, with every library entry that points at it. */
export interface ConvertCandidate {
  trackIds: string[];
  location: string;
  name: string;
  artist: string;
  reasons: UnplayableReason[];
  /** `durationSec` is there when the file itself was read. */
  facts: (AudioFacts & { durationSec?: number }) | null;
  /** The file had to be read and is not there: listed, never converted ("file not reachable"). */
  unreachable?: true;
  /** The file is there but its audio could not be read: listed, never converted ("couldn't read the file"). */
  unreadable?: true;
}

export interface ConvertPreviewItem {
  trackIds: string[];
  from: string;
  to: string;
  readiness: Readiness;
  out: OutputFacts;
}

export interface ConvertRunOptions {
  libraryPath: string;
  dbKey?: string;
  profileId: PlayerProfileId;
  target: TargetFormat;
  /** Forced false for an XML library. */
  trashOriginals: boolean;
  items: ConvertPreviewItem[];
}

/** What the renderer sends; it may name the operation so it can cancel before the first event. */
export type ConvertRunPayload = ConvertRunOptions & { operationId?: string };

export interface ConvertProgress {
  operationId: string;
  type: 'start' | 'converting' | 'converted' | 'failed' | 'writing' | 'complete' | 'cancelled' | 'error';
  current: number;
  total: number;
  name?: string;
  message: string;
  convertedCount: number;
  failedCount: number;
}

export interface ConvertRunResult {
  switched: number;
  /** Exactly the entries the library write switched: nothing the run never reached, nothing it skipped. */
  switchedItems: { trackIds: string[]; from: string; to: string }[];
  failed: { from: string; error: string }[];
  conflicts: string[];
  trashed: number;
  backupPath?: string;
  cancelled: boolean;
  /** The library write failed: nothing was switched and no original was trashed. */
  error?: string;
  /** Entries the write left alone, and why. */
  skipped?: SwitchSkip[];
  /** Originals that were switched away from but could not be moved to the Trash. */
  notTrashed?: { from: string; error: string }[];
}

export interface FfmpegInstallProgress {
  percent: number;
}
