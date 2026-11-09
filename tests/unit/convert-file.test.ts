import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('fs');
vi.unmock('music-metadata');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as mm from 'music-metadata';
import { convertFile } from '@main/convert/convertFile';
import { outputFacts } from '@main/convert/conversionPlan';
import { readFileFacts } from '@main/convert/audioFacts';
import { PLAYER_PROFILES } from '@main/convert/playerProfiles';

const FFMPEG = process.env.FFMPEG_PATH;
const real = FFMPEG ? it : it.skip;
const FIX = path.resolve(__dirname, '../fixtures/audio');

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-file-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

async function jobFor(input: string, output: string) {
  const source = await readFileFacts(input);
  if ('unreachable' in source) throw new Error('fixture unreadable');
  const out = outputFacts({ ...source, sampleRate: source.sampleRate! }, PLAYER_PROFILES.cdj2000, 'aiff');
  return { input, output, out, source };
}

describe('convertFile (real ffmpeg; set FFMPEG_PATH)', () => {
  real('converts a 24-bit 96 kHz FLAC to 24-bit 48 kHz AIFF with the same duration', async () => {
    const input = path.join(dir, 'a.flac');
    fs.copyFileSync(path.join(FIX, 'flac-24-96000.flac'), input);
    const job = await jobFor(input, path.join(dir, 'a.aif'));
    const r = await convertFile(FFMPEG!, job, new AbortController().signal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.facts).toMatchObject({ format: 'aiff', sampleRate: 48000, bitDepth: 24 });
    expect(Math.abs(r.facts.durationSec - job.source.durationSec)).toBeLessThanOrEqual(0.05);
    expect(fs.existsSync(job.output)).toBe(true);
    expect(fs.readdirSync(dir).filter(f => f.endsWith('.converting'))).toEqual([]);
  });

  real('converts a file whose name has accents and an ampersand', async () => {
    const input = path.join(dir, 'Roméo & Co.flac');
    fs.copyFileSync(path.join(FIX, 'flac-24-96000.flac'), input);
    const job = await jobFor(input, path.join(dir, 'Roméo & Co.aif'));
    const r = await convertFile(FFMPEG!, job, new AbortController().signal);
    expect(r.ok).toBe(true);
    expect(fs.existsSync(job.output)).toBe(true);
  });

  real('keeps the cover art in AIFF', async () => {
    const input = path.join(dir, 'c.flac');
    fs.copyFileSync(path.join(FIX, 'flac-cover-16-44100.flac'), input);
    const job = await jobFor(input, path.join(dir, 'c.aif'));
    const r = await convertFile(FFMPEG!, job, new AbortController().signal);
    expect(r.ok).toBe(true);
    const meta = await mm.parseFile(job.output);
    expect(meta.common.picture?.length).toBe(1);
  });

  real('removes the partial file when ffmpeg fails', async () => {
    const input = path.join(dir, 'bad.flac');
    fs.writeFileSync(input, 'this is not audio');
    const job = await jobFor(path.join(FIX, 'flac-24-96000.flac'), path.join(dir, 'bad.aif'));
    const r = await convertFile(FFMPEG!, { ...job, input }, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    expect(fs.readdirSync(dir).sort()).toEqual(['bad.flac']);
  });

  real('abort removes the file in flight', async () => {
    const input = path.join(dir, 'a.flac');
    fs.copyFileSync(path.join(FIX, 'flac-24-96000.flac'), input);
    const job = await jobFor(input, path.join(dir, 'a.aif'));
    const ac = new AbortController();
    const p = convertFile(FFMPEG!, job, ac.signal);
    ac.abort();
    const r = await p;
    expect(r.ok).toBe(false);
    expect(fs.readdirSync(dir)).toEqual(['a.flac']);
  });
});

describe('convertFile without ffmpeg', () => {
  it('reports a missing binary and leaves nothing behind', async () => {
    const input = path.join(dir, 'a.flac');
    fs.copyFileSync(path.join(FIX, 'flac-24-96000.flac'), input);
    const job = await jobFor(input, path.join(dir, 'a.aif'));
    const r = await convertFile(path.join(dir, 'no-such-ffmpeg'), job, new AbortController().signal);
    expect(r.ok).toBe(false);
    expect(fs.readdirSync(dir)).toEqual(['a.flac']);
  });
});
