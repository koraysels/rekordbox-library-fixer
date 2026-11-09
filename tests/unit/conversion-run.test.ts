import { describe, it, expect, vi } from 'vitest';
import {
  findUnplayable, previewConversion, runConversion, type RunDeps,
} from '@main/convert/conversionRun';
import type { ConvertCandidate, ConvertPreviewItem, ConvertProgress, ConvertRunOptions } from '@main/ipcContract';
import type { TrackPayload } from '@main/ipcContract';
import type { ConvertResult } from '@main/convert/convertFile';
import type { EntrySwitch } from '@main/convert/applyConversions';

const track = (over: Partial<TrackPayload> & { id: string; location: string }): TrackPayload => ({
  name: `Track ${over.id}`, artist: 'Artist', ...over,
});
const lib = (tracks: TrackPayload[]) => ({ tracks: new Map(tracks.map(t => [t.id, t])) });
const noRead = vi.fn(async () => { throw new Error('should not read'); });

describe('findUnplayable', () => {
  it('lists ALAC, 96 kHz and 32-bit tracks with reasons and skips streaming', async () => {
    const library = lib([
      track({ id: '1', location: '/m/a.m4a', fileType: 6, sampleRate: 44100, bitDepth: 16 }),
      track({ id: '2', location: '/m/b.wav', fileType: 11, sampleRate: 96000, bitDepth: 24 }),
      track({ id: '3', location: '/m/c.aiff', fileType: 12, sampleRate: 44100, bitDepth: 32 }),
      track({ id: '4', location: '/m/fine.mp3', fileType: 1, sampleRate: 44100 }),
      track({ id: '5', location: 'tidal:tracks:123', fileType: 22 }),
    ]);
    const out = await findUnplayable(library, 'cdj2000', noRead);
    expect(noRead).not.toHaveBeenCalled();
    const byLoc = Object.fromEntries(out.map(c => [c.location, c]));
    expect(Object.keys(byLoc).sort()).toEqual(['/m/a.m4a', '/m/b.wav', '/m/c.aiff']);
    expect(byLoc['/m/a.m4a'].reasons).toEqual([{ kind: 'format', format: 'alac' }]);
    expect(byLoc['/m/b.wav'].reasons).toEqual([{ kind: 'sampleRate', hz: 96000, max: 48000 }]);
    expect(byLoc['/m/c.aiff'].reasons).toEqual([{ kind: 'bitDepth', bits: 32, max: 24 }]);
  });

  it('reads the file when the library lacks the facts, and marks an unreadable file unreachable', async () => {
    const read = vi.fn(async (p: string) => p === '/m/x.m4a'
      ? { format: 'alac' as const, sampleRate: 44100, bitDepth: 16, durationSec: 200 }
      : { unreachable: true as const });
    const out = await findUnplayable(lib([
      track({ id: '1', location: '/m/x.m4a' }),
      track({ id: '2', location: '/m/gone.flac', kind: 'FLAC File' }),
    ]), 'cdj2000', read);
    const x = out.find(c => c.location === '/m/x.m4a')!;
    expect(x.reasons).toEqual([{ kind: 'format', format: 'alac' }]);
    expect(x.facts?.sampleRate).toBe(44100);
    const gone = out.find(c => c.location === '/m/gone.flac')!;
    expect(gone.unreachable).toBe(true);
  });

  it('entries sharing a file become one candidate', async () => {
    const out = await findUnplayable(lib([
      track({ id: '1', location: '/m/Café.flac'.normalize('NFC'), fileType: 5, sampleRate: 44100, bitDepth: 16 }),
      track({ id: '2', location: '/m/Café.flac'.normalize('NFD'), fileType: 5, sampleRate: 44100, bitDepth: 16 }),
    ]), 'cdj2000', noRead);
    expect(out).toHaveLength(1);
    expect(out[0].trackIds.sort()).toEqual(['1', '2']);
  });
});

