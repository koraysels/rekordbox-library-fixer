# Media Player — Design Spec

**Date:** 2026-07-15
**Status:** Approved by user (sections 1 & 2 + media-chrome revision approved in brainstorming session)

## Goal

Preview audio tracks directly in the app: play, pause, seek, and volume control without leaving the library manager. Playback available everywhere tracks appear.

## Requirements

- Play button on every track row: duplicates list, relocate/missing tracks, track details panel (filter page has no per-track rows — dropped).
- Persistent bottom mini-player bar between page content and the existing `AppFooter`; hidden when idle, survives page switches.
- Controls: play/pause, seek bar with `elapsed / total` time display, volume slider with mute toggle, stop (✕).
- Volume persists across sessions.
- Space bar toggles play/pause when focus is not in an input/textarea/contenteditable and a track is loaded.
- Formats: mp3, m4a/aac, flac, wav, ogg natively; AIFF via container rewrap (DJ libraries commonly use AIFF, which Chromium cannot play).

## Architecture

### Main process — `media://` protocol

- `protocol.registerSchemesAsPrivileged([{ scheme: 'media', privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } }])` before `app.whenReady()`. `corsEnabled` + an `Access-Control-Allow-Origin: *` response header are required for renderer `fetch()` (the AIFF path) — verified empirically; without them Chromium blocks cross-origin fetch to the custom scheme.
- In `whenReady`: `protocol.handle('media', …)` decodes the path, rejects non-audio extensions (403), forwards `request.headers` to `net.fetch(pathToFileURL(path))` so range requests work, and adds the ACAO header.
- Streams from disk with HTTP range request support → instant start and seek without loading whole files into memory. Missing file → 404 response.
- Renderer URL shape: `media:///${encodeURIComponent(track.location)}`.

### Renderer

Everything plays through a **single `<audio>` element**; media-chrome components bind to it and provide all transport UI. Units:

1. **`src/renderer/stores/playerStore.ts`** — Zustand store (matches existing `settingsStore` pattern).
   - State: `currentTrack` (id, name, artist, location), `status: 'idle' | 'loading' | 'playing' | 'paused' | 'error'`, `volume`, `muted`.
   - Actions: `playTrack(track)`, `toggle()`, `stop()`, `setVolume(v)`, `setMuted(m)`.
   - Persist middleware, key `rekordbox-player`, partialized to `{ volume, muted }`.
   - Time/duration stay OFF the store — media-chrome reads them from the element directly; rows only need per-track play state.

2. **`src/renderer/audio/`**
   - `audioController.ts` — thin singleton the MiniPlayer registers its `<audio>` element with; store actions (`playTrack`, `toggle`, `stop`) drive the element through it, and element events (`playing`, `pause`, `ended`, `error`, `volumechange`) sync back to the store.
   - `resolveAudioSrc.ts` — returns the element `src` for a track: `media:///…` URL directly for native formats; for `.aiff`/`.aif`, fetches the same URL and rewraps to a WAV Blob URL.
   - `aiffToWav.ts` — pure function: AIFF is uncompressed PCM, so no decoding — parse `COMM`/`SSND` chunks, byte-swap big-endian samples (`NONE`; `sowt` is already little-endian), prepend a 44-byte WAV header. Compressed AIFC variants rejected with a clear error. ~80 lines, no AudioContext, fully unit-testable.

3. **UI components** — player UI is composed from **media-chrome** (`media-chrome/react`), not hand-built:
   - **`src/renderer/components/ui/MiniPlayer.tsx`** — bottom bar rendered in `AppWithRouter` above `AppFooter`. `<MediaController audio>` wrapping the single `<audio slot="media">` plus ready-made `<MediaPlayButton>`, `<MediaTimeRange>`, `<MediaTimeDisplay showDuration>`, `<MediaMuteButton>`, `<MediaVolumeRange>`; custom bits are only the track title/artist text and the stop ✕ button. Styled via media-chrome CSS vars + Tailwind to match the TE theme. Hidden when `status === 'idle'`.
   - **`src/renderer/components/ui/PlayButton.tsx`** — small reusable button: ▶ (idle/other track), ⏸ (this track playing), spinner (this track loading). Dropped into `DuplicateItem`, `MissingTrackItem`, `VirtualizedList` rows, `TrackDetails`. Reads `playerStore`; never touches the element directly. Note: `TrackDetails` is currently not mounted anywhere in the app (pre-existing); its PlayButton becomes active if/when the panel is used.

### New dependency

- `media-chrome` — headless media player components (Mux). Handles play state, seeking, buffering UI, time formatting, volume, accessibility. Unstyled; themed via CSS vars. Pure JS, no native binaries, safe for electron-builder packaging. Goes in `dependencies`.

## Behaviors

- ▶ on a row: stop current, load and play the new track. ⏸ pauses; ▶ resumes.
- Track ends → status `paused` at position 0, track stays loaded. No autoplay-next in v1.
- Mini-player ✕ → full stop and unload (`src` cleared, AIFF Blob URL revoked); bar hides.
- Page switches never interrupt playback.
- Loading: spinner on row button while the stream opens / AIFF rewraps.
- Missing tracks on the relocate page still get a play button — after relocation the updated location plays.
- Volume/mute changes flow element → store (persisted); on app start the stored values are applied to the element.

## Error handling

- Protocol 404 (missing/moved file), element decode failure, AIFF rewrap failure → store `status: 'error'` → toast via existing `useNotifications` ("File missing or unreadable" / "Unsupported AIFF variant") → store resets to `idle`. Player remains usable.
- AIFF Blob URLs revoked on track switch and stop — no memory leaks.
- Space-key handler ignores events when `e.target` is an input, textarea, or contenteditable.

## Testing (vitest, existing jsdom setup)

- `playerStore`: action/state transitions with a mocked controller.
- `aiffToWav`: generated fixture buffers — valid PCM (big-endian `NONE` and little-endian `sowt`), corrupt header, compressed AIFC rejection; output verified against expected WAV header + samples.
- `PlayButton`: four render states (idle / loading / playing-this / playing-other).
- `MiniPlayer`: smoke test — renders when a track is loaded, hidden when idle (media-chrome custom elements register in jsdom; deep transport interaction is covered by media-chrome itself, not re-tested here).
- No e2e: headless CI audio is flaky.

## Out of scope (v1)

- Waveform display, autoplay-next, playlists/queue, A-B duplicate comparison, gapless playback, EQ.
