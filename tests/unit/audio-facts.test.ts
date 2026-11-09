import { vi, describe, it, expect } from 'vitest';
vi.unmock('music-metadata');
vi.unmock('fs');
import * as path from 'path';
import { factsFromLibrary, readFileFacts } from '../../src/main/convert/audioFacts';

const fx = (n: string) => path.join(process.cwd(), 'tests/fixtures/audio', n);

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
  it('gives the full duration of a header-less MP3 larger than the head', async () => {
    const f = await readFileFacts(fx('mp3-noxing-10s.mp3'), 20_000);
    expect(f).toMatchObject({ format: 'mp3' });
    expect(Math.abs((f as { durationSec: number }).durationSec - 10)).toBeLessThan(0.1);
  });
});
