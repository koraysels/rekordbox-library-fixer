import * as fs from 'fs';
import * as path from 'path';

const FILE = 'rekordbox-key.json';
const SHAPE = /^[0-9a-f]{64}$/i;

/**
 * A second home for the pasted database key, in the app's data folder.
 *
 * The settings store keeps it in browser storage, which can come back empty
 * (storage cleared, a profile reset) — and then the load screen asked for the
 * key again. This copy lives outside that storage and refills it.
 */
export function readSavedDbKey(dir: string): string {
  try {
    const { key } = JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8'));
    return typeof key === 'string' && SHAPE.test(key) ? key : '';
  } catch {
    return '';
  }
}

/** Only a key of the right shape is kept; anything else would only fail later. */
export function writeSavedDbKey(dir: string, key: string): boolean {
  const trimmed = key.trim();
  if (!SHAPE.test(trimmed)) { return false; }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, FILE), JSON.stringify({ key: trimmed }), { mode: 0o600 });
  return true;
}
