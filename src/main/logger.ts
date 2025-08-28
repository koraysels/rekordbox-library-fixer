import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  operation: string;
  details: any;
}

export class Logger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, `rekordbox-manager-${this.getDateString()}.log`);
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private writeLog(entry: LogEntry): void {
    const logLine = `[${entry.timestamp}] ${entry.level.toUpperCase()} - ${entry.operation}\n${JSON.stringify(entry.details, null, 2)}\n\n`;

    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(operation: string, details: any = {}): void {
    this.writeLog({
      timestamp: this.getTimestamp(),
      level: 'info',
      operation,
      details
    });
  }

  warning(operation: string, details: any = {}): void {
    this.writeLog({
      timestamp: this.getTimestamp(),
      level: 'warning',
      operation,
      details
    });
  }

  error(operation: string, details: any = {}): void {
    this.writeLog({
      timestamp: this.getTimestamp(),
      level: 'error',
      operation,
      details
    });
  }

  logDuplicateResolution(
    strategy: string,
    duplicateSets: any[],
    tracksToKeep: Map<string, any>,
    tracksRemoved: number
  ): void {
    const details = {
      strategy,
      totalDuplicateSets: duplicateSets.length,
      totalTracksKept: tracksToKeep.size,
      totalTracksRemoved: tracksRemoved,
      duplicateSets: duplicateSets.map(set => ({
        id: set.id,
        matchType: set.matchType,
        confidence: set.confidence,
        tracksCount: set.tracks.length,
        tracksInSet: set.tracks.map((track: any) => ({
          id: track.id,
          name: track.name,
          artist: track.artist,
          location: track.location,
          size: track.size,
          bitrate: track.bitrate
        }))
      })),
      keptTracks: Array.from(tracksToKeep.values()).map((track: any) => ({
        id: track.id,
        name: track.name,
        artist: track.artist,
        location: track.location,
        reason: 'Selected by strategy: ' + strategy
      }))
    };

    this.info('DUPLICATE_RESOLUTION_COMPLETED', details);
  }

  logLibraryParsing(xmlPath: string, trackCount: number, playlistCount: number): void {
    this.info('LIBRARY_PARSING_COMPLETED', {
      xmlPath,
      trackCount,
      playlistCount,
      parseTime: this.getTimestamp()
    });
  }

  logLibrarySaving(outputPath: string, trackCount: number): void {
    this.info('LIBRARY_SAVING_COMPLETED', {
      outputPath,
      trackCount,
      saveTime: this.getTimestamp()
    });
  }

  logDuplicateDetection(
    trackCount: number,
    duplicateSetsFound: number,
    options: any
  ): void {
    this.info('DUPLICATE_DETECTION_COMPLETED', {
      totalTracks: trackCount,
      duplicateSetsFound,
      detectionOptions: options,
      detectionTime: this.getTimestamp()
    });
  }

  getLogPath(): string {
    return this.logFile;
  }

  getLogsDirectory(): string {
    return this.logDir;
  }
}