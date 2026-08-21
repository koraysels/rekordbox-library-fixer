import { describe, it, expect } from 'vitest';
import { mediaUrlToFilePath, isAllowedMediaPath } from '../../src/main/mediaProtocol';

describe('mediaUrlToFilePath', () => {
  it('decodes a mac path', () => {
    const url = `media:///${encodeURIComponent('/Users/dj/Music/track.mp3')}`;
    expect(mediaUrlToFilePath(url)).toBe('/Users/dj/Music/track.mp3');
  });

  it('decodes spaces and unicode', () => {
    const p = '/Users/dj/Music/Träck – final (v2).aiff';
    expect(mediaUrlToFilePath(`media:///${encodeURIComponent(p)}`)).toBe(p);
  });

  it('decodes a windows path', () => {
    const p = 'C:\\Music\\track.flac';
    expect(mediaUrlToFilePath(`media:///${encodeURIComponent(p)}`)).toBe(p);
  });
});

describe('isAllowedMediaPath', () => {
  it('allows known audio extensions', () => {
    expect(isAllowedMediaPath('/Users/dj/Music/track.mp3')).toBe(true);
    expect(isAllowedMediaPath('/Users/dj/Music/track.AIFF')).toBe(true);
  });

  it('rejects paths without an allowed audio extension', () => {
    expect(isAllowedMediaPath('/Users/dj/.ssh/id_rsa')).toBe(false);
    expect(isAllowedMediaPath('/etc/passwd')).toBe(false);
    expect(isAllowedMediaPath('/Users/dj/Music/track.mp3.txt')).toBe(false);
  });
});
