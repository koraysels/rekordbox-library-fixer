import { isStreamingLocation } from '../streamingLocation';
import type { DbPlaylist } from '../rekordboxDbParser';
import type { PdbExport, PdbPlaylist, PdbTrack } from './pdbReader';
import type { SyncList } from './syncList';

/**
 * What a USB stick lacks, and why. Rekordbox skips, without a word, every track
 * it cannot read at sync time — a file on an unplugged drive, a file that is
 * gone, a streaming track — so a playlist arrives half full or empty on the
 * player. This compares each synced library playlist with its copy on the
 * stick and gives every missing entry a reason.
 *
 * Pure: the file system comes in through `UsbCheckDeps`, like the wizard's deps,
 * so tests fake it whole.
 */

export type NotOnStickReason = 'drive-unplugged' | 'missing' | 'no-access' | 'streaming' | 'not-synced-yet';

export const notOnStickReasons: NotOnStickReason[] =
  ['drive-unplugged', 'missing', 'no-access', 'streaming', 'not-synced-yet'];

export type FileState = 'ok' | 'missing' | 'no-access';

export interface UsbCheckDeps {
  /** `missing` only for ENOENT/ENOTDIR (`fileState.ts`); EPERM/EACCES is `no-access`. */
  fileState(path: string): Promise<FileState>;
  isVolumeMounted(path: string): boolean;
  /** The drive as the user knows it: `DJ SSD`, `D:`. */
  driveName(path: string): string;
}

export interface LibraryTrackRef {
  id: string;
  name: string;
  artist: string;
  location: string;
}

export interface LibraryPlaylistRef {
  id: string;
  /** Names from the root down, the playlist's own name last. */
  path: string[];
  kind: 'list' | 'folder' | 'smart';
  trackIds: string[];
  /** Ids of the folders above it, nearest last. */
  ancestorIds: string[];
}

export interface NotOnStickEntry {
  trackId: string;
  name: string;
  artist: string;
  location: string;
  reason: NotOnStickReason;
  /** For `drive-unplugged`: the drive to plug in. */
  drive?: string;
}

export interface PlaylistCheck {
  id: string;
  path: string[];
  libraryCount: number;
  stickCount: number;
  /** False when the stick has no playlist by this name at all. */
  onStick: boolean;
  notOnStick: NotOnStickEntry[];
  /** Entries on the stick no library entry accounts for: taken out of the playlist since the last sync. */
  extraOnStick: number;
}

export interface UsbCheckResult {
  playlists: PlaylistCheck[];
  totals: {
    /** Entries, not tracks: a track in three playlists counts three times. */
    byReason: Record<NotOnStickReason, number>;
    /** One row per unplugged drive: "Plug in DJ SSD: 120 tracks". */
    byDrive: Array<{ drive: string; entries: number; tracks: number }>;
    /** Checked playlists the stick has, that hold tracks in the library and none on the stick. */
    emptyOnStick: number;
  };
  /** Playlists on the stick that no checked library playlist accounts for: leftovers from older exports. */
  leftovers: Array<{ path: string[]; stickCount: number }>;
  /** Playlists the sync list names that the stick does not have at all. */
  missingOnStick: string[][];
  /** Smart playlists: the library does not list their tracks, so they are not compared. */
  notChecked: Array<{ id: string; path: string[]; stickCount: number | null }>;
  /** `unreadableRows`: rows the stick's export.pdb lists that could not be read — a damaged file. */
  stick: { tracks: number; playlists: number; unreadableRows: number };
  syncList: { present: boolean; allPlaylists: boolean; unknownIds: number };
}

export interface UsbCheckInput {
  playlists: LibraryPlaylistRef[];
  tracks: Map<string, LibraryTrackRef>;
  stick: PdbExport;
  syncList: SyncList | null;
}

