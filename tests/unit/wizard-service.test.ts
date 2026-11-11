import { describe, it, expect, vi } from 'vitest';
import { applyStep, planStep, runCheck, type WizardContext } from '../../src/main/wizard/wizardService';
import type { WizardDeps } from '../../src/main/wizard/wizardDeps';
import type { DbLibrary, DbTrack } from '../../src/main/rekordboxDbParser';
import type { MissingTrack, RelocationCandidate, RelocationOptions } from '../../src/main/trackRelocator';
import type { ConvertCandidate, ConvertPreviewItem, ConvertRunResult } from '../../src/main/ipcContract';
import type {
  ConvertStepPlan, DuplicatesStepPlan, GatherStepPlan, RelocateStepPlan, RemoveStepPlan, StepPlan,
} from '../../src/main/wizard/types';

const MUSIC = '/Users/k/Music/DJ';

const track = (id: string, location: string, extra: Partial<DbTrack> = {}): DbTrack => ({
  id, name: `Track ${id}`, artist: 'Artist', location, cues: [], loops: [], ...extra,
});

const libraryOf = (...tracks: DbTrack[]): DbLibrary => ({
  libraryPath: '/db/master.db',
  tracks: new Map(tracks.map((t) => [t.id, t])),
  playlists: [],
});

const ctxOf = (over: Partial<WizardContext> = {}): WizardContext => ({
  operationId: 'op-1',
  dbPath: '/db/master.db',
  key: 'k'.repeat(64),
  musicFolder: MUSIC,
  profileId: 'cdj2000' as WizardContext['profileId'],
  searchPaths: ['/Users/k/Downloads'],
  searchDepth: 6,
  signal: new AbortController().signal,
  onProgress: () => undefined,
  ...over,
});

const emptyRun: ConvertRunResult = {
  switched: 0, switchedItems: [], failed: [], conflicts: [], trashed: 0, cancelled: false,
};

/**
 * Fake everything that touches a disk, a database or ffmpeg. `present` lists the
 * paths that exist; `/` always does. A volume root missing from it is unplugged.
 */
function fakeDeps(library: DbLibrary | (() => DbLibrary), present: string[], over: Partial<WizardDeps> = {}): WizardDeps {
  const existing = new Set(['/', ...present]);
  const exists = (p: string) => existing.has(p);
  const read = typeof library === 'function' ? library : () => library;
  return {
    platform: 'darwin',
    parseDb: vi.fn(async () => read()),
    relocator: {
      beginRelocationRun: vi.fn(async () => undefined),
      endRelocationRun: vi.fn(),
      findMissingTracks: vi.fn(async (tracks: Map<string, DbTrack>) => [...tracks.values()]
        .filter((t) => !t.location.startsWith('tidal:') && !exists(t.location))
        .map((t): MissingTrack => ({ id: t.id, name: t.name, artist: t.artist, originalLocation: t.location }))),
      findRelocationCandidates: vi.fn(async () => [] as RelocationCandidate[]),
    },
    detector: { findDuplicates: vi.fn(async () => ({ duplicates: [], cancelled: false })) },
    relocateTracksInDb: vi.fn(() => ({ tracksRelocated: 0, skipped: [], backupPath: 'b' })),
    removeEntriesFromDb: vi.fn(() => ({ entriesRemoved: 0, playlistLinksRemoved: 0, kept: [], backupPath: 'b' })),
    mergeDuplicateEntries: vi.fn(() => ({ entriesRemoved: 0, playlistLinksMoved: 0, backupPath: 'b' })),
    applyGather: vi.fn(async () => ({ step: 'gather' as const, changed: 0, details: [], cancelled: false })),
    findUnplayable: vi.fn(async () => [] as ConvertCandidate[]),
    previewConversion: vi.fn(async () => [] as ConvertPreviewItem[]),
    runConversion: vi.fn(async () => emptyRun),
    ffmpegStatus: () => ({ state: 'ready', path: '/ff/ffmpeg' }),
    trash: vi.fn(async () => undefined),
    isRunning: () => false,
    exists,
    isRegularFile: exists,
    fileId: () => undefined,
    sameContent: async () => false,
    fileSize: () => 1000,
    freeBytes: () => 1024 ** 4,
    backupPath: () => '/db/master.db.backup.test',
    ...over,
  };
}

