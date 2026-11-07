import { describe, it, expect } from 'vitest';
import { pictureToDataUrl } from '../../src/main/trackArtwork';

describe('pictureToDataUrl', () => {
  it('turns an embedded cover into a data URL', () => {
    expect(pictureToDataUrl({ format: 'image/jpeg', data: new Uint8Array([1, 2, 3]) }))
      .toBe('data:image/jpeg;base64,AQID');
  });

  it('accepts a bare format name, as some taggers write it', () => {
    expect(pictureToDataUrl({ format: 'png', data: new Uint8Array([1]) })).toMatch(/^data:image\/png;base64,/);
  });

  it('is null without a picture', () => {
    expect(pictureToDataUrl(undefined)).toBeNull();
    expect(pictureToDataUrl({ format: 'image/jpeg', data: new Uint8Array() })).toBeNull();
  });
});
