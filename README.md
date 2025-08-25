# Rekordbox Library Manager

A desktop application for managing Rekordbox DJ library files with advanced duplicate detection, library import/export, and maintenance functionality.

## Features

- **Duplicate Detection**: Advanced algorithms using audio fingerprinting and metadata matching
- **Library Import/Export**: Parse and save Rekordbox XML library files
- **Quality-based Resolution**: Automatic duplicate resolution based on audio quality, file age, or custom preferences
- **Comprehensive Logging**: Track all operations with detailed logs for auditing and troubleshooting
- **Cross-platform**: Built with Electron for Windows, macOS, and Linux

## Screenshots

[Add screenshots here when available]

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/koraysels/rekordbox-library-fixer.git
cd rekordbox-library-manager

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

### Development
```bash
# Start both Vite dev server and Electron app
npm run dev

# Start Vite dev server only (port 3000)
npm run dev:vite

# Build main process and start Electron
npm run dev:electron
```

### Building
```bash
# Build both renderer and main process
npm run build

# Build renderer process only
npm run build:vite

# Compile main process TypeScript
npm run build:main

# Create distributable package
npm run dist
```

## Architecture

### Core Structure
- **Main Process** (`src/main/`): Electron main process handling file system operations, XML parsing, and IPC
- **Renderer Process** (`src/renderer/`): React-based UI with TypeScript
- **Shared Types** (`src/shared/`): Common interfaces and utilities

### Key Components
- `RekordboxParser`: Handles XML parsing and track data extraction from Rekordbox library files
- `DuplicateDetector`: Implements duplicate track detection algorithms using fingerprinting and metadata
- `Logger`: Comprehensive logging system for tracking operations and debugging
- `DuplicateDetector.tsx`: Main UI component for managing duplicate resolution

## Technology Stack

- **Electron 32**: Desktop app framework
- **React 18**: UI framework with TypeScript
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling framework
- **better-sqlite3**: SQLite database operations
- **xml2js**: XML parsing for Rekordbox files
- **music-metadata**: Audio file metadata extraction

## Duplicate Detection

The app provides two methods for detecting duplicates:

### Audio Fingerprinting
- Analyzes audio content using duration, bitrate, file size, and content hash
- Provides 100% confidence matching for identical audio files
- Works even when metadata differs

### Metadata Matching  
- Compares track metadata fields (artist, title, album, BPM, key, duration)
- Configurable field selection
- Confidence scoring based on field matches

### Resolution Strategies
- **Keep Highest Quality**: Selects tracks with best audio quality and metadata
- **Keep Newest**: Keeps most recently modified files
- **Keep Oldest**: Keeps files that were added to library first
- **Keep Preferred Path**: Priority based on file location preferences
- **Manual Selection**: User chooses which track to keep from each duplicate set

## Logging

The application maintains detailed logs of all operations:

- **Duplicate Detection**: Track counts, options used, duplicate sets found
- **Duplicate Resolution**: Strategy used, tracks kept/removed, detailed resolution info
- **Library Operations**: Parsing and saving operations with track/playlist counts
- **Error Tracking**: Failed operations with full context and error details

Logs are stored in the application's user data directory under `/logs/` with daily rotation.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add TypeScript types for all new interfaces
- Test thoroughly with sample Rekordbox XML files
- Update documentation for new features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/koraysels/rekordbox-library-fixer/issues)
- **Documentation**: See [CLAUDE.md](CLAUDE.md) for technical details

## Roadmap

- [ ] Add automated testing framework
- [ ] Implement playlist duplicate detection
- [ ] Add batch processing for multiple library files
- [ ] Create plugin system for custom duplicate detection algorithms
- [ ] Add library merge functionality
- [ ] Implement backup and restore features

## Acknowledgments

- Pioneer DJ for the Rekordbox software and XML format
- The open-source community for the excellent libraries used in this project