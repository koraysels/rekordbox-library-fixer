import * as crypto from 'crypto';
import * as fs from 'fs';
import * as mm from 'music-metadata';
import { Track } from './rekordboxParser';
import { Logger } from './logger';

export interface DuplicateSet {
  id: string;
  tracks: Track[];
  matchType: 'fingerprint' | 'metadata';
  confidence: number;
}

export interface DuplicateOptions {
  useFingerprint: boolean;
  useMetadata: boolean;
  metadataFields: string[];
  pathPreferences?: string[];
}

export class DuplicateDetector {
  private fingerprintCache: Map<string, string> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async findDuplicates(
    tracks: Track[], 
    options: DuplicateOptions
  ): Promise<DuplicateSet[]> {
    const duplicateSets: DuplicateSet[] = [];
    const processedTracks = new Set<string>();

    // Create fingerprint map if using audio fingerprinting
    const fingerprintMap = new Map<string, Track[]>();
    if (options.useFingerprint) {
      for (const track of tracks) {
        try {
          const fingerprint = await this.generateFingerprint(track);
          if (!fingerprintMap.has(fingerprint)) {
            fingerprintMap.set(fingerprint, []);
          }
          fingerprintMap.get(fingerprint)!.push(track);
        } catch (error) {
          console.error(`Failed to fingerprint track ${track.name}:`, error);
        }
      }

      // Add fingerprint-based duplicates
      for (const [, duplicateTracks] of fingerprintMap) {
        if (duplicateTracks.length > 1) {
          duplicateSets.push({
            id: crypto.randomBytes(8).toString('hex'),
            tracks: duplicateTracks,
            matchType: 'fingerprint',
            confidence: 100,
          });
          duplicateTracks.forEach(t => processedTracks.add(t.id));
        }
      }
    }

    // Create metadata map if using metadata matching
    if (options.useMetadata) {
      const metadataMap = new Map<string, Track[]>();
      
      for (const track of tracks) {
        // Skip if already found as fingerprint duplicate
        if (processedTracks.has(track.id)) continue;

        const metadataKey = this.generateMetadataKey(track, options.metadataFields);
        if (!metadataMap.has(metadataKey)) {
          metadataMap.set(metadataKey, []);
        }
        metadataMap.get(metadataKey)!.push(track);
      }

      // Add metadata-based duplicates
      for (const [, duplicateTracks] of metadataMap) {
        if (duplicateTracks.length > 1) {
          duplicateSets.push({
            id: crypto.randomBytes(8).toString('hex'),
            tracks: duplicateTracks,
            matchType: 'metadata',
            confidence: this.calculateMetadataConfidence(duplicateTracks, options.metadataFields),
          });
        }
      }
    }

    this.logger.logDuplicateDetection(tracks.length, duplicateSets.length, options);
    return duplicateSets;
  }

  private async generateFingerprint(track: Track): Promise<string> {
    // Check cache first
    if (this.fingerprintCache.has(track.location)) {
      return this.fingerprintCache.get(track.location)!;
    }

    try {
      // Check if file exists
      await fs.promises.access(track.location);
      
      // Get audio metadata for fingerprinting
      const metadata = await mm.parseBuffer(await fs.promises.readFile(track.location));
      
      // Create a simplified fingerprint based on:
      // - Duration (rounded to nearest second)
      // - Average bitrate
      // - File size
      // - First 1MB of file content hash
      const duration = Math.round(metadata.format.duration || 0);
      const bitrate = metadata.format.bitrate || 0;
      const fileStats = await fs.promises.stat(track.location);
      
      // Read first 1MB for content hash
      const buffer = Buffer.alloc(1024 * 1024);
      const fd = await fs.promises.open(track.location, 'r');
      await fd.read(buffer, 0, buffer.length, 0);
      await fd.close();
      
      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      const fingerprint = `${duration}_${bitrate}_${fileStats.size}_${contentHash}`;
      const hash = crypto.createHash('md5').update(fingerprint).digest('hex');
      
      // Cache the result
      this.fingerprintCache.set(track.location, hash);
      
      return hash;
    } catch (error) {
      // If file doesn't exist or can't be read, use metadata fallback
      const fallbackFingerprint = `${track.artist}_${track.name}_${track.duration}_${track.size}`;
      return crypto.createHash('md5').update(fallbackFingerprint).digest('hex');
    }
  }

