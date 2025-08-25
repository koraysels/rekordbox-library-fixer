# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron-based desktop application for managing Rekordbox DJ library files. The app provides duplicate detection, library import/export, and maintenance functionality for Rekordbox XML databases.

## Architecture

### Core Structure
- **Main Process** (`src/main/`): Electron main process handling file system operations, XML parsing, and IPC
- **Renderer Process** (`src/renderer/`): React-based UI with TypeScript
- **Shared Types** (`src/shared/`): Common interfaces and utilities

### Key Components
- `RekordboxParser`: Handles XML parsing and track data extraction from Rekordbox library files
- `DuplicateDetector`: Implements duplicate track detection algorithms
- `DuplicateDetector.tsx`: Main UI component for managing duplicate resolution
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
No test framework is currently configured. Tests must be added manually.

## Technical Stack

- **Electron 32**: Desktop app framework
- **React 18**: UI framework with TypeScript
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **better-sqlite3**: SQLite database operations
- **xml2js**: XML parsing
- **music-metadata**: Audio file metadata extraction

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

## Development Notes

- Development mode loads from `http://localhost:3000`
- Production builds load from `dist/renderer/index.html`
- Dark theme with Tailwind CSS
- Uses strict TypeScript configuration
- Path resolution configured for clean imports