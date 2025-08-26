import * as crypto from 'crypto';
import { Logger } from './logger';

export interface OwnershipIssue {
  trackId: string;
  trackName: string;
  trackLocation: string;
  currentOwner?: string;
  expectedOwner?: string;
  issueType: 'grey-track' | 'wrong-owner' | 'missing-owner';
  severity: 'low' | 'medium' | 'high';
}

export interface OwnershipFix {
  trackId: string;
  originalOwner?: string;
  newOwner: string;
  success: boolean;
  action: 'ownership-transfer' | 'owner-assignment' | 'uuid-update';
  error?: string;
}

export interface ComputerInfo {
  uuid: string;
  name: string;
  isActive: boolean;
}

export class TrackOwnershipFixer {
  private logger: Logger;
  private currentComputerUUID?: string;

  constructor() {
    this.logger = new Logger();
    this.generateComputerUUID();
  }

  private generateComputerUUID(): void {
    // Generate a consistent UUID based on machine characteristics
    const { execSync } = require('child_process');
    const os = require('os');

    try {
      let identifier: string;
      const platform = os.platform();

      if (platform === 'darwin') {
        // macOS: Use hardware UUID
        identifier = execSync('system_profiler SPHardwareDataType | grep "Hardware UUID"', { encoding: 'utf8' })
          .split(':')[1]?.trim() || '';
      } else if (platform === 'win32') {
        // Windows: Use machine GUID
        identifier = execSync('wmic csproduct get uuid /value', { encoding: 'utf8' })
          .split('=')[1]?.trim() || '';
      } else {
        // Linux: Use machine-id or fallback to hostname + MAC
        try {
          identifier = execSync('cat /etc/machine-id', { encoding: 'utf8' }).trim();
        } catch {
          identifier = os.hostname() + JSON.stringify(os.networkInterfaces());
        }
      }

      if (identifier) {
        // Create a consistent UUID from the identifier
        this.currentComputerUUID = crypto.createHash('sha256')
          .update(identifier)
          .digest('hex')
          .substring(0, 32)
          .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
      } else {
        // Fallback: generate random UUID (less ideal as it won't be consistent)
        this.currentComputerUUID = crypto.randomUUID();
      }

      this.logger.info('OWNERSHIP_FIXER_UUID_GENERATED', { 
        uuid: this.currentComputerUUID 
      });

    } catch (error) {
      this.logger.error('OWNERSHIP_FIXER_UUID_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback to random UUID
      this.currentComputerUUID = crypto.randomUUID();
    }
  }

  async detectOwnershipIssues(
    tracks: Map<string, any>,
    computers: Map<string, ComputerInfo>
  ): Promise<OwnershipIssue[]> {
    this.logger.info('OWNERSHIP_FIXER_SCAN_START', { 
      totalTracks: tracks.size,
      computers: computers.size 
    });

    const issues: OwnershipIssue[] = [];
    const activeComputerUUIDs = Array.from(computers.values())
      .filter(comp => comp.isActive)
      .map(comp => comp.uuid);

    for (const [id, track] of tracks.entries()) {
      try {
        const issue = this.analyzeTrackOwnership(id, track, activeComputerUUIDs);
        if (issue) {
          issues.push(issue);
        }
      } catch (error) {
        this.logger.error('OWNERSHIP_FIXER_ANALYZE_FAILED', {
          trackId: id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.logger.info('OWNERSHIP_FIXER_SCAN_COMPLETE', { 
      issuesFound: issues.length,
      totalTracks: tracks.size 
    });

    return issues;
  }

  private analyzeTrackOwnership(
    trackId: string,
    track: any,
    activeComputerUUIDs: string[]
  ): OwnershipIssue | null {
    // Check if track has no owner (grey track)
    if (!track.owner || track.owner === '') {
      return {
        trackId,
        trackName: track.name || 'Unknown',
        trackLocation: track.location || '',
        issueType: 'grey-track',
        severity: 'high'
      };
    }

    // Check if track owner is not in active computers
    if (!activeComputerUUIDs.includes(track.owner)) {
      return {
        trackId,
        trackName: track.name || 'Unknown',
        trackLocation: track.location || '',
        currentOwner: track.owner,
        expectedOwner: this.currentComputerUUID,
        issueType: 'wrong-owner',
        severity: 'medium'
      };
    }

    // Track ownership looks good
    return null;
  }

  async fixTrackOwnership(issue: OwnershipIssue): Promise<OwnershipFix> {
    this.logger.info('OWNERSHIP_FIXER_FIX_START', {
      trackId: issue.trackId,
      issueType: issue.issueType
    });

    if (!this.currentComputerUUID) {
      return {
        trackId: issue.trackId,
        newOwner: '',
        success: false,
        action: 'uuid-update',
        error: 'Current computer UUID not available'
      };
    }

    try {
      switch (issue.issueType) {
        case 'grey-track':
          return {
            trackId: issue.trackId,
            originalOwner: undefined,
            newOwner: this.currentComputerUUID,
            success: true,
            action: 'owner-assignment'
          };

        case 'wrong-owner':
          return {
            trackId: issue.trackId,
            originalOwner: issue.currentOwner,
            newOwner: this.currentComputerUUID,
            success: true,
            action: 'ownership-transfer'
          };

        case 'missing-owner':
          return {
            trackId: issue.trackId,
            originalOwner: undefined,
            newOwner: this.currentComputerUUID,
            success: true,
            action: 'owner-assignment'
          };

        default:
          return {
            trackId: issue.trackId,
            newOwner: this.currentComputerUUID,
            success: false,
            action: 'uuid-update',
            error: 'Unknown ownership issue type'
          };
      }
    } catch (error) {
      this.logger.error('OWNERSHIP_FIXER_FIX_FAILED', {
        trackId: issue.trackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        trackId: issue.trackId,
        newOwner: this.currentComputerUUID,
        success: false,
        action: 'uuid-update',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async batchFixOwnership(issues: OwnershipIssue[]): Promise<OwnershipFix[]> {
    this.logger.info('OWNERSHIP_FIXER_BATCH_START', { count: issues.length });

    const results: OwnershipFix[] = [];
    let successCount = 0;

    for (const issue of issues) {
      const result = await this.fixTrackOwnership(issue);
      results.push(result);
      
      if (result.success) successCount++;
    }

    this.logger.info('OWNERSHIP_FIXER_BATCH_COMPLETE', {
      total: issues.length,
      successful: successCount,
      failed: issues.length - successCount
    });

    return results;
  }

  async updateLibraryOwnership(
    library: any,
    ownershipFixes: OwnershipFix[]
  ): Promise<{ success: boolean; updatedTracks: number; error?: string }> {
    try {
      let updatedCount = 0;

      for (const fix of ownershipFixes) {
        if (!fix.success) continue;

        const track = library.tracks.get(fix.trackId);
        if (track) {
          // Update track ownership in the library
          track.owner = fix.newOwner;
          updatedCount++;

          this.logger.info('OWNERSHIP_FIXER_TRACK_UPDATED', {
            trackId: fix.trackId,
            oldOwner: fix.originalOwner,
            newOwner: fix.newOwner
          });
        }
      }

      // Update computer information if needed
      if (this.currentComputerUUID && !library.computers?.has(this.currentComputerUUID)) {
        const os = require('os');
        const computerInfo: ComputerInfo = {
          uuid: this.currentComputerUUID,
          name: os.hostname(),
          isActive: true
        };

        if (!library.computers) {
          library.computers = new Map();
        }
        library.computers.set(this.currentComputerUUID, computerInfo);

        this.logger.info('OWNERSHIP_FIXER_COMPUTER_ADDED', {
          uuid: this.currentComputerUUID,
          name: computerInfo.name
        });
      }

      this.logger.info('OWNERSHIP_FIXER_LIBRARY_UPDATED', {
        tracksUpdated: updatedCount,
        totalFixes: ownershipFixes.length
      });

      return {
        success: true,
        updatedTracks: updatedCount
      };

    } catch (error) {
      this.logger.error('OWNERSHIP_FIXER_LIBRARY_UPDATE_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        updatedTracks: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getCurrentComputerUUID(): string | undefined {
    return this.currentComputerUUID;
  }

  async regenerateComputerUUID(): Promise<string> {
    this.generateComputerUUID();
    return this.currentComputerUUID || '';
  }

  validateOwnershipIntegrity(
    tracks: Map<string, any>,
    computers: Map<string, ComputerInfo>
  ): {
    totalTracks: number;
    tracksWithOwners: number;
    tracksWithValidOwners: number;
    greyTracks: number;
    orphanedTracks: number;
  } {
    let tracksWithOwners = 0;
    let tracksWithValidOwners = 0;
    let greyTracks = 0;
    let orphanedTracks = 0;

    const activeComputerUUIDs = Array.from(computers.values())
      .filter(comp => comp.isActive)
      .map(comp => comp.uuid);

    for (const [_, track] of tracks.entries()) {
      if (track.owner) {
        tracksWithOwners++;
        
        if (activeComputerUUIDs.includes(track.owner)) {
          tracksWithValidOwners++;
        } else {
          orphanedTracks++;
        }
      } else {
        greyTracks++;
      }
    }

    const stats = {
      totalTracks: tracks.size,
      tracksWithOwners,
      tracksWithValidOwners,
      greyTracks,
      orphanedTracks
    };

    this.logger.info('OWNERSHIP_FIXER_INTEGRITY_CHECK', stats);

    return stats;
  }
}