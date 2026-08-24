import { describe, it, expect } from 'vitest';
import { diagnoseLocation, findBrokenEntries, describeReason } from '../../src/main/brokenEntries';

// Every case below was taken from a real rekordbox library.
const present = () => true;
const absent = () => false;

describe('diagnoseLocation', () => {
  it('flags a folder', () => {
    expect(diagnoseLocation('/Music/Handbraekes/', present)).toBe('folder');
  });

  it('flags a streaming entry', () => {
    expect(diagnoseLocation('/app/tidal:tracks:105015500', present)).toBe('streaming');
  });

  it('flags a path cut short mid-name', () => {
    expect(diagnoseLocation('/Music/Unknown Album/Pancake - Don&', present)).toBe('truncated');
  });

  it('flags an empty location', () => {
    expect(diagnoseLocation('', present)).toBe('empty');
    expect(diagnoseLocation(undefined, present)).toBe('empty');
  });

  it('reports a file that is simply gone as missing', () => {
    expect(diagnoseLocation('/Music/moved.mp3', absent)).toBe('missing');
  });

  it('passes a normal file', () => {
    expect(diagnoseLocation('/Music/track.mp3', present)).toBeNull();
  });
});

describe('findBrokenEntries', () => {
  const tracks = [
    { id: '1', name: 'Fine', artist: 'A', location: '/Music/ok.mp3' },
    { id: '2', name: 'Folder', artist: 'B', location: '/Music/Handbraekes/' },
    { id: '3', name: 'Stream', artist: 'C', location: '/app/tidal:tracks:1' },
    { id: '4', name: 'Cut', artist: 'D', location: '/Music/Remix Medley ' },
  ];

  it('returns damaged locations, leaving streaming tracks out', () => {
    const broken = findBrokenEntries(tracks, present);
    expect(broken.map((b) => b.trackId)).toEqual(['2', '4']);
    expect(broken.map((b) => b.reason)).toEqual(['folder', 'truncated']);
  });

  it('leaves merely missing files alone, because those are relocatable', () => {
    const broken = findBrokenEntries([{ id: '9', location: '/Music/moved.mp3' }], absent);
    expect(broken).toEqual([]);
  });

  it('keeps the track details needed to review before removing', () => {
    const [first] = findBrokenEntries([tracks[1]], present);
    expect(first).toMatchObject({ name: 'Folder', artist: 'B', location: '/Music/Handbraekes/' });
  });
});

describe('describeReason', () => {
  it('explains each reason in plain words', () => {
    expect(describeReason('folder')).toMatch(/folder/i);
    expect(describeReason('streaming')).toMatch(/streaming/i);
  });
});

describe('streaming tracks are not damaged', () => {
  it('never offers a streaming entry for removal', () => {
    // A real library held 142 TIDAL tracks. They have no file by design, and
    // removing them would delete the user's streaming collection.
    const broken = findBrokenEntries([
      { id: '1', name: 'My Skin My Logo', artist: 'Solange', location: '/app/tidal:tracks:105015500' },
      { id: '2', name: 'Cut', artist: 'X', location: '/Music/Remix Medley ' },
    ], present);
    expect(broken.map((b) => b.trackId)).toEqual(['2']);
  });
});
