import { describe, it, expect } from 'vitest';
import { planRemovals } from '../../src/main/wizard/removePlan';
import type { MissingTrack, RelocationCandidate } from '../../src/main/trackRelocator';

const track = (id: string, location = `/Music/${id}.mp3`): MissingTrack => ({
  id, name: `Track ${id}`, artist: 'Artist', originalLocation: location,
});
const cand = (path: string, confidence: number): RelocationCandidate => ({
  path, confidence, score: confidence, matchType: 'fuzzy',
});
const mounted = () => true;

describe('planRemovals', () => {
  it('removes an entry with no candidate on a mounted drive', () => {
    const plan = planRemovals([track('1')], new Map(), mounted, 'darwin');
    expect(plan.step).toBe('remove');
    expect(plan.remove).toEqual([
      { trackIds: ['1'], name: 'Track 1', artist: 'Artist', location: '/Music/1.mp3' },
    ]);
    expect(plan.setAside).toEqual([]);
  });

  it('treats an empty candidate list as no candidate', () => {
    const plan = planRemovals([track('1')], new Map([['1', []]]), mounted, 'darwin');
    expect(plan.remove).toHaveLength(1);
  });

  it('never removes an entry on an unplugged drive', () => {
    const location = '/Volumes/DJ SSD/a/1.mp3';
    const plan = planRemovals(
      [track('1', location)],
      new Map(),
      (p) => !p.startsWith('/Volumes/DJ SSD'),
      'darwin',
    );
    expect(plan.remove).toEqual([]);
    expect(plan.setAside).toEqual([{
      trackIds: ['1'], name: 'Track 1', artist: 'Artist', location,
      why: 'Drive DJ SSD is not plugged in',
    }]);
  });

  it('never lists a streaming track', () => {
    const plan = planRemovals([track('1', 'tidal:tracks:1')], new Map(), mounted, 'darwin');
    expect(plan.remove).toEqual([]);
    expect(plan.setAside).toEqual([]);
  });

  it('sets aside an entry that has any candidate, with its best guess', () => {
    const plan = planRemovals(
      [track('1')],
      new Map([['1', [cand('/A/1.mp3', 0.1), cand('/B/1.mp3', 0.3)]]]),
      mounted,
      'darwin',
    );
    expect(plan.remove).toEqual([]);
    expect(plan.setAside).toEqual([{
      trackIds: ['1'], name: 'Track 1', artist: 'Artist', location: '/Music/1.mp3',
      why: 'Might be found by hand', bestGuess: { path: '/B/1.mp3', confidence: 0.3 },
    }]);
  });
});
