export type HostPlatform = 'windows' | 'macos' | 'linux';

export interface KeyCommand {
  platform: HostPlatform;
  /** Where to paste it. */
  shell: string;
  command: string;
}

/** Which operating system the window is running on. */
export function platformFromUserAgent(userAgent: string): HostPlatform {
  if (/windows/i.test(userAgent)) { return 'windows'; }
  if (/mac os x|macintosh/i.test(userAgent)) { return 'macos'; }
  return 'linux';
}

const PYTHON_ONE_LINER =
  'from pyrekordbox.utils import deobfuscate; '
  + 'from pyrekordbox.db6.database import BLOB; '
  + 'print(deobfuscate(BLOB))';

/**
 * A command that prints the rekordbox database key on this machine.
 *
 * The key is not shipped with this app. It comes from pyrekordbox, the
 * open-source project that documents it — the command installs pyrekordbox and
 * asks it, so the value is produced locally from a package you can read rather
 * than handed over by us. It is the same on every rekordbox 6/7 install.
 */
export function keyCommandFor(platform: HostPlatform): KeyCommand {
  if (platform === 'windows') {
    return {
      platform,
      shell: 'PowerShell',
      command: `py -m pip install --quiet --user pyrekordbox; py -c "${PYTHON_ONE_LINER}"`,
    };
  }
  return {
    platform,
    shell: platform === 'macos' ? 'Terminal' : 'a terminal',
    command: `python3 -m pip install --quiet --user pyrekordbox && python3 -c "${PYTHON_ONE_LINER}"`,
  };
}

/** The key is 64 hexadecimal characters; anything else was mis-copied. */
export function looksLikeDbKey(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}
