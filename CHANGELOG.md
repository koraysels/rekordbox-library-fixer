# Changelog

## [0.5.0] - 2026-08-21

### 🎉 New Features
- **Read the rekordbox database directly**: Load a library from rekordbox's own encrypted `master.db`, no XML export needed. Opened strictly read-only from a copy (including its WAL), so rekordbox can stay open and the database is never written to. Needs the SQLCipher key, pasted once in Settings; the key is not shipped with the app.
- **Duplicate files vs duplicate entries**: Every duplicate set now states the real numbers, for example `4 entries · 2 files`, and each entry says whether it is an extra listing of the kept file or a separate copy that the trash option can remove. A filter narrows the list to one kind, and Select All follows it.
- **In-app help**: A "How duplicate resolving works" section explains entries versus files, what merging does to playlists, and what each label means.

### 🐛 Bug Fixes
- **Never write over master.db**: Loading from the database set the library path to `master.db`, while resolve and relocate write XML to that path — which would have destroyed the database. Every write path now refuses a `.db` path, and a banner marks a database-backed library as read-only.
- **Unicode paths compared correctly**: macOS stores accents composed (ö) or decomposed (o + combining diaeresis) and treats both as one file; rekordbox libraries contain both spellings. Paths are now normalised before comparison. Previously a single file looked like two, and the delete guard could have trashed the file the kept entry still points at.
- **Resolution strategy is remembered**: Picking a strategy went through the same debounce as typed fields, and the unmount cleanup discarded a pending write. It is now stored immediately. React Hook Form's own blur handler is no longer overwritten.
- **Wording**: Entries are described as merged into the kept track, not "removed from XML"; files are described as moved to the trash, which is what happens.

## [0.4.0] - 2026-08-21

### 🎉 New Features
- **History tab**: An audit trail of every library-changing operation, with per-item detail (which entries were merged, which files went to the trash, what failed) and the backup path.

### 🐛 Bug Fixes
- **Faster tab navigation**: Every tab switch re-ran both cached queries, flashing a skeleton and re-reading the whole duplicate cache even for tabs that never use it.

## [0.3.0] - 2026-08-21

### 🎉 New Features
- **Cancellable, streaming duplicate scan**: Progress with a track counter, results appearing as they are found, and a cancel that keeps what it found.

## [0.2.3] - 2026-08-21

### 🐛 Bug Fixes
- **Critical: stopped deleting files that were being kept**: Several rekordbox entries can point at one file. Resolving such a set deleted the losers' paths, which are the kept track's path, destroying the audio the user chose to keep. A path is now only trashed when no remaining track references it.
- **Files go to the trash**, not straight to permanent deletion.

## [0.2.2] - 2026-08-21

### 🐛 Bug Fixes
- **Playlists stay complete**: Resolving a duplicate filtered the removed entry out of every playlist, so a playlist holding only that copy silently lost the song. References are now re-pointed at the kept track.

## [0.2.0] - 2026-08-21

### 🎉 New Features
- **In-app track preview**: Play, pause, seek and volume from any track row, including AIFF (rewrapped to WAV, which Chromium cannot play natively).

### 🐛 Bug Fixes
- **Relocator handles large libraries**: The search re-scanned the whole tree for every track, so thousands of missing tracks pinned the app until it was killed. The file index is now built once per run.

## [0.0.5-alpha] - 2025-08-29

### 🎉 New Features
- **XML Export & Import Tutorial**: Interactive step-by-step tutorial with screenshots
- **Help System**: Tutorial accessible from menu and sidebar for easy discovery
- **Ko-fi Support**: Added donation link in About modal for project support
- **Enhanced Security**: URL validation for external links (HTTPS/HTTP/mailto only)

### 🎨 Theme & Design Overhaul
- **Completely new Theme**: Full implementation of a new light theme inspired by the TE PO-133 II sampler
- **Application Rebrand**: Renamed from "Rekordbox Library Manager" to "Rekordbox Library Fixer"
- **Color Harmony**: Applied UI design principles with proper contrast ratios
- **Typography Enhancement**: Consistent TE fonts with optimized letter spacing
- **Visual Polish**: Harmonious color schemes throughout all components

### 🐛 Bug Fixes
- **Notification Backgrounds**: Fixed missing toast notification backgrounds
- **Color Class Issues**: Resolved incorrect Tailwind color class usage
- **Theme Inconsistencies**: Eliminated dark theme remnants across components
- **Build Errors**: Fixed Tailwind config syntax issues

### 🔧 Technical Improvements
- **TypeScript Declarations**: Comprehensive electron API type definitions
- **Git Cleanup**: Removed development artifacts from version control
- **Code Quality**: Applied DRY principles and modern React patterns
- **Build System**: Verified cross-platform compatibility

---

## [0.0.3-alpha] - 2025-01-27

### 🎉 New Features
- **Track Unlocatable Status**: Tracks that fail auto-relocation are now marked as "unlocatable" instead of disappearing
- **Retry Failed Relocations**: Clear unlocatable status to retry auto-relocation on previously failed tracks
- **Enhanced Settings Sync**: Bidirectional synchronization between settings panel and main interface

### 🎨 Improvements
- **Visual Indicators**: Orange badges and warning icons for unlocatable tracks
- **Better Notifications**: Detailed auto-relocation results showing success, failure, and unlocatable counts
- **Improved Path Search UI**: Enhanced settings panel for configuring track search paths
- **Drag & Drop Support**: Added drag and drop functionality for better file handling
- **Smarter Status Updates**: More informative status messages during relocation operations

### 🐛 Bug Fixes
- Fixed track relocation state persistence across sessions
- Improved error handling for failed relocations
- Better memory management during large library scans

### 🔧 Technical
- Updated to latest TanStack Router for improved performance
- Enhanced TypeScript type safety across relocation features
- Optimized database queries for faster track searching

---

## [0.0.2-alpha] - 2025-01-26

### 🎉 New Features
- **Persistent Storage**: Track relocation results now persist across sessions using IndexedDB
- **Smart Cache Loading**: Missing tracks and relocation candidates automatically restore
- **Cross-Platform Builds**: Automated releases for Mac (DMG), Windows (NSIS), and Linux (AppImage/deb)

### 🎨 Improvements
- Enhanced user experience with cache-aware notifications
- Seamless background saves for relocation results
- Multi-session support for different libraries

---

## [0.0.1-alpha] - 2025-01-25

### 🎉 Initial Release
- **Duplicate Detection**: Find duplicate tracks using audio fingerprinting and metadata matching
- **Track Relocation**: Automatically find and relocate missing tracks
- **Library Import/Export**: Full Rekordbox XML support
- **Confidence Scoring**: Smart matching with confidence indicators
- **Bulk Operations**: Process entire library at once
- **Beautiful UI**: Modern, responsive interface with dark theme
