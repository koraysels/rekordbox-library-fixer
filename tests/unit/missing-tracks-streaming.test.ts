import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.unmock('fs');

import * as fs from 'fs';
import { TrackRelocator } from '../../src/main/trackRelocator';
import { isStreamingLocation } from '../../src/main/brokenEntries';

const relocator = new TrackRelocator();

beforeEach(() => {
  // Nothing exists on disk, so anything reported missing was reported on merit.
  vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'));
});

const asMap = (tracks: any[]) => new Map(tracks.map((t) => [t.id, t]));

describe('findMissingTracks', () => {
  it('reports a track whose file is gone', async () => {
    const missing = await relocator.findMissingTracks(asMap([
      { id: '1', name: 'Song', artist: 'A', location: '/music/song.mp3' },
    ]));
    expect(missing.map((m) => m.id)).toEqual(['1']);
  });

  it('leaves streaming tracks out', async () => {
    // Rekordbox does not mark a TIDAL track missing, so neither can we — the
    // app's missing list has to match what the DJ sees in rekordbox.
    const missing = await relocator.findMissingTracks(asMap([
      { id: 'tidal', name: 'Song', artist: 'A', location: 'tidal:tracks:1315162' },
      { id: 'spotify', name: 'Song', artist: 'A', location: 'spotify:track:abc' },
      { id: 'real', name: 'Song', artist: 'A', location: '/music/song.mp3' },
    ]));
    expect(missing.map((m) => m.id)).toEqual(['real']);
  });

  it('skips a track with no location at all', async () => {
    const missing = await relocator.findMissingTracks(asMap([
      { id: '1', name: 'Song', artist: 'A', location: '' },
    ]));
    expect(missing).toHaveLength(0);
  });

  it('still reports a damaged path, which the search can try by title', async () => {
    const missing = await relocator.findMissingTracks(asMap([
      { id: 'folder', name: 'Song', artist: 'A', location: '/music/album/' },
      { id: 'cut', name: 'Song', artist: 'A', location: '/music/Artist & ' },
    ]));
    expect(missing.map((m) => m.id).sort()).toEqual(['cut', 'folder']);
  });
});

describe('isStreamingLocation', () => {
  it.each([
    ['tidal:tracks:1315162', true],
    ['spotify:track:4uLU6hMCjMI75M1A2tKUQC', true],
    ['soundcloud:tracks:12345', true],
    ['/Users/dj/Music/track.mp3', false],
    ['/Users/dj/Music/Drum & Bass/tune.aiff', false],
    ['', false],
    [undefined, false],
  ])('%s -> %s', (location, expected) => {
    expect(isStreamingLocation(location as any)).toBe(expected);
  });

  it('is not fooled by a colon inside a folder name', () => {
    expect(isStreamingLocation('/Users/dj/tidal:tracks:1/real file.mp3')).toBe(false);
  });
});
