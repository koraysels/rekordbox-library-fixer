import { describe, it, expect } from 'vitest';
import { computeDeletablePaths } from '../../src/main/safeDeletePaths';

describe('computeDeletablePaths', () => {
  it('never deletes a file a remaining track still points at', () => {
    // The real bug: 3 XML entries share one file; 2 are removed, 1 is kept.
    const kept = '/Music/Bruxelles arrive.mp3';
    const result = computeDeletablePaths([kept, kept], [kept]);
    expect(result).toEqual([]);
  });

  it('deletes paths no remaining track references', () => {
    const result = computeDeletablePaths(['/Music/loser.mp3'], ['/Music/keeper.mp3']);
    expect(result).toEqual(['/Music/loser.mp3']);
  });

  it('de-duplicates repeated paths so a file is unlinked once', () => {
    const result = computeDeletablePaths(
      ['/Music/dup.mp3', '/Music/dup.mp3', '/Music/other.mp3'],
      []
    );
    expect(result).toEqual(['/Music/dup.mp3', '/Music/other.mp3']);
  });

  it('treats paths differing only in case as the same file', () => {
    const result = computeDeletablePaths(['/Music/Song.mp3'], ['/music/song.MP3']);
    expect(result).toEqual([]);
  });

  it('ignores empty or missing locations', () => {
    const result = computeDeletablePaths(['', '/Music/real.mp3'], ['', undefined as any]);
    expect(result).toEqual(['/Music/real.mp3']);
  });

  it('handles the mixed case: some losers share the kept file, others do not', () => {
    const kept = '/Music/keeper.mp3';
    const result = computeDeletablePaths(
      [kept, '/Music/real-loser.mp3', kept, '/Music/real-loser.mp3'],
      [kept, '/Music/untouched.mp3']
    );
    expect(result).toEqual(['/Music/real-loser.mp3']);
  });

  it('never deletes a file whose path differs only in Unicode form', () => {
    // macOS stores accents composed or decomposed and treats both as one file;
    // rekordbox libraries contain both spellings for the same track.
    const composed = '/Music/Bökken/WONTON.mp3';
    const decomposed = '/Music/Bökken/WONTON.mp3';
    expect(composed).not.toBe(decomposed);
    expect(computeDeletablePaths([decomposed], [composed])).toEqual([]);
  });

  it('de-duplicates the same file written in both Unicode forms', () => {
    const composed = '/Music/Bökken/WONTON.mp3';
    const decomposed = '/Music/Bökken/WONTON.mp3';
    expect(computeDeletablePaths([composed, decomposed], [])).toHaveLength(1);
  });
});

describe('computeDeletablePaths — only ever regular files', () => {
  // Rekordbox libraries really contain these: verified in a user's XML.
  const isFile = (p: string) => p.endsWith('.mp3');

  it('refuses a folder, which would take a whole album with it', () => {
    expect(computeDeletablePaths(['/Music/Handbraekes/'], [], isFile)).toEqual([]);
  });

  it('refuses a streaming entry that has no file at all', () => {
    expect(computeDeletablePaths(['/x/tidal:tracks:105015500'], [], isFile)).toEqual([]);
  });

  it('refuses a truncated location', () => {
    expect(computeDeletablePaths(['/Music/Unknown Album/Pancake - Don&'], [], isFile)).toEqual([]);
  });

  it('still deletes a genuine duplicate file', () => {
    expect(computeDeletablePaths(['/Music/dup.mp3'], [], isFile)).toEqual(['/Music/dup.mp3']);
  });
});
