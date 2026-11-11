import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { sameContent, CHUNK_BYTES } from '../../src/main/wizard/sameContent';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-same-content-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const write = (name: string, bytes: Buffer) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, bytes);
  return p;
};
const pattern = (n: number) => Buffer.from(Array.from({ length: n }, (_, i) => i % 251));

describe('sameContent', () => {
  it('is true for two files with identical bytes', async () => {
    const a = write('a.mp3', pattern(CHUNK_BYTES * 2 + 17));
    const b = write('b.mp3', pattern(CHUNK_BYTES * 2 + 17));
    expect(await sameContent(a, b)).toBe(true);
  });

  it('is false for files of the same size that differ in one byte', async () => {
    const bytes = pattern(CHUNK_BYTES + 10);
    const a = write('a.mp3', bytes);
    const changed = Buffer.from(bytes);
    changed[CHUNK_BYTES + 5] ^= 0xff;
    const b = write('b.mp3', changed);
    expect(await sameContent(a, b)).toBe(false);
  });

  it('is false for files of different sizes without reading them', async () => {
    const a = write('a.mp3', pattern(100));
    const b = write('b.mp3', pattern(101));
    const open = vi.fn(fs.promises.open);
    expect(await sameContent(a, b, { stat: fs.promises.stat, open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('is false when a file is missing or is a folder', async () => {
    const a = write('a.mp3', pattern(10));
    expect(await sameContent(a, path.join(dir, 'gone.mp3'))).toBe(false);
    fs.mkdirSync(path.join(dir, 'folder'));
    expect(await sameContent(path.join(dir, 'folder'), path.join(dir, 'folder'))).toBe(false);
  });

  it('is true for two empty files', async () => {
    const a = write('a.mp3', Buffer.alloc(0));
    const b = write('b.mp3', Buffer.alloc(0));
    expect(await sameContent(a, b)).toBe(true);
  });
});
