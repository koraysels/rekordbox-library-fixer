import { describe, it, expect } from 'vitest';
import { searchTermFor } from '../../src/main/trackRelocator';

const track = (location: string, name = 'Some Title', artist = 'Some Artist') =>
  ({ id: '1', name, artist, originalLocation: location }) as any;

describe('searchTermFor', () => {
  it('uses the old filename when the path names a file', () => {
    expect(searchTermFor(track('/Music/Artist/Album/01 Real Name.mp3'))).toBe('01 Real Name');
  });

  it('falls back to the title when the location is a folder', () => {
    // A real library holds entries like this; the basename would be the folder.
    expect(searchTermFor(track('/Music/Handbraekes/', 'Milc Sessions'))).toBe('Milc Sessions');
  });

  it('falls back to the title when the path was cut short', () => {
    expect(searchTermFor(track('/Music/Unknown Album/Pancake - Don&', 'Pancakes'))).toBe('Pancakes');
  });

  it('adds the artist when the title is too short to search on', () => {
    expect(searchTermFor(track('/Music/Folder/', 'Ra', 'The Acid'))).toBe('The Acid Ra');
  });

  it('uses the artist when there is no title at all', () => {
    expect(searchTermFor(track('/Music/Folder/', '', 'Boards of Canada'))).toBe('Boards of Canada');
  });
});
