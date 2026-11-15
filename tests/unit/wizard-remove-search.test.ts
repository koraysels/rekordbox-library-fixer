import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// The search walks real folders.
vi.unmock('fs');

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { planStep, type WizardContext } from '../../src/main/wizard/wizardService';
import { realWizardDeps, type WizardDeps } from '../../src/main/wizard/wizardDeps';
import { TrackRelocator } from '../../src/main/trackRelocator';
import { DuplicateDetector } from '../../src/main/duplicateDetector';
import type { DbLibrary, DbTrack } from '../../src/main/rekordboxDbParser';
import type { RemoveStepPlan } from '../../src/main/wizard/types';

/**
 * The remove step reads "no candidate" as "gone", so these run the real search
 * against real folders: one whose name is glob syntax, a file far below it, and
 * the working directory at `/` as in a packaged app.
 */
let root: string;
let music: string;

const track = (id: string, location: string): DbTrack => ({
  id, name: `Track ${id}`, artist: 'Artist', location, cues: [], loops: [],
});

function deps(library: DbLibrary): WizardDeps {
  return {
    ...realWizardDeps({
      relocator: new TrackRelocator(),
      detector: new DuplicateDetector(),
      trash: async () => undefined,
      ffmpegStatus: () => ({ state: 'missing', sizeBytes: 0 }),
    }),
    parseDb: async () => library,
    isRunning: () => false,
  };
}

const ctx = (): WizardContext => ({
  operationId: 'remove-search',
  dbPath: '/db/master.db',
  key: 'k'.repeat(64),
  musicFolder: music,
  profileId: 'cdj2000',
  searchPaths: [],
  signal: new AbortController().signal,
  onProgress: () => undefined,
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-remove-search-'));
  music = path.join(root, 'Music [DJ] {2024}');
  const deep = path.join(music, 'Genre', 'Label', 'Artist', 'Album', 'Disc 1', 'a', 'b', 'c', 'd');
  fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(deep, 'Deep Song.mp3'), 'x');
  vi.spyOn(process, 'cwd').mockReturnValue('/');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the remove step against a real search', () => {
  it('finds a moved file deep in a bracketed music folder, and does not remove its entry', async () => {
    const lib: DbLibrary = {
      libraryPath: '/db/master.db',
      tracks: new Map([['1', track('1', path.join(root, 'Old', 'Deep Song.mp3'))]]),
      playlists: [],
    };
    const plan = await planStep('remove', ctx(), deps(lib)) as RemoveStepPlan;

    expect(plan.remove).toEqual([]);
    expect(plan.setAside).toHaveLength(1);
    expect(plan.setAside[0].bestGuess?.path).toMatch(/Deep Song\.mp3$/);
  });

  it('still removes an entry whose file is gone when the search covered everything', async () => {
    const lib: DbLibrary = {
      libraryPath: '/db/master.db',
      tracks: new Map([['1', track('1', path.join(root, 'Old', 'Zzqx Vanished.mp3'))]]),
      playlists: [],
    };
    const plan = await planStep('remove', ctx(), deps(lib)) as RemoveStepPlan;

    expect(plan.remove.map((r) => r.trackIds)).toEqual([['1']]);
  });

  it('removes nothing when a search folder is not there', async () => {
    const lib: DbLibrary = {
      libraryPath: '/db/master.db',
      tracks: new Map([['1', track('1', path.join(root, 'Old', 'Zzqx Vanished.mp3'))]]),
      playlists: [],
    };
    const missingFolder = path.join(root, 'Not Here');
    const plan = await planStep('remove', { ...ctx(), searchPaths: [missingFolder] }, deps(lib)) as RemoveStepPlan;

    expect(plan.remove).toEqual([]);
    expect(plan.setAside[0].why).toContain(`${missingFolder} (not there)`);
  });
});
