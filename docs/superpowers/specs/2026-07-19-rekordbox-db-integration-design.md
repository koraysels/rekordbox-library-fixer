# Rekordbox Database Integration — Design Spec

**Date:** 2026-07-19
**Status:** Approved by user (sections 1 & 2 approved in brainstorming session)

## Goal

Load a Rekordbox library directly from the encrypted `master.db` SQLite database, as an alternative input source alongside the existing XML import. Removes the manual "export XML from Rekordbox" step for users who have Rekordbox installed locally.

## Scope

- **Read-only** from `master.db`. The app never writes to it.
- **Alongside** XML import, not a replacement — both load paths remain.
- Rekordbox **6 and 7** (shared `djmd*` schema).
- Write-back to `master.db` is explicitly **out of scope** (future feature). Edits (duplicate resolution, relocation) continue to flow through XML export exactly as today.

## Requirements

- "Open rekordbox database" action next to the existing XML import in `EmptyLibraryState` and the sidebar.
- Auto-detect `master.db` for RB 7 then RB 6 on macOS and Windows.
- Auto-extract the SQLCipher key from the local Rekordbox installation; on failure, fall back to a manual key field in settings (persisted locally, Zustand key `rekordbox-db`).
- Parsed output is byte-for-byte the same `LibraryData` shape the XML parser produces, so all downstream features (duplicate detection, relocation, preview, XML export) work unchanged.
- No hardcoded key in the repository (DMCA risk); key stays in memory + local persist only, never logged, never sent anywhere.

## Architecture

Target contract (unchanged, from `src/main/rekordboxParser.ts`):
`LibraryData = { libraryPath: string; tracks: Map<string, Track>; playlists: Playlist[] }`
`Track` and `Playlist` per `src/renderer/types/index.ts`.

### Main process — three new units

1. **`src/main/rekordboxDbLocator.ts`** — locates `master.db` and the decryption key.
   - DB paths (try RB 7 then RB 6):
     - macOS: `~/Library/Pioneer/rekordbox7/master.db`, `~/Library/Pioneer/rekordbox6/master.db`
     - Windows: `%APPDATA%\Pioneer\rekordbox7\master.db`, `%APPDATA%\Pioneer\rekordbox6\master.db`
   - Key extraction: derive the stored DB passphrase from the local Rekordbox install the way pyrekordbox does — read the Rekordbox app's stored options/credentials (e.g. `rekordboxAgent` storage `options.json`, or the app asar) and decrypt the embedded DB password. On any failure return `null`; the UI then uses the manual key field.
   - Exports: `detectRekordboxDb(): { found: boolean; dbPath: string | null; version: 6 | 7 | null; hasKey: boolean }` and `extractDbKey(): string | null`.

2. **`src/main/rekordboxDbParser.ts`** — `parseDb(dbPath: string, key: string): Promise<LibraryData>`.
   - Copies `master.db` to a temp file and opens the **copy** `readonly: true` — avoids any contention with Rekordbox's own file lock / WAL; Rekordbox may stay open. Temp copy deleted after parse.
   - Opens via `better-sqlite3-multiple-ciphers`: `PRAGMA key = '<key>'; PRAGMA cipher_compatibility = 4;`.
   - Only rows with `rb_local_deleted = 0`.
   - Query → map to existing `Track`:
     - `djmdContent` + joins `djmdArtist` / `djmdAlbum` / `djmdGenre` / `djmdKey` → `name` (Title), `artist`, `album`, `genre`, `FolderPath` → `location`, `Length` → `duration`, `BitRate` → `bitrate`, `FileSize` → `size`, `created_at` → `dateAdded`, `Rating` → `rating`.
     - `djmdCue` WHERE `ContentID` → `cues` / `loops` (Kind distinguishes hotcue / memory / loop).
     - `djmdBeatGrid` → tempo/beatgrid data, preserved for XML export.
     - `djmdPlaylist` (hierarchy via `ParentID`) + `djmdSongPlaylist` → `Playlist[]` (FOLDER/PLAYLIST, children).
   - `location` uses the same on-disk absolute path format the rest of the app expects (matching the XML parser's decoded path), so relocation/preview/duplicate logic is source-agnostic.

3. **IPC** — `src/main/main.ts` + `src/main/preload.ts`:
   - `detectRekordboxDb()` → `{ found, dbPath, version, hasKey }`.
   - `parseRekordboxDb({ dbPath, key })` → same return contract as `parseRekordboxLibrary`.

### Renderer

- `src/renderer/hooks/useLibrary.ts`: add `loadFromDb()` beside `loadLibrary()`; both set the same `libraryData`.
- `EmptyLibraryState` + sidebar: "Open rekordbox database" button next to the XML button. On detection show the found path + version; when no key was extracted, show a small settings field to paste the key.

## Dependency & Packaging

- `better-sqlite3-multiple-ciphers` in `dependencies` (native module, SQLCipher support, sync API).
- Add to pnpm `onlyBuiltDependencies`; electron-builder `asarUnpack` for the native `.node` (native binaries cannot live inside asar).
- CI: Electron/Node-ABI prebuilds exist; otherwise add an `electron-rebuild` step.
- **Plan Task 1 is a spike:** install the dep, prove decrypt + read against a real `master.db`, and produce one packaged build. If native packaging fails, escalate — fall back to the WASM SQLCipher option (wa-sqlite-cipher). Do not build UI before the spike passes.

## Error Handling

- DB not found → "Open rekordbox database" disabled with hint "Rekordbox not found — use XML import".
- Decrypt fails (wrong key) → toast "Cannot decrypt database — check the key" + fall back to the manual key field.
- Unknown/mismatched schema version → clean error, no crash.
- All failures leave the XML import path fully usable.

## Key Security

- Extracted or pasted key lives in memory + local Zustand persist only. Never in the repo, never in logs, never transmitted. No hardcoded key.

## Testing (vitest, existing setup)

- `rekordboxDbParser`: against a small **unencrypted** SQLite fixture built in-test with the `djmd*` schema — verify Track mapping, cues/loops split, playlist hierarchy, `rb_local_deleted` filter.
- `rekordboxDbLocator`: platform path resolution (mocked fs) and key-extraction parsing against a fixture options file.
- Mapping parity: the same track loaded via XML and via DB yields identical `Track` fields.
- No e2e against a real encrypted DB (key is machine-specific).

## Out of scope (this feature)

- Writing back to `master.db`.
- Non-macOS/Windows platforms for auto-detection (Linux users use XML or a manual DB path + key).
- Playlist smart-lists / intelligent playlists beyond the standard hierarchy.
