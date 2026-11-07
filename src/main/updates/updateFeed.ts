import * as path from 'path';

/**
 * The pieces of self-updating on macOS that do not touch the network or the
 * disk, kept apart so they can be tested.
 *
 * Squirrel.Mac — what electron-updater uses on macOS — refuses any update not
 * signed with an Apple Developer ID, which this app is not. So on macOS the app
 * reads electron-builder's own feed (latest-mac.yml), downloads the zip for its
 * architecture, checks it against the feed's sha512, and swaps the bundle itself.
 */

export interface FeedFile { url: string; sha512: string; size: number }
export interface Feed { version: string; files: FeedFile[] }

/** Is `latest` a newer version than `current`? Pre-release tags count as older. */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => {
    const [core, pre] = v.replace(/^v/, '').split('-', 2);
    return { nums: core.split('.').map((n) => parseInt(n, 10) || 0), pre: pre ?? null };
  };
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.nums.length, b.nums.length); i++) {
    const d = (a.nums[i] ?? 0) - (b.nums[i] ?? 0);
    if (d !== 0) { return d > 0; }
  }
  // Same numbers: a release is newer than its own pre-release.
  return a.pre === null && b.pre !== null;
}

/** electron-builder's latest-mac.yml, read without a YAML dependency. */
export function parseFeed(yml: string): Feed | null {
  const version = /^version:\s*['"]?([^\s'"]+)/m.exec(yml)?.[1];
  if (!version) { return null; }
  const files: FeedFile[] = [];
  const entry = /-\s+url:\s*(\S+)\s+sha512:\s*(\S+)\s+size:\s*(\d+)/g;
  for (const m of yml.matchAll(entry)) {
    files.push({ url: m[1], sha512: m[2], size: Number(m[3]) });
  }
  return { version, files };
}

/** The zip for this Mac: `-arm64-mac.zip` on Apple Silicon, the plain `-mac.zip` on Intel. */
export function pickMacZip(files: FeedFile[], arch: string): FeedFile | null {
  const zips = files.filter((f) => f.url.endsWith('-mac.zip'));
  const arm = zips.find((f) => f.url.endsWith('-arm64-mac.zip'));
  const intel = zips.find((f) => !f.url.includes('-arm64-'));
  return (arch === 'arm64' ? arm : intel) ?? null;
}

/**
 * Where a release file can be downloaded. GitHub turns spaces in an uploaded
 * name into dots, while the feed names use dashes; releases before v0.6.10 kept
 * the dotted names, so both spellings are offered, the feed's first.
 */
export function downloadUrls(owner: string, repo: string, version: string, fileName: string): string[] {
  const base = `https://github.com/${owner}/${repo}/releases/download/v${version}/`;
  const dotted = fileName.replace(/^Rekordbox-Library-Fixer-/, 'Rekordbox.Library.Fixer-');
  return [...new Set([fileName, dotted])].map((n) => base + encodeURIComponent(n));
}

/** The .app bundle the running executable lives in, or null outside one. */
export function appBundleOf(exePath: string): string | null {
  const marker = '.app/Contents/MacOS/';
  const at = exePath.indexOf(marker);
  return at === -1 ? null : exePath.slice(0, at + '.app'.length);
}

/**
 * Can the bundle be replaced in place? Not when macOS runs it from a
 * translocated read-only copy (an app opened straight from Downloads), and not
 * from inside a mounted disk image.
 */
export function canReplaceBundle(bundle: string): boolean {
  if (bundle.includes('/AppTranslocation/')) { return false; }
  if (bundle.startsWith('/Volumes/')) { return false; }
  return path.isAbsolute(bundle);
}

/**
 * The script that swaps the bundle once the app has quit: the old bundle is
 * moved aside first and put back if the new one cannot be moved in, so a
 * failed swap never leaves the user without an app. A process that has not
 * gone within ten seconds is killed; by then it has saved and called exit.
 */
export function swapScript(): string {
  return `#!/bin/bash
set -x
PID="$1"; NEW="$2"; TARGET="$3"; BACKUP="$4"
echo "swap started $(date)"
for i in $(seq 1 50); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done
# The app has flushed its storage and called exit by now; in testing its
# process could still hang in native teardown, which left the swap waiting.
if kill -0 "$PID" 2>/dev/null; then kill -9 "$PID"; sleep 0.5; fi
if ! mv "$TARGET" "$BACKUP"; then open "$TARGET"; exit 1; fi
if mv "$NEW" "$TARGET"; then
  xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null
  rm -rf "$BACKUP"
else
  mv "$BACKUP" "$TARGET"
fi
open "$TARGET"
`;
}
