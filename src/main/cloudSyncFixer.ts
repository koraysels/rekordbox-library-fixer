import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Dropbox } from 'dropbox';
import { Logger } from './logger';

export interface CloudSyncIssue {
  trackId: string;
  trackName: string;
  originalLocation: string;
  issueType: 'online-only' | 'path-mismatch' | 'missing-local' | 'sync-conflict';
  cloudPath?: string;
  localPath?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CloudSyncFix {
  trackId: string;
  originalLocation: string;
  fixedLocation?: string;
  success: boolean;
  action: 'download' | 'path-update' | 'local-copy' | 'manual-required';
  error?: string;
}

export interface DropboxConfig {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export class CloudSyncFixer {
  private logger: Logger;
  private dropbox?: Dropbox;
  private dropboxPath?: string;

  constructor() {
    this.logger = new Logger();
    this.detectDropboxPath();
  }

  private detectDropboxPath(): void {
    const platform = os.platform();
    const homeDir = os.homedir();

    // Common Dropbox locations by platform
    const dropboxPaths: Record<string, string[]> = {
      darwin: [
        path.join(homeDir, 'Dropbox'),
        path.join(homeDir, 'Dropbox (Personal)'),
        path.join(homeDir, 'Dropbox (Business)')
      ],
      win32: [
        path.join(homeDir, 'Dropbox'),
        path.join(homeDir, 'Dropbox (Personal)'),
        path.join(homeDir, 'Dropbox (Business)')
      ],
      linux: [
        path.join(homeDir, 'Dropbox'),
        path.join(homeDir, 'dropbox'),
        path.join(homeDir, '.dropbox')
      ]
    };

    const possiblePaths = dropboxPaths[platform] || [];

    for (const dbPath of possiblePaths) {
      if (fs.existsSync(dbPath)) {
        this.dropboxPath = dbPath;
        this.logger.info('CLOUD_SYNC_DROPBOX_DETECTED', { path: dbPath });
        break;
      }
    }

    if (!this.dropboxPath) {
      this.logger.warning('CLOUD_SYNC_DROPBOX_NOT_FOUND', { searchedPaths: possiblePaths });
    }
  }

