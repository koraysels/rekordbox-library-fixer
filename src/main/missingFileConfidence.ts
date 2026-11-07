/**
 * How sure a duplicate set is when its files cannot be read.
 *
 * Such a set was matched on artist, title and length, which alone is a strong
 * hint but not proof — 75, Medium. The library still carries more evidence
 * though, and a flat 75 threw it away: two entries in the same folder, one
 * named "04 Flash Wiggles.mp3" and the other "04 Flash Wiggles 1.mp3", are a
 * copy by any reading, yet showed as Medium.
 */

const BASE = 75;
const COPY_NAMED = 95;

interface Evidence {
  location?: string;
  album?: string;
  bitrate?: number;
  size?: number;
}

/** Folder and file stem, with a copy suffix (" 1", " copy", " (2)") removed. */
function originalName(location: string): { dir: string; stem: string } | null {
  const normalized = location.normalize('NFC');
  const slash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  const file = normalized.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  if (dot <= 0) { return null; }
  const stem = file.slice(0, dot).replace(/(?: copy| \(\d+\)| \d+)$/i, '');
  return { dir: normalized.slice(0, slash).toLowerCase(), stem: stem.toLowerCase() };
}

function isCopyNamed(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a === b) { return false; }
  const x = originalName(a);
  const y = originalName(b);
  return !!x && !!y && x.dir === y.dir && x.stem === y.stem;
}

const same = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function pairConfidence(a: Evidence, b: Evidence): number {
  if (isCopyNamed(a.location, b.location)) { return COPY_NAMED; }
  let score = BASE;
  if (same(a.album, b.album)) { score += 5; }
  if (a.bitrate && b.bitrate && a.bitrate === b.bitrate) { score += 5; }
  // Re-tagging changes a file by kilobytes, so sizes are compared loosely.
  if (a.size && b.size && Math.abs(a.size - b.size) / Math.max(a.size, b.size) <= 0.05) { score += 7; }
  return score;
}

/** A set is only as sure as its least alike pair. */
export function missingFileSetConfidence(tracks: Evidence[]): number {
  let lowest = Infinity;
  for (let i = 0; i < tracks.length - 1; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      lowest = Math.min(lowest, pairConfidence(tracks[i], tracks[j]));
    }
  }
  return Number.isFinite(lowest) ? lowest : BASE;
}
