# Playable-on-my-decks converter — design

Issue: [#11](https://github.com/koraysels/rekordbox-library-fixer/issues/11) (asked as "FLAC → MP3/AIFF/WAV converter").

## Why

Older Pioneer players — the user's own CDJ-2000 and CDJ-2000NXS — refuse files the
library is full of. The issue names FLAC; the user's actual library holds **no FLAC at
all**, but does hold what those decks equally refuse: 30 lossless M4A (ALAC), WAV up to
32-bit, and a handful of 96 kHz files. At a gig that is a track that will not load. The
fix today is converting by hand and then re-doing cues and beatgrids, or losing them.

So the feature is not "convert FLAC" but **"make my library playable on my decks"**:
pick the player, see every track it cannot play, convert those, and keep everything the
DJ built on them.

## What success looks like

After a run, every selected track plays on the chosen player, and in rekordbox it is the
**same entry** it was before: same cues, loops, hot cues, beatgrid, play count, rating,
colour, playlist slots. Only the file behind it changed.

## Decided with the user

- **The library entry switches to the converted file.** It is never duplicated: a
  second entry would need its cues copied by hand and would show up in this app's own
  duplicate detection.
- **What happens to the original file is a choice**, offered as an option: keep it on
  disk (default), or move it to the system Trash once the library is updated and the new
  file verified.

## Goals

1. Choose a player profile; list the tracks that profile cannot play, with the reason
   per track (format, sample rate, bit depth).
2. Select per track, select all, filter by reason.
3. Preview (dry run): exactly which files would be written where, and what changes in the
   library — before anything is touched.
4. Convert, with progress and cancel, then switch the library entries over.
5. Works on `master.db` (the default) and on an XML library.
6. Works with nothing for the user to install.

## Non-goals

- Two library entries per track (see above).
- Converting tracks the player can already play, "to save space" or for any other reason.
- Editing tags, normalising loudness, or any processing beyond what the player needs.
- Streaming tracks (TIDAL, Spotify) — they have no file; they are never listed.
- Writing to USB sticks / device exports — rekordbox's own sync does that.

## Anti-goals (would make this a failure even if it technically works)

- **A cue or beatgrid that moves.** A DJ who finds their hot cues a few milliseconds off
  stops trusting the library.
- **A library entry pointing at nothing.** The original is never removed before the
  library has been updated and the new file checked.
- **Quietly losing quality**: truncating 24-bit to 16-bit without dither, or a lossy
  target picked by default.
- **Losing cover art or tags.**

## Constraints

- Same safety rules as every other database write (see CLAUDE.md): rekordbox closed,
  verified backup mandatory, ids re-checked before writing, `rb_local_usn` bumped.
- Shares the relocation path's guarantee: only file-describing columns change, so cues,
  beatgrids and playlists (keyed by the content ID) stay attached. Relocation already
  proves this on real libraries for `FolderPath` / `FileNameL`.
- Path comparisons go through NFC normalisation (`normalizePath.ts`).
- **Usable without its page.** A guided "fix my library" wizard is the next project (its
  own branch, after this). Finding unplayable tracks, planning a run and running it live
  outside the React page — pure modules plus main-process services — so a wizard step can
  call "convert what your decks can't play" with defaults and no page of its own.
- Long runs follow the auto-relocation pattern: sequential, live progress, cancel
  between files, a strip on the page when the dialog is hidden.

- **The player is a setting**: "Oldest player you play on", persisted in the settings
  store with the other settings. It is the minimum the library has to play on. The
  converter page starts from it and can switch it for a one-off run (someone else's
  gear) without changing the setting. Other pages may use it later, e.g. marking a track
  that will not load; that is not part of this work.

## How — my calls (the user said "go"; each can be vetoed)

- **Player profile, not a format picker.** First profile: *CDJ-2000 / CDJ-2000NXS* —
  plays MP3, AAC, WAV, AIFF; up to 48 kHz; up to 24-bit integer PCM. Not FLAC, not ALAC,
  not 32-bit or float. The builder confirms these limits against Pioneer's spec sheets
  and stores profiles as data so NXS2 / XDJ etc. can be added later.
- **Default target: AIFF**, keeping the source's bit depth up to 24-bit (32-bit/float →
  24-bit with dither), sample rate capped at 48 kHz (96/88.2 kHz → 48/44.1 kHz,
  high-quality resampler). Lossless to lossless is sample-exact, so cues land where they
  were. Cover art and tags carried across (ID3 in AIFF).
