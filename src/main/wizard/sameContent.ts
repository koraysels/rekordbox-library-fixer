import * as fs from 'fs';
import type { FileHandle } from 'fs/promises';

/** How much of each file is held in memory at once. */
export const CHUNK_BYTES = 1024 * 1024;

/** The two calls `sameContent` makes, so a test can see which ones it made. */
export interface ContentIo {
  stat: (p: string) => Promise<{ isFile(): boolean; size: number }>;
  open: (p: string, flags: string) => Promise<FileHandle>;
}

const realIo: ContentIo = {
  stat: (p) => fs.promises.stat(p),
  open: (p, flags) => fs.promises.open(p, flags),
};

/**
 * Whether two paths hold byte-for-byte the same file.
 *
 * False unless both are regular files of equal size; only then are they read,
 * one chunk of each at a time, stopping at the first difference. A whole file is
 * never loaded: a WAV can be gigabytes. Anything that cannot be read counts as
 * "not the same" — this decides whether a file may go to the Trash.
 */
export async function sameContent(a: string, b: string, io: ContentIo = realIo): Promise<boolean> {
  let sizeA: number;
  try {
    const [statA, statB] = await Promise.all([io.stat(a), io.stat(b)]);
    if (!statA.isFile() || !statB.isFile() || statA.size !== statB.size) {return false;}
    sizeA = statA.size;
  } catch {
    return false;
  }

  let fa: FileHandle | undefined;
  let fb: FileHandle | undefined;
  try {
    fa = await io.open(a, 'r');
    fb = await io.open(b, 'r');
    const bufA = Buffer.alloc(Math.min(CHUNK_BYTES, Math.max(sizeA, 1)));
    const bufB = Buffer.alloc(bufA.length);
    let position = 0;
    for (;;) {
      const [ra, rb] = await Promise.all([
        fa.read(bufA, 0, bufA.length, position),
        fb.read(bufB, 0, bufB.length, position),
      ]);
      if (ra.bytesRead !== rb.bytesRead) {return false;}
      if (ra.bytesRead === 0) {return position === sizeA;}
      if (!bufA.subarray(0, ra.bytesRead).equals(bufB.subarray(0, rb.bytesRead))) {return false;}
      position += ra.bytesRead;
    }
  } catch {
    return false;
  } finally {
    await fa?.close().catch(() => undefined);
    await fb?.close().catch(() => undefined);
  }
}

/**
 * Which physical file a path names, as `dev:ino`, following symlinks — or
 * undefined when that cannot be told (missing, unreadable, or a filesystem that
 * reports no inode). Two different spellings of one file — a symlinked folder, a
 * firmlink, macOS's `/Volumes/Macintosh HD` alias of `/` — compare equal here
 * when they never would as path strings. Inodes are read as bigints: NTFS and
 * ReFS file ids do not fit a double.
 */
export function fileIdentity(p: string): string | undefined {
  try {
    const st = fs.statSync(p, { bigint: true });
    if (!st.isFile() || st.ino === 0n) {return undefined;}
    return `${st.dev}:${st.ino}`;
  } catch {
    return undefined;
  }
}
