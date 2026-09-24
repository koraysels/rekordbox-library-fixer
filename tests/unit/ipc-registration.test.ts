import { describe, it, expect, vi } from 'vitest';
vi.unmock('fs');

import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const ipcDir = path.join(root, 'src/main/ipc');
const handlerSources = fs.readdirSync(ipcDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => read(`src/main/ipc/${f}`));
const allHandlerCode = [...handlerSources, read('src/main/main.ts')].join('\n');

const namesFrom = (code: string, pattern: RegExp) =>
  [...code.matchAll(pattern)].map((m) => m[1]);

const registered = namesFrom(allHandlerCode, /ipcMain\.handle\(\s*'([^']+)'/g);
const invoked = namesFrom(read('src/main/preload.ts'), /ipcRenderer\.invoke\('([^']+)'/g);

/**
 * The handlers live in per-domain modules now. Nothing at compile time says a
 * channel the preload calls is actually registered, and a missing one only
 * shows up as a button that quietly does nothing — so it is checked here.
 */
describe('IPC registration', () => {
  it('registers every channel the preload invokes', () => {
    const missing = [...new Set(invoked)].filter((name) => !registered.includes(name));
    expect(missing).toEqual([]);
  });

  it('registers each channel exactly once', () => {
    // Registering twice throws at runtime and takes the whole app down.
    const seen = new Set<string>();
    const twice = registered.filter((name) => (seen.has(name) ? true : (seen.add(name), false)));
    expect(twice).toEqual([]);
  });

  it('keeps the handlers out of main.ts', () => {
    // main.ts owns the window, the menu and the app lifecycle; it grew to 1800
    // lines by owning every handler too.
    expect(namesFrom(read('src/main/main.ts'), /ipcMain\.handle\(\s*'([^']+)'/g)).toEqual([]);
  });

  it('registers every module that defines handlers', () => {
    const main = read('src/main/main.ts');
    for (const file of fs.readdirSync(ipcDir).filter((f) => f.endsWith('.ts'))) {
      const code = read(`src/main/ipc/${file}`);
      const fn = code.match(/export function (register\w+)\(/)?.[1];
      expect(fn, `${file} exports no register function`).toBeTruthy();
      expect(main, `${fn} is never called`).toContain(`${fn}()`);
    }
  });
});
