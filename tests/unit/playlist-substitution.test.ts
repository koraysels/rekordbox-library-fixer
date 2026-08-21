import { describe, it, expect } from 'vitest';
import { substitutePlaylistTrackIds } from '../../src/main/playlistSubstitution';

describe('substitutePlaylistTrackIds', () => {
  it('replaces a removed track id with the kept id, keeping the playlist complete', () => {
    const playlists = [{ name: 'Set', tracks: ['a', 'B', 'c'] }];
    substitutePlaylistTrackIds(playlists, new Map([['B', 'A']]));
    expect(playlists[0].tracks).toEqual(['a', 'A', 'c']);
  });

  it('does not create a duplicate when the kept track is already in the playlist', () => {
    // playlist has both the kept (A) and the removed (B) version of the song
    const playlists = [{ name: 'Set', tracks: ['A', 'x', 'B'] }];
    substitutePlaylistTrackIds(playlists, new Map([['B', 'A']]));
    expect(playlists[0].tracks).toEqual(['A', 'x']);
  });

  it('preserves order of first appearance when kept comes after removed', () => {
    const playlists = [{ name: 'Set', tracks: ['B', 'y', 'A'] }];
    substitutePlaylistTrackIds(playlists, new Map([['B', 'A']]));
    expect(playlists[0].tracks).toEqual(['A', 'y']);
  });

  it('recurses into nested folders', () => {
    const playlists = [
      { name: 'Folder', tracks: [], children: [{ name: 'Inner', tracks: ['B', 'c'] }] },
    ];
    substitutePlaylistTrackIds(playlists, new Map([['B', 'A']]));
    expect((playlists[0].children![0] as any).tracks).toEqual(['A', 'c']);
  });

  it('collapses several removed versions of one song into a single kept entry', () => {
    // three duplicates B, C, D all resolve to kept A, all present in the playlist
    const playlists = [{ name: 'Set', tracks: ['B', 'C', 'z', 'D'] }];
    substitutePlaylistTrackIds(playlists, new Map([['B', 'A'], ['C', 'A'], ['D', 'A']]));
    expect(playlists[0].tracks).toEqual(['A', 'z']);
  });

  it('leaves unrelated playlists untouched', () => {
    const playlists = [{ name: 'Other', tracks: ['x', 'y'] }];
    substitutePlaylistTrackIds(playlists, new Map([['B', 'A']]));
    expect(playlists[0].tracks).toEqual(['x', 'y']);
  });
});
