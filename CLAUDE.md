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
- `DuplicateDetector.tsx`: Main UI component for managing duplicate resolution
- `useDuplicates`: Custom hook managing duplicate detection state and operations
- `SettingsPanel`: Configuration UI with Zustand store integration
- Path aliases configured: `@/`, `@renderer/`, `@main/`, `@shared/`

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
- **better-sqlite3**: SQLite database operations
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

### Performance Considerations
- UI-critical state (duplicates, scanning status) remains in React state for optimal performance
- Settings changes are handled by Zustand for immediate updates without lag
- Debounced saves for duplicate results to SQLite database (1-second debounce)

### Store Usage Pattern
```typescript
// In components
const scanOptions = useSettingsStore((state) => state.scanOptions);
const setScanOptions = useSettingsStore((state) => state.setScanOptions);
const addPathPreference = useSettingsStore((state) => state.addPathPreference);
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

## Development Notes

- Development mode loads from `http://localhost:3000` - ensure Electron listens on same port as Vite
- Production builds load from `dist/renderer/index.html`
- Dark theme with Tailwind CSS and purple accent (`rekordbox-purple`)
- Uses strict TypeScript configuration
- Path resolution configured for clean imports
- Settings persist automatically across sessions via Zustand store
- Avoid `position: fixed` on headers - use native app-style static positioning
