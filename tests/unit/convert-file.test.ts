import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('fs');
vi.unmock('music-metadata');
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as mm from 'music-metadata';
import { convertFile } from '@main/convert/convertFile';
import { outputFacts, outputReadiness } from '@main/convert/conversionPlan';
import { isReadable, readFileFacts } from '@main/convert/audioFacts';
import { PLAYER_PROFILES } from '@main/convert/playerProfiles';

const FFMPEG = process.env.FFMPEG_PATH;
const real = FFMPEG ? it : it.skip;
const FIX = path.resolve(__dirname, '../fixtures/audio');

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-file-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

async function jobFor(input: string, output: string, target: 'aiff' | 'mp3' = 'aiff') {
  const source = await readFileFacts(input);
  if (!isReadable(source)) throw new Error('fixture unreadable');
  const out = outputFacts({ ...source, sampleRate: source.sampleRate! }, PLAYER_PROFILES.cdj2000, target);
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

  real('converts a 200.02 s FLAC to MP3 and passes verification despite the encoder delay', async () => {
    const input = path.join(dir, 'odd.flac');
    execFileSync(FFMPEG!, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
      '-t', '200.02', '-ac', '2', '-c:a', 'flac', '-sample_fmt', 's16', input]);
    const job = await jobFor(input, path.join(dir, 'odd.mp3'), 'mp3');
    const r = await convertFile(FFMPEG!, job, new AbortController().signal);
    if (!r.ok) throw new Error(r.error);
    expect(r.facts).toMatchObject({ format: 'mp3', sampleRate: 44100 });
    // and the file it left is recognised as reusable next time, not as a conflict
    const again = await readFileFacts(job.output);
    expect(outputReadiness({ exists: true, facts: isReadable(again) ? again : undefined }, job.out, job.source.durationSec)).toBe('reusable');
  }, 60000);

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
    const input = path.join(dir, 'long.flac');
    execFileSync(FFMPEG!, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=96000:cl=stereo',
      '-t', '3600', '-c:a', 'flac', '-sample_fmt', 's32', input]);
    const job = await jobFor(input, path.join(dir, 'long.aif'));
    const ac = new AbortController();
    const p = convertFile(FFMPEG!, job, ac.signal);
    const partial = `${job.output}.converting`;
    for (let i = 0; i < 200 && !fs.existsSync(partial); i++) await new Promise(r => setTimeout(r, 25));
    expect(fs.existsSync(partial)).toBe(true);
    ac.abort();
    const r = await p;
    expect(r.ok).toBe(false);
    expect(fs.readdirSync(dir)).toEqual(['long.flac']);
  }, 30000);

  real('never replaces a file that appeared at the output path', async () => {
    const input = path.join(dir, 'a.flac');
    fs.copyFileSync(path.join(FIX, 'flac-24-96000.flac'), input);
    const job = await jobFor(input, path.join(dir, 'a.aif'));
    fs.writeFileSync(job.output, 'precious');
    const r = await convertFile(FFMPEG!, job, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('left it alone');
    expect(fs.readFileSync(job.output, 'utf8')).toBe('precious');
    expect(fs.readdirSync(dir).sort()).toEqual(['a.aif', 'a.flac']);
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
