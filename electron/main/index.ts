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
  screen,
} from 'electron';
import { registerIpcHandlers, isStealthActive, isPinnedActive, syncContentProtection } from '../ipc/handlers';
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
        mainWindow.setSkipTaskbar(true);
        mainWindow.setTitle(' ');
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } else if (isPinnedActive()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      syncContentProtection(mainWindow);
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

  // Apply content protection immediately — ghost cursor is ON by default so the
  // window should be invisible to screen-capture tools from the very first frame.
  syncContentProtection(mainWindow);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) syncContentProtection(mainWindow); // protect BEFORE the window becomes visible
    mainWindow?.show();
    mainWindow?.focus();
  });

  /* ── Ghost cursor — relay OS cursor position to renderer ──────
     DOM mousemove events are swallowed by the <webview> renderer,
     so the parent renderer never sees them while the cursor is over
     the ChatGPT panel.  We poll screen.getCursorScreenPoint() in
     the main process (~60 fps) and convert to window-relative
     coordinates so GhostCursor.tsx can position its dot correctly
     whether the cursor is over normal DOM or over the webview.   */
  let cursorRelayInterval: NodeJS.Timeout | null = null;

  const startCursorRelay = () => {
    if (cursorRelayInterval) return; // already running
    cursorRelayInterval = setInterval(() => {
      const win = mainWindow;
      if (!win || win.isDestroyed() || !win.isVisible()) return;
      const { x: cx, y: cy } = screen.getCursorScreenPoint();
      const b = win.getContentBounds(); // DIP coords, same as renderer
      win.webContents.send('cursor:pos', { x: cx - b.x, y: cy - b.y });
    }, 16); // ~60 fps
  };

  const stopCursorRelay = () => {
    if (cursorRelayInterval) {
      clearInterval(cursorRelayInterval);
      cursorRelayInterval = null;
    }
  };

  // Relay runs whenever the window is visible — NOT tied to focus so the ghost
  // cursor tracks correctly even when another app has keyboard focus.
  // Only pause on hide/close (window is gone from screen entirely).
  mainWindow.on('focus',  startCursorRelay);
  mainWindow.on('show',   startCursorRelay);
  mainWindow.on('hide',   stopCursorRelay);
  mainWindow.on('closed', stopCursorRelay);

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
            syncContentProtection(mainWindow);
            setTimeout(() => {
              if (!mainWindow || mainWindow.isDestroyed()) return;
              mainWindow.show();
              mainWindow.focus();
              if (isStealthActive()) {
                mainWindow.setSkipTaskbar(true);
                mainWindow.setTitle(' ');
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
              } else if (isPinnedActive()) {
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
              }
            }, 60);
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
      syncContentProtection(mainWindow);
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.show();
        mainWindow.focus();
        if (isPinnedActive() && !isStealthActive()) {
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      }, 60);
    });
  } catch (err) {
    console.warn('[Main] Failed to create tray icon:', err);
  }

  /* ── Global Shortcut — with fallback ── */
  // The toggle function shared by all shortcut keys + tray.
  // "accessible" = visible AND not minimized. A minimized window has
  // isVisible()===true on Windows, so we must check both.
  //
  // Flash prevention strategy:
  // Windows resets WDA_EXCLUDEFROMCAPTURE during the hide→show transition.
  // Fix: (1) debounce rapid toggling so the compositor has time to settle,
  //      (2) delay show() by 100ms after setContentProtection,
  //      (3) reapply content protection immediately after show() as a safety net.
  let _toggleCooldown = false;
  const toggleWindow = () => {
    if (!mainWindow || _toggleCooldown) return;
    _toggleCooldown = true;
    // 400ms cooldown prevents rapid toggling that causes compositor race conditions
    setTimeout(() => { _toggleCooldown = false; }, 400);

    const accessible = mainWindow.isVisible() && !mainWindow.isMinimized();
    if (accessible) {
      mainWindow.hide();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      // Apply protection BEFORE show so Windows compositor can process it first
      syncContentProtection(mainWindow);
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.show();
        // Reapply immediately after show — Windows may reset the flag during transition
        syncContentProtection(mainWindow);
        if (isStealthActive()) {
          mainWindow.setSkipTaskbar(true);
          mainWindow.setTitle(' ');
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        } else if (isPinnedActive()) {
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
        mainWindow.focus();
      }, 100);
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
