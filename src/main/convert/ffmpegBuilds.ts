/**
 * The ffmpeg builds the converter may download on first use, pinned by checksum.
 *
 * Source:  github.com/eugeneware/ffmpeg-static, release b6.0 (ffmpeg 6.0)
 * Licence: GPL (built with --enable-gpl, libmp3lame, libx264 ...). The app does not
 *          bundle or redistribute it; it fetches it onto the user's machine after asking.
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

export const FFMPEG_VERSION = '6.0';
export const FFMPEG_SOURCE = 'github.com/eugeneware/ffmpeg-static (b6.0)';

const base = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0';

export const FFMPEG_BUILDS: Partial<Record<`${NodeJS.Platform}-${string}`, FfmpegBuild>> = {
  'darwin-arm64': {
    url: `${base}/ffmpeg-darwin-arm64.gz`,
    sha256: '6be74d6f449889c2e87a75873894f8520cad56c08ac76f2a628d85b0519daaca',
    sizeBytes: 19253088,
    archive: 'gzip',
  },
  'darwin-x64': {
    url: `${base}/ffmpeg-darwin-x64.gz`,
    sha256: 'a12354fce7eb62361473bbe10d53a1893695babd35869ec8e92e5dfea8d0440b',
    sizeBytes: 25067704,
    archive: 'gzip',
  },
  'win32-x64': {
    url: `${base}/ffmpeg-win32-x64.gz`,
    sha256: '450d66226c79405c724e821f291cab0911e934bfa9fa2231adcab587f3e07b50',
    sizeBytes: 28894894,
    archive: 'gzip',
  },
  'linux-x64': {
    url: `${base}/ffmpeg-linux-x64.gz`,
    sha256: '17c1ae10b52ac499180679fe6ba77e17642390c4eedb0f1e3b0ac045da55128f',
    sizeBytes: 28928723,
    archive: 'gzip',
  },
};
