import { describe, it, expect } from 'vitest';
import { countPlaylistMembership } from '../../src/renderer/utils/playlistMembership';
import type { Playlist } from '../../src/renderer/types';

const pl = (name: string, tracks: string[]): Playlist => ({ name, tracks, type: 'PLAYLIST' });
const folder = (name: string, children: Playlist[]): Playlist => ({ name, tracks: [], type: 'FOLDER', children });

describe('countPlaylistMembership', () => {
  it('counts how many playlists a track is in and names them', () => {
    const m = countPlaylistMembership([pl('Set A', ['t1', 't2']), pl('Set B', ['t1'])]);
    expect(m.get('t1')).toEqual({ count: 2, names: ['Set A', 'Set B'] });
    expect(m.get('t2')).toEqual({ count: 1, names: ['Set A'] });
  });

  it('does not count a track twice within the same playlist', () => {
    const m = countPlaylistMembership([pl('Set A', ['t1', 't1', 't2'])]);
    expect(m.get('t1')!.count).toBe(1);
  });

  it('walks nested folders but ignores folder containers themselves', () => {
    const tree = [folder('Crates', [pl('Deep', ['t1']), folder('More', [pl('Deeper', ['t1'])])])];
    const m = countPlaylistMembership(tree);
    expect(m.get('t1')).toEqual({ count: 2, names: ['Deep', 'Deeper'] });
  });

  it('returns nothing for a track in no playlist', () => {
    const m = countPlaylistMembership([pl('Set A', ['t1'])]);
    expect(m.get('t2')).toBeUndefined();
  });
});