- **WAV** offered as a target; it carries art and tags poorly on Pioneer gear, so it is
  not the default.
- **MP3** offered with a plain warning: encoder delay can shift cues by a few
  milliseconds, and it is lossy. 320 kbps CBR, LAME header written.
- **Where converted files go:** next to the original, same name, new extension. If that
  name exists, the track is reported as a conflict and skipped — never overwritten.
- **ffmpeg comes with the app's own download, not the installer**: fetched once on
  first use from a pinned, checksummed build for the platform and architecture, kept in
  the app's data folder. Keeps the installer and every auto-update small. The user is
  told once, with the size, before it downloads. Licence notice for the build shipped in
  the About/credits.
- **Same format in and out** (a 32-bit WAV to WAV, a 96 kHz AIFF to AIFF): "same name,
  new extension" would be the original's own path. The converted file then gets a
  suffix saying what changed — `01 Track (24-bit).wav`, `01 Track (48 kHz).aif` — so
  "keep original" still holds and nothing is overwritten. The preview shows the name.
- **Several entries pointing at one file** (see `classifyDuplicateSet`): converting
  that file switches every entry that points at it, and the preview lists them all,
  including any the user did not select. Leaving one behind on a trashed file would be
  an entry pointing at nothing.
- **Order of work per track:** convert to a temporary name → verify the output (opens,
  duration within 50 ms of the source, expected format) → rename into place. After all
  files: one library write for the whole batch. Only after that write succeeds are
  originals trashed, if that option is on.
- **Database columns updated:** `FolderPath`, `FileNameL`, `FileType`, `FileSize`,
  `BitRate`, `BitDepth`, `SampleRate`, plus `rb_local_usn`. `AnalysisDataPath` and
  everything else untouched. FileType codes seen in a real library: 1 MP3, 4 AAC, 6
  lossless M4A, 11 WAV, 12 AIFF; FLAC is 5 per pyrekordbox — the builder verifies the
  codes before writing them.
- **XML library:** `Location`, `Kind`, `BitRate`, `Size`, `SampleRate` rewritten through
  the existing XML writer, backup first. But rekordbox matches an imported XML track by
  its location and an import never removes one, so importing that XML adds the
  converted file as a **new** track without cues beside the old one — the duplicate this
  design rules out. So in XML mode the page says so plainly and points to the database
  for switching entries in rekordbox itself, and **"move originals to Trash" is not
  offered** (the old rekordbox entry would point at nothing).
- **USB sticks are out of scope.** The decks read a rekordbox USB export with its own
  copies of the files; after a run the page tells the user to sync their USB from
  rekordbox so the sticks get the converted files.
- **History:** one entry per run in the Activity history, per-track detail (old path, new
  path, outcome), like merges and relocations.
- **Sidebar:** its own page, "Convert", after Track Relocation.

## Relation to the existing draft PR

markst's [draft PR](https://github.com/markst/rekordbox-library-fixer/pull/2) (stale
since May) predates the database support and the split main process, uses npm instead of
pnpm, and has the problems this design rules out (16-bit truncation, originals deleted
before the library write, system ffmpeg only, no artwork). It is built fresh on the
current architecture; the PR's per-track selection and dry-run ideas carry over, and
markst is credited in the changelog and on the issue.

## Left to the builder

- The exact ffmpeg build source, and how its checksum is pinned.
- The verification threshold beyond the 50 ms duration check, if any.
- UI layout, within the app's existing style (TE theme, PopoverButton, progress dialog).

## How it is proven

- Unit tests for the pure parts: profile → "can this play?" with reason; ffmpeg argument
  building per source/target; library update planning (DB columns and XML attributes).
- A real-database check, as for duplicates: convert a copy's tracks and confirm rekordbox
  itself opens the result with cues, hot cues and beatgrid intact on at least one ALAC
  and one 32-bit WAV track.
