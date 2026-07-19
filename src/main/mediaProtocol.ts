/**
 * media:// protocol — streams local audio files to the renderer.
 * URL shape: media:///<encodeURIComponent(absolutePath)>
 * The whole path is one encoded segment, so slashes inside it are %2F
 * and survive URL parsing on every platform.
 */
export function mediaUrlToFilePath(url: string): string {
  const { pathname } = new URL(url);
  return decodeURIComponent(pathname.replace(/^\//, ''));
}

const ALLOWED_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.aiff', '.aif']);

export function isAllowedMediaPath(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) { return false; }
  return ALLOWED_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}
