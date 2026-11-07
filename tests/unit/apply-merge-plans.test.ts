import { describe, it, expect } from 'vitest';
import { applyMergePlans } from '../../src/renderer/utils/applyMergePlans';
import type { LibraryData } from '../../src/renderer/types';

const library = (): LibraryData => ({
  libraryPath: '/x/master.db',
  tracks: new Map([['keep', { id: 'keep' }], ['dup', { id: 'dup' }], ['other', { id: 'other' }]]),
  playlists: [
    { name: 'Set', type: 'PLAYLIST', tracks: ['dup', 'other', 'keep'] },
    { name: 'Folder', type: 'FOLDER', tracks: [], children: [
      { name: 'Inner', type: 'PLAYLIST', tracks: ['dup', 'other'] },
    ] },
  ],
});

describe('applyMergePlans', () => {
  it('drops merged entries, so a rescan no longer finds the set', () => {
    // A rescan after merging in master.db ran on the stale in-memory library
    // and found every set it had just resolved.
    const next = applyMergePlans(library(), [{ keepId: 'keep', removeIds: ['dup'] }]);
    expect([...next.tracks.keys()]).toEqual(['keep', 'other']);
  });

  it('points playlist slots at the kept track, without listing it twice', () => {
    const next = applyMergePlans(library(), [{ keepId: 'keep', removeIds: ['dup'] }]);
    expect(next.playlists[0].tracks).toEqual(['keep', 'other']);
    expect(next.playlists[1].children![0].tracks).toEqual(['keep', 'other']);
  });

  it('leaves the original untouched', () => {
    const before = library();
    applyMergePlans(before, [{ keepId: 'keep', removeIds: ['dup'] }]);
    expect(before.tracks.has('dup')).toBe(true);
    expect(before.playlists[0].tracks).toEqual(['dup', 'other', 'keep']);
  });
});