const plans: StepPlan[] = [
  { step: 'relocate', apply: [{ trackIds: ['1'], name: 'a', artist: 'b', location: '/x/a.mp3', to: '/y/a.mp3', confidence: 0.95 }], setAside: [] },
  { step: 'remove', remove: [{ trackIds: ['1'], name: 'a', artist: 'b', location: '/x/a.mp3' }], setAside: [] },
  { step: 'duplicates', merges: [{ keepId: '1', removeIds: ['2'], keepName: 'a', artist: 'b', trashPaths: [] }], setAside: [] },
  { step: 'gather', moves: [], unplugged: [], bytesCrossDrive: 0, freeBytes: 0 },
  { step: 'convert', items: [], setAside: [], ffmpeg: { state: 'ready', path: '/ff' } },
];

describe('runCheck', () => {
  it('counts nothing for streaming tracks or tracks on an unplugged drive', async () => {
    const lib = libraryOf(
      track('1', '/Users/k/Gone/missing.mp3'),
      track('2', 'tidal:tracks:2'),
      track('3', '/Volumes/Old/a/b.mp3'),
      track('4', '/Users/k/Downloads/Promos/x.mp3'),
      track('5', `${MUSIC}/Promos/in.mp3`),
    );
    const deps = fakeDeps(lib, ['/Users/k/Downloads/Promos/x.mp3', `${MUSIC}/Promos/in.mp3`, MUSIC]);
    const check = await runCheck(ctxOf(), deps);

    expect(check.missing).toBe(1);
    expect(check.outsideFolder).toBe(1);
    expect(check.unpluggedDrives).toEqual(['/Volumes/Old']);
    expect(check.libraryPath).toBe('/db/master.db');

    // Neither the duplicate scan nor the player check sees a streaming or unplugged track.
    const scanned = vi.mocked(deps.detector.findDuplicates).mock.calls[0][0].map((t) => t.id);
    expect(scanned).not.toContain('2');
    const checked = [...vi.mocked(deps.findUnplayable).mock.calls[0][0].tracks.keys()];
    expect(checked).not.toContain('2');
    expect(checked).not.toContain('3');
  });

  it('counts unplayable files but not unreachable ones', async () => {
    const deps = fakeDeps(libraryOf(track('1', '/a.flac')), ['/a.flac'], {
      findUnplayable: vi.fn(async () => [
        { trackIds: ['1'], location: '/a.flac', name: 'a', artist: 'b', reasons: [], facts: null },
        { trackIds: ['2'], location: '/b.flac', name: 'b', artist: 'b', reasons: [], facts: null, unreachable: true },
      ] as ConvertCandidate[]),
      detector: {
        findDuplicates: vi.fn(async () => ({
          duplicates: [{ id: 's', tracks: [], matchType: 'metadata' as const, confidence: 90 }],
          cancelled: false,
        })),
      },
    });
    const check = await runCheck(ctxOf(), deps);
    expect(check.unplayable).toBe(1);
    expect(check.duplicates).toBe(1);
  });
});

