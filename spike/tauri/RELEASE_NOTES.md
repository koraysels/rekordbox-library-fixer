**This is a test build, not the app.** It checks whether a smaller version of Rekordbox Library Fixer, built on Tauri instead of Electron, runs on your computer. It installs next to the normal app and changes nothing: your library is copied to a temporary folder and only read.

Open it and go through the three checks:
1. **Read my library**
2. **Play a track** (pick any track from your collection)
3. **Open the app screen**

Then click **Copy results** and paste them in a new issue: https://github.com/koraysels/rekordbox-library-fixer/issues/new?title=Tauri%20test%20results

Say which computer and system you're on, and whether anything looked wrong.

## ✨ Features
- [ ] Download about 60 % smaller than the Electron app
- [ ] Reads the rekordbox database with pyrekordbox

## 🐛 Fixes
- [ ] None, this is a test build

## ⚠️ Known Issues
- [ ] The app screen isn't connected yet: its buttons do nothing
- [ ] No Intel Mac build yet
- [ ] Linux: playback needs the GStreamer plugins (`gstreamer1.0-plugins-good`, `gstreamer1.0-libav`)

---

## macOS – Which file to download

| Your Mac | File to download |
|----------|-----------------|
| Apple Silicon (M1/M2/M3/M4) | `...aarch64.dmg` |
| Intel (2019 and earlier) | not available yet |

**Not sure which chip you have?** Click the Apple menu → About This Mac. It will say “Apple M1” (or M2/M3/M4) or “Intel Core”.

---

## macOS – Opening an unsigned app

This app is not signed with an Apple Developer certificate, so macOS warns you the first time.

**Option 1 – Open Anyway (no Terminal):**
1. Open the app. macOS says it could not verify it. Click **Done**.
2. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.
3. Confirm. macOS remembers the choice from then on.

**Option 2 – Remove quarantine via Terminal:**
```bash
xattr -dr com.apple.quarantine "/Applications/Rekordbox Library Fixer Tauri Test.app"
```

## Windows

Windows SmartScreen may say it protected your PC. Click **More info → Run anyway**.

---
*Built with ❤️ for DJs*
