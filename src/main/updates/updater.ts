import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { app, net, session, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { runtime, sendToWindow } from '../runtime';
import type { UpdateStatusPayload } from '../ipcContract';
import {
  isNewer, parseFeed, pickMacZip, downloadUrls, appBundleOf, canReplaceBundle, swapScript, type FeedFile,
} from './updateFeed';

const OWNER = 'koraysels';
const REPO = 'rekordbox-library-fixer';
const RELEASES_PAGE = `https://github.com/${OWNER}/${REPO}/releases/latest`;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const run = promisify(execFile);

export type UpdateState = UpdateStatusPayload;

let status: UpdateState = { state: 'idle' };
let macStaged: string | null = null;
let busy = false;

function publish(next: UpdateState): void {
  status = next;
  sendToWindow('update-status', next);
}

const log = () => runtime().logger;

// ---------- macOS: self-install, because Squirrel.Mac needs a Developer ID ----------

async function fetchOk(url: string): Promise<Response> {
  const res = await net.fetch(url);
  if (!res.ok) { throw new Error(`${res.status} for ${url}`); }
  return res;
}

async function downloadVerified(version: string, file: FeedFile, dest: string): Promise<void> {
  let lastError: unknown = null;
  for (const url of downloadUrls(OWNER, REPO, version, file.url)) {
    try {
      const res = await fetchOk(url);
      const total = Number(res.headers.get('content-length')) || file.size;
      const hash = crypto.createHash('sha512');
      let received = 0;
      let lastPercent = -1;
      const body = Readable.fromWeb(res.body as any);
      body.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        received += chunk.length;
        const percent = Math.floor((received / total) * 100);
        if (percent !== lastPercent) { lastPercent = percent; publish({ state: 'downloading', version, percent }); }
      });
      await pipeline(body, fs.createWriteStream(dest));
      // The feed carries a sha512 for every file; a corrupt or tampered download stops here.
      if (hash.digest('base64') !== file.sha512) { throw new Error('The download did not match its checksum'); }
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Download failed');
}

async function checkMac(): Promise<void> {
  const feedText = await (await fetchOk(`${RELEASES_PAGE}/download/latest-mac.yml`)).text();
  const feed = parseFeed(feedText);
  if (!feed) { throw new Error('The update feed could not be read'); }
  if (!isNewer(feed.version, app.getVersion())) { publish({ state: 'up-to-date', version: app.getVersion() }); return; }

  const bundle = appBundleOf(app.getPath('exe'));
  if (!bundle || !canReplaceBundle(bundle)) {
    publish({ state: 'manual', version: feed.version, url: RELEASES_PAGE });
    return;
  }
  const zip = pickMacZip(feed.files, process.arch);
  if (!zip) { publish({ state: 'manual', version: feed.version, url: RELEASES_PAGE }); return; }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rlf-update-'));
  const zipPath = path.join(work, 'update.zip');
  publish({ state: 'downloading', version: feed.version, percent: 0 });
  await downloadVerified(feed.version, zip, zipPath);

  // ditto keeps the bundle's symlinks and permissions, which unzip can mangle.
  const unpacked = path.join(work, 'unpacked');
  await run('/usr/bin/ditto', ['-x', '-k', zipPath, unpacked]);
  const appName = fs.readdirSync(unpacked).find((n) => n.endsWith('.app'));
  if (!appName) { throw new Error('The update did not contain the app'); }
  macStaged = path.join(unpacked, appName);
  fs.rmSync(zipPath, { force: true });
  log().info('UPDATE_STAGED', { version: feed.version, staged: macStaged });
  publish({ state: 'ready', version: feed.version });
}

function installMac(): void {
  const bundle = appBundleOf(app.getPath('exe'));
  if (!macStaged || !bundle) { return; }
  const script = path.join(path.dirname(macStaged), 'swap.sh');
  fs.writeFileSync(script, swapScript(), { mode: 0o755 });
  const backup = path.join(path.dirname(macStaged), 'previous.app');
  // Detached, so it outlives this process: it waits for the app to quit,
  // swaps the bundle (restoring the old one on failure) and reopens it.
  // Its output goes to a log beside it, so a failed swap can be diagnosed.
  const out = fs.openSync(path.join(path.dirname(macStaged), 'swap.log'), 'a');
  const child = spawn('/bin/bash', [script, String(process.pid), macStaged, bundle, backup], {
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  log().info('UPDATE_INSTALLING', { script, bundle, swapPid: child.pid });
  // Not app.quit(): in testing it closed the window and left the process
  // running, so the swap waited forever. Flush what the page has stored, then
  // exit outright — the swap only needs this process gone.
  session.defaultSession.flushStorageData();
  setTimeout(() => app.exit(0), 500);
}

// ---------- Windows and Linux: electron-updater installs without signing ----------

function wireElectronUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-not-available', () => publish({ state: 'up-to-date', version: app.getVersion() }));
  autoUpdater.on('download-progress', (p) =>
    publish({ state: 'downloading', version: String(status.state === 'downloading' ? status.version : ''), percent: Math.floor(p.percent) }));
  autoUpdater.on('update-available', (info) => publish({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('update-downloaded', (info) => publish({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (error) => {
    log().warning('UPDATE_FAILED', { error: error.message });
    publish({ state: 'error', message: error.message });
  });
}

// ---------- shared ----------

export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) { return status; }
  if (busy || status.state === 'ready') { return status; }
  busy = true;
  publish({ state: 'checking' });
  try {
    if (process.platform === 'darwin') {
      await checkMac();
    } else {
      await autoUpdater.checkForUpdates();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update check failed';
    log().warning('UPDATE_CHECK_FAILED', { error: message });
    publish({ state: 'error', message });
  } finally {
    busy = false;
  }
  return status;
}

export function installUpdate(): void {
  if (status.state !== 'ready') { return; }
  if (process.platform === 'darwin') { installMac(); } else { autoUpdater.quitAndInstall(); }
}

export function openReleasesPage(): Promise<void> {
  return shell.openExternal(RELEASES_PAGE);
}

export function currentUpdateStatus(): UpdateState {
  return status;
}

/** Check shortly after launch, then every few hours. Does nothing in development. */
export function startUpdateChecks(): void {
  if (!app.isPackaged) { return; }
  if (process.platform !== 'darwin') { wireElectronUpdater(); }
  setTimeout(() => { void checkForUpdates(); }, 15_000);
  setInterval(() => { void checkForUpdates(); }, CHECK_EVERY_MS);
}