describe('planStep', () => {
  it('reads the database again and searches the music folder first', async () => {
    const lib = libraryOf(track('1', '/Users/k/Gone/a.mp3'));
    const deps = fakeDeps(lib, [MUSIC], {
      relocator: {
        ...fakeDeps(lib, []).relocator,
        findRelocationCandidates: vi.fn(async () => [
          { path: `${MUSIC}/a.mp3`, confidence: 0.95, score: 100, matchType: 'exact' as const },
        ]),
      },
    });
    const plan = await planStep('relocate', ctxOf(), deps) as RelocateStepPlan;

    expect(deps.parseDb).toHaveBeenCalledWith('/db/master.db', 'k'.repeat(64));
    const options = vi.mocked(deps.relocator.beginRelocationRun).mock.calls[0][0] as RelocationOptions;
    expect(options.searchPaths).toEqual([MUSIC, '/Users/k/Downloads']);
    expect(options.searchDepth).toBe(6);
    expect(plan.apply).toEqual([{
      trackIds: ['1'], name: 'Track 1', artist: 'Artist', location: '/Users/k/Gone/a.mp3',
      to: `${MUSIC}/a.mp3`, confidence: 0.95,
    }]);
    expect(deps.relocator.endRelocationRun).toHaveBeenCalled();
  });

  it('never searches for a track on an unplugged drive, and never plans to remove it', async () => {
    const lib = libraryOf(track('1', '/Volumes/Old/a.mp3'), track('2', '/Users/k/Gone/b.mp3'));
    const deps = fakeDeps(lib, [MUSIC]);
    const plan = await planStep('remove', ctxOf(), deps) as RemoveStepPlan;

    const searched = vi.mocked(deps.relocator.findRelocationCandidates).mock.calls.map(([t]) => t.id);
    expect(searched).toEqual(['2']);
    expect(plan.remove.map((r) => r.trackIds)).toEqual([['2']]);
    expect(plan.setAside.map((s) => s.trackIds)).toEqual([['1']]);
  });

  it('refuses to hand back a plan when cancelled mid-search', async () => {
    const controller = new AbortController();
    const lib = libraryOf(track('1', '/Users/k/Gone/a.mp3'), track('2', '/Users/k/Gone/b.mp3'));
    const deps = fakeDeps(lib, [MUSIC], {
      relocator: {
        ...fakeDeps(lib, []).relocator,
        findRelocationCandidates: vi.fn(async () => { controller.abort(); return []; }),
      },
    });
    await expect(planStep('remove', ctxOf({ signal: controller.signal }), deps)).rejects.toThrow(/cancel/i);
    expect(deps.relocator.endRelocationRun).toHaveBeenCalled();
  });

  it('sets aside what cannot be converted as it stands', async () => {
    const candidates = [
      { trackIds: ['1'], location: '/a.flac', name: 'A', artist: 'x', reasons: [], facts: null },
      { trackIds: ['2'], location: '/b.flac', name: 'B', artist: 'x', reasons: [], facts: null, unreadable: true },
      { trackIds: ['3'], location: '/c.flac', name: 'C', artist: 'x', reasons: [], facts: null },
    ] as ConvertCandidate[];
    const out = { format: 'aiff' } as unknown as ConvertPreviewItem['out'];
    const deps = fakeDeps(libraryOf(track('1', '/a.flac')), ['/a.flac'], {
      findUnplayable: vi.fn(async () => candidates),
      previewConversion: vi.fn(async () => [
        { trackIds: ['1'], from: '/a.flac', to: '/a.aiff', readiness: 'new' as const, out },
        { trackIds: ['3'], from: '/c.flac', to: '/a.aiff', readiness: 'conflict' as const, out },
      ]),
    });
    const plan = await planStep('convert', ctxOf(), deps) as ConvertStepPlan;

    expect(vi.mocked(deps.previewConversion).mock.calls[0][2]).toBe('aiff');
    expect(plan.items.map((i) => i.from)).toEqual(['/a.flac']);
    expect(plan.setAside.map((s) => s.trackIds)).toEqual([['2'], ['3']]);
    expect(plan.ffmpeg).toEqual({ state: 'ready', path: '/ff/ffmpeg' });
  });
});

