# Fix-my-library wizard — design

## Why

Most DJs don't want to learn four tools (duplicates, relocation, maintenance, converter). They want their
library fixed. Today the app makes them pick a page, understand its options and run it, in the right order,
themselves. The wizard does that for them: one check, a short summary, one confirm per step.

## What success looks like

A DJ opens the app, answers a few questions the first time, clicks "Check my library", confirms a handful of
steps, and ends with: no missing tracks that could be found, no dead entries, no duplicate files, every file
in one music folder, and every track playable on their oldest player — with all cues, beatgrids and playlists
intact. Nothing unsure was changed without them seeing it.

## Decided with the user

- **The wizard is the default screen.** An "Advanced" switch shows today's pages, unchanged. The last mode
  used is remembered.
- **Database only.** An XML library is sent to Advanced: an XML import can't remove entries or switch them
  to a new file, so most steps couldn't deliver.
- **First run** asks, once: find the database, the key (see below), oldest player, music folder. Then
  straight to "Check my library".
- **The database key is bundled.** Read at build time from a gitignored `.env`; release builds get it from a
  GitHub Actions secret that writes `.env` during the build. The app tries the bundled key first and shows
  today's paste screen only when the database won't open with it (a rekordbox update could change it). The
  key is never committed to the repository.
- **Music folder** is a setting next to "Oldest player you play on", usable by Advanced too. Relocation
  searches it first.
- **One scan, then a summary** ("142 missing, 38 duplicates, 12 won't play on your CDJ, 300 outside your
  music folder"). Steps with nothing to do are skipped. Coming back later shows the last result and a
  "Check again" button; the app never scans by itself.
- **Step order:** relocate → remove broken entries → duplicates → gather into the music folder → convert.
- **Sure cases fixed with one confirm per step; unsure cases set aside** in a "check these yourself" list
  that opens the matching Advanced page. No per-track yes/no questions in the wizard.
- **Each step writes on its own**, with its own verified backup, and the next step works from the updated
  library — the summary numbers update as you go.
- **Rekordbox must be closed**: checked before the first step (a "Close rekordbox to continue" screen that
  waits) and again before each write.
- **Each step is one Activity-history entry**, like today's operations.
- **No undo button in this version.** Backups are listed in History, trashed files are in the Trash.
  Restoring a database alone would undo library changes but not file moves.
- **Look:** the app's current TE theme, orange accent, one thing per screen, big and calm.

### The steps

1. **Relocate.** Same matching as the Relocate page (`TrackRelocator.findRelocationCandidates`), music folder
   searched first. A match of **90 % or more** is applied; the rest are set aside with their best guess.
2. **Remove broken entries.** An entry is removed only when *all* hold: its file is still not found after
   step 1, its drive is mounted, and it is not a streaming track (`isStreamingLocation`). An entry on an
   unplugged drive is never removed. The step shows the count and the list before the confirm.
3. **Duplicates.** Sure = several entries pointing at one file (`classifyDuplicateSet`), or files with
   identical audio (same duration, same size, same tags). Kept entry: most cues + playlist slots, then best
   quality, then the one inside the music folder. Extra files go to the Trash (only once no entry uses them,
   as today). Anything less certain is set aside.
4. **Gather into the music folder.** Tracks outside it are **moved** in, to
   `<music folder>/<name of the folder they came from>/<file>`. Files already inside stay put. Same drive: a
   rename. Other drive: copy, verify, switch the library entry, and only then trash the original — the
   converter's rule. **Never overwrite**: an identical file already at the destination (same size and
   content) is reused; a different one gets a ` (2)` suffix. Tracks on unplugged drives and streaming tracks
   are left out; unplugged ones are listed as "plug in <drive> to include these".
5. **Convert.** The converter's `runConversion` with the player from settings, AIFF target, and **originals
   moved to the Trash** after the library write (the Convert page still defaults to keeping them).

### Also changing

- **Advanced's Consolidate tool** uses the new database-aware gathering and loses its "overwrite" option. Today
  it only updates XML and can overwrite a destination file; afterwards there is one way to gather, and none
  that overwrites.

## Goals

1. Wizard and Advanced modes, wizard default, mode remembered.
2. First-run setup; bundled key with paste fallback.
3. One check producing a per-step summary; steps run in order, each skipped when empty.
4. The five steps above, each: sure cases in one confirm, unsure set aside, backup, one write, history entry.
5. A database-aware gather, shared by the wizard and the Consolidate tool.

