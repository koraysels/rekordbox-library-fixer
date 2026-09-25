# CLAUDE.md

This file contains essential project information
Detailed documentation can be found in referenced files
Update both this file and referenced files when making changes

## Project Overview

This is an Electron-based desktop application for managing Rekordbox DJ libraries. It finds and resolves
duplicates, relocates tracks whose files have moved, and clears out entries that can never resolve to a
file — writing the result into rekordbox's own `master.db`, or into an XML library when that is what is
open. A rekordbox XML import can add and update tracks but never remove one, which is why cleaning a
collection has to go through the database.

> ! The processes this software offers, retains all essential DJ metadata, including cues, loops, beatgrids, and playlists.

## Architecture

### Core Structure
- **Main Process** (`src/main/`): file system operations, library parsing and IPC.
  `main.ts` owns only the window, the menu and the app lifecycle. The IPC handlers live in
  `src/main/ipc/`, one module per domain (`library`, `duplicates`, `relocation`,
  `maintenance`, `backups`, `system`), each exporting a `register*Ipc()` that `main.ts` calls
  once the app is ready. The long-lived pieces (parser, detector, relocator, logger, window)
  live in `src/main/runtime.ts` behind `runtime()`, read per call rather than captured at
  import time — the window is replaced when it is closed and reopened. `sendToWindow()` is
  how a handler reports progress. A test checks every channel the preload invokes is
  registered exactly once, because a missing one only shows up as a button that does nothing.
- **Renderer Process** (`src/renderer/`): React-based UI with TypeScript
- **Shared Types** (`src/shared/`): Common interfaces and utilities

### State Management
- **Zustand Store** (`src/renderer/stores/settingsStore.ts`): Persistent settings management with automatic localStorage sync
  - Handles scan options, resolution strategy, and path preferences
  - Uses Zustand persist middleware for automatic persistence
  - Performance-optimized with selective state updates
- **React State**: Used for UI-specific state (duplicates list, scanning status, selections)

### Key Components
- `RekordboxParser`: Handles XML parsing and track data extraction from Rekordbox library files
  - **Complete Metadata Preservation**: Extended Track interface with all required Rekordbox fields
  - **Format Compliance**: Follows official Rekordbox XML specification (see `assets/rekordbox_xml_format_list.pdf`)
  - **Beatgrid Support**: Full TEMPO element preservation with Metro/Battito attributes
- `DuplicateDetector`: Implements duplicate track detection algorithms
- `DuplicateDetector.tsx`: Main UI component for managing duplicate resolution with shared PopoverButton components
- `TrackRelocator.tsx`: Core relocation functionality with enhanced UX and shared UI components
  - **Sequential Auto-Relocation**: Rebuilt to use same logic as manual relocation for 100% consistency
  - **Progress Tracking**: Real-time updates with track names, confidence scores, and operation status
  - **Cancellation Support**: Immediate cancellation with proper cleanup of active operations
- `useDuplicates`: Custom hook managing duplicate detection state and operations
- `useTrackRelocator`: State management for track relocation operations
- `SettingsPanel`: Configuration UI with Zustand store integration
- **Rekordbox database** (`src/main/rekordboxDbLocator.ts`, `rekordboxDbParser.ts`,
  `rekordboxDbIpc.ts`, `rekordboxDbWriter.ts`, `rekordboxDbRelocator.ts`): reads an encrypted
  `master.db` into the same `LibraryData` the XML parser produces, and writes changes back
  into it. Reading is done on a copy taken with its `-wal` and opened `readonly`, so rekordbox
  can stay open while you look. Writing — resolving duplicates, relocating tracks, removing
  entries that point at nothing — edits the real file and is guarded three ways: rekordbox
  must be closed, a backup is mandatory (the write is refused without one), and every id is
  re-checked against the database before anything goes, so an entry whose file is actually
  there survives a stale list. This exists because a rekordbox XML import can add and update
  tracks but never remove one, so an XML round-trip can never clean a collection.

  Three facts the code depends on, each verified against a real database:
  the driver defaults to chacha20 so `PRAGMA cipher='sqlcipher'` and `legacy=4` must precede
  the key; BPM is stored times 100; ordinary cues store `OutMsec = -1`, so only a positive
  value marks a loop. `master.db` lives in the unversioned `Pioneer/rekordbox` directory on
  Rekordbox 7. The SQLCipher key is never hardcoded; the user pastes it on the load screen and
  it persists in the settings store.
