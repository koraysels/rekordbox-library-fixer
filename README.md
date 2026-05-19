# Rekordbox Library Fixer

<div align="center">

<img src="assets/icons/256x256.png" alt="Rekordbox Library Fixer" width="128" height="128" style="border-radius: 20px; background-color: white; padding: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />

![Rekordbox Library Fixer](https://img.shields.io/badge/DJ%20Tool-Rekordbox-FF6B35?style=for-the-badge&logo=music&logoColor=white)
![Version](https://img.shields.io/badge/version-0.0.5--alpha-brightgreen?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-Non--Commercial-orange?style=for-the-badge)

**Just trying to make DJs' lives a bit easier, one library at a time**

*Find duplicates, fix missing tracks, and keep your DJ metadata intact*

[Download Latest Release](https://github.com/koraysels/rekordbox-library-fixer/releases) • [Report Bug](https://github.com/koraysels/rekordbox-library-fixer/issues) • [Request Feature](https://github.com/koraysels/rekordbox-library-fixer/issues)

</div>

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [What It Does](#what-it-does)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
  - [Download & Install](#download--install)
  - [Using the Tool](#using-the-tool)
- [For Developers](#for-developers)
- [Contributing](#contributing)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Support](#support)
- [License](#license)

---

## Why This Exists

You're prepping for a gig and realize you have 47 versions of "One More Time" and half your tracks show as "!" because you reorganized your music folder. This tool handles those two problems: duplicate detection and track relocation.

I'm aware of commercial tools like Rekordbox Collection Tool (RCT) by MixMasterG, but it's macOS-only and closed source. This is free and cross-platform.

**The common pain points:**
- Duplicate tracks with slightly different names cluttering your library
- Missing file references ("!" tracks) after moving your music folder
- Spending more time organizing than mixing

---

## What It Does

### Duplicate Detection
- **Audio fingerprinting**: Finds identical tracks even with different filenames
- **Metadata matching**: Compares artist, title, BPM, key — configurable
- **Confidence scoring**: Shows how certain the match is
- **Flexible settings**: Adjust thresholds to suit your library

### Track Relocation
- **Smart search**: Automatically finds moved music files
- **Similarity matching**: Matches tracks even when filenames differ
- **Bulk operations**: Fix hundreds of missing tracks at once
- **Unlocatable tracking**: Marks tracks that couldn't be auto-relocated for manual review

### Resolution Options
- **Quality-based**: Keeps the highest bitrate version
- **Date-based**: Keep newest or oldest files
- **Folder preferences**: Prioritize tracks from certain directories (e.g. FLAC over MP3)
- **Manual mode**: Review everything yourself

### Session Persistence
- Picks up where you left off if you close the app
- Uses IndexedDB (no external database needed)
- Results are stored per-library

---

## Screenshots

### Main Dashboard

<img src="screenshots/01-main-interface.png" alt="Main Interface" width="600" />

### Duplicate Detection

<img src="screenshots/03-duplicate-detection.png" alt="Duplicate Detection" width="600" />

### Track Relocation

<img src="screenshots/04-track-relocation.png" alt="Track Relocation" width="600" />

### Statistics

<img src="screenshots/06-statistics.png" alt="Statistics" width="400" />

### Settings

<img src="screenshots/02-settings-library.png" alt="Settings Panel" width="400" />

---

## Quick Start

### Download & Install

#### Option 1: Pre-built App (Recommended)

1. Go to [Releases](https://github.com/koraysels/rekordbox-library-fixer/releases)
2. Download the right file for your system:

**Windows:**
- `Rekordbox.Library.Fixer.Setup.x.x.x-alpha.exe` — installer (recommended)
- `Rekordbox.Library.Fixer-x.x.x-alpha-win.zip` — portable

**macOS:**
- `Rekordbox.Library.Fixer-x.x.x-alpha-universal.dmg` — works on both Intel and Apple Silicon Macs
- `Rekordbox.Library.Fixer-x.x.x-alpha-arm64.dmg` — Apple Silicon only (M1/M2/M3/M4)
- `Rekordbox.Library.Fixer-x.x.x-alpha.dmg` — Intel only (pre-2020 Macs)

> **Not sure which Mac you have?** Click the Apple menu > About This Mac. If it says "Intel" under Processor/Chip, use the Intel DMG or the universal one. If it says "Apple M1/M2/M3", use the arm64 or universal one.

**Linux:**
- `rekordbox-library-manager-x.x.x-alpha.AppImage` — universal AppImage
- `rekordbox-library-manager_x.x.x-alpha_arm64.deb` — Debian/Ubuntu

3. Install and launch

#### macOS: Opening an Unsigned App

Since this app isn't signed with an Apple Developer certificate, macOS may warn you about it. The `xattr` command in Terminal removes the quarantine flag:

```bash
xattr -dr com.apple.quarantine /Applications/Rekordbox\ Library\ Fixer.app
```

Alternatively, right-click the app and choose **Open**, then click **Open** in the dialog that appears.

#### Option 2: Build from Source

```bash
git clone https://github.com/koraysels/rekordbox-library-fixer.git
cd rekordbox-library-fixer
npm install
npm run dev
```

---

### Using the Tool

#### Step 1: Export Your Rekordbox Library

1. Open Rekordbox
2. Go to **File → Export Collection in xml format**

   ![Export Menu](screenshots/export-collection-as-xml.png)

3. Save the XML file somewhere easy to find (e.g. Desktop)
4. Large libraries (10,000+ tracks) may take a few minutes to export

> **Tip**: Export your library regularly as a backup — the XML contains all your playlists, cue points, and track metadata.

#### Step 2: Load Your Library

**Drag & Drop:**
1. Launch Rekordbox Library Fixer
2. Drag your XML file onto the app window

<img src="screenshots/06-drag-drop-library.png" alt="Drag and Drop" width="600" />

**Browse:**
1. Launch the app
2. Click **Browse for XML File** and select your file

#### Step 3: Find Duplicates

1. Go to the **Duplicate Detection** tab
2. Configure detection settings (optional): audio fingerprinting, metadata fields, path preferences
3. Click **Scan for Duplicates**
4. Review the grouped results

#### Step 4: Resolve Duplicates

1. Review the duplicate groups
2. Select duplicates to resolve (or **Select All**)
3. Choose a resolution strategy:
   - **Keep Highest Quality** — keeps best bitrate
   - **Keep Newest** — most recently modified
   - **Keep Preferred Path** — prioritizes specific folders
   - **Manual** — review each pair yourself
4. Click **Resolve Selected** and confirm

#### Step 5: Relocate Missing Tracks (Optional)

If tracks show as "!" in Rekordbox:

1. Go to the **Track Relocator** tab
2. Add search directories where your music might be
3. Configure search depth and similarity threshold
4. Click **Scan for Missing Tracks**
5. Review candidates and apply the relocations you want

#### Step 6: Import Back to Rekordbox

**Enable XML import in Rekordbox:**

1. Open Rekordbox
2. Go to view preferences and enable **"rekordbox xml"** in the Tree View

<img src="screenshots/import-xml-step-1.jpg" alt="Enable XML Import" width="600" />

**Import the cleaned file:**

1. Navigate to the **Database** tab
2. Select your updated XML file (saved with `_cleaned` suffix by the tool)

<img src="screenshots/import-xml-step-2.jpg" alt="Import XML" width="600" />

3. Keep **BPM change points** checked to preserve beatgrid data
4. Click **Import** and wait for processing

**Import playlists:**

1. In the left sidebar, find the **rekordbox xml** section
2. Right-click **Playlists** and select **Import Playlist**

<img src="screenshots/import-xml-step-3.jpg" alt="Import Playlists" width="400" />

**Verify:**
- Check playlist track counts are correct
- Confirm duplicates are removed
- Test that relocated tracks play

> **Backup reminder**: Before importing, back up your Rekordbox database:
> - Windows: `%APPDATA%\Pioneer\rekordbox`
> - macOS: `~/Library/Pioneer/rekordbox`

---

## For Developers

### Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Electron + Node.js
- **Storage**: Dexie.js (IndexedDB)
- **State**: Zustand with persistence
- **Testing**: Vitest + Playwright
- **Build**: Vite + electron-builder

### Development Commands
```bash
# Development
npm run dev              # Launch with hot reload
npm run test:unit        # Unit tests
npm run test:e2e         # End-to-end tests

# Building
npm run build            # Production build
npm run dist:mac         # macOS installer
npm run dist:win         # Windows installer
npm run dist:all         # All platforms
```

### Architecture
```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
├── shared/         # Shared types and utilities
└── tests/          # Test suites
```

---

## Contributing

### For DJs:
- [Report bugs](https://github.com/koraysels/rekordbox-library-fixer/issues)
- [Suggest features](https://github.com/koraysels/rekordbox-library-fixer/issues)
- Share your workflow and use cases
- Star the repo to help other DJs find it

### For Developers:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for your changes
4. Submit a pull request

### Areas needing help:
- Serato/VirtualDJ format support
- Playlist duplicate detection
- Audio analysis (BPM/key detection)
- Batch processing for multiple libraries

---

## FAQ

**Is this safe to use with my library?**
Yes. The tool creates backups before making changes. Your original files are never modified directly.

**Does it work with large libraries?**
Yes. Tested with libraries containing 50,000+ tracks. Uses IndexedDB (via Dexie.js) for performance and persistent storage.

**Can I undo changes?**
Yes. Every operation creates a backup XML file you can restore from.

**What about other DJ software?**
Currently supports Rekordbox XML format. Serato and VirtualDJ may be added if there's enough interest.

**Is it free?**
Free for personal use. No ads, no subscriptions, no limits.

---

## Roadmap

**v0.0.6:**
- Playlist duplicate detection
- Improved UI

**v0.1.0:**
- Multi-format support (Serato, VirtualDJ, Traktor)
- Auto-import mode

**v1.0.0:**
- Stability and performance polish

---

## Support

- [Report Issues](https://github.com/koraysels/rekordbox-library-fixer/issues)
- [Request Features](https://github.com/koraysels/rekordbox-library-fixer/discussions)
- [Ko-fi](https://ko-fi.com/koraysels) — if this saved you time

---

## License

Custom non-commercial license — see [LICENSE](LICENSE) for details.

- Free for personal use
- Study and contribute to the code
- Internal business use is fine
- No commercial repackaging or selling

---

<div align="center">

**Made by a DJ who got tired of messy libraries**

[Back to Top](#rekordbox-library-fixer)

</div>
