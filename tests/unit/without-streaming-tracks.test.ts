import { describe, it, expect } from 'vitest';
import { withoutStreamingTracks } from '../../src/renderer/relocation/withoutStreamingTracks';

describe('withoutStreamingTracks', () => {
  it('drops streaming entries from a cached missing list, keeping real files', () => {
    const cached = [
      { id: '1', originalLocation: '/music/song.mp3' },
      { id: '2', originalLocation: 'tidal:tracks:265227326' },
      // How an old cache stored it: resolved against the working directory.
      { id: '3', originalLocation: '/Users/me/rekordbox-library-manager/tidal:tracks:265227326' },
      { id: '4', originalLocation: 'spotify:track:abc' },
    ];
    expect(withoutStreamingTracks(cached).map((t) => t.id)).toEqual(['1']);
  });
});