- **Verified backups** (`src/main/backupDatabase.ts`): every database write copies the file aside
  with its `-wal` and then checks the copy against the source size before opening the database for
  writing. A truncated backup — a full disk, a drive that disconnected mid-copy — is worse than no
  backup, because it invites the user to trust it and only fails when it is needed.
- **The database key** (`src/renderer/utils/keyExtractionCommand.ts`): never hardcoded, never
  shipped. The load screen shows the one-line command for the host platform that prints the key
  locally via the open-source pyrekordbox package, and a pasted key is checked for shape (64 hex
  characters) before it is used.
- **Write guard** (`src/main/librarySource.ts`): every *XML* write path refuses a `.db` path.
  The XML writer writes to `libraryPath`, so a database-backed library would otherwise have
  been overwritten with XML and destroyed. Database-backed libraries go through the
  database-native writers instead.
- **Streaming tracks** (`isStreamingLocation` in `src/main/brokenEntries.ts`): rekordbox gives
  a TIDAL or Spotify track a made-up location like `tidal:tracks:123`. They have no file by
  design, so they are never missing, never broken and never removable. Counting them as
  missing made the app's missing list disagree with rekordbox's.
- **Path comparison** (`src/renderer/utils/normalizePath.ts`): macOS stores accents composed
  or decomposed and treats both as one file, and rekordbox libraries contain both spellings.
  Any path comparison — duplicate classification and the delete guard — normalises to NFC
  first, or one file reads as two and the kept track's file can be trashed.
- **Duplicate kinds** (`src/renderer/utils/classifyDuplicateSet.ts`): distinguishes several
  entries pointing at one file from genuinely duplicated files, which decides whether
  resolving can free disk space.
- **Activity history** (`src/renderer/db/duplicationHistoryDb.ts`): its own Dexie database,
  separate from the relocation history, recording one entry per library-changing operation
  with per-item detail. Surfaced by the History tab.
- `MiniPlayer` / `PlayButton`: In-app track preview (play/pause/seek/volume) via a single
  `<audio>` element + media-chrome transport UI. Audio streams over the custom `media://`
  protocol (`src/main/mediaProtocol.ts`); AIFF is rewrapped to WAV in the renderer
  (`src/renderer/audio/aiffToWav.ts`). Player state in `src/renderer/stores/playerStore.ts`
  (volume persisted, key `rekordbox-player`); element commands via
  `src/renderer/audio/audioController.ts`.
- **Shared UI Components**: Reusable PopoverButton, ConfidenceBadge, and other UI elements
- **Utility Functions**: Centralized formatters for file size, duration, dates, and other data
- **Custom Hooks**: File operations and other reusable business logic
- Path aliases configured: `@/`, `@renderer/`, `@main/`, `@shared/`

### Recent Enhancements

#### v0.0.4 (2025-08-28): Critical XML & Auto-Relocation Fixes
- **XML Generation Fix**: Complete overhaul of Rekordbox XML generation to ensure proper imports
  - **All Required Attributes**: Now includes `Composer`, `Grouping`, `Kind`, `DiscNumber`, `TrackNumber`, `Year`, `DateAdded`, `SampleRate`, `Remixer`, `Label`, `Mix`
  - **Proper URL Encoding**: Fixed Location field format from `file://localhost%2F...` to `file://localhost/...`
  - **Complete TEMPO Preservation**: All beatgrid data maintained including `Metro` and `Battito` attributes
  - **Extended Track Interface**: Full metadata preservation with new fields for all Rekordbox requirements
- **Auto-Relocation Rebuild**: Complete rewrite using sequential processing instead of worker threads
  - **Identical Logic**: Auto-relocation now calls exact same `findRelocationCandidates()` function as manual relocation
  - **Real-time Progress**: Live progress tracking with track names, confidence scores, and detailed logging
  - **Proper Cancellation**: Immediate cancellation support with cleanup of active operations
  - **Settings Synchronization**: Fixed settings alignment between main and renderer processes
  - **Performance**: Removed worker pool complexity in favor of reliable sequential processing

