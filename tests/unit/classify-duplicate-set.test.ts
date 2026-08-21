import { describe, it, expect } from 'vitest';
import { classifyDuplicateSet, deletableFileCount, distinctFileCount, looksLikePlayableFile } from '../../src/renderer/utils/classifyDuplicateSet';

describe('classifyDuplicateSet', () => {
  it('calls it entries when every copy points at the same file', () => {
    expect(classifyDuplicateSet([
      { location: '/m/song.mp3' },
      { location: '/m/song.mp3' },
    ])).toBe('entries');
  });

  it('ignores case differences when comparing paths', () => {
    expect(classifyDuplicateSet([
      { location: '/m/Song.mp3' },
      { location: '/M/song.MP3' },
    ])).toBe('entries');
  });

  it('calls it files when the copies are distinct files', () => {
    expect(classifyDuplicateSet([
      { location: '/m/a.mp3' },
      { location: '/other/a.mp3' },
    ])).toBe('files');
  });

  it('calls it mixed when some copies share a file and others do not', () => {
    expect(classifyDuplicateSet([
      { location: '/m/a.mp3' },
      { location: '/m/a.mp3' },
      { location: '/other/a.mp3' },
    ])).toBe('mixed');
  });

  it('treats a set without locations as entries', () => {
    expect(classifyDuplicateSet([{}, {}])).toBe('entries');
  });

  it('calls it entries when the paths differ only in Unicode form', () => {
    // The real case: one rekordbox entry stores "Bökken" composed, the other
    // decomposed. One folder, one file — nothing to delete.
    expect(classifyDuplicateSet([
      { location: '/Music/Bökken/WONTON.mp3' },
      { location: '/Music/Bökken/WONTON.mp3' },
    ])).toBe('entries');
  });
});

describe('deletableFileCount', () => {
  it('is zero when the other copies are the same file as the kept one', () => {
    const tracks = [
      { id: 'a', location: '/m/song.mp3' },
      { id: 'b', location: '/m/song.mp3' },
    ];
    expect(deletableFileCount(tracks, 'a')).toBe(0);
  });

  it('counts each distinct other file once', () => {
    const tracks = [
      { id: 'a', location: '/m/keep.mp3' },
      { id: 'b', location: '/m/dup1.mp3' },
      { id: 'c', location: '/m/dup1.mp3' },
      { id: 'd', location: '/m/dup2.mp3' },
    ];
    expect(deletableFileCount(tracks, 'a')).toBe(2);
  });
});

describe('distinctFileCount', () => {
  it('counts one file when every entry points at it', () => {
    expect(distinctFileCount([
      { location: '/m/a.mp3' },
      { location: '/m/a.mp3' },
    ])).toBe(1);
  });

  it('counts the real files behind a mixed set', () => {
    // The real case: five rekordbox entries, two files on disk.
    expect(distinctFileCount([
      { location: '/m/x[www.mp3' },
      { location: '/m/x[www.MP3Fiber.com].mp3' },
      { location: '/m/x[www.mp3' },
      { location: '/m/x[www.MP3Fiber.com].mp3' },
      { location: '/m/x[www.mp3' },
    ])).toBe(2);
  });

  it('folds Unicode variants of one path into a single file', () => {
    expect(distinctFileCount([
      { location: '/m/Bökken.mp3' },
      { location: '/m/Bökken.mp3' },
    ])).toBe(1);
  });
});

describe('looksLikePlayableFile', () => {
  it('rejects a folder location, which rekordbox really stores', () => {
    expect(looksLikePlayableFile('/Music/Handbraekes/')).toBe(false);
  });

  it('rejects a streaming entry', () => {
    expect(looksLikePlayableFile('/x/tidal:tracks:105015500')).toBe(false);
  });

  it('rejects a truncated location with no extension', () => {
    expect(looksLikePlayableFile('/Music/Unknown Album/Remix Medley ')).toBe(false);
  });

  it('accepts a normal audio file', () => {
    expect(looksLikePlayableFile('/Music/track.mp3')).toBe(true);
  });
});

describe('counting ignores locations that are not files', () => {
  it('does not count a folder or a stream as a file', () => {
    expect(distinctFileCount([
      { location: '/Music/real.mp3' },
      { location: '/Music/Handbraekes/' },
      { location: '/x/tidal:tracks:1' },
    ])).toBe(1);
  });

  it('calls a set of unplayable locations entries, not files', () => {
    expect(classifyDuplicateSet([
      { location: '/x/tidal:tracks:1' },
      { location: '/x/tidal:tracks:2' },
    ])).toBe('entries');
  });
});
