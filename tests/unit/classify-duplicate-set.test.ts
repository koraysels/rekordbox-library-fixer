import { describe, it, expect } from 'vitest';
import { classifyDuplicateSet, deletableFileCount } from '../../src/renderer/utils/classifyDuplicateSet';

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
