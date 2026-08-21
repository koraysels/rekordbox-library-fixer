import { describe, it, expect } from 'vitest';
import { normalizePathForCompare } from '../../src/renderer/utils/normalizePath';

// Same name, different Unicode forms — exactly what a real library contains.
const COMPOSED = '/Music/Bökken/WONTON.mp3';        // ö as one code point
const DECOMPOSED = '/Music/Bökken/WONTON.mp3';     // o + combining diaeresis

describe('normalizePathForCompare', () => {
  it('makes composed and decomposed accents compare equal', () => {
    expect(COMPOSED).not.toBe(DECOMPOSED);
    expect(normalizePathForCompare(COMPOSED)).toBe(normalizePathForCompare(DECOMPOSED));
  });

  it('ignores case, as macOS and Windows filesystems do', () => {
    expect(normalizePathForCompare('/Music/Song.MP3')).toBe(normalizePathForCompare('/music/song.mp3'));
  });

  it('still tells genuinely different paths apart', () => {
    expect(normalizePathForCompare('/Music/a.mp3')).not.toBe(normalizePathForCompare('/Music/b.mp3'));
  });

  it('handles missing values', () => {
    expect(normalizePathForCompare(undefined)).toBe('');
    expect(normalizePathForCompare(null)).toBe('');
  });
});
