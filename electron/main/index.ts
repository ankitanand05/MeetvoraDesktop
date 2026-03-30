/**
 * Electron Main Process — Cross-platform entry point
 * Supports: Windows, macOS, Linux
 */

import dotenv from 'dotenv';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

// Disable GPU HW acceleration — prevents transparent-window crashes on all platforms
const { app: earlyApp } = require('electron');
earlyApp.disableHardwareAcceleration();

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
} from 'electron';
import { registerIpcHandlers, isStealthActive } from '../ipc/handlers';
import { initializeDatabase, closeDatabase } from '../storage/db';

let mainWindow: BrowserWindow | null = null;

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
  try {
    const parsed = new URL(url);
    if (parsed.host === 'auth' || parsed.pathname.startsWith('//auth')) {
      const token = parsed.searchParams.get('token');
      const email = parsed.searchParams.get('email');
      const name = parsed.searchParams.get('name');

      if (token && email) {
        const { setConfig } = require('./storage/config');
        setConfig('auth-token', token);
        setConfig('user-email', email);
        if (name) setConfig('user-name', name);

        console.log('[DeepLink] Auth success for', email);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth:success', { email, name: name || '' });
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }
  } catch (err) {
    console.error('[DeepLink] Failed to parse URL:', err);
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
  const isLinux = process.platform === 'linux';

  mainWindow = new BrowserWindow({
    width: 420,
    height: 720,
    minWidth: 360,
    minHeight: 500,
    frame: false,
    resizable: true,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    // macOS-specific: use hidden titlebar for native feel
    ...(isMac && { titleBarStyle: 'hiddenInset' }),
    icon: path.join(appRoot, 'build', isLinux ? 'icon.png' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
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

  // Cross-platform stealth shortcut
  // macOS: Cmd+Shift+` / Others: Ctrl+Shift+`
  const shortcut = process.platform === 'darwin' ? 'Cmd+Shift+`' : 'Ctrl+Shift+`';
  const registered = globalShortcut.register(shortcut, () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.restore();
      if (isStealthActive()) {
        mainWindow.setContentProtection(true);
        mainWindow.setSkipTaskbar(true);
        mainWindow.setTitle(' ');
      }
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.focus();
    }
  });
  if (!registered) console.warn('[Main] Failed to register global shortcut');

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
