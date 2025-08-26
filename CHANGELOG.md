# Changelog

All notable changes to this project will be documented in this file.

## [0.0.2-alpha] - 2025-08-26

### 🚀 New Features

#### Track Relocation Results Caching
- **Persistent Storage**: Track relocation results are now cached using Dexie.js (IndexedDB)
- **Smart Cache Loading**: Previously scanned missing tracks, relocation candidates, and search results are automatically restored when reopening a library
- **Performance Enhancement**: Relocation candidates are cached per track to avoid redundant searches
- **Multi-Session Support**: Results persist across app sessions for improved workflow continuity
- **Database Integration**: Separate databases for relocation results, cloud sync results, and ownership results

#### Enhanced User Experience
- **Instant Results**: Cached relocation candidates load immediately with "info" notification
- **Background Saves**: All results are automatically saved to cache without user intervention
- **Cache Management**: Integrated cache clearing when results are manually cleared
- **Error Handling**: Robust error handling for cache operations with fallback to normal operation

### 🔧 Technical Improvements
- **Dexie.js Integration**: Added professional IndexedDB wrapper with TypeScript support
- **Map Serialization**: Custom serialization handling for JavaScript Map objects in database storage
- **Modular Database Design**: Separate storage modules for different result types (relocations, cloud sync, ownership)
- **Type Safety**: Full TypeScript interfaces for all cached data structures
- **Memory Management**: Efficient state management with React hooks for cache data

### 🛠️ Developer Experience
- **Build System**: Updated electron-builder configuration for cross-platform releases
- **Package Management**: Added proper author email for Linux package building
- **Linux Support**: Enhanced Linux category mapping (AudioVideo) for better app store integration
- **Cross-Platform Builds**: Automated builds for Mac (DMG), Windows (NSIS installer), and Linux (AppImage, deb)

### 📦 Build Artifacts
- **macOS**: Universal DMG and ZIP files for Intel (x64) and Apple Silicon (arm64)
- **Windows**: NSIS installer and ZIP archives for both x64 and x32 architectures  
- **Linux**: AppImage (portable) and deb package for ARM64 architecture

### 🔄 Compatibility
- Maintains backward compatibility with existing library files
- No breaking changes to existing duplicate detection workflows
- Cache data is library-specific and isolated per project

### 🐛 Bug Fixes
- Fixed package.json syntax error that was preventing test execution
- Resolved DMG build configuration issues for macOS releases
- Corrected Linux build requirements for deb package generation

---

## [0.0.1] - 2025-01-26

### Initial Release
- Electron-based desktop application for Rekordbox library management
- Duplicate track detection with confidence scoring
- XML library import/export functionality  
- Track relocation and path management
- React-based UI with TypeScript
- Zustand state management with localStorage persistence
- Cross-platform support (macOS, Windows, Linux)