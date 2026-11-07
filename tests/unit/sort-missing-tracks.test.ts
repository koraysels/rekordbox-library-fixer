import { describe, it, expect } from 'vitest';
import { sortMissingTracks, bestConfidenceOf } from '../../src/renderer/relocation/sortMissingTracks';

const t = (id: string, bestConfidence?: number) => ({ id, bestConfidence });

describe('sortMissingTracks', () => {
  it('keeps library order by default', () => {
    const tracks = [t('a', 0.2), t('b', 0.6), t('c')];
    expect(sortMissingTracks(tracks, 'library').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts the closest near-misses first, untried and no-candidate tracks last', () => {
    // 444 tracks auto-relocate could not place: the ones that nearly made it
    // are worth a look first.
    const tracks = [t('none'), t('low', 0.3), t('untried'), t('near', 0.68), t('zero', 0)];
    expect(sortMissingTracks(tracks, 'confidence').map((x) => x.id))
      .toEqual(['near', 'low', 'zero', 'none', 'untried']);
  });

  it('is stable among equal scores and does not mutate its input', () => {
    const tracks = [t('a', 0.5), t('b', 0.5), t('c', 0.9)];
    const sorted = sortMissingTracks(tracks, 'confidence');
    expect(sorted.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(tracks.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('bestConfidenceOf', () => {
  it('takes the highest candidate confidence, or undefined with none', () => {
    expect(bestConfidenceOf([{ confidence: 0.4 }, { confidence: 0.7 }])).toBe(0.7);
    expect(bestConfidenceOf([])).toBeUndefined();
  });
});
