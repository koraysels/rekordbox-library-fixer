import { describe, it, expect, vi } from 'vitest';
vi.unmock('fs');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { volumeRoot, isVolumeMounted, isInsideFolder, driveName, isMountPoint } from '../../src/main/wizard/volumes';

describe('volumeRoot', () => {
  it('finds the external volume on macOS', () => {
    expect(volumeRoot('/Volumes/DJ SSD/a/b.mp3', 'darwin')).toBe('/Volumes/DJ SSD');
  });

  it('treats everything else on macOS as the internal disk', () => {
    expect(volumeRoot('/Users/x/a.mp3', 'darwin')).toBe('/');
  });

  it('finds the drive letter on Windows, upper-cased', () => {
    expect(volumeRoot('D:\\Music\\a.mp3', 'win32')).toBe('D:\\');
    expect(volumeRoot('d:\\Music\\a.mp3', 'win32')).toBe('D:\\');
    expect(volumeRoot('e:/Music/a.mp3', 'win32')).toBe('E:\\');
  });

  it('finds the share of a UNC path', () => {
    expect(volumeRoot('\\\\nas\\music\\a.mp3', 'win32')).toBe('\\\\nas\\music');
  });

  it('finds the mount point on Linux', () => {
    expect(volumeRoot('/media/kim/USB/a.mp3', 'linux')).toBe('/media/kim/USB');
    expect(volumeRoot('/run/media/kim/USB/a.mp3', 'linux')).toBe('/run/media/kim/USB');
    expect(volumeRoot('/mnt/disk/a.mp3', 'linux')).toBe('/mnt/disk');
    expect(volumeRoot('/home/kim/a.mp3', 'linux')).toBe('/');
  });
});

describe('driveName', () => {
  it('names a drive the way the user sees it', () => {
    expect(driveName('/Volumes/DJ SSD/a.mp3', 'darwin')).toBe('DJ SSD');
    expect(driveName('D:\\Music\\a.mp3', 'win32')).toBe('D:');
    expect(driveName('\\\\nas\\music\\a.mp3', 'win32')).toBe('\\\\nas\\music');
    expect(driveName('/media/kim/USB/a.mp3', 'linux')).toBe('USB');
  });
});

describe('isVolumeMounted', () => {
  it('asks whether the volume root exists', () => {
    const seen: string[] = [];
    const exists = (p: string) => { seen.push(p); return p === '/Volumes/DJ SSD'; };
    expect(isVolumeMounted('/Volumes/DJ SSD/a.mp3', 'darwin', exists, () => true)).toBe(true);
    expect(isVolumeMounted('/Volumes/Gone/a.mp3', 'darwin', exists, () => true)).toBe(false);
    expect(seen).toEqual(['/Volumes/DJ SSD', '/Volumes/Gone']);
  });

  it('counts the internal disk as mounted', () => {
    expect(isVolumeMounted('/Users/x/a.mp3', 'darwin', (p) => p === '/', () => false)).toBe(true);
  });

  it('does not count an empty folder left in /Volumes as the drive', () => {
    // An unclean eject can leave /Volumes/DJ SSD behind; the drive then mounts as "DJ SSD 1".
    const exists = (p: string) => p === '/Volumes/DJ SSD';
    const asked: string[] = [];
    const mountPoint = (root: string) => { asked.push(root); return false; };
    expect(isVolumeMounted('/Volumes/DJ SSD/a.mp3', 'darwin', exists, mountPoint)).toBe(false);
    expect(asked).toEqual(['/Volumes/DJ SSD']);
  });

  it('asks the same of a Linux mount point, but not of a Windows drive letter', () => {
    expect(isVolumeMounted('/media/kim/USB/a.mp3', 'linux', () => true, () => false)).toBe(false);
    expect(isVolumeMounted('D:\\a.mp3', 'win32', () => true, () => false)).toBe(true);
  });
});

describe('isMountPoint', () => {
  it('is false for a plain folder on the same disk as its parent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mount-point-'));
    try {
      expect(isMountPoint(dir)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is false for a folder that is not there', () => {
    expect(isMountPoint(path.join(os.tmpdir(), 'no-such-volume-for-this-test'))).toBe(false);
  });
});

describe('isInsideFolder', () => {
  it('stops at a separator boundary', () => {
    expect(isInsideFolder('/Music2/x.mp3', '/Music')).toBe(false);
    expect(isInsideFolder('/Music/x.mp3', '/Music')).toBe(true);
    expect(isInsideFolder('/Music/sub/x.mp3', '/Music/')).toBe(true);
  });

  it('reads composed and decomposed accents as one path', () => {
    const composed = '/Music/Bj\u00f6rk';
    const decomposed = '/Music/Bjo\u0308rk';
    expect(isInsideFolder(`${decomposed}/x.mp3`, composed)).toBe(true);
    expect(isInsideFolder(`${composed}/x.mp3`, decomposed)).toBe(true);
  });

  it('ignores case', () => {
    expect(isInsideFolder('/users/kim/MUSIC/x.mp3', '/Users/Kim/Music')).toBe(true);
  });

  it('works with Windows separators', () => {
    expect(isInsideFolder('D:\\Music\\x.mp3', 'd:\\music')).toBe(true);
    expect(isInsideFolder('D:\\Music2\\x.mp3', 'D:\\Music')).toBe(false);
  });

  it('puts nothing inside an unset folder', () => {
    expect(isInsideFolder('/Music/x.mp3', '')).toBe(false);
  });
});
