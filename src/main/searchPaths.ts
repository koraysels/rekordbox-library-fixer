/**
 * The folders a relocation search looks in: the music folder first, then the
 * Relocate page's own folders, each once (compared NFC and case-insensitively,
 * so two spellings of one folder are searched once). Node-free, so the Relocate
 * page and the wizard build the list the same way.
 */
export function withMusicFolderFirst(musicFolder: string, searchPaths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [musicFolder, ...searchPaths]) {
    const key = (p ?? '').normalize('NFC').toLowerCase();
    if (!p || seen.has(key)) {continue;}
    seen.add(key);
    out.push(p);
  }
  return out;
}
