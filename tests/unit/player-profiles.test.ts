import { describe, it, expect } from 'vitest';
import {
  PLAYER_PROFILES, DEFAULT_PLAYER, whyUnplayable, describeReason, formatFromLibrary,
} from '../../src/main/convert/playerProfiles';

const cdj = PLAYER_PROFILES.cdj2000;

describe('player profiles', () => {
  it('defaults to the CDJ-2000', () => {
    expect(DEFAULT_PLAYER).toBe('cdj2000');
  });
  it('labels the profile for the UI', () => {
    expect(cdj.label).toBe('CDJ-2000 / CDJ-2000NXS');
  });
  it('passes what the CDJ-2000 plays', () => {
    expect(whyUnplayable({ format: 'mp3' }, cdj)).toEqual([]);
    expect(whyUnplayable({ format: 'aiff', sampleRate: 48000, bitDepth: 24 }, cdj)).toEqual([]);
  });
  it('flags FLAC and ALAC by format', () => {
    expect(whyUnplayable({ format: 'flac' }, cdj)).toEqual([{ kind: 'format', format: 'flac' }]);
    expect(whyUnplayable({ format: 'alac', sampleRate: 44100 }, cdj)[0]).toEqual({ kind: 'format', format: 'alac' });
  });
  it('flags a playable format past the limits, with every reason', () => {
    expect(whyUnplayable({ format: 'wav', sampleRate: 96000, bitDepth: 32 }, cdj)).toEqual([
      { kind: 'sampleRate', hz: 96000, max: 48000 }, { kind: 'bitDepth', bits: 32, max: 24 },
    ]);
    expect(whyUnplayable({ format: 'wav', bitDepth: 32, isFloat: true }, cdj)).toContainEqual({ kind: 'float' });
  });
  it('reads the format from FileType, then Kind, then extension', () => {
    expect(formatFromLibrary({ location: '/a.m4a', fileType: 6 })).toBe('alac');
    expect(formatFromLibrary({ location: '/a.m4a', fileType: 4 })).toBe('aac');
    expect(formatFromLibrary({ location: '/a.x', fileType: 5 })).toBe('flac');
    expect(formatFromLibrary({ location: '/a.m4a', kind: 'Apple Lossless' })).toBe('alac');
    expect(formatFromLibrary({ location: '/a.m4a', kind: 'AAC' })).toBe('aac');
    expect(formatFromLibrary({ location: '/a.x', kind: 'FLAC File' })).toBe('flac');
    expect(formatFromLibrary({ location: '/a.FLAC' })).toBe('flac');
    expect(formatFromLibrary({ location: '/a.AIF' })).toBe('aiff');
    expect(formatFromLibrary({ location: '/a.m4a' })).toBe('unknown');
    expect(formatFromLibrary({ location: '/a.mp4' })).toBe('unknown');
  });
  it('says why in words', () => {
    expect(describeReason({ kind: 'sampleRate', hz: 96000, max: 48000 })).toBe('96 kHz — this player stops at 48 kHz');
    expect(describeReason({ kind: 'bitDepth', bits: 32, max: 24 })).toBe('32-bit — this player stops at 24-bit');
    expect(describeReason({ kind: 'float' })).toBe("32-bit float isn't supported");
    expect(describeReason({ kind: 'format', format: 'flac' })).toBe("FLAC isn't supported");
    expect(describeReason({ kind: 'format', format: 'alac' })).toBe("Apple Lossless (ALAC) isn't supported");
  });
});
