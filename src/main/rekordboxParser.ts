import * as fs from 'fs';
import * as xml2js from 'xml2js';

export interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  location: string;
  size?: number;
  bitrate?: number;
  duration?: number;
  dateAdded?: Date;
  dateModified?: Date;
  playCount?: number;
  rating?: number;
  comments?: string;
  cues?: Cue[];
  loops?: Loop[];
  beatgrid?: BeatGrid;
  playlists?: string[];
}

export interface Cue {
  name?: string;
  type: string;
  start: number;
  length?: number;
  hotcue?: number;
}

export interface Loop {
  name?: string;
  start: number;
  end: number;
}

export interface BeatGrid {
  bpm: number;
  offset: number;
  beats?: number[];
}

export interface Playlist {
  name: string;
  tracks: string[]; // Track IDs
  type: 'FOLDER' | 'PLAYLIST';
  children?: Playlist[];
}

export interface RekordboxLibrary {
  version: string;
  tracks: Map<string, Track>;
  playlists: Playlist[];
}

export class RekordboxParser {
  private parser: xml2js.Parser;
  private builder: xml2js.Builder;

  constructor() {
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
    });
    this.builder = new xml2js.Builder({
      renderOpts: { pretty: true, indent: '  ' },
      xmldec: { version: '1.0', encoding: 'UTF-8' },
    });
  }

  async parseLibrary(xmlPath: string): Promise<RekordboxLibrary> {
    const xmlContent = await fs.promises.readFile(xmlPath, 'utf-8');
    const result = await this.parser.parseStringPromise(xmlContent);
    
    const library: RekordboxLibrary = {
      version: result.DJ_PLAYLISTS?.Version || '1.0.0',
      tracks: new Map(),
      playlists: [],
    };

    // Parse tracks from COLLECTION
    if (result.DJ_PLAYLISTS?.COLLECTION?.TRACK) {
      const tracks = Array.isArray(result.DJ_PLAYLISTS.COLLECTION.TRACK) 
        ? result.DJ_PLAYLISTS.COLLECTION.TRACK 
        : [result.DJ_PLAYLISTS.COLLECTION.TRACK];

      for (const track of tracks) {
        const parsedTrack = this.parseTrack(track);
        library.tracks.set(parsedTrack.id, parsedTrack);
      }
    }

    // Parse playlists
    if (result.DJ_PLAYLISTS?.PLAYLISTS?.NODE) {
      const nodes = Array.isArray(result.DJ_PLAYLISTS.PLAYLISTS.NODE)
        ? result.DJ_PLAYLISTS.PLAYLISTS.NODE
        : [result.DJ_PLAYLISTS.PLAYLISTS.NODE];

      library.playlists = this.parsePlaylists(nodes, library.tracks);
    }

    return library;
  }

  private parseTrack(trackNode: any): Track {
    const track: Track = {
      id: trackNode.TrackID || '',
      name: trackNode.Name || '',
      artist: trackNode.Artist || '',
      album: trackNode.Album,
      genre: trackNode.Genre,
      bpm: trackNode.AverageBpm ? parseFloat(trackNode.AverageBpm) : undefined,
      key: trackNode.Tonality,
      location: decodeURIComponent(trackNode.Location || '').replace('file://localhost', ''),
      size: trackNode.Size ? parseInt(trackNode.Size) : undefined,
      bitrate: trackNode.BitRate ? parseInt(trackNode.BitRate) : undefined,
      duration: trackNode.TotalTime ? parseFloat(trackNode.TotalTime) : undefined,
      playCount: trackNode.PlayCount ? parseInt(trackNode.PlayCount) : undefined,
      rating: trackNode.Rating ? parseInt(trackNode.Rating) : undefined,
      comments: trackNode.Comments,
      cues: [],
      loops: [],
    };

    // Parse position marks (cues and loops)
    if (trackNode.POSITION_MARK) {
      const marks = Array.isArray(trackNode.POSITION_MARK) 
        ? trackNode.POSITION_MARK 
        : [trackNode.POSITION_MARK];

      for (const mark of marks) {
        if (mark.Type === 'CUE') {
          track.cues?.push({
            name: mark.Name,
            type: 'CUE',
            start: parseFloat(mark.Start || '0'),
            hotcue: mark.Num ? parseInt(mark.Num) : undefined,
          });
        } else if (mark.Type === 'LOOP') {
          track.loops?.push({
            name: mark.Name,
            start: parseFloat(mark.Start || '0'),
            end: parseFloat(mark.End || '0'),
          });
        }
      }
    }

    // Parse tempo/beatgrid
    if (trackNode.TEMPO) {
      const tempos = Array.isArray(trackNode.TEMPO) 
        ? trackNode.TEMPO 
        : [trackNode.TEMPO];
      
      if (tempos[0]) {
        track.beatgrid = {
          bpm: parseFloat(tempos[0].Bpm || trackNode.AverageBpm || '120'),
          offset: parseFloat(tempos[0].Inizio || '0'),
        };
      }
    }

    return track;
  }

  private parsePlaylists(nodes: any[], tracks: Map<string, Track>): Playlist[] {
    const playlists: Playlist[] = [];

    for (const node of nodes) {
      const playlist: Playlist = {
        name: node.Name || '',
        type: node.Type === '0' ? 'FOLDER' : 'PLAYLIST',
        tracks: [],
      };

      // Parse tracks in playlist
      if (node.TRACK) {
        const playlistTracks = Array.isArray(node.TRACK) 
          ? node.TRACK 
          : [node.TRACK];
        
        for (const trackRef of playlistTracks) {
          const trackId = trackRef.Key || '';
          playlist.tracks.push(trackId);
          
          // Add playlist reference to track
          const track = tracks.get(trackId);
          if (track) {
            if (!track.playlists) track.playlists = [];
            track.playlists.push(playlist.name);
          }
        }
      }

      // Parse child nodes (subfolders/playlists)
      if (node.NODE) {
        const childNodes = Array.isArray(node.NODE) 
          ? node.NODE 
          : [node.NODE];
        playlist.children = this.parsePlaylists(childNodes, tracks);
      }

      playlists.push(playlist);
    }

    return playlists;
  }

  async saveLibrary(library: RekordboxLibrary, outputPath: string): Promise<void> {
    const xmlObj = {
      DJ_PLAYLISTS: {
        $: { Version: library.version },
        PRODUCT: { $: { Name: 'rekordbox', Version: '6.0.0', Company: 'Pioneer DJ' } },
        COLLECTION: {
          $: { Entries: library.tracks.size.toString() },
          TRACK: Array.from(library.tracks.values()).map(track => this.trackToXML(track)),
        },
        PLAYLISTS: {
          NODE: this.playlistsToXML(library.playlists, library.tracks),
        },
      },
    };

    const xml = this.builder.buildObject(xmlObj);
    await fs.promises.writeFile(outputPath, xml, 'utf-8');
  }

  private trackToXML(track: Track): any {
    const xmlTrack: any = {
      $: {
        TrackID: track.id,
        Name: track.name,
        Artist: track.artist,
        Location: 'file://localhost' + encodeURIComponent(track.location),
      },
    };

    // Add optional attributes
    if (track.album) xmlTrack.$.Album = track.album;
    if (track.genre) xmlTrack.$.Genre = track.genre;
    if (track.bpm) xmlTrack.$.AverageBpm = track.bpm.toString();
    if (track.key) xmlTrack.$.Tonality = track.key;
    if (track.size) xmlTrack.$.Size = track.size.toString();
    if (track.bitrate) xmlTrack.$.BitRate = track.bitrate.toString();
    if (track.duration) xmlTrack.$.TotalTime = track.duration.toString();
    if (track.playCount) xmlTrack.$.PlayCount = track.playCount.toString();
    if (track.rating) xmlTrack.$.Rating = track.rating.toString();
    if (track.comments) xmlTrack.$.Comments = track.comments;

    // Add position marks
    const positionMarks: any[] = [];
    
    if (track.cues) {
      for (const cue of track.cues) {
        const mark: any = {
          $: {
            Type: 'CUE',
            Start: cue.start.toString(),
          },
        };
        if (cue.name) mark.$.Name = cue.name;
        if (cue.hotcue !== undefined) mark.$.Num = cue.hotcue.toString();
        positionMarks.push(mark);
      }
    }

    if (track.loops) {
      for (const loop of track.loops) {
        const mark: any = {
          $: {
            Type: 'LOOP',
            Start: loop.start.toString(),
            End: loop.end.toString(),
          },
        };
        if (loop.name) mark.$.Name = loop.name;
        positionMarks.push(mark);
      }
    }

    if (positionMarks.length > 0) {
      xmlTrack.POSITION_MARK = positionMarks;
    }

    // Add beatgrid/tempo
    if (track.beatgrid) {
      xmlTrack.TEMPO = {
        $: {
          Bpm: track.beatgrid.bpm.toString(),
          Inizio: track.beatgrid.offset.toString(),
        },
      };
    }

    return xmlTrack;
  }

  private playlistsToXML(playlists: Playlist[], tracks: Map<string, Track>): any[] {
    return playlists.map(playlist => {
      const node: any = {
        $: {
          Type: playlist.type === 'FOLDER' ? '0' : '1',
          Name: playlist.name,
          Entries: playlist.tracks.length.toString(),
        },
      };

      // Add tracks to playlist
      if (playlist.tracks.length > 0) {
        node.TRACK = playlist.tracks.map(trackId => ({
          $: { Key: trackId },
        }));
      }

      // Add child nodes
      if (playlist.children && playlist.children.length > 0) {
        node.NODE = this.playlistsToXML(playlist.children, tracks);
      }

      return node;
    });
  }
}
