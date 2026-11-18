# Move from Electron to Tauri

## Why

- A smaller download and install. Electron is 271 MB of today's 396 MB app.
- Less memory, faster start.
- Tauri's updater signs updates with its own key, so the hand-written macOS bundle swap in
  `src/main/updates/` can go.
- pyrekordbox knows rekordbox's database better than our hand-written SQL does.

## What it does not change

- **Opening the app on a Mac the first time.** There is no Apple Developer account, and there won't
  be one. Without it no app can be notarized, whatever it is built with. Tauri's own docs: "Ad-hoc
  code signing does not prevent MacOS from requiring users to whitelist the installation." The app
  stays ad-hoc signed (today's Electron build already is, and the signature is valid), so users
  get "Apple could not verify…" and click **Open Anyway** in Privacy & Security. `xattr` stays as
  the fallback. Updates after that need nothing, because the app downloads them itself and they
  carry no quarantine flag.
- **The speed of scans and writes.** Those are disk, audio parsing and SQLite. They cost the same
  in any shell. The slow tabs were React rendering, fixed in 0.9.1.

## Decisions

- **Keep the TypeScript backend.** The ~10k lines in `src/main/` (wizard, converter, relocation,
  USB check, backups) and their tests stay. They run as a compiled Node sidecar.
- **Add a Python sidecar with pyrekordbox for everything that touches `master.db`.** Reading,
  writing, the key and `rb_local_usn`. This also takes the only native addon
  (`better-sqlite3-multiple-ciphers`) out of the Node sidecar, which then compiles to a single
  binary with no `.node` files to ship beside it.
- **The renderer does not change.** `window.electronAPI` stays, implemented over Tauri's `invoke`
  and events, so the 35 files that call it and `ipcContract.ts` keep working.

## Shape

```
webview (React, unchanged)
   │  invoke('rpc', {channel, payload}) / listen(progress)
Tauri core (Rust): window, menu, dialogs, trash, notifications, media:// protocol,
   │               updater, single instance, starts and stops both sidecars
   │  JSON lines over stdio
Node sidecar (today's src/main, minus Electron): the 60 IPC handlers
   │  JSON lines over stdio
Python sidecar (pyrekordbox): open, read, write master.db
```

What moves from Electron to Rust: `dialog.showOpenDialog`, `shell.trashItem / openPath /
openExternal / showItemInFolder`, `Notification`, `Menu`, `app.getPath / getVersion /
requestSingleInstanceLock`, `protocol.handle` (media://, with range requests for seeking). That is
about 40 call sites. The Node side reaches them through one `Host` interface instead of importing
`electron`.

## Order

Each phase ships on its own and the app works after every one.

1. **Spike, go or no-go.** Before any real work:
   - pyrekordbox opens a copy of a real `master.db` with the bundled key and reads tracks, cues and
     playlists that match ours.
   - PyInstaller (onedir) builds the sidecar on macOS arm64/x64, Windows and Linux in CI, and an
     ad-hoc signed build starts after a browser download plus Open Anyway.
   - The Node backend compiles to one binary (bun `--compile` or Node SEA) and runs ffmpeg and
     music-metadata.
   - `<audio>` plays and seeks over media:// in WebKit (Mac), WebView2 (Windows) and WebKitGTK
     (Linux), including the AIFF-to-WAV path.
   - Measure download size, installed size, RAM and start time against Electron 0.9.1.

   Stop if the installed app isn't clearly smaller. A Node runtime plus a Python runtime may land
   at 120–180 MB.
2. **The database moves to Python, still inside Electron.** The parser, writer, relocator and
   conversion switch become calls to the Python sidecar. The guards stay as they are: rekordbox
   closed, verified backup first, ids re-checked before writing. The database tests run against the
   sidecar. Ship it as an Electron release and let it run for a while.
3. **The Node side stops importing Electron.** A `Host` interface for dialogs, trash, paths,
   notifications and sending progress, with the Electron implementation behind it. No behaviour
   change. Ship.
4. **Tauri shell.** Rust core, the Node sidecar, `window.electronAPI` over `invoke`, media://, the
   menu. Run both builds side by side until the Tauri one passes the e2e tests.
5. **Moving users over.**
   - Settings, the wizard's last check, the relocation cache and Activity history live in
     Electron's storage, which Tauri cannot read. The last Electron release writes them to a JSON
     file in the app's data folder, and the first Tauri launch reads it in.
   - The last Electron release updates users into the Tauri build. On macOS our own updater swaps
     bundles, so it can install a Tauri .app with the same name. On Windows electron-updater runs
     the new NSIS installer silently. The app id and install folder must match, or the old copy
     stays behind.
   - From then on tauri-plugin-updater, with its signing key as a GitHub Actions secret.
6. **Release workflow, README, website.** Tauri's build action, the database key bundled as today
   (never in the repo), release notes that say "Open Anyway" first and `xattr` second.

## Risks

- pyrekordbox's write support covers only some tables. Where it doesn't, the sidecar uses raw SQL
  through pyrekordbox's session, so the key and USN handling stay in one place.
- WebKitGTK on Linux needs GStreamer plugins for audio, which some distros don't install.
- Three processes instead of two: when a sidecar dies, the app has to say so and restart it, not
  hang.
- A rekordbox update that changes the schema now has to be handled in two places until phase 2 is
  done.

## Out of scope

Rewriting the backend in Rust or Python, a UI redesign, Apple notarization.
