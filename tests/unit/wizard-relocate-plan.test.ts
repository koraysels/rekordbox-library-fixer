import { describe, it, expect } from 'vitest';
import { planRelocations } from '../../src/main/wizard/relocatePlan';
import type { MissingTrack, RelocationCandidate } from '../../src/main/trackRelocator';

const track = (id: string, location = `/Music/${id}.mp3`): MissingTrack => ({
  id, name: `Track ${id}`, artist: 'Artist', originalLocation: location,
});
const cand = (path: string, confidence: number): RelocationCandidate => ({
  path, confidence, score: confidence, matchType: 'fuzzy',
});

describe('planRelocations', () => {
  it('applies a match of 90 % or more', () => {
    const plan = planRelocations([track('1')], new Map([['1', [cand('/New/1.mp3', 0.95)]]]));
    expect(plan.step).toBe('relocate');
    expect(plan.apply).toEqual([{
      trackIds: ['1'], name: 'Track 1', artist: 'Artist', location: '/Music/1.mp3',
      to: '/New/1.mp3', confidence: 0.95,
    }]);
    expect(plan.setAside).toEqual([]);
  });

  it('applies a match of exactly the threshold', () => {
    const plan = planRelocations([track('1')], new Map([['1', [cand('/New/1.mp3', 0.9)]]]));
    expect(plan.apply).toHaveLength(1);
  });

  it('sets a weaker match aside with its best guess', () => {
    const plan = planRelocations([track('1')], new Map([['1', [cand('/New/1.mp3', 0.89)]]]));
    expect(plan.apply).toEqual([]);
    expect(plan.setAside).toEqual([{
      trackIds: ['1'], name: 'Track 1', artist: 'Artist', location: '/Music/1.mp3',
      why: 'Best match is 89 %', bestGuess: { path: '/New/1.mp3', confidence: 0.89 },
    }]);
  });

  it('leaves a track with no candidate to the remove step', () => {
    const plan = planRelocations([track('1'), track('2')], new Map([['2', []]]));
    expect(plan.apply).toEqual([]);
    expect(plan.setAside).toEqual([]);
  });

  it('picks the highest of several candidates', () => {
    const plan = planRelocations([track('1')], new Map([['1', [
      cand('/A/1.mp3', 0.7), cand('/B/1.mp3', 0.97), cand('/C/1.mp3', 0.92),
    ]]]));
    expect(plan.apply[0].to).toBe('/B/1.mp3');
    expect(plan.apply[0].confidence).toBe(0.97);
  });

  it('honours a different threshold', () => {
    const plan = planRelocations([track('1')], new Map([['1', [cand('/New/1.mp3', 0.8)]]]), 0.75);
    expect(plan.apply).toHaveLength(1);
  });

  it('never lists a streaming track', () => {
    const plan = planRelocations(
      [track('1', 'tidal:tracks:1')],
      new Map([['1', [cand('/New/1.mp3', 0.99)]]]),
    );
    expect(plan.apply).toEqual([]);
    expect(plan.setAside).toEqual([]);
  });
});
