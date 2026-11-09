import { describe, it, expect } from 'vitest';
import { PLAYER_PROFILES } from '../../src/main/convert/playerProfiles';
import {
  outputFacts, outputPath, ffmpegArgs, outputReadiness, groupBySharedFile,
} from '../../src/main/convert/conversionPlan';

const cdj = PLAYER_PROFILES.cdj2000;
const aiff48x24 = outputFacts({ format: 'flac', sampleRate: 96000, bitDepth: 24 }, cdj, 'aiff');
const wav48x24 = outputFacts({ format: 'flac', sampleRate: 96000, bitDepth: 24 }, cdj, 'wav');
const src = { format: 'flac' as const, sampleRate: 96000, bitDepth: 24 };

describe('conversion plan', () => {
  it('keeps 24-bit, caps 96 kHz to 48 kHz and 88.2 kHz to 44.1 kHz', () => {
    expect(outputFacts({ format: 'flac', sampleRate: 96000, bitDepth: 24 }, cdj, 'aiff')).toMatchObject({ sampleRate: 48000, bitDepth: 24 });
    expect(outputFacts({ format: 'flac', sampleRate: 88200, bitDepth: 16 }, cdj, 'aiff').sampleRate).toBe(44100);
    expect(outputFacts({ format: 'wav', sampleRate: 44100, bitDepth: 32, isFloat: true }, cdj, 'aiff').bitDepth).toBe(24);
    expect(outputFacts({ format: 'flac', sampleRate: 64000 }, cdj, 'aiff')).toMatchObject({ sampleRate: 48000, bitDepth: 16 });
    expect(outputFacts({ format: 'flac', sampleRate: 192000, bitDepth: 24 }, cdj, 'wav').sampleRate).toBe(48000);
    expect(outputFacts({ format: 'flac', sampleRate: 176400, bitDepth: 24 }, cdj, 'wav').sampleRate).toBe(44100);
  });
  it('computes PCM bitrate and fixes MP3 at 320', () => {
    expect(aiff48x24.bitrateKbps).toBe(2304);
    const mp3 = outputFacts({ format: 'flac', sampleRate: 96000, bitDepth: 24 }, cdj, 'mp3');
    expect(mp3).toMatchObject({ bitrateKbps: 320, sampleRate: 48000 });
    expect(mp3.bitDepth).toBeUndefined();
  });
  it('names the output next to the original, suffixed when it would be the same file', () => {
    expect(outputPath('/m/01 Track.flac', { format: 'flac' }, aiff48x24)).toBe('/m/01 Track.aif');
    expect(outputPath('/m/01 Track.aif', { format: 'aiff', sampleRate: 96000, bitDepth: 24 }, aiff48x24)).toBe('/m/01 Track (48 kHz).aif');
    expect(outputPath('/m/x.wav', { format: 'wav', sampleRate: 96000, bitDepth: 32 }, wav48x24)).toBe('/m/x (24-bit, 48 kHz).wav');
    expect(outputPath('/m/x.WAV', { format: 'wav', sampleRate: 88200, bitDepth: 24 }, outputFacts({ format: 'wav', sampleRate: 88200, bitDepth: 24 }, cdj, 'wav'))).toBe('/m/x (44.1 kHz).wav');
    expect(outputPath('C:\\m\\a.flac', { format: 'flac' }, aiff48x24)).toBe('C:\\m\\a.aif');
  });
  it('builds args as an array and keeps odd characters intact', () => {
    const nfd = '/m/Roméo & "Co" #1.flac';
    const args = ffmpegArgs(nfd, '/m/out.aif.converting', aiff48x24, { format: 'flac', sampleRate: 96000, bitDepth: 24 });
    expect(args[args.indexOf('-i') + 1]).toBe(nfd);
    expect(args).toContain('pcm_s24be');
    expect(args.join(' ')).toContain('aresample=48000');
    expect(args[args.indexOf('-f') + 1]).toBe('aiff');
    expect(args[args.length - 1]).toBe('/m/out.aif.converting');
  });
  it('carries cover art into AIFF and MP3 but not WAV', () => {
    expect(ffmpegArgs('/a.flac', '/a.aif.converting', aiff48x24, src)).toContain('0:v?');
    expect(ffmpegArgs('/a.flac', '/a.wav.converting', wav48x24, src)).not.toContain('0:v?');
    const mp3 = outputFacts(src, cdj, 'mp3');
    const a = ffmpegArgs('/a.flac', '/a.mp3.converting', mp3, src);
    expect(a).toContain('0:v?');
    expect(a).toContain('libmp3lame');
    expect(a).toContain('320k');
  });
  it('only resamples/dithers when something changes', () => {
    const same = outputFacts({ format: 'flac', sampleRate: 44100, bitDepth: 16 }, cdj, 'aiff');
    const args = ffmpegArgs('/a.flac', '/a.aif.converting', same, { format: 'flac', sampleRate: 44100, bitDepth: 16 });
    expect(args).not.toContain('-af');
    expect(args).toContain('pcm_s16be');
    const depth = outputFacts({ format: 'wav', sampleRate: 44100, bitDepth: 32, isFloat: true }, cdj, 'wav');
    expect(ffmpegArgs('/a.wav', '/b.wav.converting', depth, { format: 'wav', sampleRate: 44100, bitDepth: 32, isFloat: true }).join(' '))
      .toContain('dither_method=triangular_hp');
  });
  it('an existing output that matches the plan is reusable, not a conflict', () => {
    expect(outputReadiness({ exists: true, facts: { format: 'aiff', sampleRate: 48000, bitDepth: 24, durationSec: 200.02 } }, aiff48x24, 200)).toBe('reusable');
    expect(outputReadiness({ exists: true, facts: { format: 'aiff', sampleRate: 44100, bitDepth: 16, durationSec: 200 } }, aiff48x24, 200)).toBe('conflict');
    expect(outputReadiness({ exists: true, facts: { format: 'aiff', sampleRate: 48000, bitDepth: 24, durationSec: 201 } }, aiff48x24, 200)).toBe('conflict');
    expect(outputReadiness({ exists: true }, aiff48x24, 200)).toBe('conflict');
    expect(outputReadiness({ exists: false }, aiff48x24, 200)).toBe('new');
  });
  it('groups entries that share one file, accents normalised', () => {
    const g = groupBySharedFile([{ id: '1', location: '/m/Roméo.flac' }, { id: '2', location: '/m/Roméo.flac' }]);
    expect([...g.values()][0].map((t) => t.id)).toEqual(['1', '2']);
    const mixed = groupBySharedFile([{ id: '1', location: '/m/Rome\u0301o.flac' }, { id: '2', location: '/m/Rom\u00e9o.flac' }]);
    expect(mixed.size).toBe(1);
  });
});
