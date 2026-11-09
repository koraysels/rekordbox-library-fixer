import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { FFMPEG_BUILDS, type FfmpegBuild } from './ffmpegBuilds';

const run = promisify(execFile);

type Builds = Partial<Record<string, FfmpegBuild>>;

export type FfmpegStatus =
  | { state: 'ready'; path: string }
  | { state: 'missing'; sizeBytes: number }
  | { state: 'unsupported' };

export function ffmpegPath(userData: string, platform: NodeJS.Platform): string {
  return path.join(userData, 'ffmpeg', platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
}

export function ffmpegStatus(
  userData: string,
  platform: NodeJS.Platform,
  arch: string,
  exists: (p: string) => boolean = fs.existsSync,
  builds: Builds = FFMPEG_BUILDS,
): FfmpegStatus {
  const build = builds[`${platform}-${arch}`];
  if (!build) { return { state: 'unsupported' }; }
  const file = ffmpegPath(userData, platform);
  return exists(file) ? { state: 'ready', path: file } : { state: 'missing', sizeBytes: build.sizeBytes };
}

/**
 * Download the pinned build, check it, unpack it and move it into place. The binary
 * only ever appears at its final path complete and verified.
 */
export async function installFfmpeg(
  userData: string,
  platform: NodeJS.Platform,
  arch: string,
  onProgress: (pct: number) => void,
  fetchImpl: typeof fetch = globalThis.fetch,
  builds: Builds = FFMPEG_BUILDS,
): Promise<string> {
  const build = builds[`${platform}-${arch}`];
  if (!build) { throw new Error(`ffmpeg is not available for ${platform}-${arch}`); }
  if (build.archive === 'zip') { throw new Error('zip builds are not supported yet'); }

  const dir = path.join(userData, 'ffmpeg');
  fs.mkdirSync(dir, { recursive: true });
  const download = path.join(dir, 'ffmpeg.download');
  const unpacked = path.join(dir, 'ffmpeg.unpacked');
  const final = ffmpegPath(userData, platform);
  const cleanup = () => { fs.rmSync(download, { force: true }); fs.rmSync(unpacked, { force: true }); };

  try {
    const res = await fetchImpl(build.url);
    if (!res.ok || !res.body) { throw new Error(`${res.status} for ${build.url}`); }
    const total = Number(res.headers.get('content-length')) || build.sizeBytes;
    const hash = crypto.createHash('sha256');
    let received = 0;
    let last = -1;
    const body = Readable.fromWeb(res.body as any);
    body.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      received += chunk.length;
      const pct = Math.min(100, Math.floor((received / total) * 100));
      if (pct !== last) { last = pct; onProgress(pct); }
    });
    await pipeline(body, fs.createWriteStream(download));
    if (hash.digest('hex') !== build.sha256) {
      throw new Error('The ffmpeg download did not match its checksum');
    }

    if (build.archive === 'gzip') {
      await pipeline(fs.createReadStream(download), zlib.createGunzip(), fs.createWriteStream(unpacked));
    } else {
      fs.renameSync(download, unpacked);
    }
    fs.chmodSync(unpacked, 0o755);
    if (platform === 'darwin') {
      // A downloaded binary is quarantined; Gatekeeper would refuse to run it.
      try { await run('xattr', ['-d', 'com.apple.quarantine', unpacked]); } catch { /* not quarantined */ }
    }
    fs.renameSync(unpacked, final);
    fs.rmSync(download, { force: true });
    onProgress(100);
    return final;
  } catch (error) {
    cleanup();
    throw error;
  }
}
