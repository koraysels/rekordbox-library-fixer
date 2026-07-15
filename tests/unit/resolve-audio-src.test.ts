import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mediaUrl, resolveAudioSrc } from '../../src/renderer/audio/resolveAudioSrc';

describe('mediaUrl', () => {
  it('encodes the whole path as one segment', () => {
    expect(mediaUrl('/Users/dj/My Track.mp3')).toBe(`media:///${encodeURIComponent('/Users/dj/My Track.mp3')}`);
  });
});

describe('resolveAudioSrc', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the media URL directly for native formats', async () => {
    for (const ext of ['mp3', 'm4a', 'flac', 'wav', 'ogg', 'MP3']) {
      const { src, revoke } = await resolveAudioSrc(`/music/track.${ext}`);
      expect(src).toBe(mediaUrl(`/music/track.${ext}`));
      expect(revoke).toBeNull();
    }
  });

  it('fetches and rewraps aiff to a blob URL', async () => {
    // minimal valid AIFF: FORM(12) + COMM(8+18) + SSND(8+8+2) = 56 bytes, one 16-bit sample
    const aiff = new ArrayBuffer(56);
    const dv = new DataView(aiff);
    const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) { dv.setUint8(at + i, s.charCodeAt(i)); } };
    str(0, 'FORM'); dv.setUint32(4, 48); str(8, 'AIFF');
    str(12, 'COMM'); dv.setUint32(16, 18);
    dv.setUint16(20, 1); dv.setUint32(22, 1); dv.setUint16(26, 16);
    dv.setUint16(28, 16398); dv.setUint32(30, 44100 << 16); dv.setUint32(34, 0);
    str(38, 'SSND'); dv.setUint32(42, 10); dv.setUint32(46, 0); dv.setUint32(50, 0);
    dv.setInt16(54, 1234); // one sample
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => aiff }));
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { src, revoke } = await resolveAudioSrc('/music/track.aiff');
    expect(fetch).toHaveBeenCalledWith(mediaUrl('/music/track.aiff'));
    expect(src).toBe('blob:fake');
    expect(createSpy).toHaveBeenCalledOnce();
    revoke!();
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake');
  });

  it('throws a clear error when the file is missing (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(resolveAudioSrc('/gone.aif')).rejects.toThrow('File missing or unreadable');
  });
});
