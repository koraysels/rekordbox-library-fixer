import * as fs from 'fs';

/**
 * Which drive a path lives on, and whether that drive is plugged in.
 *
 * "Mounted" means the volume root exists. The internal disk (`/`) always does, so
 * only an external volume can read as unplugged — and an entry on an unplugged
 * volume is never removed, moved or counted as broken: its file is not lost, the
 * drive is just not there right now.
 */
export function volumeRoot(p: string, platform: NodeJS.Platform): string {
  if (platform === 'win32') {return windowsRoot(p);}
  const parts = p.split('/');
  if (platform === 'darwin') {
    return parts[1] === 'Volumes' && parts[2] ? `/Volumes/${parts[2]}` : '/';
  }
  if (parts[1] === 'media' && parts[2] && parts[3]) {return parts.slice(0, 4).join('/');}
  if (parts[1] === 'run' && parts[2] === 'media' && parts[3] && parts[4]) {return parts.slice(0, 5).join('/');}
  if (parts[1] === 'mnt' && parts[2]) {return parts.slice(0, 3).join('/');}
  return '/';
}

function windowsRoot(p: string): string {
  const drive = /^([a-z]):[\\/]?/i.exec(p);
  if (drive) {return `${drive[1].toUpperCase()}:\\`;}
  const unc = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)/.exec(p);
  if (unc) {return `\\\\${unc[1]}\\${unc[2]}`;}
  return '\\';
}

/** The drive as the user knows it: `DJ SSD`, `D:`, `\\nas\music`. */
export function driveName(p: string, platform: NodeJS.Platform): string {
  const root = volumeRoot(p, platform);
  if (platform === 'win32') {
    return /^[A-Z]:\\$/.test(root) ? root.slice(0, 2) : root;
  }
  return root === '/' ? root : root.slice(root.lastIndexOf('/') + 1);
}

export function isVolumeMounted(
  p: string,
  platform: NodeJS.Platform,
  exists: (p: string) => boolean = fs.existsSync,
): boolean {
  return exists(volumeRoot(p, platform));
}

const forCompare = (p: string) => p.normalize('NFC').toLowerCase().replace(/\\/g, '/');

/**
 * Whether `p` is `folder` or lies under it. NFC and case-insensitive, like every
 * path comparison here, and stopping at a separator so `/Music2` is not inside
 * `/Music`. An unset folder holds nothing.
 */
export function isInsideFolder(p: string, folder: string): boolean {
  if (!folder) {return false;}
  const f = forCompare(folder).replace(/\/+$/, '');
  const target = forCompare(p);
  return target === f || target.startsWith(`${f}/`);
}
