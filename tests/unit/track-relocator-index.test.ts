import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// The index walks real folders.
vi.unmock('fs');
import * as fs from 'fs';
import * as path from 'path';

// Spy on the index walk so we can assert it is NOT re-run per track
const globSpy = vi.fn();
vi.mock('../../src/main/audioFileIndex', async () => {
  const actual = await vi.importActual<typeof import('../../src/main/audioFileIndex')>('../../src/main/audioFileIndex');
  return {
    indexAudioFiles: (...args: Parameters<typeof actual.indexAudioFiles>) => {
      globSpy(...args);
      return actual.indexAudioFiles(...args);
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

  it('indexes the search path only ONCE across many tracks in the same run', async () => {
    const r = new TrackRelocator();
    const opts = makeOptions();
    await r.beginRelocationRun(opts);
    for (let i = 0; i < 25; i++) {
      await r.findRelocationCandidates(track(String(i), 'Song One'), opts);
    }
    r.endRelocationRun();
    expect(globSpy).toHaveBeenCalledTimes(1);
  });

  it('re-indexes when the search options change (index key differs)', async () => {
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
    // one index during the run + one after it was freed
    expect(globSpy).toHaveBeenCalledTimes(2);
  });
});

describe('TrackRelocator index coverage', () => {
  it('finds files in a folder whose name looks like a glob pattern', async () => {
    const odd = path.join(tmpDir, 'Music [DJ] {2024}');
    fs.mkdirSync(odd);
    fs.writeFileSync(path.join(odd, 'Bracket Song.mp3'), 'x');
    const r = new TrackRelocator();
    const summary = await r.beginRelocationRun(makeOptions({ searchPaths: [odd] }));
    expect(summary).toEqual({ files: 1, unsearched: [] });
    const candidates = await r.findRelocationCandidates(track('1', 'Bracket Song'), makeOptions({ searchPaths: [odd] }));
    expect(candidates[0]?.path).toBe(path.join(odd, 'Bracket Song.mp3'));
  });

  it('counts depth from the search folder, not from the working directory', async () => {
    const deep = path.join(tmpDir, 'a', 'b', 'c', 'd', 'e', 'f', 'g');
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, 'Way Down.mp3'), 'x');
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue('/');
    try {
      const r = new TrackRelocator();
      // 'a/b/c/d/e/f/g/Way Down.mp3' is level 8 below the search folder.
      const found = await r.findRelocationCandidates(track('1', 'Way Down'), makeOptions({ searchDepth: 8 }));
      expect(found.some((c) => c.path.endsWith('Way Down.mp3'))).toBe(true);
      r.endRelocationRun();
      const tooShallow = await r.findRelocationCandidates(track('1', 'Way Down'), makeOptions({ searchDepth: 7 }));
      expect(tooShallow.some((c) => c.path.endsWith('Way Down.mp3'))).toBe(false);
    } finally {
      cwd.mockRestore();
    }
  });

  it('matches extensions in any case and skips hidden files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'Loud.MP3'), 'x');
    fs.writeFileSync(path.join(tmpDir, '._Loud.mp3'), 'x');
    const r = new TrackRelocator();
    const summary = await r.beginRelocationRun(makeOptions());
    expect(summary.files).toBe(4);
  });

  it('reports a search folder that is not there', async () => {
    const gone = path.join(tmpDir, 'nope');
    const r = new TrackRelocator();
    const summary = await r.beginRelocationRun(makeOptions({ searchPaths: [tmpDir, gone] }));
    expect(summary.unsearched).toEqual([{ path: gone, reason: 'missing' }]);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('reports a folder it cannot read', async () => {
    const locked = path.join(tmpDir, 'Locked');
    fs.mkdirSync(locked);
    fs.writeFileSync(path.join(locked, 'Hidden Away.mp3'), 'x');
    fs.chmodSync(locked, 0o000);
    try {
      const r = new TrackRelocator();
      const summary = await r.beginRelocationRun(makeOptions());
      expect(summary.unsearched).toEqual([{ path: locked, reason: 'unreadable' }]);
    } finally {
      fs.chmodSync(locked, 0o755);
    }
  });

  it('throws in strict mode when the index cannot be built', async () => {
    const r = new TrackRelocator();
    (r as any).getFileIndex = async () => { throw new Error('disk on fire'); };
    await expect(r.findRelocationCandidates(track('1', 'Song One'), makeOptions(), { strict: true }))
      .rejects.toThrow('disk on fire');
    await expect(r.findRelocationCandidates(track('1', 'Song One'), makeOptions())).resolves.toEqual([]);
  });
});