describe('previewConversion', () => {
  it('plans the output path and readiness from fresh source facts', async () => {
    const cands: ConvertCandidate[] = [
      { trackIds: ['1'], location: '/m/a.flac', name: 'A', artist: 'X', reasons: [{ kind: 'format', format: 'flac' }],
        facts: { format: 'flac', sampleRate: 96000, bitDepth: 24 } },
      { trackIds: ['2'], location: '/m/gone.flac', name: 'G', artist: 'X', reasons: [], facts: null, unreachable: true },
    ];
    const readFacts = vi.fn(async () => ({ format: 'flac' as const, sampleRate: 96000, bitDepth: 24, durationSec: 100 }));
    const items = await previewConversion(cands, 'cdj2000', 'aiff', { readFacts, exists: () => false });
    expect(items).toEqual([{
      trackIds: ['1'], from: '/m/a.flac', to: '/m/a.aif', readiness: 'new',
      out: { format: 'aiff', sampleRate: 48000, bitDepth: 24, bitrateKbps: 2304 },
    }]);
  });
});

// ---- runConversion ----

const OUT = { format: 'aiff' as const, sampleRate: 44100, bitDepth: 16, bitrateKbps: 1411 };
const item = (n: string, over: Partial<ConvertPreviewItem> = {}): ConvertPreviewItem => ({
  trackIds: [`t${n}`], from: `/m/${n}.flac`, to: `/m/${n}.aif`, readiness: 'new', out: OUT, ...over,
});
const sourceFacts = { format: 'flac' as const, sampleRate: 44100, bitDepth: 16, durationSec: 100 };

function harness(opts: Partial<ConvertRunOptions> = {}, over: Partial<RunDeps> = {}) {
  const events: ConvertProgress[] = [];
  const order: string[] = [];
  const controller = new AbortController();
  const convert = vi.fn(async (_ff: string, job: { input: string; output: string }): Promise<ConvertResult> => {
    order.push(`convert:${job.input}`);
    return { ok: true, outputPath: job.output, sizeBytes: 1234, facts: { ...sourceFacts, format: 'aiff' } };
  });
  const switchDb = vi.fn((_db: string, _key: string, switches: EntrySwitch[], o: { backupPath: string }) => {
    order.push('write');
    return { switched: switches.length, skipped: [], backupPath: o.backupPath };
  });
  const switchXml = vi.fn(async (_x: string, _l: unknown, switches: EntrySwitch[]) => {
    order.push('write');
    return { switched: switches.length, skipped: [], backupPath: '/lib.xml.backup' };
  });
  const trash = vi.fn(async (p: string) => { order.push(`trash:${p}`); });
  const deps: RunDeps = {
    ffmpeg: '/ff', emit: (p) => { events.push(p); if (p.type === 'writing') order.push('emit:writing'); },
    signal: controller.signal, convert: convert as never, switchDb: switchDb as never,
    switchXml: switchXml as never, trash,
    readFacts: vi.fn(async () => sourceFacts),
    fileSize: vi.fn(async () => 999),
    loadXmlLibrary: vi.fn(async () => ({ version: '1', tracks: new Map(), playlists: [] }) as never),
    ...over,
  };
  const run: ConvertRunOptions = {
    libraryPath: '/rb/master.db', dbKey: 'k', profileId: 'cdj2000', target: 'aiff',
    trashOriginals: false, items: [item('a'), item('b')], ...opts,
  };
  return { events, order, controller, convert, switchDb, switchXml, trash, deps, run };
}