/** The library's playlist tree as a flat list with paths. Attribute 4 is a smart playlist. */
export function flattenLibraryPlaylists(tree: DbPlaylist[]): LibraryPlaylistRef[] {
  const out: LibraryPlaylistRef[] = [];
  const walk = (nodes: DbPlaylist[] | undefined, parentPath: string[], ancestors: string[]) => {
    for (const node of nodes ?? []) {
      const id = node.id ?? parentPath.concat(node.name).join('/');
      const kind = node.type === 'FOLDER' ? 'folder' : node.attribute === 4 ? 'smart' : 'list';
      const p = [...parentPath, node.name];
      out.push({ id, path: p, kind, trackIds: node.tracks, ancestorIds: ancestors });
      if (kind === 'folder') {walk(node.children, p, [...ancestors, id]);}
    }
  };
  walk(tree, [], []);
  return out;
}

const fold = (s: string) => s.normalize('NFC').toLowerCase().trim();
const baseName = (p: string) => p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);
const pathKey = (p: string[]) => p.map(fold).join('\u0000');
const titleKey = (title: string, artist: string) => `${fold(title)}\u0000${fold(artist)}`;

function stickPlaylistPaths(playlists: PdbPlaylist[]): Map<number, string[]> {
  const byId = new Map(playlists.map((p) => [p.id, p]));
  const paths = new Map<number, string[]>();
  const pathOf = (p: PdbPlaylist, seen = new Set<number>()): string[] => {
    const known = paths.get(p.id);
    if (known) {return known;}
    const parent = byId.get(p.parentId);
    const result = parent && !seen.has(p.id)
      ? [...pathOf(parent, seen.add(p.id)), p.name]
      : [p.name];
    paths.set(p.id, result);
    return result;
  };
  for (const p of playlists) {pathOf(p);}
  return paths;
}

/**
 * Which library playlists the stick is meant to carry. Without a sync list (a
 * stick made with Export) that is every playlist: the ones the stick evidently
 * carries are picked once the stick's playlists are matched to them.
 */
function playlistsToCheck(
  library: LibraryPlaylistRef[],
  syncList: SyncList | null,
): { checked: LibraryPlaylistRef[]; unknownIds: number } {
  const candidates = library.filter((p) => p.kind !== 'folder');
  if (!syncList) {return { checked: candidates, unknownIds: 0 };}
  const known = new Set(library.map((p) => p.id));
  const unknownIds = syncList.nodes.filter((n) => !known.has(n.id)).length;
  if (syncList.allPlaylists) {return { checked: candidates, unknownIds };}
  // A listed folder carries everything below it.
  const listed = new Set(syncList.nodes.map((n) => n.id));
  return {
    checked: candidates.filter((p) => listed.has(p.id) || p.ancestorIds.some((a) => listed.has(a))),
    unknownIds,
  };
}

/**
 * Which stick playlist is which library playlist: the same path first, then the
 * same name, but only when one stick playlist and one library playlist are left
 * with it — of two library playlists called Techno, the stick's one Techno could
 * be either, and a guess would report the other as missing from the stick.
 */
