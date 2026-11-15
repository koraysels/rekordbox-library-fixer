import * as fs from 'fs';
import * as path from 'path';

/** A search folder, or a folder inside one, that could not be looked through. */
export interface UnsearchedFolder {
  path: string;
  /** `missing`: the search folder is not there. `unreadable`: it is, but listing it failed. */
  reason: 'missing' | 'unreadable';
}

export interface AudioFileIndexResult {
  files: string[];
  /** Empty only when every folder was listed. A search with anything here is incomplete. */
  unsearched: UnsearchedFolder[];
}

export interface AudioFileIndexOptions {
  /** With a leading dot, any case: `.mp3`. */
  extensions: string[];
  /** Look below the search folder at all. */
  recursive: boolean;
  /**
   * How many levels below each search folder to look: a file directly in it is
   * level 1. Counted from the search folder itself — glob counted from the
   * process's working directory, which in a packaged app is `/`, so files a few
   * folders down were never found.
   */
  maxDepth: number;
}

const isGone = (e: unknown) => {
  const code = (e as NodeJS.ErrnoException)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
};

/**
 * Every audio file under the search folders, and every folder that could not be
 * listed. Walked by hand rather than globbed: a glob reads a folder name such as
 * `Music [DJ]` as a pattern and, like any glob, says nothing about a folder it
 * could not read. A caller deciding that a file is gone needs to know both.
 *
 * Hidden files and folders are skipped, as glob did; a symbolic link to a file
 * counts, a link to a folder is not followed.
 */
export async function indexAudioFiles(
  searchPaths: string[],
  options: AudioFileIndexOptions,
): Promise<AudioFileIndexResult> {
  const wanted = new Set(options.extensions.map((e) => e.toLowerCase()));
  const files: string[] = [];
  const unsearched: UnsearchedFolder[] = [];
  const depthLimit = options.recursive ? options.maxDepth : 1;

  const walk = async (dir: string, level: number, isRoot: boolean): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      // A subfolder that vanished mid-walk held nothing to find.
      if (isRoot || !isGone(e)) {
        unsearched.push({ path: dir, reason: isRoot && isGone(e) ? 'missing' : 'unreadable' });
      }
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {continue;}
      const full = path.join(dir, entry.name);
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try { isFile = (await fs.promises.stat(full)).isFile(); } catch { isFile = false; }
      }
      if (isFile) {
        if (wanted.has(path.extname(entry.name).toLowerCase())) {files.push(full);}
      } else if (entry.isDirectory() && level < depthLimit) {
        await walk(full, level + 1, false);
      }
    }
  };

  for (const root of searchPaths) {
    await walk(root, 1, true);
  }
  return { files, unsearched };
}
