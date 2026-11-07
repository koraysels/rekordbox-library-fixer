import { describe, it, expect } from 'vitest';
import { missingFileSetConfidence } from '../../src/main/missingFileConfidence';

const dir = '/Users/dj/Music/iTunes/iTunes Media/Music/Doshy & Conrank/Doshy - Hijacked (STRT007)';
const track = (over: Record<string, unknown>) => ({
  name: 'Flash Wiggles', artist: 'Doshy & Conrank', album: 'Doshy - Hijacked (STRT007)',
  duration: 138, bitrate: 320, size: 5_600_000, location: `${dir}/04 Flash Wiggles.mp3`, ...over,
});

describe('missingFileSetConfidence', () => {
  it('is high for a copy-named file next to the original', () => {
    // "04 Flash Wiggles 1.mp3" beside "04 Flash Wiggles.mp3" is how a copy gets
    // named; with the files unreadable this used to read a flat Medium.
    const set = [track({}), track({ location: `${dir}/04 Flash Wiggles 1.mp3`, size: 5_500_000 })];
    expect(missingFileSetConfidence(set)).toBeGreaterThanOrEqual(90);
  });

  it.each([' copy', ' (2)', ' 2'])('recognises the "%s" copy suffix', (suffix) => {
    const set = [track({}), track({ location: `${dir}/04 Flash Wiggles${suffix}.mp3` })];
    expect(missingFileSetConfidence(set)).toBeGreaterThanOrEqual(90);
  });

  it('is high when album, bitrate and size all agree across folders', () => {
    const set = [track({}), track({ location: '/elsewhere/Flash Wiggles.mp3', size: 5_550_000 })];
    expect(missingFileSetConfidence(set)).toBeGreaterThanOrEqual(90);
  });

  it('stays medium on artist, title and length alone', () => {
    const set = [
      track({}),
      track({ location: '/elsewhere/Flash Wiggles.mp3', album: 'Other', bitrate: 128, size: 2_000_000 }),
    ];
    expect(missingFileSetConfidence(set)).toBe(75);
  });

  it('does not treat a different track in the same folder as a copy', () => {
    const set = [
      track({}),
      track({ location: `${dir}/05 Other Song.mp3`, album: 'Other', bitrate: 128, size: 2_000_000 }),
    ];
    expect(missingFileSetConfidence(set)).toBe(75);
  });

  it('scores a set by its weakest pair', () => {
    const set = [
      track({}),
      track({ location: `${dir}/04 Flash Wiggles 1.mp3` }),
      track({ location: '/elsewhere/x.mp3', album: 'Other', bitrate: 128, size: 2_000_000 }),
    ];
    expect(missingFileSetConfidence(set)).toBe(75);
  });
});
