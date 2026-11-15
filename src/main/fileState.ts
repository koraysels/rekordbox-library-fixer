import * as fs from 'fs';

/**
 * Whether a failed file check means the file is gone. Only "no such file" and
 * "a folder on the way is a file" do. Anything else — macOS refusing access to
 * ~/Downloads or a removable drive (EPERM), a permission bit (EACCES), a drive
 * that errors — means the app cannot tell, and a file it cannot tell about is
 * not a lost file.
 */
export function isGoneError(e: unknown): boolean {
  const code = (e as NodeJS.ErrnoException | undefined)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/** The error code of a check that failed for any reason but "not there", or `'unknown'` without one. */
export function errorCode(e: unknown): string {
  return (e as NodeJS.ErrnoException | undefined)?.code ?? 'unknown';
}

/** Is the file at `p` known to be gone? False when it is there, and false when the app cannot tell. */
export function isGoneSync(p: string): boolean {
  try {
    fs.statSync(p);
    return false;
  } catch (e) {
    return isGoneError(e);
  }
}
