/**
 * The conversion run, apart from Electron and React: find what the player cannot
 * play, plan the outputs, and run them — convert, verify, switch the library
 * entries in one write, then (only if asked, only for a database library) move
 * the originals to the Trash. The IPC module wires it to the window; a headless
 * caller passes its own `emit` and `signal`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { isStreamingLocation } from '../streamingLocation';
import { isRekordboxDatabasePath } from '../librarySource';
import { RekordboxParser, type RekordboxLibrary } from '../rekordboxParser';
import type {
  ConvertCandidate, ConvertPreviewItem, ConvertProgress, ConvertRunOptions, ConvertRunResult,
  PlayerProfileId, TrackPayload,
} from '../ipcContract';
import { PLAYER_PROFILES, whyUnplayable, formatFromLibrary, type AudioFacts } from './playerProfiles';
import {
  groupBySharedFile, outputFacts, outputPath, outputReadiness, type TargetFormat,
} from './conversionPlan';
import { factsFromLibrary, isReadable, readFileFacts } from './audioFacts';
import { convertFile } from './convertFile';
import { switchEntriesInDb, switchEntriesInXml, referenceKey, type EntrySwitch, type SwitchSkip, type RemainingReferences } from './applyConversions';

type ReadFacts = typeof readFileFacts;
const nfcKey = (p: string) => p.normalize('NFC').toLowerCase();

/**
 * Every file in the library the player cannot play, one candidate per file. The
 * file is read only when the library does not know its format, depth or rate;
 * otherwise it is only checked to be there, so a missing file shows up as
 * unreachable instead of disappearing from the preview later. A file that is
 * there but cannot be parsed is unreadable — a different fix than relocating.
 */
export async function findUnplayable(
  library: { tracks: Map<string, TrackPayload> },
  profileId: PlayerProfileId,
  readFacts: ReadFacts = readFileFacts,
  exists: (p: string) => boolean = fs.existsSync,
): Promise<ConvertCandidate[]> {
  const profile = PLAYER_PROFILES[profileId];
  const tracks = [...library.tracks.values()].filter(t => t.location && !isStreamingLocation(t.location));
  const candidates: ConvertCandidate[] = [];

  for (const group of groupBySharedFile(tracks).values()) {
    const first = group[0];
    const known = factsFromLibrary(first as Parameters<typeof factsFromLibrary>[0]);
    let facts: ConvertCandidate['facts'] = known;
    let unreachable = false;
    let unreadable = false;

    if (!known || !known.sampleRate) {
      const read = await readFacts(first.location);
      if (isReadable(read) && read.sampleRate) {facts = read;}
      else if ('unreachable' in read) {unreachable = true;}
      else {unreadable = true;}
    } else if (whyUnplayable(known, profile).length > 0 && !exists(first.location)) {
      unreachable = true;
    }

    let reasons;
    if (unreachable || unreadable) {
      // Say what the library alone can tell; the file itself could not be asked.
      const format = formatFromLibrary(first as Parameters<typeof formatFromLibrary>[0]);
      const partial: AudioFacts | null = known ?? (format === 'unknown' ? null : { format });
      reasons = partial ? whyUnplayable(partial, profile) : [];
    } else {
      reasons = whyUnplayable(facts as AudioFacts, profile);
      if (reasons.length === 0) {continue;}
    }

    candidates.push({
      trackIds: group.map(t => t.id),
      location: first.location,
      name: first.name,
      artist: first.artist,
      reasons,
      facts,
      ...(unreachable ? { unreachable: true as const } : {}),
      ...(unreadable ? { unreadable: true as const } : {}),
    });
  }
  return candidates;
}

export interface PreviewIo {
  readFacts?: ReadFacts;
  exists?: (p: string) => boolean;
}

/**
 * What each convertible candidate becomes, and whether a file already at that
 * path can be reused or is in the way. Two candidates planned onto one output
 * path: the second is a conflict.
 */