  private generateMetadataKey(track: Track, fields: string[]): string {
    const keyParts: string[] = [];
    
    for (const field of fields) {
      switch (field) {
        case 'artist':
          keyParts.push(this.normalizeString(track.artist));
          break;
        case 'title':
          keyParts.push(this.normalizeString(track.name));
          break;
        case 'album':
          if (track.album) keyParts.push(this.normalizeString(track.album));
          break;
        case 'duration':
          if (track.duration) keyParts.push(Math.round(track.duration).toString());
          break;
        case 'bpm':
          if (track.bpm) keyParts.push(Math.round(track.bpm).toString());
          break;
        case 'key':
          if (track.key) keyParts.push(track.key);
          break;
      }
    }
    
    return keyParts.join('_');
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private calculateMetadataConfidence(tracks: Track[], fields: string[]): number {
    // Calculate confidence based on how many fields match
    let totalMatches = 0;
    let totalComparisons = 0;
    
    for (let i = 0; i < tracks.length - 1; i++) {
      for (let j = i + 1; j < tracks.length; j++) {
        for (const field of fields) {
          totalComparisons++;
          if (this.compareField(tracks[i], tracks[j], field)) {
            totalMatches++;
          }
        }
      }
    }
    
    return Math.round((totalMatches / totalComparisons) * 100);
  }

  private compareField(track1: Track, track2: Track, field: string): boolean {
    switch (field) {
      case 'artist':
        return this.normalizeString(track1.artist) === this.normalizeString(track2.artist);
      case 'title':
        return this.normalizeString(track1.name) === this.normalizeString(track2.name);
      case 'album':
        return track1.album && track2.album 
          ? this.normalizeString(track1.album) === this.normalizeString(track2.album)
          : track1.album === track2.album;
      case 'duration':
        return track1.duration && track2.duration
          ? Math.abs(track1.duration - track2.duration) < 2 // Within 2 seconds
          : false;
      case 'bpm':
        return track1.bpm && track2.bpm
          ? Math.abs(track1.bpm - track2.bpm) < 1 // Within 1 BPM
          : false;
      case 'key':
        return track1.key === track2.key;
      default:
        return false;
    }
  }

  async resolveDuplicates(resolution: {
    duplicates: DuplicateSet[];
    strategy: 'keep-highest-quality' | 'keep-newest' | 'keep-oldest' | 'keep-preferred-path' | 'manual';
    selections?: Map<string, string>; // Map of duplicate set ID to track ID to keep
    pathPreferences?: string[];
  }): Promise<Map<string, Track>> {
    const tracksToKeep = new Map<string, Track>();
    
    for (const duplicateSet of resolution.duplicates) {
      let keepTrack: Track | undefined;
      
      switch (resolution.strategy) {
        case 'keep-highest-quality':
          keepTrack = this.selectHighestQuality(duplicateSet.tracks);
          break;
        case 'keep-newest':
          keepTrack = this.selectNewest(duplicateSet.tracks);
          break;
        case 'keep-oldest':
          keepTrack = this.selectOldest(duplicateSet.tracks);
          break;
        case 'keep-preferred-path':
          keepTrack = this.selectPreferredPath(duplicateSet.tracks, resolution.pathPreferences || []);
          break;
        case 'manual':
          if (resolution.selections) {
            const selectedId = resolution.selections.get(duplicateSet.id);
            keepTrack = duplicateSet.tracks.find(t => t.id === selectedId);
          }
          break;
      }
      
      if (keepTrack) {
        // Merge metadata from all duplicates into the kept track
        keepTrack = this.mergeTrackMetadata(keepTrack, duplicateSet.tracks);
        tracksToKeep.set(keepTrack.id, keepTrack);
      }
    }
    
    const totalTracksRemoved = resolution.duplicates.reduce((sum, set) => sum + set.tracks.length, 0) - tracksToKeep.size;
    this.logger.logDuplicateResolution(resolution.strategy, resolution.duplicates, tracksToKeep, totalTracksRemoved);
    
    return tracksToKeep;
  }

  private selectHighestQuality(tracks: Track[]): Track {
    return tracks.reduce((best, current) => {
      const bestScore = this.calculateQualityScore(best);
      const currentScore = this.calculateQualityScore(current);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateQualityScore(track: Track): number {
    let score = 0;
    
    // Bitrate is most important
    if (track.bitrate) score += track.bitrate * 10;
    
    // File size as secondary indicator
    if (track.size) score += track.size / 1000000; // MB
    
    // Bonus for having metadata
    if (track.bpm) score += 100;
    if (track.key) score += 100;
    if (track.cues && track.cues.length > 0) score += 200;
    if (track.loops && track.loops.length > 0) score += 150;
    if (track.beatgrid) score += 150;
    
    return score;
  }

  private selectNewest(tracks: Track[]): Track {
    return tracks.reduce((newest, current) => {
      if (!newest.dateModified) return current;
      if (!current.dateModified) return newest;
      return current.dateModified > newest.dateModified ? current : newest;
    });
  }

  private selectOldest(tracks: Track[]): Track {
    return tracks.reduce((oldest, current) => {
      if (!oldest.dateAdded) return current;
      if (!current.dateAdded) return oldest;
      return current.dateAdded < oldest.dateAdded ? current : oldest;
    });
  }

  private selectPreferredPath(tracks: Track[], pathPreferences: string[]): Track {
    // If no preferences specified, fall back to highest quality
    if (pathPreferences.length === 0) {
      return this.selectHighestQuality(tracks);
    }

    // Score tracks based on path preference order
    const scoredTracks = tracks.map(track => {
      let pathScore = pathPreferences.length; // Default score if no match
      
      // Find the highest priority path that matches
      for (let i = 0; i < pathPreferences.length; i++) {
        const preference = pathPreferences[i];
        if (track.location.toLowerCase().includes(preference.toLowerCase())) {
          pathScore = i; // Lower index = higher priority
          break;
        }
      }
      
      return {
        track,
        pathScore,
        qualityScore: this.calculateQualityScore(track)
      };
    });

    // Sort by path preference first, then by quality
    scoredTracks.sort((a, b) => {
      if (a.pathScore !== b.pathScore) {
        return a.pathScore - b.pathScore; // Lower pathScore wins
      }
      return b.qualityScore - a.qualityScore; // Higher quality wins
    });

    return scoredTracks[0].track;
  }

  private mergeTrackMetadata(keepTrack: Track, allTracks: Track[]): Track {
    const merged = { ...keepTrack };
    
    // Merge cues from all tracks
    const allCues = new Map<string, any>();
    for (const track of allTracks) {
      if (track.cues) {
        for (const cue of track.cues) {
          const key = `${cue.type}_${cue.start}`;
          if (!allCues.has(key)) {
            allCues.set(key, cue);
          }
        }
      }
    }
    merged.cues = Array.from(allCues.values());
    
    // Merge loops from all tracks
    const allLoops = new Map<string, any>();
    for (const track of allTracks) {
      if (track.loops) {
        for (const loop of track.loops) {
          const key = `${loop.start}_${loop.end}`;
          if (!allLoops.has(key)) {
            allLoops.set(key, loop);
          }
        }
      }
    }
    merged.loops = Array.from(allLoops.values());
    
    // Merge playlists
    const allPlaylists = new Set<string>();
    for (const track of allTracks) {
      if (track.playlists) {
        track.playlists.forEach(p => allPlaylists.add(p));
      }
    }
    merged.playlists = Array.from(allPlaylists);
    
    // Keep highest play count
    merged.playCount = Math.max(...allTracks.map(t => t.playCount || 0));
    
    // Keep highest rating
    merged.rating = Math.max(...allTracks.map(t => t.rating || 0));
    
    return merged;
  }
}
