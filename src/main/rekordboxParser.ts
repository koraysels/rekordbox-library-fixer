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
  // Required Rekordbox fields that must be preserved
  composer?: string;
  grouping?: string;
  kind?: string;
  discNumber?: number;
  trackNumber?: number;
  year?: number;
  sampleRate?: number;
  remixer?: string;
  label?: string;
  mix?: string;
  // Store all TEMPO elements, not just the first one
  tempos?: Array<{
    bpm: number;
    inizio: number;
    metro?: string;
    battito?: number;
  }>;
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
      const topLevelNodes = Array.isArray(result.DJ_PLAYLISTS.PLAYLISTS.NODE)
        ? result.DJ_PLAYLISTS.PLAYLISTS.NODE
        : [result.DJ_PLAYLISTS.PLAYLISTS.NODE];

      // Look for ROOT node (Type="0" with Name="ROOT")
      const rootNode = topLevelNodes.find((node: any) => 
        node.Type === '0' && node.Name === 'ROOT'
      );

      if (rootNode && rootNode.NODE) {
        // Parse children of ROOT node
        const rootChildren = Array.isArray(rootNode.NODE) 
          ? rootNode.NODE 
          : [rootNode.NODE];
        library.playlists = this.parsePlaylists(rootChildren, library.tracks);
      } else {
        // No ROOT node found, parse all top-level nodes directly
        library.playlists = this.parsePlaylists(topLevelNodes, library.tracks);
      }
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
      // Required Rekordbox fields
      composer: trackNode.Composer || '',
      grouping: trackNode.Grouping || '',
      kind: trackNode.Kind,
      discNumber: trackNode.DiscNumber ? parseInt(trackNode.DiscNumber) : 0,
      trackNumber: trackNode.TrackNumber ? parseInt(trackNode.TrackNumber) : 0,
      year: trackNode.Year ? parseInt(trackNode.Year) : 0,
      sampleRate: trackNode.SampleRate ? parseInt(trackNode.SampleRate) : undefined,
      remixer: trackNode.Remixer || '',
      label: trackNode.Label || '',
      mix: trackNode.Mix || '',
      dateAdded: trackNode.DateAdded ? new Date(trackNode.DateAdded) : undefined,
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

    // Parse ALL tempo elements, not just the first one
    if (trackNode.TEMPO) {
      const tempos = Array.isArray(trackNode.TEMPO)
        ? trackNode.TEMPO
        : [trackNode.TEMPO];

      track.tempos = tempos.map((tempo: any) => ({
        bpm: parseFloat(tempo.Bpm || trackNode.AverageBpm || '120'),
        inizio: parseFloat(tempo.Inizio || '0'),
        metro: tempo.Metro,
        battito: tempo.Battito ? parseInt(tempo.Battito) : undefined,
      }));

      // Keep the first tempo as beatgrid for backward compatibility
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
            if (!track.playlists) {track.playlists = [];}
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
          NODE: {
            $: {
              Type: '0',
              Name: 'ROOT',
              Count: library.playlists.length.toString()
            },
            NODE: this.playlistsToXML(library.playlists, library.tracks)
          }
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
        Artist: track.artist || '',
        Composer: track.composer || '',
        Album: track.album || '',
        Grouping: track.grouping || '',
        Genre: track.genre || '',
        Kind: track.kind || '',
        Size: track.size?.toString() || '',
        TotalTime: track.duration?.toString() || '',
        DiscNumber: track.discNumber?.toString() || '0',
        TrackNumber: track.trackNumber?.toString() || '0',
        Year: track.year?.toString() || '0',
        AverageBpm: track.bpm?.toString() || '0.00',
        DateAdded: track.dateAdded ? track.dateAdded.toISOString().split('T')[0] : '',
        BitRate: track.bitrate?.toString() || '',
        SampleRate: track.sampleRate?.toString() || '',
        Comments: track.comments || '',
        PlayCount: track.playCount?.toString() || '0',
        Rating: track.rating?.toString() || '0',
        Location: 'file://localhost' + encodeURI(track.location).replace(/#/g, '%23'),
        Remixer: track.remixer || '',
        Tonality: track.key || '',
        Label: track.label || '',
        Mix: track.mix || '',
      },
    };

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
        if (cue.name) {mark.$.Name = cue.name;}
        if (cue.hotcue !== undefined) {mark.$.Num = cue.hotcue.toString();}
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
        if (loop.name) {mark.$.Name = loop.name;}
        positionMarks.push(mark);
      }
    }

    if (positionMarks.length > 0) {
      xmlTrack.POSITION_MARK = positionMarks;
    }

    // Add ALL TEMPO elements, not just the first one
    if (track.tempos && track.tempos.length > 0) {
      xmlTrack.TEMPO = track.tempos.map(tempo => {
        const tempoElement: any = {
          $: {
            Inizio: tempo.inizio.toString(),
            Bpm: tempo.bpm.toString(),
          },
        };
        if (tempo.metro) {tempoElement.$.Metro = tempo.metro;}
        if (tempo.battito) {tempoElement.$.Battito = tempo.battito.toString();}
        return tempoElement;
      });
    } else if (track.beatgrid) {
      // Fallback to single tempo if no tempos array
      xmlTrack.TEMPO = {
        $: {
          Inizio: track.beatgrid.offset.toString(),
          Bpm: track.beatgrid.bpm.toString(),
        },
      };
    }

    return xmlTrack;
  }

  private playlistsToXML(playlists: Playlist[], tracks: Map<string, Track>): any[] {
    return playlists.map(playlist => {
      const node: any = {
        $: {
          Name: playlist.name,
          Type: playlist.type === 'FOLDER' ? '0' : '1',
          KeyType: '0',
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
