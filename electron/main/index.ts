/**
 * Electron Main Process — Cross-platform entry point
 * Supports: Windows, macOS, Linux
 */

import dotenv from 'dotenv';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

// Disable GPU HW acceleration on macOS only — on Windows disabling it breaks
// transparent/frameless windows on many GPU drivers (renders black rectangle).
const { app: earlyApp } = require('electron');
if (process.platform === 'darwin') {
  earlyApp.disableHardwareAcceleration();
}

// Resolve app root (asar in prod, project root in dev)
const appRoot = isDev ? path.join(__dirname, '../..') : process.resourcesPath;

// Load env files
dotenv.config({ path: path.join(appRoot, '.env.example') });
dotenv.config({ path: path.join(appRoot, '.env'), override: true });

import {
  app,
  BrowserWindow,
  shell,
  session,
  desktopCapturer,
  dialog,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import { registerIpcHandlers, isStealthActive, isPinnedActive } from '../ipc/handlers';
import { initializeDatabase, closeDatabase } from '../storage/db';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

/** Expose getter so other modules can access the main window */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/* ─────────────────────────────────────────────── */
/* DEEP LINK PROTOCOL (meetvora://)               */
/* ─────────────────────────────────────────────── */

const PROTOCOL = 'meetvora';

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function handleDeepLink(url: string): void {
  console.log('[DeepLink] Received:', url);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

/* ─────────────────────────────────────────────── */
/* SINGLE INSTANCE LOCK                           */
/* ─────────────────────────────────────────────── */

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLinkUrl = argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (deepLinkUrl) handleDeepLink(deepLinkUrl);

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (isStealthActive()) {
        mainWindow.setContentProtection(true);
        mainWindow.setSkipTaskbar(true);
        mainWindow.setTitle(' ');
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } else if (isPinnedActive()) {
        mainWindow.setContentProtection(true);
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      mainWindow.focus();
    }
  });

  // macOS deep-link handler
  app.on('open-url', (_event, url) => {
    handleDeepLink(url);
  });
}

/* ─────────────────────────────────────────────── */
/* CREATE WINDOW                                  */
/* ─────────────────────────────────────────────── */

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  mainWindow = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 500,
    minHeight: 500,
    frame: false,
    resizable: false,
    show: false,
    // Transparent windows are unreliable on Windows with many GPU drivers.
    // Only enable on macOS/Linux where HW accel is disabled.
    transparent: !isWin,
    backgroundColor: isWin ? '#1a1a2e' : '#00000000',
    hasShadow: false,
    // macOS-specific: use hidden titlebar for native feel
    ...(isMac && { titleBarStyle: 'hiddenInset' }),
    icon: path.join(appRoot, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (['https:', 'http:'].includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {
      console.warn('[Main] Blocked malformed external URL:', url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  /* ── Renderer crash / hang recovery ── */
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer gone:', details.reason, details.exitCode);
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          isDev
            ? mainWindow.loadURL('http://localhost:5174')
            : mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
        }
      }, 1000);
    }
  });

  let unresponsiveTimer: NodeJS.Timeout | null = null;
  mainWindow.on('unresponsive', () => {
    console.warn('[Main] Window unresponsive — reloading in 5s');
    if (unresponsiveTimer) clearTimeout(unresponsiveTimer);
    unresponsiveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    }, 5000);
  });
  mainWindow.on('responsive', () => {
    if (unresponsiveTimer) {
      clearTimeout(unresponsiveTimer);
      unresponsiveTimer = null;
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Load failed:', errorCode, errorDescription);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        isDev
          ? mainWindow.loadURL('http://localhost:5174')
          : mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
      }
    }, 2000);
  });
}

/* ─────────────────────────────────────────────── */
/* APP INIT                                       */
/* ─────────────────────────────────────────────── */

app.whenReady().then(async () => {
  try {
    initializeDatabase();
  } catch (error: any) {
    dialog.showErrorBox('Database Error', error.message || 'Could not initialize local database.');
    app.quit();
    return;
  }

  registerIpcHandlers();
  createWindow();

  /* ── System Tray ── */
  // Critical: provides a guaranteed way to show/recover the window,
  // even when the global shortcut fails (non-US keyboard layouts).
  try {
    const iconPath = path.join(appRoot, 'build', 'icon.png');
    let trayIcon: Electron.NativeImage;
    try {
      trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    } catch {
      trayIcon = nativeImage.createEmpty();
    }
    tray = new Tray(trayIcon);
    tray.setToolTip('Meetvora');
    const trayMenu = Menu.buildFromTemplate([
      {
        label: 'Show / Hide',
        click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
            mainWindow.hide();
          } else {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            if (isStealthActive()) {
              mainWindow.setContentProtection(true);
              mainWindow.setSkipTaskbar(true);
              mainWindow.setTitle(' ');
              mainWindow.setAlwaysOnTop(true, 'screen-saver');
            } else if (isPinnedActive()) {
              mainWindow.setContentProtection(true);
              mainWindow.setAlwaysOnTop(true, 'screen-saver');
            }
          }
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setContextMenu(trayMenu);
    tray.on('double-click', () => {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (isPinnedActive() && !isStealthActive()) {
        mainWindow.setContentProtection(true);
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    });
  } catch (err) {
    console.warn('[Main] Failed to create tray icon:', err);
  }

  /* ── Global Shortcut — with fallback ── */
  // The toggle function shared by all shortcut keys + tray.
  // "accessible" = visible AND not minimized. A minimized window has
  // isVisible()===true on Windows, so we must check both.
  const toggleWindow = () => {
    if (!mainWindow) return;
    const accessible = mainWindow.isVisible() && !mainWindow.isMinimized();
    if (accessible) {
      mainWindow.hide();
    } else {
      // Restore first so the window isn't in a minimized state when shown
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      if (isStealthActive()) {
        mainWindow.setContentProtection(true);
        mainWindow.setSkipTaskbar(true);
        mainWindow.setTitle(' ');
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } else if (isPinnedActive()) {
        // Re-apply pin props (Windows can lose them after hide/restore)
        mainWindow.setContentProtection(true);
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      mainWindow.focus();
    }
  };

  // Try the primary shortcut, then a fallback that works on all keyboard layouts.
  const primary = process.platform === 'darwin' ? 'Cmd+Shift+`' : 'Ctrl+Shift+`';
  const fallback = process.platform === 'darwin' ? 'Cmd+Shift+F12' : 'Ctrl+Shift+F12';

  const regPrimary = globalShortcut.register(primary, toggleWindow);
  if (!regPrimary) {
    console.warn(`[Main] Primary shortcut (${primary}) failed — trying fallback (${fallback})`);
  }
  const regFallback = globalShortcut.register(fallback, toggleWindow);
  if (!regFallback) {
    console.warn(`[Main] Fallback shortcut (${fallback}) also failed`);
  }
  if (regPrimary || regFallback) {
    console.log(`[Main] Global shortcut registered: ${regPrimary ? primary : ''} ${regFallback ? fallback : ''}`);
  } else {
    console.error('[Main] No global shortcuts could be registered — use the tray icon to show/hide');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Auto-grant loopback audio
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    });
  });
});

/* ─────────────────────────────────────────────── */
/* APP LIFECYCLE                                  */
/* ─────────────────────────────────────────────── */

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) { tray.destroy(); tray = null; }
  closeDatabase();
});

/* ─────────────────────────────────────────────── */
/* CRASH SAFETY                                   */
/* ─────────────────────────────────────────────── */

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});
