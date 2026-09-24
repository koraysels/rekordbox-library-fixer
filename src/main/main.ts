import * as path from 'path';
import { app, BrowserWindow, shell, Menu, protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import { mediaUrlToFilePath, isAllowedMediaPath } from './mediaProtocol';
import { mainLogger as appLogger } from './appLogger';
import { runtime, safeConsole, setMainWindow } from './runtime';
import { registerLibraryIpc } from './ipc/library';
import { registerDuplicateIpc } from './ipc/duplicates';
import { registerRelocationIpc } from './ipc/relocation';
import { registerMaintenanceIpc } from './ipc/maintenance';
import { registerBackupIpc } from './ipc/backups';
import { registerSystemIpc } from './ipc/system';


// Must run before app ready — grants media:// streaming + fetch privileges.
// corsEnabled is required for renderer fetch() (the AIFF rewrap path); without
// it Chromium refuses cross-origin fetches to the custom scheme entirely.
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } }
]);

// One window only. A second instance carries its own loaded library, and with
// several similarly named exports that makes it possible to act on a different
// file than the window you are looking at.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) { mainWindow.restore(); }
      mainWindow.focus();
    }
  });
}


let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../assets/icons/icon.png'), // works in dev + Linux
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#18181B',
  });
  // The handler modules send progress through the runtime, so it needs the
  // window that exists now — not one captured when they were imported.
  setMainWindow(mainWindow);
  // In development, load from localhost
  if (process.env.NODE_ENV === 'development') {
    // Fixed port to match Vite config
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }


  mainWindow.on('closed', () => {
    mainWindow = null;
    setMainWindow(null);
  });

  // Handle navigation for security
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
    }
  });

  // Enable native drag-and-drop handling in main process
  mainWindow.webContents.on('dom-ready', () => {
    // Override the default file drag behavior to capture native paths
    mainWindow?.webContents.executeJavaScript(`
      // Remove any existing listeners
      document.removeEventListener('dragover', window.__electronDragOver);
      document.removeEventListener('drop', window.__electronDrop);
      
      // Add new listeners that capture native file paths
      window.__electronDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      window.__electronDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = Array.from(e.dataTransfer.files);
        console.log('Native drop detected, files:', files.length);
        
        // Extract native file paths
        const filePaths = files.map(file => {
          console.log('File object:', {
            name: file.name,
            path: file.path,
            size: file.size,
            type: file.type
          });
          return file.path;
        }).filter(path => path && path.length > 0);
        
        if (filePaths.length > 0) {
          console.log('Sending native paths to main process:', filePaths);
          window.electronAPI?.handleNativeDrop?.(filePaths);
        }
      };
      
      document.addEventListener('dragover', window.__electronDragOver);
      document.addEventListener('drop', window.__electronDrop);
      
      console.log('✅ Native drag-and-drop handlers installed');
    `);
  });
}

// Create the application menu
function createMenu() {
  const template = [
    {
      label: 'Rekordbox Library Fixer',
      submenu: [
        {
          label: 'About Rekordbox Library Fixer',
          click: () => {
            mainWindow?.webContents.send('show-about');
          }
        },
        {
          label: 'XML Export & Import Tutorial',
          click: () => {
            mainWindow?.webContents.send('show-tutorial');
          }
        },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { role: 'delete' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Log File',
          click: () => {
            const logPath = runtime().logger.getLogPath();
            shell.openPath(logPath).catch(err => {
              appLogger.error('Failed to open log file:', err);
            });
          }
        },
        {
          label: 'Open Logs Directory',
          click: () => {
            const logsDir = runtime().logger.getLogsDirectory();
            shell.openPath(logsDir).catch(err => {
              appLogger.error('Failed to open logs directory:', err);
            });
          }
        },
        { type: 'separator' },
        {
          label: 'XML Export & Import Tutorial',
          click: () => {
            mainWindow?.webContents.send('show-tutorial');
          }
        },
        { type: 'separator' },
        {
          label: 'About Rekordbox Library Fixer',
          click: () => {
            mainWindow?.webContents.send('show-about');
          }
        }
      ]
    }
  ] as Electron.MenuItemConstructorOptions[];

  // Add developer menu in development only
  if (process.env.NODE_ENV === 'development') {
    // Find View menu and add separator + dev tools if not already there
    const viewMenu = template.find(menu => menu.label === 'View');
    if (viewMenu && viewMenu.submenu && Array.isArray(viewMenu.submenu)) {
      // Dev tools already added above in View menu for consistency
    }
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  protocol.handle('media', async (request) => {
    try {
      const filePath = mediaUrlToFilePath(request.url);
      if (!isAllowedMediaPath(filePath)) {
        return new Response('Forbidden', { status: 403 });
      }
      const res = await net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers });
      // CORS-enabled scheme: renderer fetch() needs an explicit allow header
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    } catch {
      return new Response('Bad media URL', { status: 400 });
    }
  });

  // Enable context menu with copy/paste support using eval to bypass TypeScript compilation
  try {
    // electron-context-menu is ESM-only; TypeScript compiles import() to require()
    // in CommonJS mode, so we use Function to get a real dynamic ESM import.
    const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const contextMenuModule = await esmImport('electron-context-menu');
    const contextMenu = contextMenuModule.default;
    contextMenu({
      showLookUpSelection: false,
      showSearchWithGoogle: false,
      showCopyImage: false,
      showCopyImageAddress: false,
      showSaveImage: false,
      showSaveImageAs: false,
      showServices: false
    });
    safeConsole.log('✅ Context menu initialized');
  } catch (error) {
    safeConsole.warn('⚠️ Failed to load context menu:', error);
  }

  // Create application menu
  createMenu();

  registerLibraryIpc();
  registerDuplicateIpc();
  registerRelocationIpc();
  registerMaintenanceIpc();
  registerBackupIpc();
  registerSystemIpc();

  // Database storage is now handled via Dexie in the renderer process
  safeConsole.log('✅ Application initialized');

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// File reachability check — used by startup auto-load

// IPC Handlers for Feature 1: Duplicate Detection


/**
 * Raise an operating-system notification for results worth knowing about when
 * the window is not in front: a finished scan, a failed write.
 */


// Show file in system file manager

// Note: Duplicate storage is now handled via Dexie in the renderer process

// Track Relocation IPC Handlers


// Add cancel handler


// Open external URLs in the default browser

// Native file dialog for opening files with absolute paths


// Handle native file drop with real file paths (event-based only)

// Save dropped file content to temp directory (fallback)