function matchStickPlaylists(
  library: LibraryPlaylistRef[],
  stickLists: PdbPlaylist[],
  stickPaths: Map<number, string[]>,
): Map<string, PdbPlaylist> {
  const claimed = new Set<number>();
  const stickFor = new Map<string, PdbPlaylist>();
  const byPath = new Map<string, PdbPlaylist[]>();
  for (const p of stickLists) {
    const k = pathKey(stickPaths.get(p.id)!);
    byPath.set(k, [...(byPath.get(k) ?? []), p]);
  }
  for (const lib of library) {
    const match = byPath.get(pathKey(lib.path))?.find((p) => !claimed.has(p.id));
    if (match) {claimed.add(match.id); stickFor.set(lib.id, match);}
  }
  const group = <T>(items: T[], name: (t: T) => string) => {
    const m = new Map<string, T[]>();
    for (const t of items) {m.set(name(t), [...(m.get(name(t)) ?? []), t]);}
    return m;
  };
  const freeStick = group(stickLists.filter((p) => !claimed.has(p.id)), (p) => fold(p.name));
  const freeLibrary = group(library.filter((p) => !stickFor.has(p.id)), (p) => fold(p.path[p.path.length - 1]));
  for (const [name, libs] of freeLibrary) {
    const sticks = freeStick.get(name) ?? [];
    if (libs.length === 1 && sticks.length === 1) {stickFor.set(libs[0].id, sticks[0]);}
  }
  return stickFor;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Why a library entry is not on the stick. Unplugged first: a file on an absent drive cannot be checked. */
async function reasonFor(
  location: string,
  deps: UsbCheckDeps,
): Promise<{ reason: NotOnStickReason; drive?: string }> {
  if (isStreamingLocation(location)) {return { reason: 'streaming' };}
  if (!location) {return { reason: 'missing' };}
  if (!deps.isVolumeMounted(location)) {return { reason: 'drive-unplugged', drive: deps.driveName(location) };}
  const state = await deps.fileState(location);
  return { reason: state === 'ok' ? 'not-synced-yet' : state };
}

/**
 * Pair a library playlist's entries with the stick's, as multisets: a track in
 * a playlist twice needs two entries on the stick. A stick track has no library
 * id, so the pairing is by file name (NFC, case-insensitive), then by title and
 * artist for a file rekordbox renamed on the way (FAT32 forbids some characters).
 */
function pairEntries(
  libraryTracks: Array<LibraryTrackRef | undefined>,
  stickTracks: PdbTrack[],
  artistOf: (t: PdbTrack) => string,
): { unmatched: number[]; extra: number } {
  const byFile = new Map<string, number[]>();
  const byTitle = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, i: number) => {
    const list = m.get(k);
    if (list) {list.push(i);} else {m.set(k, [i]);}
  };
  stickTracks.forEach((t, i) => {
    push(byFile, fold(t.fileName || baseName(t.filePath)), i);
    push(byTitle, titleKey(t.title, artistOf(t)), i);
  });
  const used = new Set<number>();
  const take = (list: number[] | undefined) => {
    const i = list?.find((n) => !used.has(n));
    if (i !== undefined) {used.add(i);}
    return i;
  };

  const unmatched: number[] = [];
  const second: number[] = [];
  libraryTracks.forEach((t, i) => {
    if (!t || take(byFile.get(fold(baseName(t.location)))) === undefined) {second.push(i);}
  });
  // Title and artist only after every file name had its chance, so a renamed
  // file cannot take the stick entry another entry matches exactly by name.
  for (const i of second) {
    const t = libraryTracks[i];
    if (!t || take(byTitle.get(titleKey(t.name, t.artist))) === undefined) {unmatched.push(i);}
  }
  return { unmatched, extra: stickTracks.length - used.size };
}