export async function previewConversion(
  candidates: ConvertCandidate[],
  profileId: PlayerProfileId,
  target: TargetFormat,
  io: PreviewIo = {},
): Promise<ConvertPreviewItem[]> {
  const readFacts = io.readFacts ?? readFileFacts;
  const exists = io.exists ?? fs.existsSync;
  const profile = PLAYER_PROFILES[profileId];
  const planned = new Set<string>();
  const items: ConvertPreviewItem[] = [];

  for (const c of candidates) {
    if (c.unreachable || c.unreadable || !c.facts) {continue;}
    let source = c.facts;
    if (!source.sampleRate || source.durationSec === undefined) {
      const read = await readFacts(c.location);
      if (!isReadable(read) || !read.sampleRate) {continue;}
      source = read;
    }
    const src = source as AudioFacts & { sampleRate: number; durationSec: number };
    const out = outputFacts(src, profile, target);
    const to = outputPath(c.location, src, out);

    let readiness;
    if (planned.has(nfcKey(to))) {
      readiness = 'conflict' as const;
    } else if (!exists(to)) {
      readiness = 'new' as const;
    } else {
      const existing = await readFacts(to);
      readiness = outputReadiness(
        { exists: true, facts: isReadable(existing) ? existing : undefined }, out, src.durationSec,
      );
    }
    planned.add(nfcKey(to));
    items.push({ trackIds: c.trackIds, from: c.location, to, readiness, out });
  }
  return items;
}

