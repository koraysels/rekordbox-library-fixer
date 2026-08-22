import { describe, it, expect, vi, beforeEach } from 'vitest';

// The fingerprint step reads files; stub it so the tests exercise scan
// orchestration (progress, cancel, streaming) rather than disk I/O.
vi.mock('music-metadata', () => ({
  parseBuffer: vi.fn(async () => ({
    format: { duration: 100, bitrate: 320, sampleRate: 44100 },
    common: { title: 'T', artist: 'A' },
  })),
}));
// Stub only the fs calls fingerprinting makes; the rest of fs (used by the
// logger) stays real. Content is keyed by path so two tracks at the same
// location fingerprint identically — that's how the tests build a duplicate set.
import * as fs from 'fs';
beforeEach(() => {
  vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined as any);
  vi.spyOn(fs.promises, 'readFile').mockImplementation(async (p: any) => Buffer.from(String(p)) as any);
  vi.spyOn(fs.promises, 'stat').mockImplementation(async (p: any) => ({ size: String(p).length * 10 }) as any);
  vi.spyOn(fs.promises, 'open').mockImplementation(async (p: any) => ({
    read: async (buf: Buffer) => { buf.write(String(p)); return { bytesRead: 1 }; },
    close: async () => undefined,
  }) as any);
});

import { DuplicateDetector } from '../../src/main/duplicateDetector';

const track = (id: string, name: string, location: string, size = 1000) =>
  ({ id, name, artist: 'A', location, size, duration: 100, bitrate: 320 } as any);

const OPTIONS = {
  useFingerprint: true,
  useMetadata: false,
  metadataFields: ['artist', 'title'],
};

describe('DuplicateDetector scan progress + cancel', () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector();
  });

  it('reports progress while scanning', async () => {
    const tracks = [track('1', 'a', '/m/a.mp3'), track('2', 'b', '/m/b.mp3'), track('3', 'c', '/m/c.mp3')];
    const events: any[] = [];
    await detector.findDuplicates(tracks, OPTIONS, {
      onProgress: (p) => events.push(p),
    });
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.total).toBe(3);
    expect(last.current).toBe(3);
  });

  it('stops early when cancelled and returns what it found so far', async () => {
    const tracks = Array.from({ length: 50 }, (_, i) => track(String(i), `t${i}`, `/m/t${i}.mp3`));
    const cancelToken = { cancelled: false };
    let seen = 0;

    const result = await detector.findDuplicates(tracks, OPTIONS, {
      cancelToken,
      onProgress: (p) => {
        seen = p.current;
        if (p.current >= 5) { cancelToken.cancelled = true; }
      },
    });

    expect(seen).toBeLessThan(50);
    expect(result.cancelled).toBe(true);
    expect(Array.isArray(result.duplicates)).toBe(true);
  });

  it('streams a duplicate set as soon as a second copy is found', async () => {
    // Same location => same fingerprint => a duplicate set of two.
    const tracks = [
      track('1', 'song', '/m/song.mp3'),
      track('2', 'song', '/m/song.mp3'),
      track('3', 'other', '/m/other.mp3'),
    ];
    const streamed: any[] = [];
    await detector.findDuplicates(tracks, OPTIONS, {
      onDuplicateSet: (set) => streamed.push(set),
    });
    expect(streamed.length).toBeGreaterThan(0);
    expect(streamed[0].tracks.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps a stable set id when a set grows, so the UI can upsert', async () => {
    const tracks = [
      track('1', 'song', '/m/song.mp3'),
      track('2', 'song', '/m/song.mp3'),
      track('3', 'song', '/m/song.mp3'),
    ];
    const streamed: any[] = [];
    await detector.findDuplicates(tracks, OPTIONS, {
      onDuplicateSet: (set) => streamed.push({ id: set.id, count: set.tracks.length }),
    });
    // emitted at 2 members, then again at 3 — same id both times
    expect(streamed.length).toBe(2);
    expect(streamed[0].id).toBe(streamed[1].id);
    expect(streamed[0].count).toBe(2);
    expect(streamed[1].count).toBe(3);
  });

  it('still works with no callbacks (plain call)', async () => {
    const tracks = [track('1', 'song', '/m/song.mp3'), track('2', 'song', '/m/song.mp3')];
    const result = await detector.findDuplicates(tracks, OPTIONS);
    expect(result.duplicates.length).toBe(1);
    expect(result.cancelled).toBe(false);
  });
});

describe('missing files fall back to metadata', () => {
  it('groups the same song whose copies differ only in tag size', async () => {
    // Real case: two entries for one song, files gone from disk, sizes
    // 13,336,237 and 13,353,762 — re-tagged, same audio. Including exact size
    // in the fallback key split them into separate sets.
    vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'));
    const detector = new DuplicateDetector();
    const tracks = [
      { id: '1', name: 'Detain (Original Mix)', artist: 'Weval', location: '/gone/a.mp3', duration: 325, size: 13336237 },
      { id: '2', name: 'Detain (Original Mix)', artist: 'Weval', location: '/gone/b.mp3', duration: 325, size: 13353762 },
    ] as any[];

    const { duplicates } = await detector.findDuplicates(tracks, OPTIONS);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].tracks).toHaveLength(2);
  });

  it('does not claim a content match when the files could not be read', async () => {
    vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'));
    const detector = new DuplicateDetector();
    const tracks = [
      { id: '1', name: 'Song', artist: 'A', location: '/gone/a.mp3', duration: 100 },
      { id: '2', name: 'Song', artist: 'A', location: '/gone/b.mp3', duration: 100 },
    ] as any[];

    const { duplicates } = await detector.findDuplicates(tracks, OPTIONS);
    expect(duplicates[0].matchType).toBe('metadata');
    expect(duplicates[0].confidence).toBeLessThan(100);
  });
});
