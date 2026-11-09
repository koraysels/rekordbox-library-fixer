import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { ffmpegPath, ffmpegStatus, installFfmpeg } from '@main/convert/ffmpegBinary';
import { FFMPEG_BUILDS, type FfmpegBuild } from '@main/convert/ffmpegBuilds';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-bin-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const payload = Buffer.from('#!/bin/sh\necho fake ffmpeg\n');
const gz = zlib.gzipSync(payload);
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const build = (over: Partial<FfmpegBuild> = {}): FfmpegBuild =>
  ({ url: 'https://example.test/ffmpeg.gz', sha256: sha(gz), sizeBytes: gz.length, archive: 'gzip', ...over });
const table = (b: FfmpegBuild) => ({ 'linux-x64': b });
const fakeFetch = (body: Buffer, ok = true) =>
  (async () => new Response(ok ? body : null, { status: ok ? 200 : 404, headers: { 'content-length': String(body.length) } })) as unknown as typeof fetch;

describe('pinned builds', () => {
  it('covers the four supported platforms with a 64-hex checksum', () => {
    for (const k of ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64'] as const) {
      expect(FFMPEG_BUILDS[k]?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(FFMPEG_BUILDS[k]?.url).toMatch(/^https:\/\//);
    }
  });
});

describe('ffmpegPath / ffmpegStatus', () => {
  it('puts the binary in <userData>/ffmpeg', () => {
    expect(ffmpegPath('/u', 'linux')).toBe(path.join('/u', 'ffmpeg', 'ffmpeg'));
    expect(ffmpegPath('/u', 'win32')).toBe(path.join('/u', 'ffmpeg', 'ffmpeg.exe'));
  });
  it('is missing, with the size, before install', () => {
    const s = ffmpegStatus('/u', 'darwin', 'arm64', () => false);
    expect(s).toEqual({ state: 'missing', sizeBytes: FFMPEG_BUILDS['darwin-arm64']!.sizeBytes });
  });
  it('is ready when the file exists', () => {
    const s = ffmpegStatus('/u', 'linux', 'x64', () => true);
    expect(s).toEqual({ state: 'ready', path: ffmpegPath('/u', 'linux') });
  });
  it('is unsupported on an unknown platform', () => {
    expect(ffmpegStatus('/u', 'freebsd', 'x64', () => false)).toEqual({ state: 'unsupported' });
    expect(ffmpegStatus('/u', 'win32', 'ia32', () => false)).toEqual({ state: 'unsupported' });
  });
});

describe('installFfmpeg', () => {
  it('installs and verifies a build', async () => {
    const pct: number[] = [];
    const out = await installFfmpeg(dir, 'linux', 'x64', (p) => pct.push(p), fakeFetch(gz), table(build()));
    expect(out).toBe(ffmpegPath(dir, 'linux'));
    expect(fs.readFileSync(out).equals(payload)).toBe(true);
    if (process.platform !== 'win32') { expect(fs.statSync(out).mode & 0o111).not.toBe(0); }
    expect(fs.readdirSync(path.join(dir, 'ffmpeg'))).toEqual(['ffmpeg']);
    expect(pct[pct.length - 1]).toBe(100);
  });

  it('refuses a download with the wrong checksum and leaves nothing behind', async () => {
    const bad = build({ sha256: 'f'.repeat(64) });
    await expect(installFfmpeg(dir, 'linux', 'x64', () => {}, fakeFetch(gz), table(bad)))
      .rejects.toThrow('The ffmpeg download did not match its checksum');
    expect(fs.readdirSync(path.join(dir, 'ffmpeg'))).toEqual([]);
  });

  it('fails on an HTTP error without leaving a file', async () => {
    await expect(installFfmpeg(dir, 'linux', 'x64', () => {}, fakeFetch(gz, false), table(build()))).rejects.toThrow('404');
    expect(fs.readdirSync(path.join(dir, 'ffmpeg'))).toEqual([]);
  });

  it('rejects an unsupported platform', async () => {
    await expect(installFfmpeg(dir, 'freebsd', 'x64', () => {}, fakeFetch(gz), {})).rejects.toThrow(/not available/);
  });
});