export interface RunDeps {
  ffmpeg: string;
  emit: (p: ConvertProgress) => void;
  signal: AbortSignal;
  operationId?: string;
  convert?: typeof convertFile;
  switchDb?: typeof switchEntriesInDb;
  switchXml?: typeof switchEntriesInXml;
  /** Move a file to the OS trash. Required to trash anything; without it nothing is trashed. */
  trash?: (p: string) => Promise<void>;
  readFacts?: ReadFacts;
  fileSize?: (p: string) => Promise<number>;
  loadXmlLibrary?: (xmlPath: string) => Promise<RekordboxLibrary>;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Converts the items one at a time and writes every verified output into the
 * library in one go — also after a cancel, so finished work is not thrown away.
 * A file whose conversion fails never reaches the library. Originals are trashed
 * only after that write succeeded, only for entries it actually switched, and
 * never for an XML library.
 */
export async function runConversion(opts: ConvertRunOptions, deps: RunDeps): Promise<ConvertRunResult> {
  const convert = deps.convert ?? convertFile;
  const switchDb = deps.switchDb ?? switchEntriesInDb;
  const switchXml = deps.switchXml ?? switchEntriesInXml;
  const readFacts = deps.readFacts ?? readFileFacts;
  const fileSize = deps.fileSize ?? (async (p: string) => (await fs.promises.stat(p)).size);
  const loadXml = deps.loadXmlLibrary ?? ((p: string) => new RekordboxParser().parseLibrary(p));
  const operationId = deps.operationId ?? `convert-${Date.now()}`;

  const isDb = isRekordboxDatabasePath(opts.libraryPath);
  const trashOriginals = opts.trashOriginals && isDb;
  const total = opts.items.length;
  const result: ConvertRunResult = {
    switched: 0, switchedItems: [], failed: [], conflicts: [], trashed: 0, cancelled: false,
  };
  const done: { item: ConvertPreviewItem; sizeBytes: number }[] = [];
  let current = 0;

  const emit = (type: ConvertProgress['type'], message: string, name?: string) => deps.emit({
    operationId, type, current, total, message, convertedCount: done.length, failedCount: result.failed.length,
    ...(name !== undefined ? { name } : {}),
  });
  const fail = (item: ConvertPreviewItem, error: string, name: string) => {
    result.failed.push({ from: item.from, error });
    emit('failed', `Could not convert ${name}: ${error}`, name);
  };

  emit('start', `Converting ${total} file${total === 1 ? '' : 's'}…`);

  for (const item of opts.items) {
    if (deps.signal.aborted) {break;}
    current++;
    const name = path.basename(item.from);

    if (item.readiness === 'conflict') {
      result.conflicts.push(item.from);
      continue;
    }
    if (nfcKey(item.to) === nfcKey(item.from)) {
      fail(item, 'The output would be the same file as the original', name);
      continue;
    }

    try {
      const source = await readFacts(item.from);
      if (!isReadable(source)) {
        fail(item, 'unreachable' in source ? 'file not reachable' : "couldn't read the file", name);
        continue;
      }

      if (item.readiness === 'reusable') {
        // Check again: the file may have changed since the preview.
        const existing = await readFacts(item.to);
        const still = outputReadiness(
          { exists: isReadable(existing), facts: isReadable(existing) ? existing : undefined },
          item.out, source.durationSec,
        );
        if (still !== 'reusable') { fail(item, 'The existing converted file no longer matches', name); continue; }
        done.push({ item, sizeBytes: await fileSize(item.to) });
        emit('converted', `Reusing ${path.basename(item.to)}`, name);
        continue;
      }

      emit('converting', `Converting ${name}`, name);
      const res = await convert(deps.ffmpeg, { input: item.from, output: item.to, out: item.out, source }, deps.signal);
      if (res.ok) {
        done.push({ item, sizeBytes: res.sizeBytes });
        emit('converted', `Converted ${name}`, name);
      } else if (deps.signal.aborted) {
        break; // in flight when cancelled: its partial file is gone, it is not a failure
      } else {
        fail(item, res.error, name);
      }
    } catch (e) {
      fail(item, errorText(e), name);
    }
  }
  result.cancelled = deps.signal.aborted;

  const switches: EntrySwitch[] = done.flatMap(({ item, sizeBytes }) => item.trackIds.map(trackId => ({
    trackId, oldLocation: item.from, newLocation: item.to, target: opts.target, sizeBytes, out: item.out,
  })));

  if (switches.length > 0) {
    emit('writing', `Writing ${switches.length} entr${switches.length === 1 ? 'y' : 'ies'} into your library…`);
    let skipped: SwitchSkip[];
    let remaining: RemainingReferences;
    try {
      if (isDb) {
        if (!opts.dbKey) {
          throw new Error('The rekordbox database needs its key before it can be changed — paste it on the Library screen.');
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outcome = switchDb(opts.libraryPath, opts.dbKey, switches, { backupPath: `${opts.libraryPath}.backup.${stamp}` });
        result.switched = outcome.switched;
        result.backupPath = outcome.backupPath;
        skipped = outcome.skipped;
        remaining = outcome.remaining;
      } else {
        const library = await loadXml(opts.libraryPath);
        const outcome = await switchXml(opts.libraryPath, library, switches);
        result.switched = outcome.switched;
        result.backupPath = outcome.backupPath;
        skipped = outcome.skipped;
        remaining = outcome.remaining;
      }
    } catch (e) {
      result.error = errorText(e);
      result.switched = 0;
      emit('error', `The library was not changed: ${result.error}. The converted files are kept.`);
      return result;
    }
    if (skipped.length) {result.skipped = skipped;}
    const skippedIds = new Set(skipped.map(s => s.trackId));
    result.switchedItems = done
      .map(({ item }) => ({ trackIds: item.trackIds.filter(id => !skippedIds.has(id)), from: item.from, to: item.to }))
      .filter(i => i.trackIds.length > 0);

    if (trashOriginals && deps.trash) {
      const notSwitched = new Set(skipped.map(s => s.trackId));
      for (const { item } of done) {
        if (item.trackIds.some(id => notSwitched.has(id))) {continue;}
        // Counted inside the write: an entry the list did not know about (a re-import,
        // a track relocated onto this file) keeps the original out of the Trash.
        const left = remaining[referenceKey(item.from)];
        if (left !== 0) {
          (result.notTrashed ??= []).push({
            from: item.from,
            error: left === undefined
              ? 'Kept: the library write did not confirm nothing else uses it'
              : `Kept: ${left} other ${left === 1 ? 'entry' : 'entries'} in your library still uses it`,
          });
          continue;
        }
        try {
          await deps.trash(item.from);
          result.trashed++;
        } catch (e) {
          (result.notTrashed ??= []).push({ from: item.from, error: errorText(e) });
        }
      }
    }
  }

  current = result.cancelled ? current : total;
  emit(
    result.cancelled ? 'cancelled' : 'complete',
    `${result.cancelled ? 'Cancelled' : 'Done'}: ${done.length} converted, ${result.failed.length} failed, ${result.switched} entries switched`,
  );
  return result;
}
