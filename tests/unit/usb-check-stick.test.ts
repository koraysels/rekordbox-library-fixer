import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('fs');

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readStick, realUsbCheckDeps } from '../../src/main/usb/checkStick';
import { buildExport } from './helpers/pdbBuilder';

let root: string;
let rb: string;

const listing = (dir: string) =>
  fs.readdirSync(dir).map((f) => {
    const s = fs.statSync(path.join(dir, f));
    return `${f}:${s.size}:${s.mtimeMs}`;
  }).sort();

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'stick-'));
  rb = path.join(root, 'PIONEER', 'rekordbox');
  fs.mkdirSync(rb, { recursive: true });
  fs.writeFileSync(path.join(rb, 'export.pdb'), buildExport({
    artists: [], tracks: [{ id: 1, title: 'T', filePath: '/Contents/t.mp3' }],
    playlists: [{ id: 2, name: 'Gig' }], entries: [{ playlistId: 2, trackId: 1 }],
  }));
});
afterEach(() => {
  fs.chmodSync(root, 0o755);
  fs.rmSync(root, { recursive: true, force: true });
});

describe('readStick', () => {
  it('reads the export and the sync list, leaving the stick as it was', async () => {
    fs.writeFileSync(path.join(rb, 'playlists3.sync'),
      '<?xml version="1.0"?>\r\n<Sync AllPlaylists="0"><Playlists><NODE Id="B" ParentId="0" Attribute="0"/></Playlists></Sync>');
    const before = listing(rb);
    const { pdb, syncList } = await readStick(root);
    expect(pdb.playlists.map((p) => p.name)).toEqual(['Gig']);
    expect(pdb.entries).toHaveLength(1);
    expect(syncList?.nodes).toEqual([{ id: '11', parentId: '0', attribute: 0 }]);
    expect(listing(rb)).toEqual(before);
  });

  it('reads a stick made with Export, which has no sync list', async () => {
    expect((await readStick(root)).syncList).toBeNull();
  });

  it('fails plainly when the stick has no export', async () => {
    fs.rmSync(path.join(rb, 'export.pdb'));
    await expect(readStick(root)).rejects.toThrow(/ENOENT/);
  });
});

describe('realUsbCheckDeps', () => {
  it('tells a file that is gone from one the app may not read', async () => {
    const deps = realUsbCheckDeps('linux');
    const file = path.join(root, 'here.mp3');
    fs.writeFileSync(file, '');
    expect(await deps.fileState(file)).toBe('ok');
    expect(await deps.fileState(path.join(root, 'gone.mp3'))).toBe('missing');
    expect(await deps.fileState(path.join(file, 'below a file.mp3'))).toBe('missing');
    if (process.getuid?.() !== 0) {
      const locked = path.join(root, 'locked');
      fs.mkdirSync(locked);
      fs.writeFileSync(path.join(locked, 'a.mp3'), '');
      fs.chmodSync(locked, 0o000);
      try {
        expect(await deps.fileState(path.join(locked, 'a.mp3'))).toBe('no-access');
      } finally {
        fs.chmodSync(locked, 0o755);
      }
    }
  });
});