#### v0.0.2 (2025-08-26): Track Relocation Caching
- **Persistent Storage**: Implemented Dexie.js (IndexedDB) for caching track relocation results
  - **Smart Cache Loading**: Missing tracks, relocation candidates, and search results persist across sessions
  - **Performance Enhancement**: Instant loading of previously computed relocation candidates
  - **Multi-Session Support**: Results automatically restore when reopening libraries
  - **Database Integration**: Separate databases for relocation, cloud sync, and ownership results
- **Enhanced User Experience**: Cache-aware notifications and seamless background saves
- **Cross-Platform Builds**: Automated releases for Mac (DMG), Windows (NSIS), and Linux (AppImage/deb)
- **Technical Improvements**: Map serialization, TypeScript interfaces, and modular database design

#### v0.0.1 (2025-01-26): Foundation & Architecture
- **Code Architecture Refactor**: Major refactoring following React best practices
  - **DRY Implementation**: Eliminated duplicate PopoverButton code (saved ~184 lines)
  - **Modular Structure**: Clean ES module organization with barrel exports
  - **Separation of Concerns**: Clear boundaries between UI, utilities, and business logic
  - **Shared Components**: Reusable PopoverButton, ConfidenceBadge, formatting utilities
  - **Type Safety**: Proper TypeScript interfaces for all shared components
- **Track Relocation Feature**: Complete implementation of core relocation workflow
  - Reset track locations and auto-relocate functionality
  - Smart file matching with confidence scoring
  - Streamlined UI focused on primary use cases
  - Visual folder browser for search path selection
- **Enhanced UX**: Portal-based popovers with detailed button descriptions
- **Logo Integration**: Replaced generic icons with actual application logo throughout UI
- **Improved Navigation**: Reordered tabs for optimal workflow (Duplicates → Relocate → Import → Maintenance)
- **Responsive Design**: Enhanced mobile and smaller screen compatibility
  - Flexible button layouts that stack vertically on smaller screens
  - Improved touch targets and spacing for mobile interaction
  - Consistent button behavior across different screen sizes

## Development Commands

### Core Development
```bash
npm run dev          # Start both Vite dev server and Electron app
npm run dev:vite     # Start Vite dev server only (port 3000)
npm run dev:electron # Build main process and start Electron
```

### Building
```bash
npm run build        # Build both renderer and main process
npm run build:vite   # Build renderer process only
npm run build:main   # Compile main process TypeScript
npm run dist         # Create distributable package
```

### Testing
```bash
npm test               # Run all tests (unit + e2e)
npm run test:unit      # Run unit tests with vitest
npm run test:unit:ui   # Run unit tests with web UI  
npm run test:unit:watch # Run unit tests in watch mode
npm run test:e2e       # Run e2e tests with playwright
npm run test:e2e:ui    # Run e2e tests with UI
```

Test framework uses:
- **Vitest**: Unit testing with jsdom environment 
- **Playwright**: End-to-end testing
- **@testing-library/react**: React component testing utilities
- **@testing-library/jest-dom**: Jest-dom matchers for assertions 

## Technical Stack

- **Electron 32**: Desktop app framework
- **React 18**: UI framework with TypeScript
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **Dexie.js**: IndexedDB wrapper for all client-side storage and caching
- **xml2js**: XML parsing
- **music-metadata**: Audio file metadata extraction
- **Zustand**: State management with persist middleware for localStorage sync
- **Radix UI**: Professional UI components (Popover for playlist display) 

## Key File Locations

- Main entry: `dist/main/main.js`
- Renderer entry: `src/renderer/main.tsx`
- Electron preload: `src/main/preload.ts`
- Main window config: `src/main/main.ts:11-36`
- TypeScript configs: `tsconfig.json`, `tsconfig.main.json`, `tsconfig.node.json`
- Database schemas: `src/renderer/db/duplicatesDb.ts`, `src/renderer/db/relocationsDb.ts`

## IPC Communication

