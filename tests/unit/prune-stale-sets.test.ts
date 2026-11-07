import { describe, it, expect } from 'vitest';
import { pruneStaleSets } from '../../src/renderer/utils/pruneStaleSets';

const set = (id: string, ...trackIds: string[]) => ({ id, tracks: trackIds.map((t) => ({ id: t })) });

describe('pruneStaleSets', () => {
  it('drops sets that were resolved since the scan', () => {
    // 5431 saved sets came back after the library had been cleaned in
    // master.db: "Bruxelles arrive" showed 4 entries, the database held 2.
    const live = new Set(['a1', 'b1', 'b2', 'b3']);
    const result = pruneStaleSets([set('A', 'a1', 'a2'), set('B', 'b1', 'b2', 'b3', 'b4')], live);
    expect(result.map((s) => s.id)).toEqual(['B']);
    expect(result[0].tracks.map((t) => t.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('keeps the same objects when nothing changed', () => {
    const sets = [set('A', 'a1', 'a2')];
    expect(pruneStaleSets(sets, new Set(['a1', 'a2']))[0]).toBe(sets[0]);
  });

  it('accepts the library map itself', () => {
    const live = new Map([['a1', {}], ['a2', {}]]);
    expect(pruneStaleSets([set('A', 'a1', 'a2', 'gone')], live)[0].tracks).toHaveLength(2);
  });
});