describe('runConversion', () => {
  it('a failed file does not stop the run or reach the library', async () => {
    const h = harness({ items: [item('a'), item('b'), item('c')] });
    h.convert.mockImplementationOnce(async (_f, job) => ({ ok: true, outputPath: job.output, sizeBytes: 1, facts: sourceFacts }))
      .mockImplementationOnce(async () => ({ ok: false, error: 'ffmpeg exploded' }));
    const res = await runConversion(h.run, h.deps);
    expect(h.convert).toHaveBeenCalledTimes(3);
    expect(res.failed).toEqual([{ from: '/m/b.flac', error: 'ffmpeg exploded' }]);
    const switches = h.switchDb.mock.calls[0][2] as EntrySwitch[];
    expect(switches.map(s => s.trackId)).toEqual(['ta', 'tc']);
    expect(res.switched).toBe(2);
    expect(h.switchDb).toHaveBeenCalledTimes(1);
    expect(h.events.at(-1)?.type).toBe('complete');
  });

  it('cancel switches what finished and drops what was in flight', async () => {
    const h = harness({ items: [item('a'), item('b'), item('c')] });
    h.convert.mockImplementationOnce(async (_f, job) => ({ ok: true, outputPath: job.output, sizeBytes: 1, facts: sourceFacts }))
      .mockImplementationOnce(async () => { h.controller.abort(); return { ok: false, error: 'Cancelled' }; });
    const res = await runConversion(h.run, h.deps);
    expect(h.convert).toHaveBeenCalledTimes(2);
    expect(res.cancelled).toBe(true);
    expect(res.failed).toEqual([]);
    expect((h.switchDb.mock.calls[0][2] as EntrySwitch[]).map(s => s.trackId)).toEqual(['ta']);
    expect(h.events.at(-1)?.type).toBe('cancelled');
  });

  it('the database write is refused while rekordbox runs and files are kept', async () => {
    const h = harness({ trashOriginals: true });
    h.switchDb.mockImplementation(() => { throw new Error('Close rekordbox first'); });
    const res = await runConversion(h.run, h.deps);
    expect(res.error).toMatch(/Close rekordbox first/);
    expect(res.switched).toBe(0);
    expect(res.trashed).toBe(0);
    expect(h.trash).not.toHaveBeenCalled();
    expect(h.events.at(-1)?.type).toBe('error');
  });

  it('originals are trashed only after the write, and never for XML', async () => {
    const db = harness({ trashOriginals: true });
    const res = await runConversion(db.run, db.deps);
    expect(res.trashed).toBe(2);
    expect(db.order).toEqual([
      'convert:/m/a.flac', 'convert:/m/b.flac', 'emit:writing', 'write', 'trash:/m/a.flac', 'trash:/m/b.flac',
    ]);
    expect(db.switchDb.mock.calls[0][3].backupPath).toMatch(/^\/rb\/master\.db\.backup\.\d{4}-\d\d-\d\dT/);

    const xml = harness({ libraryPath: '/lib.xml', dbKey: undefined, trashOriginals: true });
    const xres = await runConversion(xml.run, xml.deps);
    expect(xml.switchXml).toHaveBeenCalledTimes(1);
    expect(xml.switchDb).not.toHaveBeenCalled();
    expect(xml.trash).not.toHaveBeenCalled();
    expect(xres.trashed).toBe(0);
  });

  it('does not trash a file whose entries were skipped by the write', async () => {
    const h = harness({ trashOriginals: true });
    h.switchDb.mockImplementation((_d, _k, s, o) => ({
      switched: s.length - 1, skipped: [{ trackId: 'tb', reason: 'not in the collection' }], backupPath: o.backupPath,
    }));
    const res = await runConversion(h.run, h.deps);
    expect(h.trash.mock.calls.map(c => c[0])).toEqual(['/m/a.flac']);
    expect(res.trashed).toBe(1);
  });

  it('reusable outputs are switched without converting again', async () => {
    const h = harness({ items: [item('a', { readiness: 'reusable' }), item('b', { readiness: 'conflict' })] });
    h.deps.readFacts = vi.fn(async (p: string) => p.endsWith('.aif')
      ? { format: 'aiff' as const, sampleRate: 44100, bitDepth: 16, durationSec: 100 }
      : sourceFacts);
    const res = await runConversion(h.run, h.deps);
    expect(h.convert).not.toHaveBeenCalled();
    expect(res.conflicts).toEqual(['/m/b.flac']);
    const switches = h.switchDb.mock.calls[0][2] as EntrySwitch[];
    expect(switches).toEqual([{ trackId: 'ta', newLocation: '/m/a.aif', target: 'aiff', sizeBytes: 999, out: OUT }]);
  });

  it('switches every entry of a shared file together', async () => {
    const h = harness({ items: [item('a', { trackIds: ['t1', 't2'] })] });
    await runConversion(h.run, h.deps);
    expect((h.switchDb.mock.calls[0][2] as EntrySwitch[]).map(s => s.trackId)).toEqual(['t1', 't2']);
  });

  it('writes nothing when nothing converted', async () => {
    const h = harness();
    h.convert.mockResolvedValue({ ok: false, error: 'bad' });
    const res = await runConversion(h.run, h.deps);
    expect(h.switchDb).not.toHaveBeenCalled();
    expect(res.switched).toBe(0);
    expect(h.events.some(e => e.type === 'writing')).toBe(false);
  });
});