## Non-goals

- XML libraries in the wizard.
- Undo.
- Sorting files into Artist/Album folders from tags (a later option).
- USB export — rekordbox's own sync does that; the end screen says to sync.
- Changing Advanced pages beyond Consolidate.

## Anti-goals

- **An unplugged drive treated as lost files.** No entry on an unmounted volume is ever removed, moved or
  counted as broken.
- **A file overwritten or trashed while an entry still uses it.**
- **A change the user didn't see.** Every confirm shows what will happen, with counts and a list.
- **A wizard that fails halfway with a raw error.** Preconditions (rekordbox closed, key works, drive
  mounted, disk space for a cross-drive move) are checked before a step starts and said in plain words.

## Constraints

- Every database write follows CLAUDE.md: rekordbox closed, verified backup mandatory, ids re-checked before
  writing, `rb_local_usn` bumped, only the columns each operation needs.
- Path comparisons through NFC normalisation, and case-insensitive where the filesystem is.
- **The step logic lives outside React**, like the converter's `conversionRun.ts`: each step is a pure
  "find/plan" part plus a main-process "apply" service, so it is testable without rendering and both the
  wizard and the Advanced pages can call it. The wizard UI only sequences them.
- Long steps follow the existing pattern: sequential, live progress, cancel between files.
- Files growing past ~500 lines get split (CLAUDE.md).
- Commit messages and anything on GitHub: no AI attribution, short and plain.

## Calls made after the builder check (mine; each can be vetoed)

- **The bundled key overrides CLAUDE.md's "never shipped"** — the user's decision. CLAUDE.md is updated
  to say so; `keyExtractionCommand.ts` and the paste screen stay, as the fallback.
- **"Drive mounted"** means the volume root of the entry's path exists (`/Volumes/<name>` on macOS, the
  drive letter on Windows, the mount point on Linux). The internal disk is always mounted.
- **Step 2 removes only entries with no relocation candidate at any confidence.** An entry step 1 set aside
  with an unsure guess is never removed; it stays in "check these yourself".
- **Interruptions:** a step's library write is one transaction. Cancelling before it changes nothing;
  cancelling a file-moving step (gather, convert) stops between files and writes what was done, like the
  converter. Reopening the app shows the last result, and continuing always starts with "Check again",
  because rekordbox may have changed the library in between.
- **Identical audio:** content is hashed only for files already equal in size and duration, so the cost
  scales with likely duplicates, not the library. Extra files go to the Trash wherever they are, since the
  Trash can be undone.
- **Gather into same-named folders:** two sources called `Downloads` end up in one `Downloads` folder;
  the clash rule (reuse identical, ` (2)` otherwise) keeps that safe. Cross-drive moves are always
  copy → verify → switch → trash; the step refuses up front, in words, when the music folder's drive lacks
  the space for them.
- **Convert step:** trusts `runConversion`'s rules (reused MP3s, entries sharing a file). If ffmpeg isn't
  downloaded yet, the step asks first, with the size, the same way the Convert page does.
- **First run, finding the database:** several or no candidates use today's home-screen picker. A saved XML
  library gets a screen saying the wizard works on the database, with buttons to open the database or go
  to Advanced.
- **Consolidate in Advanced** writes to the database for a database library and, as today, to the XML for
  an XML library — both without "overwrite".

## Left to the builder

- How the bundled key gets from `.env` into the main process (generated module at build time, or a resource
  file read at runtime), as long as the key is never committed and a build without `.env` still works (it
  just falls back to the paste screen).
- How the check runs (one IPC call producing all step inputs, or one per step) and how long-running scans
  report progress.
- The exact "identical audio" test for duplicates beyond duration + size + tags, if any (a content hash for
  same-size files is reasonable).
- Screen layout within the TE theme.
- Where "check these yourself" lists live (they can link to the Advanced page with a filter).

## How it is proven

- Unit tests for every pure part: the summary, each step's sure/unsure split, the duplicate keep rule, the
  gather destination and clash rules, the "never remove on an unplugged drive" rule.
- Database tests on a copy, as for relocation and merges: each step's apply leaves cues, beatgrids and
  playlists attached and only touches its columns.
- A whole-wizard run on a copy of the user's real library (with its drives), then the user opens rekordbox
  and checks it.
