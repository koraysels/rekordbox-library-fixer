import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
vi.unmock('music-metadata');
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { factsFromLibrary, readFileFacts } from '../../src/main/convert/audioFacts';

const fx = (n: string) => path.join(process.cwd(), 'tests/fixtures/audio', n);

/** A WAV header claiming `dataBytes` of 16-bit stereo 44.1 kHz audio, the rest a sparse file of silence. */
function bigWav(file: string, dataBytes: number) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dataBytes, 40);
  fs.writeFileSync(file, h);
  fs.truncateSync(file, 44 + dataBytes);
}

let dir: string;
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-facts-')); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('factsFromLibrary', () => {
  it('uses FileType, sample rate and depth when the library has them', () => {
    expect(factsFromLibrary({ location: '/a.m4a', fileType: 6, sampleRate: 44100, bitDepth: 24 }))
      .toEqual({ format: 'alac', sampleRate: 44100, bitDepth: 24 });
  });
  it('needs the file for an m4a without FileType', () => {
    expect(factsFromLibrary({ location: '/a.m4a' })).toBeNull();
  });
  it('needs the file for an XML WAV', () => {
    expect(factsFromLibrary({ location: '/a.wav', sampleRate: 44100 })).toBeNull();
  });
  it('accepts a lossy track without depth', () => {
    expect(factsFromLibrary({ location: '/a.mp3', fileType: 1, sampleRate: 44100 }))
      .toEqual({ format: 'mp3', sampleRate: 44100 });
  });
});

describe('readFileFacts', () => {
  it('marks a track whose file is unreachable', async () => {
    expect(await readFileFacts('/Volumes/NotMounted/x.flac')).toEqual({ unreachable: true });
  });
  it('calls a file that is there but cannot be parsed unreadable, not unreachable', async () => {
    const file = path.join(dir, 'garbage.flac');
    fs.writeFileSync(file, 'this is not audio at all');
    expect(await readFileFacts(file)).toEqual({ unreadable: true });
  });
  it('reads ALAC from a real m4a header', async () => {
    const f = await readFileFacts(fx('alac-24-44100.m4a'));
    expect(f).toMatchObject({ format: 'alac', sampleRate: 44100, bitDepth: 24 });
    expect((f as { durationSec: number }).durationSec).toBeCloseTo(1, 0);
  });
  it('reads 24-bit 96 kHz FLAC', async () => {
    expect(await readFileFacts(fx('flac-24-96000.flac')))
      .toMatchObject({ format: 'flac', sampleRate: 96000, bitDepth: 24 });
  });
  it('reads 32-bit float WAV', async () => {
    expect(await readFileFacts(fx('wav-f32-44100.wav')))
      .toMatchObject({ format: 'wav', sampleRate: 44100, bitDepth: 32, isFloat: true });
  });
  it('gives the full duration of a header-less MP3', async () => {
    const f = await readFileFacts(fx('mp3-noxing-10s.mp3'));
    expect(f).toMatchObject({ format: 'mp3' });
    expect(Math.abs((f as { durationSec: number }).durationSec - 10)).toBeLessThan(0.1);
  });
  it('gives the full duration of a WAV', async () => {
    const f = await readFileFacts(fx('wav-pcm32-44100-1s.wav'));
    expect(f).toMatchObject({ format: 'wav', sampleRate: 44100 });
    expect(Math.abs((f as { durationSec: number }).durationSec - 1)).toBeLessThan(0.01);
  });
  it('reads a 300 MB WAV without loading it: the right duration, in well under a second', async () => {
    const file = path.join(dir, 'big.wav');
    const seconds = 300 * 1024 * 1024 / (44100 * 4);
    bigWav(file, 44100 * 4 * Math.floor(seconds));
    const started = performance.now();
    const f = await readFileFacts(file);
    const ms = performance.now() - started;
    expect(f).toMatchObject({ format: 'wav', sampleRate: 44100, bitDepth: 16 });
    expect(Math.abs((f as { durationSec: number }).durationSec - Math.floor(seconds))).toBeLessThan(0.01);
    expect(ms).toBeLessThan(500);
  });
  it('reads a WAV over 2 GiB (more than one buffer can hold) instead of calling it unreachable', async () => {
    const file = path.join(dir, 'huge.wav');
    const dataBytes = 44100 * 4 * 15_000; // ~2.46 GiB, sparse
    bigWav(file, dataBytes);
    const f = await readFileFacts(file);
    expect(f).toMatchObject({ format: 'wav', sampleRate: 44100, bitDepth: 16 });
    expect(Math.abs((f as { durationSec: number }).durationSec - 15_000)).toBeLessThan(0.01);
  });
});