The app uses Electron's IPC for communication between main and renderer processes. The handlers live in
`src/main/ipc/` by domain; `src/main/preload.ts` is the full list of what the renderer can call. Key APIs
exposed through `window.electronAPI`:
- `selectRekordboxXML()`: File picker for XML files
- `parseRekordboxLibrary(xmlPath)`: Parse Rekordbox XML with complete metadata preservation
- `findDuplicates(options)`: Detect duplicate tracks
- `resolveDuplicates(resolution)`: Apply duplicate resolution
- `saveRekordboxXML(data)`: Export modified library with full Rekordbox compatibility
- `saveDuplicateResults(data)`: Store duplicate results
- `getDuplicateResults()`: Retrieve stored duplicate results  
- `deleteDuplicateResults()`: Clear duplicate results cache
- `autoRelocateTracks(tracks, options, libraryPath)`: Sequential auto-relocation with progress tracking
- `cancelAutoRelocate(operationId)`: Cancel active auto-relocation operation
- `showFileInFolder(path)`: Open file location in system file manager; reports back when the file is gone
- `mergeDuplicatesInDb(data)` / `relocateTracksInDb` (via `batchRelocateTracks`/`autoRelocateTracks` with
  `dbKey`) / `removeEntriesInDb(data)`: the database-native writes, each requiring rekordbox to be closed
  and taking a backup first

## State Management Architecture

### Settings Persistence
- Settings (scan options, resolution strategy, path preferences) are managed by Zustand store
- Automatic persistence via Zustand persist middleware to localStorage key `rekordbox-settings`
- Store located at `src/renderer/stores/settingsStore.ts`

### Caching Architecture
- **IndexedDB Storage**: Dexie.js provides robust client-side caching for track relocation results
- **Database Separation**: Dedicated databases for duplicates (`RekordboxDuplicatesDB`) and relocations (`RekordboxRelocationsDB`)
- **Smart Loading**: Cached results automatically restore when reopening libraries
- **Map Serialization**: Custom handling for JavaScript Map objects in database storage
- **Storage Helpers**: Dedicated storage modules (`relocationStorage`, `cloudSyncStorage`, `ownershipStorage`)

### Performance Considerations
- UI-critical state (duplicates, scanning status) remains in React state for optimal performance
- Settings changes are handled by Zustand for immediate updates without lag
- Relocation candidates cached per track ID to avoid redundant searches
- Background saves with error handling and fallback to normal operation
- All data persistence uses IndexedDB through Dexie.js (no external database dependencies)

### Store Usage Pattern
```typescript
// Zustand store (settings)
const scanOptions = useSettingsStore((state) => state.scanOptions);
const setScanOptions = useSettingsStore((state) => state.setScanOptions);

// Dexie cache (results)
const cachedResult = await relocationStorage.getRelocationResult(libraryPath);
await relocationStorage.saveRelocationResult(resultData);
```

## UI/UX Features

### Search and Filtering
- **Debounced Search**: 300ms debounce prevents lag during typing
- **Multi-field Search**: Searches across track title, artist, album, and file path
- **Case Insensitive**: All search operations are case-insensitive
- **Real-time Filtering**: Results update automatically after debounce period
- **Loading States**: Visual feedback during search operations

### Layout and Positioning  
- **Native App Style**: Header uses static positioning (not fixed) to prevent overlap
- **Scrollable Lists**: Proper flexbox implementation with `min-h-0` and `overflow-y-auto`
- **Compact Library Info**: Minimal space usage with ellipsis for long paths
- **Fixed Footer**: Status bar positioned at bottom with library stats

### Interactive Elements
- **Radix UI Popover**: Professional playlist display with click-to-expand
- **Loading Animations**: Spinner states for all async operations  
- **Debounced Loading**: Visual feedback during heavy operations
- **Hover States**: Consistent interactive feedback

## Code Organization

### Modular Architecture (Following React Best Practices)
```
src/renderer/
├── components/
│   ├── ui/                        # Reusable UI components
│   │   ├── PopoverButton.tsx      # Shared tooltip button component
│   │   ├── EmptyLibraryState.tsx  # The home screen: database first, XML below
│   │   └── index.ts               # Barrel exports
│   ├── DuplicateDetector.tsx      # The page: state, results, modals
│   ├── DuplicateToolbar.tsx       # Its toolbar — scan, search, filter, resolve
│   └── TrackRelocator.tsx
├── hooks/                         # Custom business logic hooks
│   ├── useDuplicates.ts           # Duplicate detection state
│   ├── useDuplicateResolution.ts  # The three resolve flows (XML, database, trash)
│   ├── useTrackRelocator.ts       # Relocation state
│   └── index.ts                   # Barrel exports
├── relocation/                    # What a relocation run means, apart from React
│   └── relocationOutcome.ts       # History, library update, wording — shared by
│                                  # manual and automatic relocation
├── scan/                          # The duplicate scan, outside the page
│   └── duplicateScanSession.ts    # Survives a tab switch; the page subscribes
├── utils/                         # Pure utility functions
│   ├── keyExtractionCommand.ts    # The per-platform command that prints the key
│   ├── classifyDuplicateSet.ts    # Entries-for-one-file vs duplicated files
│   └── index.ts                   # Barrel exports
└── stores/                        # State management
    └── settingsStore.ts           # Zustand store with persistence
```

