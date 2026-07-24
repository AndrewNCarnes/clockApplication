import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  Tray,
  Menu,
  nativeImage,
  session,
} from 'electron';
import path from 'node:path';
import { readState, writeState } from './store';
import { Scheduler } from './scheduler';
import { setWindowsFocusAssist } from './focusAssist';
import type {
  AlertKind,
  FocusAssistResult,
  PersistedState,
  ScheduleItem,
  TrayCommand,
} from '../src/types';

// Vite plugin injects these: dist-electron holds compiled main/preload, dist
// holds the built renderer. In dev, VITE_DEV_SERVER_URL points at the server.
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(__dirname, '../public')
  : process.env.DIST;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Whether a focus session is active. When true, we suppress the app's own
// toasts EXCEPT the 'focus-end' alert.
let focusActive = false;

const scheduler = new Scheduler((item: ScheduleItem) => {
  showToast(item.kind, item.title, item.body);
  win?.webContents.send('schedule:fired', { id: item.id, kind: item.kind });
});

function iconPath(): string {
  return path.join(process.env.VITE_PUBLIC || process.env.DIST || __dirname, 'icon.png');
}

function trayImage() {
  // Fall back gracefully if the icon file is missing.
  const img = nativeImage.createFromPath(
    path.join(__dirname, '../build/icon.png'),
  );
  return img.isEmpty()
    ? nativeImage.createFromPath(iconPath())
    : img.resize({ width: 16, height: 16 });
}

function showToast(kind: AlertKind, title: string, body: string) {
  // Focus mode suppresses everything except the focus-session transition
  // alerts (session ended, and Pomodoro focus<->break boundaries).
  if (focusActive && kind !== 'focus-end' && kind !== 'break-end') return;
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    icon: nativeImage.createFromPath(path.join(__dirname, '../build/icon.png')),
    silent: false,
  });
  n.on('click', () => showWindow());
  n.show();
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 380,
    minHeight: 560,
    title: 'Clock & Timer',
    icon: nativeImage.createFromPath(path.join(__dirname, '../build/icon.png')),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('close', (e) => {
    // Minimize-to-tray behaviour: hide instead of quitting unless the user
    // really quits. The renderer persists minimizeToTray but the simplest
    // reliable default is to honour tray presence.
    if (!isQuitting && tray) {
      e.preventDefault();
      win?.hide();
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'));
  }
}

function sendTray(cmd: TrayCommand) {
  showWindow();
  win?.webContents.send('tray:command', cmd);
}

function createTray() {
  try {
    tray = new Tray(trayImage());
    const menu = Menu.buildFromTemplate([
      { label: 'Show Clock & Timer', click: () => showWindow() },
      { type: 'separator' },
      { label: 'Start / Stop Focus', click: () => sendTray('toggle-focus') },
      { label: 'Pause All Timers', click: () => sendTray('pause-all-timers') },
      { label: 'Resume All Timers', click: () => sendTray('resume-all-timers') },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setToolTip('Clock & Timer');
    tray.setContextMenu(menu);
    tray.on('click', () => showWindow());
  } catch (err) {
    // Tray is a nice-to-have; never let it block startup.
    console.error('Tray unavailable:', err);
    tray = null;
  }
}

// ---- IPC handlers ----

ipcMain.handle('store:load', async (): Promise<PersistedState | null> => {
  return readState();
});

ipcMain.handle('store:save', async (_e, state: PersistedState): Promise<void> => {
  await writeState(state);
});

ipcMain.handle('schedule:set', async (_e, item: ScheduleItem): Promise<void> => {
  scheduler.set(item);
});

ipcMain.handle('schedule:clear', async (_e, id: string): Promise<void> => {
  scheduler.clear(id);
});

ipcMain.handle(
  'notify',
  async (_e, payload: { kind: AlertKind; title: string; body: string }): Promise<void> => {
    showToast(payload.kind, payload.title, payload.body);
  },
);

ipcMain.handle('focus:set-active', async (_e, active: boolean): Promise<void> => {
  focusActive = active;
});

ipcMain.handle(
  'focus:windows-assist',
  async (_e, enable: boolean): Promise<FocusAssistResult> => {
    return setWindowsFocusAssist(enable);
  },
);

// ---- App lifecycle ----

// Single-instance: focus the existing window instead of launching a second app.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    // Lock down the renderer with a strict CSP in production. We skip this in
    // dev because Vite's HMR needs inline scripts and a websocket connection;
    // the packaged app only ever loads local files, so this is a safe, tight
    // policy there.
    if (!VITE_DEV_SERVER_URL) {
      session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
        cb({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; " +
                "script-src 'self'; " +
                "style-src 'self' 'unsafe-inline'; " +
                'media-src \'self\' blob: data:; ' +
                "img-src 'self' data: blob:; " +
                "connect-src 'self'",
            ],
          },
        });
      });
    }

    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // With a tray we keep running; without one, quit on all platforms except mac.
  if (!tray && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  scheduler.dispose();
  // Best-effort: make sure we don't leave Focus Assist forced on.
  if (focusActive) setWindowsFocusAssist(false);
});
