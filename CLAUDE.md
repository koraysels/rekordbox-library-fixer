# CLAUDE.md

This file contains essential project information
Detailed documentation can be found in referenced files
Update both this file and referenced files when making changes

## Project Overview

This is an Electron-based desktop application for managing Rekordbox DJ library files. The app provides duplicate detection, library import/export, and maintenance functionality for Rekordbox XML databases.

> ! The processes this software offers, retains all essential DJ metadata, including cues, loops, beatgrids, and playlists.

## Architecture

### Core Structure
- **Main Process** (`src/main/`): Electron main process handling file system operations, XML parsing, and IPC
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
- `DuplicateDetector`: Implements duplicate track detection algorithms
- `DuplicateDetector.tsx`: Main UI component for managing duplicate resolution with shared PopoverButton components
- `TrackRelocator.tsx`: Core relocation functionality with enhanced UX and shared UI components
- `useDuplicates`: Custom hook managing duplicate detection state and operations
- `useTrackRelocator`: State management for track relocation operations
- `SettingsPanel`: Configuration UI with Zustand store integration
- **Shared UI Components**: Reusable PopoverButton, ConfidenceBadge, and other UI elements
- **Utility Functions**: Centralized formatters for file size, duration, dates, and other data
- **Custom Hooks**: File operations and other reusable business logic
- Path aliases configured: `@/`, `@renderer/`, `@main/`, `@shared/`

### Recent Enhancements

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

The app uses Electron's IPC for communication between main and renderer processes. Key APIs exposed through `window.electronAPI`:
- `selectRekordboxXML()`: File picker for XML files
- `parseRekordboxLibrary(xmlPath)`: Parse Rekordbox XML
- `findDuplicates(options)`: Detect duplicate tracks
- `resolveDuplicates(resolution)`: Apply duplicate resolution
- `saveRekordboxXML(data)`: Export modified library
- `saveDuplicateResults(data)`: Store duplicate results
- `getDuplicateResults()`: Retrieve stored duplicate results  
- `deleteDuplicateResults()`: Clear duplicate results cache
- `showFileInFolder(path)`: Open file location in system file manager

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
│   ├── ui/                     # Reusable UI components
│   │   ├── PopoverButton.tsx   # Shared tooltip button component
│   │   ├── ConfidenceBadge.tsx # Confidence level indicator
│   │   └── index.ts           # Barrel exports
│   ├── DuplicateDetector.tsx   # Feature components using shared UI
│   └── TrackRelocator.tsx     
├── hooks/                      # Custom business logic hooks
│   ├── useFileOperations.ts   # File system operations
│   ├── useDuplicates.ts       # Duplicate detection logic
│   └── index.ts              # Barrel exports
├── utils/                     # Pure utility functions
│   ├── formatters.ts          # Data formatting (fileSize, duration, etc.)
│   └── index.ts              # Barrel exports
└── stores/                    # State management
    └── settingsStore.ts       # Zustand store with persistence
```

### Component Patterns
- **Feature Components**: Compose UI components with business logic hooks
- **UI Components**: Pure presentation with minimal logic, TypeScript interfaces
- **Utilities**: Pure functions with no side effects, easily testable
- **Hooks**: Encapsulate stateful logic and side effects with clear interfaces

## Development Notes

- Development mode loads from `http://localhost:3000` - ensure Electron listens on same port as Vite
- Production builds load from `dist/renderer/index.html`
- Dark theme with Tailwind CSS and purple accent (`rekordbox-purple`)
- Uses strict TypeScript configuration
- Path resolution configured for clean imports
- Settings persist automatically across sessions via Zustand store
- Avoid `position: fixed` on headers - use native app-style static positioning
- Follow DRY, KISS, and SoC principles for all new code
- Use barrel exports for clean import paths
