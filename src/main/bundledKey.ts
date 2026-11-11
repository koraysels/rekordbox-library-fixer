import * as path from 'path';
import { readKeyFile } from './savedDbKey';

/**
 * The database key that ships with a release build.
 *
 * `scripts/write-bundled-key.mjs` writes `bundled-key.json` next to the
 * compiled main process at build time, from a gitignored `.env` locally or a
 * GitHub Actions secret in CI. It is never committed. A build without it still
 * works: the key comes back empty and the load screen asks for one, as it also
 * does when a rekordbox update changes the key.
 */
export const BUNDLED_KEY_FILE = 'bundled-key.json';

/** Where the compiled main process lives: `dist/main`, where the build script puts the file. */
export const BUNDLED_KEY_DIR = __dirname;

export function readBundledKey(dir: string): string {
  return readKeyFile(path.join(dir, BUNDLED_KEY_FILE));
}
