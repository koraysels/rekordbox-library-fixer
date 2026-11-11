// Bundles the rekordbox database key into the build, or makes sure none is.
//
// The key comes from REKORDBOX_DB_KEY in the environment, else from a line in
// the gitignored `.env` at the repository root (CI writes that file from a
// secret). A key of the right shape is written to dist/main/bundled-key.json;
// anything else removes that file, so a build without a key never ships a
// stale one. Only "bundled key: yes" or "bundled key: no" is printed — never
// the key.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHAPE = /^[0-9a-f]{64}$/i;
const NAME = 'REKORDBOX_DB_KEY';

function keyFromDotEnv(rootDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(rootDir, '.env'), 'utf8');
  } catch {
    return '';
  }
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || match[1] !== NAME) { continue; }
    return match[2].trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  }
  return '';
}

/** Returns true when a key was bundled. */
export function writeBundledKey(rootDir, env) {
  const fromEnv = (env[NAME] ?? '').trim();
  const key = fromEnv || keyFromDotEnv(rootDir);
  const file = path.join(rootDir, 'dist', 'main', 'bundled-key.json');
  if (SHAPE.test(key)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ key }), { mode: 0o600 });
    return true;
  }
  fs.rmSync(file, { force: true });
  return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(`bundled key: ${writeBundledKey(rootDir, process.env) ? 'yes' : 'no'}`);
}
