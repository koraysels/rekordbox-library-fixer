import { describe, it, expect } from 'vitest';
import { computeStatistics } from '@renderer/hooks/useStatistics';
import type { LibraryData } from '@renderer/types';

describe('computeStatistics', () => {
  it('returns zeros for null/empty library', () => {
    const stats = computeStatistics(null);
    expect(stats.totalTracks).toBe(0);
    expect(stats.totalPlaylists).toBe(0);
    expect(stats.genreDistribution).toEqual([]);
    expect(stats.bpmDistribution).toEqual([]);
    expect(stats.yearDistribution).toEqual([]);
    expect(stats.specialTagCount).toBe(0);
  });

  it('computes basic stats', () => {
    const tracks = new Map<string, any>();
    tracks.set('t1', { id: 't1', Genre: 'House', Bpm: '120', Year: '2010', Tags: 'nice, www.example.com' });
    tracks.set('t2', { id: 't2', Genre: 'Techno', Bpm: '128', Year: '2015', Tags: ['cool!'] });
    tracks.set('t3', { id: 't3', Genre: 'House', Bpm: '115', Year: '', Tags: '' });

    const libraryData: LibraryData = {
      libraryPath: '/tmp/lib',
      tracks,
      playlists: [ { name: 'P1', tracks: ['t1'], type: 'PLAYLIST' } ],
    };

    const stats = computeStatistics(libraryData);
    expect(stats.totalTracks).toBe(3);
    expect(stats.totalPlaylists).toBe(1);
    // genre: House (2), Techno (1)
    expect(stats.genreDistribution[0].label).toBe('House');
    expect(stats.genreDistribution[0].count).toBe(2);
    // bpm bins should contain counts
    const bpmBins = stats.bpmDistribution.reduce<Record<string, number>>((acc, cur) => {
      acc[String(cur.bin)] = cur.count;
      return acc;
    }, {});
    expect(bpmBins['120-139'] || bpmBins['120-139']).toBeDefined();
    // special tags: t1 has www, t2 has 'cool!' (special char) => count 2
    expect(stats.specialTagCount).toBe(2);
  });
});