export async function checkUsb(input: UsbCheckInput, deps: UsbCheckDeps): Promise<UsbCheckResult> {
  const { stick, syncList } = input;
  const stickPaths = stickPlaylistPaths(stick.playlists);
  const stickLists = stick.playlists.filter((p) => !p.isFolder);
  const tracksById = new Map(stick.tracks.map((t) => [t.id, t]));
  const entriesByPlaylist = new Map<number, Array<{ index: number; track: PdbTrack }>>();
  for (const e of stick.entries) {
    const track = tracksById.get(e.trackId);
    if (!track) {continue;}
    const list = entriesByPlaylist.get(e.playlistId) ?? [];
    list.push({ index: e.entryIndex, track });
    entriesByPlaylist.set(e.playlistId, list);
  }
  const stickTracksOf = (id: number) =>
    (entriesByPlaylist.get(id) ?? []).sort((a, b) => a.index - b.index).map((e) => e.track);
  const artistOf = (t: PdbTrack) => stick.artists.get(t.artistId) ?? '';

  const toCheck = playlistsToCheck(input.playlists, syncList);
  const stickFor = matchStickPlaylists(toCheck.checked, stickLists, stickPaths);
  const { unknownIds } = toCheck;
  // Without a sync list, only what the stick evidently carries is checked.
  const checked = syncList ? toCheck.checked : toCheck.checked.filter((p) => stickFor.has(p.id));
  const claimed = new Set([...stickFor.values()].map((p) => p.id));

  const notChecked: UsbCheckResult['notChecked'] = [];
  const pending: Array<{ check: PlaylistCheck; missing: LibraryTrackRef[] }> = [];
  const missingOnStick: string[][] = [];
  for (const lib of checked) {
    const onStick = stickFor.get(lib.id);
    const stickTracks = onStick ? stickTracksOf(onStick.id) : [];
    if (lib.kind === 'smart') {
      notChecked.push({ id: lib.id, path: lib.path, stickCount: onStick ? stickTracks.length : null });
      continue;
    }
    if (!onStick) {missingOnStick.push(lib.path);}
    const libraryTracks = lib.trackIds.map((id) => input.tracks.get(id));
    const { unmatched, extra } = pairEntries(libraryTracks, stickTracks, artistOf);
    pending.push({
      check: {
        id: lib.id,
        path: lib.path,
        libraryCount: lib.trackIds.length,
        stickCount: stickTracks.length,
        onStick: Boolean(onStick),
        notOnStick: [],
        extraOnStick: extra,
      },
      // An entry whose track row is gone has nothing to sync; it is not counted.
      missing: unmatched.map((i) => libraryTracks[i]).filter((t): t is LibraryTrackRef => Boolean(t)),
    });
  }

  // One file check per file, however many playlists hold it.
  const locations = [...new Set(pending.flatMap((p) => p.missing.map((t) => t.location)))];
  const reasons = new Map<string, { reason: NotOnStickReason; drive?: string }>();
  const found = await mapLimit(locations, 32, (l) => reasonFor(l, deps));
  locations.forEach((l, i) => reasons.set(l, found[i]));

  const byReason = Object.fromEntries(notOnStickReasons.map((r) => [r, 0])) as Record<NotOnStickReason, number>;
  const drives = new Map<string, { entries: number; tracks: Set<string> }>();
  for (const { check, missing } of pending) {
    check.notOnStick = missing.map((t) => {
      const { reason, drive } = reasons.get(t.location)!;
      byReason[reason]++;
      if (drive !== undefined) {
        const d = drives.get(drive) ?? { entries: 0, tracks: new Set<string>() };
        d.entries++;
        d.tracks.add(t.id);
        drives.set(drive, d);
      }
      return {
        trackId: t.id, name: t.name, artist: t.artist, location: t.location, reason,
        ...(drive !== undefined ? { drive } : {}),
      };
    });
  }

  const playlists = pending.map((p) => p.check);
  return {
    playlists,
    totals: {
      byReason,
      byDrive: [...drives].map(([drive, d]) => ({ drive, entries: d.entries, tracks: d.tracks.size }))
        .sort((a, b) => b.entries - a.entries),
      // A playlist the stick lacks altogether is counted in missingOnStick, not here.
      emptyOnStick: playlists.filter((p) => p.onStick && p.libraryCount > 0 && p.stickCount === 0).length,
    },
    leftovers: stickLists
      .filter((p) => !claimed.has(p.id))
      .map((p) => ({ path: stickPaths.get(p.id)!, stickCount: (entriesByPlaylist.get(p.id) ?? []).length })),
    missingOnStick,
    notChecked,
    stick: { tracks: stick.tracks.length, playlists: stickLists.length, unreadableRows: stick.unreadableRows },
    syncList: { present: syncList !== null, allPlaylists: syncList?.allPlaylists ?? false, unknownIds },
  };
}
