import { describe, it, expect } from 'vitest';
import { isInterruption } from '../../src/renderer/audio/audioController';

describe('isInterruption', () => {
  it('treats an interrupted play() as no failure', () => {
    const err = new DOMException('The play() request was interrupted by a call to pause().', 'AbortError');
    expect(isInterruption(err)).toBe(true);
  });

  it('still reports a real playback failure', () => {
    expect(isInterruption(new DOMException('no supported source', 'NotSupportedError'))).toBe(false);
    expect(isInterruption(new Error('boom'))).toBe(false);
  });
});
