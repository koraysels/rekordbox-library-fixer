import { describe, it, expect } from 'vitest';
import { describeMatch } from '../../src/renderer/utils/describeMatch';

describe('describeMatch', () => {
  it('says a fingerprint match is the same audio', () => {
    const m = describeMatch(100, 'fingerprint');
    expect(m.label).toBe('Same audio');
    expect(m.tone).toBe('high');
  });

  it('says how sure a name-based match is, in words and percent', () => {
    // "Medium" said nothing about what was medium, or why.
    expect(describeMatch(95, 'metadata').label).toBe('Very likely the same · 95%');
    expect(describeMatch(75, 'metadata').label).toBe('Probably the same · 75%');
    expect(describeMatch(55, 'metadata').label).toBe('Unsure · 55%');
  });

  it('explains a match made without the files', () => {
    expect(describeMatch(75, 'metadata', true).explanation)
      .toMatch(/could not be read.*artist, title and length/i);
  });

  it('asks for a check below the "very likely" bar', () => {
    expect(describeMatch(75, 'metadata').explanation).toMatch(/check/i);
    expect(describeMatch(95, 'metadata').explanation).not.toMatch(/check before/i);
  });
});
