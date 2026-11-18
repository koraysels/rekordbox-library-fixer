# USB check — design

## Why

A DJ syncs playlists to a USB stick with rekordbox and finds playlists empty or half full on the
player. Rekordbox skips, without a word, every track it cannot read at sync time: a file on a drive
that was not plugged in, a file that is gone, a streaming track. On the stick that prompted this
(KROCKSTICK, CDJ-2000 / CDJ-2000NXS / XDJ-RX2), 1091 playlist entries lived on a second drive that was
unplugged during the sync and 258 had no file at all; 19 synced playlists ended up empty.

The app cannot see this today. The USB check shows, per synced playlist, what is on the stick, what
is not, and why — before and after a sync.

## Decisions (agreed)

1. **Own Advanced page, "USB Sticks"** (route `/usb`, sidebar entry). The wizard's Done screen gets a
   "Check your USB stick" button that switches to Advanced and opens it. Not a wizard step: it changes
   nothing in the library.
2. **What it shows**, per playlist:
   - tracks of the library playlist that are not on the stick, each with a reason:
     - `drive-unplugged` — the file is on a volume that is not mounted (name the drive, count per drive:
       "Plug in ICYFAST BLA: 1091 tracks");
     - `missing` — the volume is there but the file is not (ENOENT/ENOTDIR, `fileState.ts`);
     - `no-access` — EPERM/EACCES;
     - `streaming` — `isStreamingLocation`;
     - `not-synced-yet` — the file is readable: rekordbox will copy it at the next sync;
   - library count vs stick count;
   - playlists on the stick that are not in the library's sync list (leftovers from older exports);
   - playlists in the sync list that are missing from the stick altogether.
   Smart playlists (`Attribute` 4) are listed as "not checked" (the parser does not evaluate them).
3. **Format: `export.pdb` only** (Device Library — what CDJ-2000/NXS/NXS2, CDJ-3000, XDJ-RX2/RX3 read).
   OneLibrary (`exportLibrary.db`) is out of scope for v1; the page says so in one line when the
   stick has one.
4. **Read-only.** The app never writes to the stick, never writes `master.db` from this page. Fixes are
   pointers: Relocate / the wizard for missing files, "plug in <drive>", "sync again in rekordbox".
   The stick's files are read from a copy taken into a temp dir, like `master.db`.
5. **Stick detection**: every mounted volume with `PIONEER/rekordbox/export.pdb`
   (`/Volumes/*` on macOS, mount points under `/media` and `/run/media/<user>` on Linux, drive letters on
   Windows). One found → it is used; several → pick from a list. Rescan button; no watcher.
6. Branch `feat/usb-check`, stacked on `feat/ui-sdk`; UI uses ui-sdk parts where they fit.

## Facts the code depends on (verified on a real stick, on copies)

- `PIONEER/rekordbox/playlists3.sync` is plain XML (CRLF), written by rekordbox's automatic sync:
  `<Sync DBID=… AutomaticSync="1" AllPlaylists="0" …><Playlists><NODE Id="199D185A" ParentId="0"
  Attribute="0" …/>…`. `Id` is hex of the library's `djmdPlaylist.ID` (decimal); `Id="0"` is the root;
  ids not in the library are deleted playlists. `AllPlaylists="1"` means every playlist is synced.
  `playlists3Plus.sync` is the same list for OneLibrary. The file may be absent (stick made with
  Export, not Sync): then the playlists to check are the library playlists whose name/path matches one
  on the stick.
- `export.pdb` is DeviceSQL (spec: Deep Symmetry, https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/exports.html,
  and crate-digger's `rekordbox_pdb.ksy`). v1 needs table types 0 (tracks: id, title, file path,
  artist id), 2 (artists, for matching), 7 (playlist_tree: id, parent_id, sort_order, is_folder, name)
  and 8 (playlist_entries: entry_index, track_id, playlist_id). Deleted rows are skipped via each row
  group's presence bitmask. A player that has written the stick can leave the file dated 2017.
- Stick tracks have no library id. Match a library entry to a stick track by file name (NFC,
  case-insensitive), then by title + artist when the name differs (rekordbox shortens or replaces
  characters FAT32 does not allow).
- Reference numbers from KROCKSTICK's `export.pdb` (for local validation only, never committed):
  5926 tracks, 78 playlist rows (77 lists, 1 folder), 2108 entries, 19 empty lists.

## Out of scope

Writing the stick; OneLibrary; evaluating smart playlists; watching for plug-ins; history playlists.
