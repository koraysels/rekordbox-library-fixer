import { describe, it, expect } from 'vitest';
import {
  isNewer, parseFeed, pickMacZip, downloadUrls, appBundleOf, canReplaceBundle, swapScript,
} from '../../src/main/updates/updateFeed';

const YML = `version: 0.6.11
files:
  - url: Rekordbox-Library-Fixer-0.6.11-mac.zip
    sha512: aaa==
    size: 147682498
  - url: Rekordbox-Library-Fixer-0.6.11-arm64-mac.zip
    sha512: bbb==
    size: 145747660
  - url: Rekordbox-Library-Fixer-0.6.11.dmg
    sha512: ccc==
    size: 153232705
path: Rekordbox-Library-Fixer-0.6.11-mac.zip
sha512: aaa==
releaseDate: '2026-11-07T15:26:17.759Z'
`;

describe('isNewer', () => {
  it('compares numerically, not as text', () => {
    expect(isNewer('0.6.10', '0.6.9')).toBe(true);
    expect(isNewer('0.6.9', '0.6.10')).toBe(false);
    expect(isNewer('v1.0.0', '0.9.9')).toBe(true);
    expect(isNewer('0.6.10', '0.6.10')).toBe(false);
  });

  it('treats a release as newer than its pre-release, never the reverse', () => {
    expect(isNewer('0.7.0', '0.7.0-beta.1')).toBe(true);
    expect(isNewer('0.7.0-beta.1', '0.7.0')).toBe(false);
  });
});

describe('parseFeed', () => {
  it('reads the version and every file', () => {
    const feed = parseFeed(YML)!;
    expect(feed.version).toBe('0.6.11');
    expect(feed.files).toHaveLength(3);
    expect(feed.files[1]).toEqual({ url: 'Rekordbox-Library-Fixer-0.6.11-arm64-mac.zip', sha512: 'bbb==', size: 145747660 });
  });

  it('is null for something that is not a feed', () => {
    expect(parseFeed('<html>Not Found</html>')).toBeNull();
  });
});

describe('pickMacZip', () => {
  const files = parseFeed(YML)!.files;
  it('takes the arm64 zip on Apple Silicon and the plain one on Intel', () => {
    expect(pickMacZip(files, 'arm64')?.url).toBe('Rekordbox-Library-Fixer-0.6.11-arm64-mac.zip');
    expect(pickMacZip(files, 'x64')?.url).toBe('Rekordbox-Library-Fixer-0.6.11-mac.zip');
  });
  it('never offers a dmg', () => {
    expect(pickMacZip(files.filter((f) => f.url.endsWith('.dmg')), 'arm64')).toBeNull();
  });
});

describe('downloadUrls', () => {
  it('tries the feed name, then the dotted name GitHub gave older uploads', () => {
    expect(downloadUrls('o', 'r', '0.6.11', 'Rekordbox-Library-Fixer-0.6.11-arm64-mac.zip')).toEqual([
      'https://github.com/o/r/releases/download/v0.6.11/Rekordbox-Library-Fixer-0.6.11-arm64-mac.zip',
      'https://github.com/o/r/releases/download/v0.6.11/Rekordbox.Library.Fixer-0.6.11-arm64-mac.zip',
    ]);
  });
});

describe('appBundleOf / canReplaceBundle', () => {
  it('finds the bundle around the executable', () => {
    expect(appBundleOf('/Applications/Rekordbox Library Fixer.app/Contents/MacOS/Rekordbox Library Fixer'))
      .toBe('/Applications/Rekordbox Library Fixer.app');
    expect(appBundleOf('/usr/local/bin/electron')).toBeNull();
  });

  it('refuses a translocated copy or one on a disk image', () => {
    expect(canReplaceBundle('/Applications/X.app')).toBe(true);
    expect(canReplaceBundle('/private/var/folders/ab/T/AppTranslocation/123/d/X.app')).toBe(false);
    expect(canReplaceBundle('/Volumes/Rekordbox Library Fixer/X.app')).toBe(false);
  });
});

describe('swapScript', () => {
  it('moves the old app aside first and puts it back if the swap fails', () => {
    const s = swapScript();
    expect(s.indexOf('mv "$TARGET" "$BACKUP"')).toBeLessThan(s.indexOf('mv "$NEW" "$TARGET"'));
    expect(s).toContain('mv "$BACKUP" "$TARGET"');
    expect(s).toContain('kill -0 "$PID"');
  });

  it('does not wait forever for an app stuck in teardown', () => {
    const s = swapScript();
    expect(s).toContain('seq 1 50');
    expect(s.indexOf('kill -9 "$PID"')).toBeLessThan(s.indexOf('mv "$TARGET" "$BACKUP"'));
  });
});
