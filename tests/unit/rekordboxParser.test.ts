import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RekordboxParser } from '../../src/main/rekordboxParser';
import { getFixturePath, loadFixture } from '../setup';
import fs from 'fs';
import path from 'path';

describe('RekordboxParser', () => {
  let parser: RekordboxParser;
  
  beforeEach(() => {
    parser = new RekordboxParser();
    vi.clearAllMocks();
  });

  describe('parseLibrary', () => {
    it('should parse a basic library correctly', async () => {
      // Mock file reading
      const basicLibraryXML = loadFixture('basic-library.xml');
      (fs.promises.readFile as any).mockResolvedValue(basicLibraryXML);
      
      const library = await parser.parseLibrary('test-path.xml');
      
      expect(library.version).toBe('1.0.0');
      expect(library.tracks.size).toBe(3);
      expect(library.playlists.length).toBe(1);
      
      // Check first track
      const track1 = library.tracks.get('1');
      expect(track1).toBeDefined();
      expect(track1?.name).toBe('House Track');
      expect(track1?.artist).toBe('DJ Test');
      expect(track1?.album).toBe('Test Album');
      expect(track1?.genre).toBe('House');
      expect(track1?.bpm).toBe(128.00);
      expect(track1?.key).toBe('Am');
      expect(track1?.bitrate).toBe(320);
      expect(track1?.playCount).toBe(5);
      expect(track1?.rating).toBe(4);
      
      // Check cues and loops
      expect(track1?.cues).toHaveLength(2);
      expect(track1?.cues?.[0]).toEqual({
        name: 'Intro',
        type: 'CUE',
        start: 0.0,
        hotcue: undefined,
      });
      expect(track1?.cues?.[1]).toEqual({
        name: 'Drop',
        type: 'CUE',
        start: 32.0,
        hotcue: 1,
      });
      
      expect(track1?.loops).toHaveLength(1);
      expect(track1?.loops?.[0]).toEqual({
        name: 'Loop 1',
        start: 64.0,
        end: 96.0,
      });
      
      // Check beatgrid
      expect(track1?.beatgrid).toEqual({
        bpm: 128.00,
        offset: 0.0,
      });
    });

    it('should handle empty library', async () => {
      const emptyLibraryXML = loadFixture('empty-library.xml');
      (fs.promises.readFile as any).mockResolvedValue(emptyLibraryXML);
      
      const library = await parser.parseLibrary('empty.xml');
      
      expect(library.version).toBe('1.0.0');
      expect(library.tracks.size).toBe(0);
      expect(library.playlists).toHaveLength(0);
    });

    it('should parse complex library with special characters', async () => {
      const complexLibraryXML = loadFixture('complex-library.xml');
      (fs.promises.readFile as any).mockResolvedValue(complexLibraryXML);
      
      const library = await parser.parseLibrary('complex.xml');
      
      expect(library.tracks.size).toBe(4);
      
      // Check track with special characters
      const track2 = library.tracks.get('2');
      expect(track2?.name).toBe('Café Dançante (Remix)');
      expect(track2?.artist).toBe('Müller & Schmidt');
      expect(track2?.album).toBe('Spëcial Chàracters');
      expect(track2?.comments).toBe('Unicode test: 音楽 🎵');
      
      // Check minimal track
      const track3 = library.tracks.get('3');
      expect(track3?.name).toBe('Minimal Track');
      expect(track3?.artist).toBe('Unknown');
      expect(track3?.album).toBeUndefined();
      expect(track3?.bpm).toBeUndefined();
    });

    it('should parse playlists correctly', async () => {
      const basicLibraryXML = loadFixture('basic-library.xml');
      (fs.promises.readFile as any).mockResolvedValue(basicLibraryXML);
      
      const library = await parser.parseLibrary('basic.xml');
      
      expect(library.playlists).toHaveLength(1);
      
      const rootPlaylist = library.playlists[0];
      expect(rootPlaylist.name).toBe('My Playlists');
      expect(rootPlaylist.type).toBe('FOLDER');
      expect(rootPlaylist.children).toHaveLength(2);
      
      const houseMix = rootPlaylist.children?.[0];
      expect(houseMix?.name).toBe('House Mix');
      expect(houseMix?.type).toBe('PLAYLIST');
      expect(houseMix?.tracks).toHaveLength(1);
      expect(houseMix?.tracks[0]).toBe('1');
      
      // Check that track has playlist reference
      const track1 = library.tracks.get('1');
      expect(track1?.playlists).toContain('House Mix');
    });

    it('should handle malformed XML gracefully', async () => {
      const malformedXML = loadFixture('malformed-library.xml');
      (fs.promises.readFile as any).mockResolvedValue(malformedXML);
      
      // Should throw an error for malformed XML
      await expect(parser.parseLibrary('malformed.xml')).rejects.toThrow();
    });

    it('should handle single track in collection', async () => {
      const singleTrackXML = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.0.0" Company="Pioneer DJ"/>
  <COLLECTION Entries="1">
    <TRACK TrackID="1" Name="Single Track" Artist="Solo Artist"/>
  </COLLECTION>
  <PLAYLISTS/>
</DJ_PLAYLISTS>`;
      
      (fs.promises.readFile as any).mockResolvedValue(singleTrackXML);
      
      const library = await parser.parseLibrary('single.xml');
      
      expect(library.tracks.size).toBe(1);
      const track = library.tracks.get('1');
      expect(track?.name).toBe('Single Track');
      expect(track?.artist).toBe('Solo Artist');
    });

    it('should decode file locations correctly', async () => {
      const basicLibraryXML = loadFixture('basic-library.xml');
      (fs.promises.readFile as any).mockResolvedValue(basicLibraryXML);
      
      const library = await parser.parseLibrary('basic.xml');
      
      const track1 = library.tracks.get('1');
      expect(track1?.location).toBe('/Users/test/Music/house-track.mp3');
      // Location should be decoded from "file://localhost/Users/test/Music/house-track.mp3"
    });
  });

  describe('saveLibrary', () => {
    it('should generate valid XML for a simple library', async () => {
      let savedXML = '';
      (fs.promises.writeFile as any).mockImplementation(async (path: string, content: string) => {
        savedXML = content;
      });
      
      const library = {
        version: '1.0.0',
        tracks: new Map([
          ['1', {
            id: '1',
            name: 'Test Track',
            artist: 'Test Artist',
            album: 'Test Album',
            location: '/path/to/track.mp3',
            bpm: 128,
            bitrate: 320,
            duration: 240.5,
            cues: [{
              name: 'Intro',
              type: 'CUE' as const,
              start: 0.0,
            }],
            loops: [],
          }],
        ]),
        playlists: [{
          name: 'Test Playlist',
          type: 'PLAYLIST' as const,
          tracks: ['1'],
        }],
      };
      
      await parser.saveLibrary(library, 'output.xml');
      
      expect(fs.promises.writeFile).toHaveBeenCalledWith('output.xml', expect.any(String), 'utf-8');
      expect(savedXML).toContain('DJ_PLAYLISTS');
      expect(savedXML).toContain('Test Track');
      expect(savedXML).toContain('Test Artist');
      expect(savedXML).toContain('file://localhost/path/to/track.mp3');
      expect(savedXML).toContain('Test Playlist');
    });

    it('should handle tracks with special characters in XML output', async () => {
      let savedXML = '';
      (fs.promises.writeFile as any).mockImplementation(async (path: string, content: string) => {
        savedXML = content;
      });
      
      const library = {
        version: '1.0.0',
        tracks: new Map([
          ['1', {
            id: '1',
            name: 'Café & Music',
            artist: 'DJ <Special>',
            location: '/path with spaces/track.mp3',
            comments: 'Test "quotes" & symbols',
            cues: [],
            loops: [],
          }],
        ]),
        playlists: [],
      };
      
      await parser.saveLibrary(library, 'special.xml');
      
      // XML should be properly escaped
      expect(savedXML).toContain('&amp;'); // & should be escaped
      expect(savedXML).toContain('&lt;'); // < should be escaped
      expect(savedXML).toContain('&quot;'); // " should be escaped
      expect(savedXML).toContain('file://localhost/path%20with%20spaces/track.mp3'); // Spaces should be encoded
    });
  });
});