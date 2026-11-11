import * as fs from 'fs';
import * as path from 'path';
import { Track } from './rekordboxParser';
import { referenceKey } from './convert/applyConversions';
import { resolveClash } from './wizard/gatherPlan';
import { fileIdentity, sameContent } from './wizard/sameContent';
import { realIsRegularFile } from './rekordboxDbRelocator';
import { isStreamingLocation } from './streamingLocation';

export interface ConsolidateOptions {
  destination: string;
  mode: 'copy' | 'move';
  /** Accepted from older callers; there is no quality choice any more, since nothing is overwritten. */
  preferLossless?: boolean;
}

/** The file operations consolidating makes, injectable so a test can fail one. */
export interface ConsolidateFs {
  /** Anything at the path, a dangling symlink included. */
  exists: (p: string) => boolean;
  isRegularFile: (p: string) => boolean;
  mkdir: (dir: string) => Promise<void>;
  /** Called with `COPYFILE_EXCL`: a copy never replaces a file. */
  copyFile: (from: string, to: string, mode: number) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  unlink: (p: string) => Promise<void>;
  size: (p: string) => number;
  sameContent: (a: string, b: string) => Promise<boolean>;
  /** Which physical file a path names, so one file under two paths is not taken for its own copy. */
  fileId: (p: string) => string | undefined;
}

const realFs: ConsolidateFs = {
  exists: (p) => { try { fs.lstatSync(p); return true; } catch { return false; } },
  isRegularFile: realIsRegularFile,
  mkdir: async (dir) => { await fs.promises.mkdir(dir, { recursive: true }); },
  copyFile: (from, to, mode) => fs.promises.copyFile(from, to, mode),
  rename: (from, to) => fs.promises.rename(from, to),
  unlink: (p) => fs.promises.unlink(p),
  size: (p) => fs.statSync(p).size,
  sameContent: (a, b) => sameContent(a, b),
  fileId: fileIdentity,
};

/**
 * A file put in place by a run. `moved` was renamed (the original is gone),
 * `copied` is a new file beside the original, `reused` was already there,
 * identical. `removeOriginal` marks an original a move still has to delete —
 * only once the library points at the new place.
 */
export interface PlacedFile {
  from: string;
  to: string;
  kind: 'moved' | 'copied' | 'reused';
  removeOriginal: boolean;
  /**
   * Which physical file `from` was before the run, so an entry spelling it
   * another way (an aliased folder, `/Volumes/Macintosh HD/…`) can follow it.
   */
  fileId?: string;
}

export interface ConsolidateProgress {
  current: number;
  total: number;
  currentFile: string;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface ConsolidateResult {
  succeeded: number;
  skipped: number;
  failed: number;
  errors: { file: string; error: string }[];
  locationUpdates: Record<string, string>; // old path → new path
  /** What was put where, so a failed library write can be undone. */
  placed: PlacedFile[];
}

export interface ConsolidatePreview {
  total: number;
  conflicts: number;
  missing: number;
  totalSizeBytes: number;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Gather a library under one destination, keeping its folder layout below the
 * tracks' common root.
 *
 * Never overwrites: a destination already holding the same bytes is reused, a
 * different file there gets ` (2)`, ` (3)`… — the wizard's gather rule
 * (`resolveClash`). Files only: a location that names a folder is left alone.
 * A move deletes an original it had to copy only after the library points at
 * the copy (`removeOriginals`), and `putBack` undoes a run whose library write
 * failed.
 */
export class LibraryConsolidator {
  private readonly io: ConsolidateFs;

  constructor(fsOps: Partial<ConsolidateFs> = {}) {
    this.io = { ...realFs, ...fsOps };
  }

  private findCommonRoot(all: string[]): string {
    // A streaming track's made-up location has no folder; it would pull the root up to nothing.
    const locations = all.filter(loc => !isStreamingLocation(loc));
    if (locations.length === 0) {return path.sep;}
    const parts = locations.map(loc => path.dirname(loc).split(path.sep));
    const first = parts[0];
    const common: string[] = [];
    for (let i = 0; i < first.length; i++) {
      if (parts.every(p => p[i] === first[i])) {
        common.push(first[i]);
      } else {break;}
    }
    const result = common.join(path.sep);
    return result || path.sep;
  }

  destPath(srcLocation: string, commonRoot: string, destination: string): string {
    const relative = path.normalize(path.relative(commonRoot, srcLocation));
    if (path.isAbsolute(relative) || relative.startsWith('..')) {
      throw new Error(
        `Track "${srcLocation}" falls outside common root "${commonRoot}" and cannot be consolidated safely`
      );
    }
    return path.join(destination, relative);
  }

  preview(tracks: Track[], destination: string): ConsolidatePreview {
    const locations = tracks.map(t => t.location).filter(Boolean) as string[];
    const commonRoot = this.findCommonRoot(locations);

    let conflicts = 0;
    let missing = 0;
    let totalSizeBytes = 0;

    for (const track of tracks) {
      if (!track.location) {continue;}
      if (!fs.existsSync(track.location)) { missing++; continue; }
      if (track.size) {totalSizeBytes += track.size;}
      const dest = this.destPath(track.location, commonRoot, destination);
      if (fs.existsSync(dest) && path.resolve(track.location) !== path.resolve(dest)) {
        conflicts++;
      }
    }

    return { total: locations.length, conflicts, missing, totalSizeBytes };
  }

