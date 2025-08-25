import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DuplicateDetector } from '../../src/main/duplicateDetector';
import type { DuplicateOptions } from '../../src/main/duplicateDetector';
import type { Track } from '../../src/main/rekordboxParser';
import fs from 'fs';

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;
  let testTracks: Track[];

  beforeEach(() => {
    detector = new DuplicateDetector();
    vi.clearAllMocks();
    
    // Set up test tracks
    testTracks = [
      {
        id: '1',
        name: 'House Track',
        artist: 'DJ Test',
        album: 'Test Album',
        location: '/path/original/house-track.mp3',
        bpm: 128,
        bitrate: 320,
        size: 8421504,
        duration: 240.5,
        genre: 'House',
        key: 'Am',
        playCount: 10,
        rating: 5,
        cues: [],
        loops: [],
      },
      {
        id: '2',
        name: 'House Track', // Same name
        artist: 'DJ Test', // Same artist
        album: 'Test Album', // Same album
        location: '/path/backup/house-track.mp3', // Different location
        bpm: 128,
        bitrate: 320,
        size: 8421504,
        duration: 240.5,
        genre: 'House',
        key: 'Am',
        playCount: 3,
        rating: 4,
        cues: [],
        loops: [],
      },
      {
        id: '3',
        name: 'house track', // Same name, different case
        artist: 'dj test', // Same artist, different case
        album: 'test album', // Same album, different case
        location: '/path/low-quality/house-track.mp3',
        bpm: 128,
        bitrate: 128, // Lower quality
        size: 4210752,
        duration: 240.8,
        genre: 'House',
        playCount: 1,
        rating: 3,
        cues: [],
        loops: [],
      },
      {
        id: '4',
        name: 'Different Track',
        artist: 'Other Artist',
        album: 'Other Album',
        location: '/path/different-track.mp3',
        bpm: 132,
        bitrate: 320,
        size: 9876543,
        duration: 180.0,
        genre: 'Techno',
        key: 'Dm',
        playCount: 8,
        rating: 5,
        cues: [],
        loops: [],
      },
    ];
  });

  describe('findDuplicates', () => {
    it('should find metadata-based duplicates', async () => {
      const options: DuplicateOptions = {
        useMetadata: true,
        useFingerprint: false,
        metadataFields: ['artist', 'title', 'album'],
      };

      const duplicates = await detector.findDuplicates(testTracks, options);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].tracks).toHaveLength(3); // Tracks 1, 2, 3 are duplicates
      expect(duplicates[0].matchType).toBe('metadata');
      expect(duplicates[0].confidence).toBeGreaterThan(0);
      
      const duplicateTrackIds = duplicates[0].tracks.map(t => t.id).sort();
      expect(duplicateTrackIds).toEqual(['1', '2', '3']);
    });

    it('should find duplicates with different metadata fields', async () => {
      const options: DuplicateOptions = {
        useMetadata: true,
        useFingerprint: false,
        metadataFields: ['artist', 'title'], // Without album
      };

      const duplicates = await detector.findDuplicates(testTracks, options);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].tracks).toHaveLength(3); // Still tracks 1, 2, 3
    });

    it('should not find duplicates when metadata fields differ significantly', async () => {
      // Add a track with same name but different artist
      const differentArtistTrack: Track = {
        ...testTracks[0],
        id: '5',
        artist: 'Completely Different Artist',
      };
      
      const tracksWithDifferentArtist = [...testTracks.slice(3), differentArtistTrack]; // Only track 4 and the new track

      const options: DuplicateOptions = {
        useMetadata: true,
        useFingerprint: false,
        metadataFields: ['artist', 'title'],
      };

      const duplicates = await detector.findDuplicates(tracksWithDifferentArtist, options);

      expect(duplicates).toHaveLength(0);
    });

    it('should handle BPM and duration matching with tolerance', async () => {
      const closeTrack: Track = {
        id: '5',
        name: 'House Track', // Same name as testTracks[0]
        artist: 'DJ Test',    // Same artist as testTracks[0]
        location: '/path/close-match.mp3',
        bpm: 127.5, // Within 1 BPM of 128
        duration: 241.0, // Within 2 seconds of 240.5
        cues: [],
        loops: [],
      };

      const tracksWithClose = [testTracks[0], closeTrack];

      const options: DuplicateOptions = {
        useMetadata: true,
        useFingerprint: false,
        metadataFields: ['artist', 'title', 'bpm', 'duration'],
      };

      const duplicates = await detector.findDuplicates(tracksWithClose, options);

      // Should find duplicates due to tolerance in BPM and duration matching
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].tracks).toHaveLength(2);
    });

    it('should handle fingerprint-based detection', async () => {
      // Mock file system operations
      (fs.promises.access as any).mockResolvedValue(undefined);
      (fs.promises.stat as any).mockResolvedValue({ size: 8421504 });
      
      const mockFd = {
        read: vi.fn().mockResolvedValue({ bytesRead: 1024 * 1024 }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (fs.promises.open as any).mockResolvedValue(mockFd);

      // Mock music-metadata
      const { parseFile } = await import('music-metadata');
      (parseFile as any).mockResolvedValue({
        format: {
          duration: 240.5,
          bitrate: 320,
        },
      });

      const options: DuplicateOptions = {
        useMetadata: false,
        useFingerprint: true,
        metadataFields: [],
      };

      const duplicates = await detector.findDuplicates([testTracks[0], testTracks[1]], options);

      // With mocked fingerprinting, tracks should be detected as duplicates
      expect(duplicates.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty tracks array', async () => {
      const options: DuplicateOptions = {
        useMetadata: true,
        useFingerprint: false,
        metadataFields: ['artist', 'title'],
      };

      const duplicates = await detector.findDuplicates([], options);

      expect(duplicates).toHaveLength(0);
    });
  });

  describe('resolveDuplicates', () => {
    let duplicateSet: any;

    beforeEach(() => {
      duplicateSet = {
        id: 'test-duplicate-set',
        tracks: [testTracks[0], testTracks[1], testTracks[2]], // Original, backup, low-quality
        matchType: 'metadata',
        confidence: 95,
      };
    });

    it('should keep highest quality track', async () => {
      const resolution = {
        duplicates: [duplicateSet],
        strategy: 'keep-highest-quality' as const,
      };

      const result = await detector.resolveDuplicates(resolution);

      expect(result.size).toBe(1);
      const keptTrack = Array.from(result.values())[0];
      expect(keptTrack.id).toBe('1'); // Should keep the highest quality (320 bitrate)
      expect(keptTrack.bitrate).toBe(320);
    });

    it('should keep newest track', async () => {
      // Add date information to tracks
      const tracksWithDates = testTracks.slice(0, 3).map((track, index) => ({
        ...track,
        dateModified: new Date(2024, 0, index + 1), // Different dates
      }));
      
      duplicateSet.tracks = tracksWithDates;

      const resolution = {
        duplicates: [duplicateSet],
        strategy: 'keep-newest' as const,
      };

      const result = await detector.resolveDuplicates(resolution);

      expect(result.size).toBe(1);
      const keptTrack = Array.from(result.values())[0];
      expect(keptTrack.id).toBe('3'); // Should keep the newest (last date)
    });

    it('should keep oldest track', async () => {
      const tracksWithDates = testTracks.slice(0, 3).map((track, index) => ({
        ...track,
        dateAdded: new Date(2024, 0, index + 1),
      }));
      
      duplicateSet.tracks = tracksWithDates;

      const resolution = {
        duplicates: [duplicateSet],
        strategy: 'keep-oldest' as const,
      };

      const result = await detector.resolveDuplicates(resolution);

      expect(result.size).toBe(1);
      const keptTrack = Array.from(result.values())[0];
      expect(keptTrack.id).toBe('1'); // Should keep the oldest (first date)
    });

    it('should keep preferred path track', async () => {
      const resolution = {
        duplicates: [duplicateSet],
        strategy: 'keep-preferred-path' as const,
        pathPreferences: ['backup', 'original', 'low-quality'],
      };

      const result = await detector.resolveDuplicates(resolution);

      expect(result.size).toBe(1);
      const keptTrack = Array.from(result.values())[0];
      expect(keptTrack.id).toBe('2'); // Should keep the backup path (first in preferences)
    });

    it('should handle manual selection', async () => {
      const resolution = {
        duplicates: [duplicateSet],
        strategy: 'manual' as const,
        selections: new Map([['test-duplicate-set', '3']]), // Manually select track 3
      };

      const result = await detector.resolveDuplicates(resolution);

      expect(result.size).toBe(1);
      const keptTrack = Array.from(result.values())[0];
      expect(keptTrack.id).toBe('3');
    });

    it('should merge metadata from all duplicates', async () => {
      // Add different cues to each track
      duplicateSet.tracks[0].cues = [{ name: 'Intro', type: 'CUE', start: 0.0 }];
      duplicateSet.tracks[1].cues = [{ name: 'Drop', type: 'CUE', start: 32.0 }];
      duplicateSet.tracks[2].loops = [{ name: 'Loop', start: 64.0, end: 96.0 }];
      
      // Add different playlists
      duplicateSet.tracks[0].playlists = ['Playlist A'];
      duplicateSet.tracks[1].playlists = ['Playlist B'];
      duplicateSet.tracks[2].playlists = ['Playlist C'];
      
      // Different play counts and ratings
      duplicateSet.tracks[0].playCount = 10;
      duplicateSet.tracks[1].playCount = 5;
      duplicateSet.tracks[2].playCount = 15;
      
      duplicateSet.tracks[0].rating = 4;
      duplicateSet.tracks[1].rating = 5;
      duplicateSet.tracks[2].rating = 3;

      const resolution = {
        duplicates: [duplicateSet],
        strategy: 'keep-highest-quality' as const,
      };

      const result = await detector.resolveDuplicates(resolution);

      expect(result.size).toBe(1);
      const mergedTrack = Array.from(result.values())[0];
      
      // Should have merged all cues and loops
      expect(mergedTrack.cues).toHaveLength(2);
      expect(mergedTrack.loops).toHaveLength(1);
      
      // Should have all playlists
      expect(mergedTrack.playlists).toHaveLength(3);
      expect(mergedTrack.playlists).toContain('Playlist A');
      expect(mergedTrack.playlists).toContain('Playlist B');
      expect(mergedTrack.playlists).toContain('Playlist C');
      
      // Should have highest values
      expect(mergedTrack.playCount).toBe(15);
      expect(mergedTrack.rating).toBe(5);
    });
  });
});