describe('applyStep', () => {
  it.each(plans)('refuses $step while rekordbox runs, before any write', async (plan) => {
    const deps = fakeDeps(libraryOf(), [], { isRunning: () => true });
    const result = await applyStep(plan, ctxOf(), deps);

    expect(result.error).toBe('Close rekordbox to continue');
    expect(result.changed).toBe(0);
    expect(deps.relocateTracksInDb).not.toHaveBeenCalled();
    expect(deps.removeEntriesFromDb).not.toHaveBeenCalled();
    expect(deps.mergeDuplicateEntries).not.toHaveBeenCalled();
    expect(deps.applyGather).not.toHaveBeenCalled();
    expect(deps.runConversion).not.toHaveBeenCalled();
  });

  it('relocates every entry of a planned file in one write', async () => {
    const deps = fakeDeps(libraryOf(), [], {
      relocateTracksInDb: vi.fn(() => ({ tracksRelocated: 2, skipped: [], backupPath: '/b' })),
    });
    const plan: RelocateStepPlan = {
      step: 'relocate',
      apply: [{ trackIds: ['1', '2'], name: 'a', artist: 'b', location: '/x/a.mp3', to: '/y/a.mp3', confidence: 0.95 }],
      setAside: [],
    };
    const result = await applyStep(plan, ctxOf(), deps);

    expect(deps.relocateTracksInDb).toHaveBeenCalledTimes(1);
    const [, , relocations, options] = vi.mocked(deps.relocateTracksInDb).mock.calls[0];
    expect(relocations).toEqual([{ trackId: '1', newLocation: '/y/a.mp3' }, { trackId: '2', newLocation: '/y/a.mp3' }]);
    expect(options.backupPath).toBe('/db/master.db.backup.test');
    expect(result.changed).toBe(2);
    expect(result.backupPath).toBe('/b');
    expect(result.details[0]).toMatchObject({ action: 'relocated', from: '/x/a.mp3', to: '/y/a.mp3' });
  });

  it('removeStep.apply re-checks mounts', async () => {
    // Planned while the drive was there; unplugged before the confirm.
    const deps = fakeDeps(libraryOf(), ['/Users/k'], {
      removeEntriesFromDb: vi.fn(() => ({ entriesRemoved: 1, playlistLinksRemoved: 0, kept: [], backupPath: '/b' })),
    });
    const plan: RemoveStepPlan = {
      step: 'remove',
      remove: [
        { trackIds: ['1'], name: 'gone', artist: 'x', location: '/Users/k/gone.mp3' },
        { trackIds: ['2'], name: 'unplugged', artist: 'x', location: '/Volumes/DJ SSD/a.mp3' },
      ],
      setAside: [],
    };
    const result = await applyStep(plan, ctxOf(), deps);

    const [, , ids, options] = vi.mocked(deps.removeEntriesFromDb).mock.calls[0];
    expect(ids).toEqual(['1']);
    // And inside the write, against the database's own location: a file on an unplugged drive counts as there.
    expect(options.fileExists?.('/Volumes/DJ SSD/a.mp3')).toBe(true);
    expect(options.fileExists?.('/Users/k/gone.mp3')).toBe(false);
    expect(result.changed).toBe(1);
    expect(result.details).toContainEqual(expect.objectContaining({ action: 'failed', trackName: 'unplugged' }));
  });

  it('writes nothing when every entry to remove is on an unplugged drive', async () => {
    const deps = fakeDeps(libraryOf(), []);
    const plan: RemoveStepPlan = {
      step: 'remove',
      remove: [{ trackIds: ['2'], name: 'u', artist: 'x', location: '/Volumes/DJ SSD/a.mp3' }],
      setAside: [],
    };
    const result = await applyStep(plan, ctxOf(), deps);
    expect(deps.removeEntriesFromDb).not.toHaveBeenCalled();
    expect(result.changed).toBe(0);
  });

  it('trashes only the files nothing uses after the merge', async () => {
    // After the merge, an entry the plan did not know about still uses b.mp3.
    const after = libraryOf(track('1', '/m/keep.mp3'), track('9', '/m/b.mp3'));
    const deps = fakeDeps(after, ['/m/a.mp3', '/m/b.mp3', '/m/keep.mp3'], {
      mergeDuplicateEntries: vi.fn(() => ({ entriesRemoved: 2, playlistLinksMoved: 1, backupPath: '/b' })),
    });
    const plan: DuplicatesStepPlan = {
      step: 'duplicates',
      merges: [{ keepId: '1', removeIds: ['2', '3'], keepName: 'Keep', artist: 'x', trashPaths: ['/m/a.mp3', '/m/b.mp3'] }],
      setAside: [],
    };
    const result = await applyStep(plan, ctxOf(), deps);

    expect(vi.mocked(deps.mergeDuplicateEntries).mock.calls[0][2]).toEqual([{ keepId: '1', removeIds: ['2', '3'] }]);
    expect(deps.parseDb).toHaveBeenCalled();
    expect(deps.trash).toHaveBeenCalledTimes(1);
    expect(deps.trash).toHaveBeenCalledWith('/m/a.mp3');
    expect(result.changed).toBe(2);
    expect(result.details).toContainEqual(expect.objectContaining({ action: 'trashed', from: '/m/a.mp3' }));
  });

  it('trashes nothing when the library cannot be read back after the merge', async () => {
    const deps = fakeDeps(() => { throw new Error('locked'); }, ['/m/a.mp3'], {
      mergeDuplicateEntries: vi.fn(() => ({ entriesRemoved: 1, playlistLinksMoved: 0, backupPath: '/b' })),
    });
    const plan: DuplicatesStepPlan = {
      step: 'duplicates',
      merges: [{ keepId: '1', removeIds: ['2'], keepName: 'Keep', artist: 'x', trashPaths: ['/m/a.mp3'] }],
      setAside: [],
    };
    const result = await applyStep(plan, ctxOf(), deps);
    expect(deps.trash).not.toHaveBeenCalled();
    expect(result.changed).toBe(1);
  });

  it('gathers through applyGather with the same backup and rekordbox check', async () => {
    const deps = fakeDeps(libraryOf(), []);
    const plan: GatherStepPlan = { step: 'gather', moves: [], unplugged: [], bytesCrossDrive: 0, freeBytes: 0 };
    await applyStep(plan, ctxOf(), deps);
    const [, gctx] = vi.mocked(deps.applyGather).mock.calls[0];
    expect(gctx.backupPath).toBe('/db/master.db.backup.test');
    expect(gctx.checkRunning).toBe(deps.isRunning);
    expect(gctx.trash).toBe(deps.trash);
  });

  it('converts to AIFF and trashes the originals', async () => {
    const out = { format: 'aiff' } as unknown as ConvertPreviewItem['out'];
    const items: ConvertPreviewItem[] = [{ trackIds: ['1'], from: '/a.flac', to: '/a.aiff', readiness: 'new', out }];
    const deps = fakeDeps(libraryOf(), [], {
      runConversion: vi.fn(async () => ({
        ...emptyRun, switched: 1, trashed: 1, backupPath: '/b',
        switchedItems: [{ trackIds: ['1'], from: '/a.flac', to: '/a.aiff' }],
      })),
    });
    const plan: ConvertStepPlan = { step: 'convert', items, setAside: [], ffmpeg: { state: 'ready', path: '/ff' } };
    const result = await applyStep(plan, ctxOf(), deps);

    const [opts, runDeps] = vi.mocked(deps.runConversion).mock.calls[0];
    expect(opts).toMatchObject({
      libraryPath: '/db/master.db', dbKey: 'k'.repeat(64), profileId: 'cdj2000',
      target: 'aiff', trashOriginals: true, items,
    });
    expect(runDeps.ffmpeg).toBe('/ff/ffmpeg');
    expect(runDeps.trash).toBe(deps.trash);
    expect(result.changed).toBe(1);
    expect(result.backupPath).toBe('/b');
    expect(result.details[0]).toMatchObject({ action: 'converted', from: '/a.flac', to: '/a.aiff' });
  });

  it('refuses to convert before ffmpeg is installed', async () => {
    const deps = fakeDeps(libraryOf(), [], { ffmpegStatus: () => ({ state: 'missing', sizeBytes: 1 }) });
    const plan: ConvertStepPlan = { step: 'convert', items: [], setAside: [], ffmpeg: { state: 'missing', sizeBytes: 1 } };
    const result = await applyStep(plan, ctxOf(), deps);
    expect(result.error).toMatch(/ffmpeg/);
    expect(deps.runConversion).not.toHaveBeenCalled();
  });

  it('turns a failed write into a step error, not a throw', async () => {
    const deps = fakeDeps(libraryOf(), [], {
      relocateTracksInDb: vi.fn(() => { throw new Error('disk full'); }),
    });
    const result = await applyStep(plans[0], ctxOf(), deps);
    expect(result.error).toMatch(/disk full/);
    expect(result.changed).toBe(0);
  });
});
