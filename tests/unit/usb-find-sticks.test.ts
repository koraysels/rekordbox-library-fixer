import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('fs');

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findSticks, stickAt, volumeRoots, type VolumeBases } from '../../src/main/usb/findSticks';

let root: string;
let bases: VolumeBases;

function makeVolume(dir: string, files: string[] = []): string {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    const p = path.join(dir, 'PIONEER', 'rekordbox', f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '');
  }
  return dir;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticks-'));
  bases = { volumes: path.join(root, 'Volumes'), media: path.join(root, 'media'), runMedia: path.join(root, 'run', 'media') };
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('findSticks', () => {
  it('finds the macOS volumes that carry export.pdb, and what else they carry', async () => {
    makeVolume(path.join(bases.volumes, 'MYSTICK'), ['export.pdb', 'exportLibrary.db', 'playlists3.sync']);
    makeVolume(path.join(bases.volumes, 'EXPORTED'), ['export.pdb']);
    makeVolume(path.join(bases.volumes, 'DJ SSD'));
    const sticks = await findSticks('darwin', bases, () => true);
    expect(sticks.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { root: path.join(bases.volumes, 'EXPORTED'), name: 'EXPORTED', hasOneLibrary: false, hasSyncList: false },
      { root: path.join(bases.volumes, 'MYSTICK'), name: 'MYSTICK', hasOneLibrary: true, hasSyncList: true },
    ]);
  });

  it('passes over a folder an unclean eject left behind, which is not a mount point', async () => {
    makeVolume(path.join(bases.volumes, 'STALE'), ['export.pdb']);
    expect(await findSticks('darwin', bases, () => false)).toEqual([]);
  });

  it('passes over the boot disk\'s link in /Volumes', async () => {
    const target = makeVolume(path.join(root, 'boot'), ['export.pdb']);
    fs.mkdirSync(bases.volumes, { recursive: true });
    fs.symlinkSync(target, path.join(bases.volumes, 'Macintosh HD'));
    expect(await volumeRoots('darwin', bases, () => true)).toEqual([]);
  });

  it('looks under /media, /media/<user> and /run/media/<user> on Linux', async () => {
    makeVolume(path.join(bases.media, 'STICK1'), ['export.pdb']);
    makeVolume(path.join(bases.media, 'koray', 'STICK2'), ['export.pdb']);
    makeVolume(path.join(bases.runMedia, 'koray', 'STICK3'), ['export.pdb']);
    const names = (await findSticks('linux', bases)).map((s) => s.name).sort();
    expect(names).toEqual(['STICK1', 'STICK2', 'STICK3']);
  });

  it('finds nothing when there is nowhere to look', async () => {
    expect(await findSticks('darwin', bases, () => true)).toEqual([]);
    expect(await findSticks('linux', bases)).toEqual([]);
  });
});

describe('stickAt', () => {
  it('names a Windows stick by its drive letter', async () => {
    const vol = makeVolume(path.join(root, 'E'), ['export.pdb']);
    const stick = await stickAt(`${vol}${path.sep}`, 'win32');
    expect(stick?.name).toBe(vol);
    expect(await stickAt(makeVolume(path.join(root, 'F')), 'win32')).toBeNull();
  });
});
