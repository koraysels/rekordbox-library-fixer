import { describe, it, expect } from 'vitest';
import { capLogs } from '../../src/renderer/utils/capLogs';

describe('capLogs', () => {
  it('appends when under the cap', () => {
    expect(capLogs(['a', 'b'], 'c', 200)).toEqual(['a', 'b', 'c']);
  });

  it('keeps only the most recent `max` entries', () => {
    const start = Array.from({ length: 200 }, (_, i) => `l${i}`);
    const result = capLogs(start, 'newest', 200);
    expect(result).toHaveLength(200);
    expect(result[199]).toBe('newest');
    expect(result[0]).toBe('l1'); // oldest dropped
  });

  it('never grows past the cap over many appends (5000 tracks)', () => {
    let logs: string[] = [];
    for (let i = 0; i < 5000; i++) {
      logs = capLogs(logs, `track ${i}`, 200);
    }
    expect(logs).toHaveLength(200);
    expect(logs[199]).toBe('track 4999');
  });

  it('does not mutate the input array', () => {
    const input = ['a'];
    capLogs(input, 'b', 200);
    expect(input).toEqual(['a']);
  });
});
