import { describe, it, expect } from 'vitest';
import { switchedItems, applyConversionSwitches } from '@renderer/convert/switchedItems';
import { buildConversionEntry } from '@renderer/convert/conversionHistory';
import { groupByReason, filterByReason } from '@renderer/convert/reasons';
import type { ConvertCandidate, ConvertPreviewItem, ConvertRunResult } from '@main/ipcContract';

const item = (n: number, over: Partial<ConvertPreviewItem> = {}): ConvertPreviewItem => ({
  trackIds: [`t${n}`], from: `/m/${n}.flac`, to: `/m/${n}.aif`, readiness: 'new',
  out: { format: 'aiff', sampleRate: 44100, bitDepth: 16, bitrateKbps: 1411 }, ...over,
});
const result = (over: Partial<ConvertRunResult> = {}): ConvertRunResult => ({
  switched: 0, switchedItems: [], failed: [], conflicts: [], trashed: 0, cancelled: false, ...over,
});

describe('switchedItems', () => {
  it('is exactly what the writer reported', () => {
    const items = [item(1), item(2), item(4, { trackIds: ['a', 'b'] })];
    const out = switchedItems(items, result({ switchedItems: [
      { trackIds: ['t1'], from: '/m/1.flac', to: '/m/1.aif' }, { trackIds: ['a'], from: '/m/4.flac', to: '/m/4.aif' },
    ] }));
    expect(out.map((i) => i.trackIds)).toEqual([['t1'], ['a']]);
  });
  it('treats items a cancelled run never reached as not converted', () => {
    const items = [item(1), item(2), item(3)];
    const cancelled = result({ cancelled: true, switchedItems: [{ trackIds: ['t1'], from: '/m/1.flac', to: '/m/1.aif' }] });
    expect(switchedItems(items, cancelled).map((i) => i.from)).toEqual(['/m/1.flac']);
    const entry = buildConversionEntry({ libraryPath: '/x.db', items, result: cancelled });
    expect(entry.details.map((d) => d.action)).toEqual(['converted', 'failed', 'failed']);
    expect(entry.details[1].error).toBe('not converted (cancelled)');
  });
  it('switches nothing when the library write failed', () => {
    expect(switchedItems([item(1)], result({ error: 'locked' }))).toEqual([]);
  });
});

describe('applyConversionSwitches', () => {
  const library = () => ({
    libraryPath: '/x.db', playlists: [],
    tracks: new Map<string, any>([['t1', { id: 't1', location: '/m/1.flac', fileType: 5, size: 9, kind: 'FLAC File' }], ['t9', { id: 't9', location: '/m/9.mp3' }]]),
  });
  it('points the track at the new file and describes it', () => {
    const next = applyConversionSwitches(library(), [item(1)]);
    expect(next.tracks.get('t1')).toMatchObject({ location: '/m/1.aif', fileType: 12, kind: 'AIFF File', sampleRate: 44100, bitDepth: 16, bitrate: 1411, size: 9 });
    expect(next.tracks.get('t9').location).toBe('/m/9.mp3');
  });
  it('does not mutate the original and returns it untouched for no switches', () => {
    const lib = library();
    applyConversionSwitches(lib, [item(1)]);
    expect(lib.tracks.get('t1').location).toBe('/m/1.flac');
    expect(applyConversionSwitches(lib, [])).toBe(lib);
  });
});

describe('buildConversionEntry', () => {
  it('records old and new path and the outcome per file', () => {
    const entry = buildConversionEntry({
      libraryPath: '/x.db', items: [item(1), item(2)],
      result: result({ switched: 1, switchedItems: [{ trackIds: ['t1'], from: '/m/1.flac', to: '/m/1.aif' }], trashed: 1, failed: [{ from: '/m/2.flac', error: 'ffmpeg exited 1' }], backupPath: '/b' }),
      names: { '/m/1.flac': 'A - One' },
    });
    expect(entry.type).toBe('conversion');
    expect(entry.backupPath).toBe('/b');
    expect(entry.summary).toBe('Converted 1 of 2 files, 1 original moved to the Trash');
    expect(entry.details).toEqual([
      { action: 'converted', trackName: 'A - One', from: '/m/1.flac', to: '/m/1.aif' },
      { action: 'failed', trackName: undefined, from: '/m/2.flac', to: '/m/2.aif', error: 'ffmpeg exited 1' },
    ]);
  });
  it('says so when the write failed', () => {
    const entry = buildConversionEntry({ libraryPath: '/x.db', items: [item(1)], result: result({ error: 'locked' }) });
    expect(entry.summary).toBe('Conversion failed: locked');
    expect(entry.details[0]).toMatchObject({ action: 'failed', error: 'locked' });
  });
});

describe('reasons', () => {
  const c = (loc: string, reasons: any[]): ConvertCandidate => ({ trackIds: [loc], location: loc, name: loc, artist: '', reasons, facts: null });
  const list = [c('a', [{ kind: 'format', format: 'flac' }]), c('b', [{ kind: 'format', format: 'flac' }]), c('d', [{ kind: 'float' }])];
  it('groups by reason, most common first', () => {
    expect(groupByReason(list)).toEqual([
      { label: "FLAC isn't supported", count: 2 }, { label: "32-bit float isn't supported", count: 1 },
    ]);
  });
  it('filters by a reason, and by none', () => {
    expect(filterByReason(list, "32-bit float isn't supported").map((x) => x.location)).toEqual(['d']);
    expect(filterByReason(list, '')).toBe(list);
  });
});
