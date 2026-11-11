import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isGoneError, isGoneSync } from '../../src/main/fileState';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-state-'));
  fs.writeFileSync(path.join(dir, 'here.mp3'), 'x');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('isGoneSync', () => {
  it('is false for a file that is there', () => {
    expect(isGoneSync(path.join(dir, 'here.mp3'))).toBe(false);
  });

  it('is true for a file that is not there, or under a file posing as a folder', () => {
    expect(isGoneSync(path.join(dir, 'gone.mp3'))).toBe(true);
    expect(isGoneSync(path.join(dir, 'here.mp3', 'inner.mp3'))).toBe(true);
  });
});

describe('isGoneError', () => {
  it('reads only "no such file" as gone, not "not allowed"', () => {
    const err = (code?: string) => Object.assign(new Error('x'), code ? { code } : {});
    expect(isGoneError(err('ENOENT'))).toBe(true);
    expect(isGoneError(err('ENOTDIR'))).toBe(true);
    expect(isGoneError(err('EPERM'))).toBe(false);
    expect(isGoneError(err('EACCES'))).toBe(false);
    expect(isGoneError(err())).toBe(false);
  });
});
