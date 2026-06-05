# Startup Auto-Load Design

**Goal:** On launch, if a library path was saved from a previous session and the file is still reachable, parse and load it automatically while the splash screen is showing. If the file is gone or unreadable, forget the path and show the import page.

**Architecture:** A single new IPC call (`file-exists`) handles the reachability check. `useLibrary` owns the startup sequence and exposes a `startupComplete` boolean. `AppWithRouter` shows `<SplashScreen />` until that flag is true. No minimum delay — the splash lasts exactly as long as the startup check needs.

**Tech Stack:** Electron IPC, React 18, Zustand, `fs.access` (Node.js)

---

## IPC layer (`src/main/main.ts` + `src/main/preload.ts`)

### New handler: `file-exists`

```typescript
ipcMain.handle('file-exists', async (_, path: string) => {
  try {
    await fs.promises.access(path, fs.constants.R_OK);
    return { accessible: true };
  } catch {
    return { accessible: false };
  }
});
```

### Preload (`src/main/preload.ts`)

Add alongside existing entries:
```typescript
checkFileAccessible: (path: string) => ipcRenderer.invoke('file-exists', path),
```

### Type declaration (`src/renderer/types/index.ts`)

Add to the `electronAPI` interface:
```typescript
checkFileAccessible: (path: string) => Promise<{ accessible: boolean }>;
```

---

## `useLibrary` hook (`src/renderer/hooks/useLibrary.ts`)

### New state

```typescript
const [startupComplete, setStartupComplete] = useState(false);
```

### Startup `useEffect` — replace existing

Current behaviour: restores path from localStorage, tries (and silently fails) to deserialize library JSON.

New behaviour:

```typescript
useEffect(() => {
  const run = async () => {
    const savedPath = localStorage.getItem('rekordboxLibraryPath');

    if (!savedPath) {
      setStartupComplete(true);
      return;
    }

    const { accessible } = await window.electronAPI.checkFileAccessible(savedPath);

    if (accessible) {
      await loadLibrary(savedPath);   // sets libraryPath + libraryData on success
    } else {
      localStorage.removeItem('rekordboxLibraryPath');
      // libraryPath and libraryData remain '' / null — import page shows
    }

    setStartupComplete(true);
  };

  run();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

`loadLibrary` already handles parse failure gracefully (clears path, shows error notification) — no additional error handling needed here.

### Remove

- The `useEffect` that tries to deserialize `rekordboxLibraryData` from localStorage (unreliable for real-sized libraries; auto-load replaces it)
- The `useEffect` that serializes library data to `rekordboxLibraryData`
- The `localStorage.removeItem('rekordboxLibraryData')` call in `clearStoredData`

### Return value

Add `startupComplete` to the hook's return object.

---

## `AppWithRouter.tsx`

### Remove

```typescript
// Remove this entire block:
const [showSplash, setShowSplash] = useState(true);

useEffect(() => {
  const timer = setTimeout(() => {
    setShowSplash(false);
  }, 2000);
  return () => clearTimeout(timer);
}, []);
```

### Replace with

```typescript
const { startupComplete, /* ...other exports */ } = useLibrary(showNotification);

if (!startupComplete) {
  return <SplashScreen />;
}
```

`showSplash` state and the timer `useEffect` are fully deleted. `startupComplete` from `useLibrary` is the single source of truth.

---

## Error handling

| Scenario | Behaviour |
|---|---|
| No saved path | `startupComplete = true` immediately, import page shown |
| Path saved, file accessible | Splash shows while parsing; main UI when done |
| Path saved, file not accessible | Path removed from localStorage, `startupComplete = true`, import page shown |
| Path saved, file accessible but invalid XML | `loadLibrary` returns `{success: false}`, shows error notification, clears path, `startupComplete = true`, import page shown |
| Path saved, parse throws unexpectedly | `loadLibrary` catch block fires, clears path, `startupComplete = true` |

---

## Files changed

| File | Change |
|---|---|
| `src/main/main.ts` | Add `file-exists` IPC handler |
| `src/main/preload.ts` | Add `checkFileAccessible` |
| `src/renderer/types/index.ts` | Add `checkFileAccessible` to `electronAPI` interface |
| `src/renderer/hooks/useLibrary.ts` | Startup sequence rewrite; remove localStorage data serialisation; expose `startupComplete` |
| `src/renderer/AppWithRouter.tsx` | Replace hardcoded splash timer with `startupComplete` gate |

---

## Out of scope

- Minimum splash delay (none — splash lasts exactly as long as the check needs)
- Progress indication during parse (the existing splash is static; no progress bar)
- Watching the file for changes after load