Anything worth testing belongs outside a component: a pure module in `utils/`, `relocation/` or
`scan/` can be tested without rendering, which is why those exist. A file growing past ~500 lines
is the signal that something in it wants to move out.

### Component Patterns
- **Feature Components**: Compose UI components with business logic hooks
- **UI Components**: Pure presentation with minimal logic, TypeScript interfaces
- **Utilities**: Pure functions with no side effects, easily testable
- **Hooks**: Encapsulate stateful logic and side effects with clear interfaces

## Development Notes

- Development mode loads from `http://localhost:3000` - ensure Electron listens on same port as Vite
- Production builds load from `dist/renderer/index.html`
- TE theme with Tailwind CSS and orange accent (`te-orange`)
- Uses strict TypeScript configuration
- Path resolution configured for clean imports
- Settings persist automatically across sessions via Zustand store
- Avoid `position: fixed` on headers - use native app-style static positioning
- Follow DRY, KISS, and SoC principles for all new code
- Use barrel exports for clean import paths

## Release Template

Always use this format for GitHub releases:

--start template

## ✨ Features
- [ ] Feature 1
- [ ] Feature 2

## 🐛 Fixes
- [ ] Fix 1
- [ ] Fix 2

## ⚠️ Known Issues
- [ ] Issue 1
- [ ] Issue 2

---

## macOS – Which file to download

| Your Mac | File to download |
|----------|-----------------|
| Apple Silicon (M1/M2/M3/M4) | `...-arm64.dmg` |
| Intel (2019 and earlier) | `....dmg` (no arch suffix) |

**Not sure which chip you have?** Click the Apple menu → About Thisf Mac. It will say “Apple M1” (or M2/M3/M4) or “Intel Core”.

---

## macOS – Opening an unsigned app

Since this app is not signed with an Apple Developer certificate, macOS may warn you. To open it:

**Option 1 – Remove quarantine via Terminal (most reliable):**
```bash
xattr -dr com.apple.quarantine /Applications/Rekordbox\ Library\ Fixer.app
```

**Option 2 – Right-click to open:**
1. Right-click the app → **Open**
2. Click **Open** in the warning dialog
3. macOS will remember the app as safe from now on

If you see “this app is not supported on this Mac” rather than a security warning, you’ve downloaded the wrong architecture — grab the other DMG.

---
*Built with ❤️ for DJs*


--end template

## Rekordbox XML Format Compliance

- **Official Specification**: All XML format rules in `@assets/rekordbox_xml_format_list.pdf`
- **Required Attributes**: All mandatory Rekordbox fields must be preserved during processing
- **TEMPO Elements**: Complete beatgrid data with Metro/Battito attributes for DJ functionality
- **URL Format**: Location fields must use `file://localhost/path` format (no double encoding)
- **Playlist Structure**: Maintain NODE hierarchy with proper KeyType and Entries attributes
- **Track Metadata**: Preserve all cues, loops, hotcues, and DJ performance data

## Critical Implementation Details

- **Auto-Relocation**: Uses identical logic to manual relocation via `trackRelocator.findRelocationCandidates()`
- **XML Generation**: Extended Track interface includes all required Rekordbox metadata fields
- **Settings Sync**: Zustand store automatically syncs between UI and processing operations
- **Progress Tracking**: Real-time updates with cancellation support for long-running operations
- **Error Handling**: Comprehensive logging and graceful fallbacks for all critical operations
- look up how to resize images for github markdown files
- Repository: [koraysels/rekordbox-library-fixer](https://github.com/koraysels/rekordbox-library-fixer)
