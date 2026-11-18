import * as fs from 'fs';
import * as path from 'path';
import { isMountPoint } from '../wizard/volumes';

/**
 * Finds rekordbox USB sticks: every mounted volume with
 * `PIONEER/rekordbox/export.pdb`. Read-only — it lists folders and checks that
 * files exist, nothing more.
 */

export interface UsbStick {
  /** The volume's root: `/Volumes/DJSTICK`, `E:\`. */
  root: string;
  /** The drive as the user knows it: `DJSTICK`, `E:`. */
  name: string;
  /** Whether it also carries a OneLibrary database (`exportLibrary.db`), which v1 does not read. */
  hasOneLibrary: boolean;
  /** Whether rekordbox's sync list (`playlists3.sync`) is there: absent on a stick made with Export. */
  hasSyncList: boolean;
}

export const stickFile = (root: string, name: string) => path.join(root, 'PIONEER', 'rekordbox', name);

const exists = (p: string) => fs.promises.access(p).then(() => true, () => false);

async function children(dir: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    // A symlink in /Volumes is the boot disk; on Linux mount points are folders.
    return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

export interface VolumeBases {
  /** macOS. */
  volumes: string;
  /** Linux: `/media/<volume>` and `/media/<user>/<volume>`. */
  media: string;
  /** Linux: `/run/media/<user>/<volume>`. */
  runMedia: string;
}

const defaultBases: VolumeBases = { volumes: '/Volumes', media: '/media', runMedia: '/run/media' };

/** The places a removable drive can be mounted on this platform. */
export async function volumeRoots(
  platform: NodeJS.Platform,
  bases: VolumeBases = defaultBases,
  mountPoint: (root: string) => boolean = isMountPoint,
): Promise<string[]> {
  if (platform === 'win32') {
    // A and B are floppy letters; probing an empty one can stall.
    const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\`);
    const present = await Promise.all(letters.map(exists));
    return letters.filter((_, i) => present[i]);
  }
  if (platform === 'darwin') {
    // An unclean eject can leave an empty folder behind on the boot disk.
    return (await children(bases.volumes)).filter(mountPoint);
  }
  const media = await children(bases.media);
  const perUser = (await Promise.all(media.map(children))).flat();
  const runMedia = (await Promise.all((await children(bases.runMedia)).map(children))).flat();
  return [...media, ...perUser, ...runMedia];
}

function stickName(root: string, platform: NodeJS.Platform): string {
  if (platform === 'win32') {return root.replace(/[\\/]+$/, '');}
  return path.basename(root);
}

/** The stick at `root`, or null when it holds no `export.pdb`. */
export async function stickAt(root: string, platform: NodeJS.Platform = process.platform): Promise<UsbStick | null> {
  if (!(await exists(stickFile(root, 'export.pdb')))) {return null;}
  const [hasOneLibrary, hasSyncList] = await Promise.all([
    exists(stickFile(root, 'exportLibrary.db')),
    exists(stickFile(root, 'playlists3.sync')),
  ]);
  return { root, name: stickName(root, platform), hasOneLibrary, hasSyncList };
}

export async function findSticks(
  platform: NodeJS.Platform = process.platform,
  bases?: VolumeBases,
  mountPoint?: (root: string) => boolean,
): Promise<UsbStick[]> {
  const roots = await volumeRoots(platform, bases, mountPoint);
  const sticks = await Promise.all(roots.map((r) => stickAt(r, platform)));
  return sticks.filter((s): s is UsbStick => s !== null);
}