  async consolidate(
    tracks: Track[],
    options: ConsolidateOptions,
    onProgress: (p: ConsolidateProgress) => void,
    cancelToken: { cancelled: boolean }
  ): Promise<ConsolidateResult> {
    const io = this.io;
    const locations = tracks.map(t => t.location).filter(Boolean) as string[];
    const commonRoot = this.findCommonRoot(locations);
    const result: ConsolidateResult = {
      succeeded: 0, skipped: 0, failed: 0,
      errors: [], locationUpdates: {}, placed: [],
    };

    const eligible = tracks.filter(t => t.location);
    const total = eligible.length;
    let current = 0;
    // Entries sharing one file: the file goes once, and every entry follows it.
    // Keyed by the physical file where there is one, so two spellings of it —
    // an aliased folder, `/Volumes/Macintosh HD/…` beside `/…` — count as one.
    // Taken before anything moves: once the file is renamed, the second
    // spelling no longer leads anywhere and could not be identified.
    const ids = new Map<string, string | undefined>();
    for (const t of eligible) {
      const loc = t.location as string;
      if (!ids.has(loc)) {ids.set(loc, io.fileId(loc));}
    }
    const fileKey = (loc: string) => {
      const id = ids.get(loc);
      return id !== undefined ? `file:${id}` : `path:${referenceKey(loc)}`;
    };
    const done = new Map<string, string>();
    // Destinations handed out this run, so two sources never get one name.
    const taken = new Set<string>();

    for (const track of eligible) {
      if (cancelToken.cancelled) {break;}

      current++;
      const src = track.location as string;

      onProgress({
        current, total,
        currentFile: path.basename(src),
        succeeded: result.succeeded,
        skipped: result.skipped,
        failed: result.failed,
      });

      try {
        const id = ids.get(src);
        const key = fileKey(src);
        const already = done.get(key);
        if (already !== undefined) {
          result.skipped++;
          if (referenceKey(already) !== referenceKey(src)) {result.locationUpdates[src] = already;}
          continue;
        }

        // Missing, or a folder (rekordbox has entries whose location is one):
        // moving a folder would carry a whole folder of music with it.
        if (!io.isRegularFile(src)) {
          result.skipped++;
          continue;
        }

        const dest = this.destPath(src, commonRoot, options.destination);
        if (referenceKey(src) === referenceKey(dest)) {
          result.skipped++;
          done.set(key, src);
          continue;
        }

        const { to, reuseExisting } = await resolveClash(dest, src, taken, io);
        taken.add(referenceKey(to));

        if (reuseExisting && id !== undefined && id === io.fileId(to)) {
          // The "identical file" is the source itself, reached through a link or an
          // aliased folder: it is already in place, and a move must not delete it.
          result.skipped++;
          done.set(key, src);
          continue;
        }

        if (reuseExisting) {
          result.skipped++;
          result.locationUpdates[src] = to;
          result.placed.push({ from: src, to, kind: 'reused', removeOriginal: options.mode === 'move', fileId: id });
          done.set(key, to);
          continue;
        }

        await io.mkdir(path.dirname(to));
        const kind = await this.place(src, to, options.mode);
        result.placed.push({ from: src, to, kind, removeOriginal: options.mode === 'move' && kind === 'copied', fileId: id });
        result.succeeded++;
        result.locationUpdates[src] = to;
        done.set(key, to);
      } catch (err) {
        result.failed++;
        result.errors.push({ file: src, error: errorText(err) });
      }
    }

    return result;
  }

  /** Put one file in place, never over another. Copy mode copies; move renames, or copies across drives. */
  private async place(src: string, to: string, mode: ConsolidateOptions['mode']): Promise<'moved' | 'copied'> {
    const io = this.io;
    // Checked again right before: something may have appeared since the name was chosen.
    if (io.exists(to)) {throw new Error(`Something is already at ${to}; it was left alone`);}
    if (mode === 'move') {
      try {
        await io.rename(src, to);
        return 'moved';
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EXDEV') {throw e;}
      }
    }
    try {
      await io.copyFile(src, to, fs.constants.COPYFILE_EXCL);
    } catch (e) {
      // EEXIST: a file that is not ours. Anything else may have left a partial copy of ours.
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {await io.unlink(to).catch(() => undefined);}
      throw e;
    }
    const want = io.size(src);
    const got = io.size(to);
    if (got !== want) {
      await io.unlink(to).catch(() => undefined);
      throw new Error(`The copy is ${got} bytes but the original is ${want}`);
    }
    return 'copied';
  }

  /**
   * Undo a run whose library write failed, newest first: renames go back, copies
   * are deleted while their original is still there. A reused file was there
   * before and is never touched. Returns what could not be put back.
   */
  async putBack(placed: PlacedFile[]): Promise<{ file: string; error: string }[]> {
    const io = this.io;
    const stuck: { file: string; error: string }[] = [];
    for (const p of [...placed].reverse()) {
      try {
        if (p.kind === 'moved') {
          if (io.exists(p.from)) {throw new Error(`something is now at ${p.from}`);}
          await io.rename(p.to, p.from);
        } else if (p.kind === 'copied') {
          if (!io.exists(p.from)) {throw new Error(`the original at ${p.from} is gone, so the copy was kept`);}
          await io.unlink(p.to);
        }
      } catch (e) {
        stuck.push({ file: p.to, error: `Could not be put back: ${errorText(e)}` });
      }
    }
    return stuck;
  }

  /** Delete originals a move copied or reused. Only call after the library points at the new place. */
  async removeOriginals(paths: string[]): Promise<{ file: string; error: string }[]> {
    const failures: { file: string; error: string }[] = [];
    for (const p of paths) {
      try { await this.io.unlink(p); } catch (e) { failures.push({ file: p, error: errorText(e) }); }
    }
    return failures;
  }

  isRegularFile(p: string): boolean {
    return this.io.isRegularFile(p);
  }

  /** Which physical file a path names, or `undefined` when it names none. */
  fileId(p: string): string | undefined {
    return this.io.fileId(p);
  }
}
