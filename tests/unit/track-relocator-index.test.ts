import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Spy on glob so we can assert it is NOT re-run per track
const globSpy = vi.fn();
vi.mock('glob', async () => {
  const actual = await vi.importActual<typeof import('glob')>('glob');
  return {
    glob: (...args: any[]) => {
      globSpy(...args);
      return (actual.glob as any)(...args);
    },
  };
});

import { TrackRelocator, type MissingTrack } from '../../src/main/trackRelocator';
import type { RelocationOptions } from '../../src/renderer/types';

let tmpDir: string;

function makeOptions(overrides: Partial<RelocationOptions> = {}): RelocationOptions {
  return {
    searchPaths: [tmpDir],
    searchDepth: 8,
    matchThreshold: 0.7,
    includeSubdirectories: true,
    fileExtensions: ['.mp3', '.flac', '.aiff'],
    ...overrides,
  };
}

function track(id: string, name: string, extra: Partial<MissingTrack> = {}): MissingTrack {
  return { id, name, artist: 'Artist', originalLocation: `/old/${name}.mp3`, ...extra };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.reloc-tmp-'));
  fs.writeFileSync(path.join(tmpDir, 'Song One.mp3'), 'x');
  fs.writeFileSync(path.join(tmpDir, 'Song Two.flac'), 'x');
  fs.writeFileSync(path.join(tmpDir, 'Deep Track.mp3'), 'x');
  globSpy.mockClear();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('TrackRelocator file-index reuse', () => {
  it('finds an exact filename match', async () => {
    const r = new TrackRelocator();
    const candidates = await r.findRelocationCandidates(track('1', 'Song One'), makeOptions());
    expect(candidates.some((c) => c.matchType === 'exact' && c.path.endsWith('Song One.mp3'))).toBe(true);
  });

  it('globs the search path only ONCE across many tracks in the same run', async () => {
    const r = new TrackRelocator();
    const opts = makeOptions();
    await r.beginRelocationRun(opts);
    for (let i = 0; i < 25; i++) {
      await r.findRelocationCandidates(track(String(i), 'Song One'), opts);
    }
    r.endRelocationRun();
    expect(globSpy).toHaveBeenCalledTimes(1);
  });

  it('re-globs when the search options change (index key differs)', async () => {
    const r = new TrackRelocator();
    await r.beginRelocationRun(makeOptions());
    await r.findRelocationCandidates(track('1', 'Song One'), makeOptions());
    await r.findRelocationCandidates(track('2', 'Song One'), makeOptions({ searchDepth: 2 }));
    r.endRelocationRun();
    expect(globSpy).toHaveBeenCalledTimes(2);
  });

  it('still works without an explicit run (single-track manual find)', async () => {
    const r = new TrackRelocator();
    const candidates = await r.findRelocationCandidates(track('1', 'Deep Track'), makeOptions());
    expect(candidates.some((c) => c.path.endsWith('Deep Track.mp3'))).toBe(true);
  });

  it('endRelocationRun frees the cached index', async () => {
    const r = new TrackRelocator();
    const opts = makeOptions();
    await r.beginRelocationRun(opts);
    await r.findRelocationCandidates(track('1', 'Song One'), opts);
    r.endRelocationRun();
    await r.findRelocationCandidates(track('2', 'Song One'), opts);
    // one glob during the run + one after it was freed
    expect(globSpy).toHaveBeenCalledTimes(2);
  });
});
