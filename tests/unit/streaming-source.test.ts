import { describe, it, expect } from 'vitest';
import { streamingServiceOf, isStreamingTrack } from '../../src/renderer/utils/streamingSource';

describe('streamingServiceOf', () => {
  it('names TIDAL, as stored in a real library', () => {
    expect(streamingServiceOf('/app/tidal:tracks:105015500')).toBe('TIDAL');
  });

  it('names other services', () => {
    expect(streamingServiceOf('/x/spotify:track:abc')).toBe('Spotify');
    expect(streamingServiceOf('/x/soundcloud:tracks:1')).toBe('SoundCloud');
    expect(streamingServiceOf('/x/beatport:tracks:1')).toBe('Beatport');
  });

  it('passes an unknown service through rather than hiding it', () => {
    expect(streamingServiceOf('/x/napster:tracks:9')).toBe('napster');
  });

  it('returns null for a real file', () => {
    expect(streamingServiceOf('/Music/Artist/track.mp3')).toBeNull();
    expect(streamingServiceOf('/Music/Folder/')).toBeNull();
    expect(streamingServiceOf(undefined)).toBeNull();
  });

  it('is not fooled by a Windows drive letter', () => {
    expect(isStreamingTrack('C:/Music/track.mp3')).toBe(false);
  });
});
