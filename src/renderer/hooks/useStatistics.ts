import { useMemo } from 'react';
import type { LibraryData, StatisticsData, DistributionItem, BinnedItem } from '../types';
import { useAppContext } from '../AppWithRouter';

function safeGetField(obj: unknown, ...keys: string[]) {
  if (!obj || typeof obj !== 'object') {return undefined;}
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && (obj as any)[k] !== null && (obj as any)[k] !== undefined) {
      return (obj as any)[k];
    }
  }
  return undefined;
}

function bpmToBin(bpmRaw: unknown): string {
  const raw = typeof bpmRaw === 'number' ? bpmRaw : parseFloat(String(bpmRaw || '').replace(/[^0-9.]/g, ''));
  const bpm = Number(raw);
  if (!isFinite(bpm)) {
    return 'Unknown';
  }
  if (bpm < 60) {
    return '0-59';
  }
  if (bpm < 80) {
    return '60-79';
  }
  if (bpm < 100) {
    return '80-99';
  }
  if (bpm < 120) {
    return '100-119';
  }
  if (bpm < 140) {
    return '120-139';
  }
  return '140+';
}

export function computeStatistics(libraryData: LibraryData | null): StatisticsData {
  const empty: StatisticsData = {
    totalTracks: 0,
    totalPlaylists: 0,
    genreDistribution: [],
    bpmDistribution: [],
    yearDistribution: [],
    specialTagCount: 0,
  };

  if (!libraryData) {
    return empty;
  }

  const genreCounts = new Map<string, number>();
  const bpmCounts = new Map<string | number, number>();
  const yearCounts = new Map<string, number>();
  let specialTagCount = 0;
  let totalTracks = 0;

  for (const value of libraryData.tracks.values()) {
    totalTracks += 1;
    const track = value as Record<string, unknown>;

    // Genres - parser may store Genre or genre or Genres
    let genre = safeGetField(track, 'Genre', 'genre', 'Genres', 'genres');
    if (Array.isArray(genre)) {
      genre = genre.join(', ');
    }
    if (!genre || String(genre).trim() === '') {
      genre = 'Unknown';
    }
    const genreKey = String(genre).trim();
    genreCounts.set(genreKey, (genreCounts.get(genreKey) || 0) + 1);

    // BPM - try several keys
    const rawBpm = safeGetField(track, 'Bpm', 'BPM', 'bpm');
    const bin = bpmToBin(rawBpm);
    bpmCounts.set(bin, (bpmCounts.get(bin) || 0) + 1);

    // Year
    const rawYear = safeGetField(track, 'Year', 'year');
    const yearNum = parseInt(String(rawYear || '').trim(), 10);
    const yearKey = Number.isFinite(yearNum) && yearNum > 0 ? String(yearNum) : 'Unknown';
    yearCounts.set(yearKey, (yearCounts.get(yearKey) || 0) + 1);

    // Tags - look for tags fields and detect special chars or www
    const tagsField = safeGetField(track, 'Tag', 'Tags', 'tag', 'tags');
    let tagsArr: string[] = [];
    if (typeof tagsField === 'string') {
      tagsArr = tagsField.split(/[,;|]/).map((s) => String(s).trim()).filter(Boolean);
    } else if (Array.isArray(tagsField)) {
      tagsArr = tagsField.map((t) => String(t).trim()).filter(Boolean);
    }

    const tagMatches = tagsArr.some((t) => /www/i.test(t) || /[^\w\s]/.test(t));
    if (tagMatches) {
      specialTagCount += 1;
    }
  }

  // Build distributions
  const genreArray: DistributionItem[] = Array.from(genreCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Take top 10 and group rest into 'Other'
  const top = genreArray.slice(0, 10);
  const rest = genreArray.slice(10);
  if (rest.length > 0) {
    const otherCount = rest.reduce((s, r) => s + r.count, 0);
    top.push({ label: 'Other', count: otherCount });
  }

  const bpmArray: BinnedItem[] = Array.from(bpmCounts.entries())
    .map(([bin, count]) => ({ bin, count }))
    .sort((a, b) => {
      // keep Unknown at the end
      if (a.bin === 'Unknown') {
        return 1;
      }
      if (b.bin === 'Unknown') {
        return -1;
      }
      const aNum = parseInt(String(a.bin).split('-')[0], 10);
      const bNum = parseInt(String(b.bin).split('-')[0], 10);
      return (aNum || 0) - (bNum || 0);
    });

  const yearArray: DistributionItem[] = Array.from(yearCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (a.label === 'Unknown') {
        return 1;
      }
      if (b.label === 'Unknown') {
        return -1;
      }
      return parseInt(a.label, 10) - parseInt(b.label, 10);
    });

  return {
    totalTracks,
    totalPlaylists: libraryData.playlists ? libraryData.playlists.length : 0,
    genreDistribution: top,
    bpmDistribution: bpmArray,
    yearDistribution: yearArray,
    specialTagCount,
  };
}

export function useStatistics() {
  const { libraryData } = useAppContext();
  return useMemo(() => computeStatistics(libraryData), [libraryData]);
}
