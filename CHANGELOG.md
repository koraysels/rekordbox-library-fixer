# Changelog

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
