import { describe, it, expect } from 'vitest';
import { upsertDuplicateSet } from '../../src/renderer/utils/upsertDuplicateSet';

describe('upsertDuplicateSet', () => {
  it('appends a set it has not seen', () => {
    const result = upsertDuplicateSet([{ id: 'a' }], { id: 'b' });
    expect(result.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('replaces a set that grew, instead of adding a second copy', () => {
    const start = [{ id: 'a', tracks: [1, 2] } as any];
    const result = upsertDuplicateSet(start, { id: 'a', tracks: [1, 2, 3] } as any);
    expect(result).toHaveLength(1);
    expect(result[0].tracks).toEqual([1, 2, 3]);
  });

  it('keeps position stable when replacing', () => {
    const start = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = upsertDuplicateSet(start, { id: 'b', extra: true } as any);
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const start = [{ id: 'a' }];
    upsertDuplicateSet(start, { id: 'b' });
    expect(start).toHaveLength(1);
  });
});