  async initializeDropboxAPI(config: DropboxConfig): Promise<boolean> {
    try {
      if (!config.accessToken) {
        this.logger.error('CLOUD_SYNC_DROPBOX_NO_TOKEN', {});
        return false;
      }

      this.dropbox = new Dropbox({
        accessToken: config.accessToken,
        clientId: config.clientId,
        clientSecret: config.clientSecret
      });

      // Test the connection
      const account = await this.dropbox.usersGetCurrentAccount();
      this.logger.info('CLOUD_SYNC_DROPBOX_CONNECTED', {
        accountId: account.result.account_id,
        name: account.result.name.display_name
      });

      return true;
    } catch (error) {
      this.logger.error('CLOUD_SYNC_DROPBOX_INIT_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async detectCloudSyncIssues(tracks: Map<string, any>): Promise<CloudSyncIssue[]> {
    this.logger.info('CLOUD_SYNC_SCAN_START', { totalTracks: tracks.size });
    const issues: CloudSyncIssue[] = [];

    for (const [id, track] of tracks.entries()) {
      if (!track.location) {continue;}

      try {
        const issue = await this.analyzeTrackForCloudIssues(id, track);
        if (issue) {
          issues.push(issue);
        }
      } catch (error) {
        this.logger.error('CLOUD_SYNC_ANALYZE_FAILED', {
          trackId: id,
          location: track.location,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.logger.info('CLOUD_SYNC_SCAN_COMPLETE', {
      issuesFound: issues.length,
      totalTracks: tracks.size
    });

    return issues;
  }

  private async analyzeTrackForCloudIssues(trackId: string, track: any): Promise<CloudSyncIssue | null> {
    const location = track.location;

    // Check if it's a Dropbox path
    if (!this.isDropboxPath(location)) {
      return null; // Not a cloud sync issue
    }

    // Check if file exists locally
    const localExists = fs.existsSync(location);

    if (!localExists) {
      // File doesn't exist locally - could be online-only or moved
      return {
        trackId,
        trackName: track.name || 'Unknown',
        originalLocation: location,
        issueType: 'online-only',
        cloudPath: this.convertToDropboxPath(location),
        severity: 'high'
      };
    }

    // Check for macOS Monterey+ online-only files
    if (await this.isOnlineOnlyFile(location)) {
      return {
        trackId,
        trackName: track.name || 'Unknown',
        originalLocation: location,
        issueType: 'online-only',
        cloudPath: this.convertToDropboxPath(location),
        localPath: location,
        severity: 'medium'
      };
    }

    // Check for path mismatches (case sensitivity issues, etc.)
    const normalizedPath = this.normalizePath(location);
    if (normalizedPath !== location && fs.existsSync(normalizedPath)) {
      return {
        trackId,
        trackName: track.name || 'Unknown',
        originalLocation: location,
        issueType: 'path-mismatch',
        localPath: normalizedPath,
        severity: 'low'
      };
    }

    return null;
  }

  async fixCloudSyncIssue(issue: CloudSyncIssue): Promise<CloudSyncFix> {
    this.logger.info('CLOUD_SYNC_FIX_START', {
      trackId: issue.trackId,
      issueType: issue.issueType
    });

    try {
      switch (issue.issueType) {
        case 'online-only':
          return await this.fixOnlineOnlyFile(issue);

        case 'path-mismatch':
          return await this.fixPathMismatch(issue);

        case 'missing-local':
          return await this.downloadFromDropbox(issue);

        case 'sync-conflict':
          return await this.resolveSyncConflict(issue);

        default:
          return {
            trackId: issue.trackId,
            originalLocation: issue.originalLocation,
            success: false,
            action: 'manual-required',
            error: 'Unknown issue type'
          };
      }
    } catch (error) {
      this.logger.error('CLOUD_SYNC_FIX_FAILED', {
        trackId: issue.trackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        trackId: issue.trackId,
        originalLocation: issue.originalLocation,
        success: false,
        action: 'manual-required',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fixOnlineOnlyFile(issue: CloudSyncIssue): Promise<CloudSyncFix> {
    // Try to make the file available locally
    try {
      if (os.platform() === 'darwin') {
        // macOS: Try to trigger download by accessing file metadata
        const { execSync } = require('child_process');
        execSync(`xattr -l "${issue.originalLocation}"`, { stdio: 'ignore' });

        // Wait a bit for the download to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (fs.existsSync(issue.originalLocation) && !await this.isOnlineOnlyFile(issue.originalLocation)) {
          return {
            trackId: issue.trackId,
            originalLocation: issue.originalLocation,
            fixedLocation: issue.originalLocation,
            success: true,
            action: 'download'
          };
        }
      }

      // If direct download didn't work, try Dropbox API
      if (this.dropbox && issue.cloudPath) {
        return await this.downloadFromDropbox(issue);
      }

      return {
        trackId: issue.trackId,
        originalLocation: issue.originalLocation,
        success: false,
        action: 'manual-required',
        error: 'Unable to download online-only file'
      };

    } catch (error) {
      return {
        trackId: issue.trackId,
        originalLocation: issue.originalLocation,
        success: false,
        action: 'manual-required',
        error: `Failed to access online-only file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async fixPathMismatch(issue: CloudSyncIssue): Promise<CloudSyncFix> {
    if (issue.localPath && fs.existsSync(issue.localPath)) {
      return {
        trackId: issue.trackId,
        originalLocation: issue.originalLocation,
        fixedLocation: issue.localPath,
        success: true,
        action: 'path-update'
      };
    }

    return {
      trackId: issue.trackId,
      originalLocation: issue.originalLocation,
      success: false,
      action: 'manual-required',
      error: 'Corrected path not found'
    };
  }

  private async downloadFromDropbox(issue: CloudSyncIssue): Promise<CloudSyncFix> {
    if (!this.dropbox || !issue.cloudPath) {
      return {
        trackId: issue.trackId,
        originalLocation: issue.originalLocation,
        success: false,
        action: 'manual-required',
        error: 'Dropbox API not available'
      };
    }

    try {
      // Download file from Dropbox
      const response = await this.dropbox.filesDownload({ path: issue.cloudPath });
      const fileBuffer = (response.result as any).fileBinary;

      // Write to local path
      fs.writeFileSync(issue.originalLocation, fileBuffer);

      return {
        trackId: issue.trackId,
        originalLocation: issue.originalLocation,
        fixedLocation: issue.originalLocation,
        success: true,
        action: 'download'
      };

    } catch (error) {
      return {
        trackId: issue.trackId,
        originalLocation: issue.originalLocation,
        success: false,
        action: 'manual-required',
        error: `Dropbox download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async resolveSyncConflict(issue: CloudSyncIssue): Promise<CloudSyncFix> {
    // For now, mark as requiring manual intervention
    // In the future, could implement logic to choose the newest file
    return {
      trackId: issue.trackId,
      originalLocation: issue.originalLocation,
      success: false,
      action: 'manual-required',
      error: 'Sync conflict requires manual resolution'
    };
  }

  private isDropboxPath(filePath: string): boolean {
    if (!this.dropboxPath) {return false;}
    return filePath.toLowerCase().includes(this.dropboxPath.toLowerCase());
  }

  private convertToDropboxPath(localPath: string): string {
    if (!this.dropboxPath) {return localPath;}

    const relativePath = path.relative(this.dropboxPath, localPath);
    return '/' + relativePath.replace(/\\/g, '/');
  }

  private normalizePath(filePath: string): string {
    // Handle case sensitivity and path separators
    return path.normalize(filePath);
  }

  private async isOnlineOnlyFile(filePath: string): Promise<boolean> {
    if (os.platform() !== 'darwin') {return false;}

    try {
      const { execSync } = require('child_process');
      const result = execSync(`xattr -l "${filePath}"`, { encoding: 'utf8' });

      // Check for Dropbox online-only attributes
      return result.includes('com.dropbox.ignored') ||
             result.includes('com.dropbox.attrs');
    } catch {
      return false;
    }
  }

  async batchFixCloudSyncIssues(issues: CloudSyncIssue[]): Promise<CloudSyncFix[]> {
    this.logger.info('CLOUD_SYNC_BATCH_FIX_START', { count: issues.length });

    const results: CloudSyncFix[] = [];
    let successCount = 0;

    for (const issue of issues) {
      const result = await this.fixCloudSyncIssue(issue);
      results.push(result);

      if (result.success) {successCount++;}

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.info('CLOUD_SYNC_BATCH_FIX_COMPLETE', {
      total: issues.length,
      successful: successCount,
      failed: issues.length - successCount
    });

    return results;
  }
}