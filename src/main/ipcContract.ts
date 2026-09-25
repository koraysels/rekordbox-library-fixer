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
