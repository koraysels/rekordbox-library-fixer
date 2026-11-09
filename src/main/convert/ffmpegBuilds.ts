/**
 * The ffmpeg builds the converter may download on first use, pinned by checksum.
 *
 * Source:  github.com/eugeneware/ffmpeg-static, release b6.1.1 (static builds, libmp3lame in all).
 *          The release bundles different upstream builds per platform: macOS x64 6.1.1,
 *          Windows 6.1.1, Linux 7.0.2, macOS arm64 6.0.
 * Licence: GPL (--enable-gpl). The macOS arm64 build is also configured --enable-nonfree,
 *          so it is not redistributable; no arm64 build without it was found. The app never
 *          bundles ffmpeg: it downloads the build onto the user's machine, after asking.
 * Each build was downloaded once and hashed; sha256 and size are of the gzip bytes
 * served at `url`, so a changed or tampered file is refused.
 */
export interface FfmpegBuild {
  url: string;
  sha256: string;
  sizeBytes: number;
  archive: 'none' | 'gzip' | 'zip';
  entry?: string;
}

export const FFMPEG_SOURCE = 'github.com/eugeneware/ffmpeg-static (b6.1.1)';

const base = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1';

export const FFMPEG_BUILDS: Partial<Record<`${NodeJS.Platform}-${string}`, FfmpegBuild>> = {
  'darwin-arm64': {
    url: `${base}/ffmpeg-darwin-arm64.gz`,
    sha256: '8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa',
    sizeBytes: 19246198,
    archive: 'gzip',
  },
  'darwin-x64': {
    url: `${base}/ffmpeg-darwin-x64.gz`,
    sha256: '929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106',
    sizeBytes: 25296431,
    archive: 'gzip',
  },
  'win32-x64': {
    url: `${base}/ffmpeg-win32-x64.gz`,
    sha256: '8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77',
    sizeBytes: 29581307,
    archive: 'gzip',
  },
  'linux-x64': {
    url: `${base}/ffmpeg-linux-x64.gz`,
    sha256: 'bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa',
    sizeBytes: 29354986,
    archive: 'gzip',
  },
};
