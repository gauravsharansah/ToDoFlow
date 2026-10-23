/**
 * main.js — Electron Main Process
 *
 * Window, app menu and (Windows/Linux) system tray. No auto-update:
 * new versions are downloaded manually from the releases page.
 */

const {
  app, BrowserWindow, Menu, Tray, shell,
  nativeTheme, dialog, nativeImage
} = require('electron');
const path = require('path');

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

// Ubuntu 23.10+ blocks Chromium's user-namespace sandbox for AppImages
// (AppArmor), which makes the app exit immediately. Run without it on Linux.
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');

// ── Globals ───────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray       = null;
let quitting   = false;

// ── Window factory ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420, height: 820,
    minWidth: 360, minHeight: 600,
    title: 'ToDoFlow',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,   // hides menu bar; still accessible via Alt key
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d0d1a' : '#f5f5ff',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      // sandbox: true is intentionally omitted — it blocks IndexedDB which
      // Firestore persistence requires. Security is kept by contextIsolation.
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(
      __dirname, 'src',
      process.platform === 'win32' ? 'icon.ico' : 'icon-512.png'
    ),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Fix: menu bar becomes unresponsive in fullscreen on Windows because
  // autoHideMenuBar + the Alt key trick stops working. Make the menu
  // always visible while in fullscreen, restore auto-hide on exit.
  // On macOS the traffic lights are hidden in fullscreen, so drop the inset.
  const setMacFullscreen = on => {
    if (process.platform !== 'darwin') return;
    mainWindow.webContents
      .executeJavaScript(`document.documentElement.classList.toggle('mac-fs', ${on})`)
      .catch(() => {});
  };
  mainWindow.on('enter-full-screen', () => {
    mainWindow.setAutoHideMenuBar(false);
    mainWindow.setMenuBarVisibility(true);
    setMacFullscreen(true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.setMenuBarVisibility(false);
    setMacFullscreen(false);
  });

  // Minimise to tray instead of closing on Windows/Linux
  mainWindow.on('close', e => {
    if (!quitting && process.platform !== 'darwin') {
      e.preventDefault();
      mainWindow.hide();
      tray && tray.displayBalloon &&
        tray.displayBalloon({
          title: 'ToDoFlow is still running',
          content: 'Tasks are syncing in the background. Right-click the tray icon to quit.',
          iconType: 'info',
        });
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // External links → system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  buildAppMenu();
}

// ── App menu ──────────────────────────────────────────────────────────────────
function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [isMac ? { role: 'close' } : { role: 'quit' }] },
    {
      label: 'Edit', submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View', submenu: [
        { role: 'reload' }, { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      role: 'help', submenu: [
        {
          label: 'About ToDoFlow',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'ToDoFlow',
            message: `ToDoFlow v${app.getVersion()}`,
            detail: 'Your tasks, beautifully organized.\nData synced globally via Firebase.',
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── System Tray ───────────────────────────────────────────────────────────────
function createTray() {
  if (process.platform === 'darwin') return;

  const iconPath = path.join(
    __dirname, 'src',
    process.platform === 'win32' ? 'icon.ico' : 'icon-512.png'
  );
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  tray.setToolTip('ToDoFlow');
  refreshTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
    }
  });
}

function refreshTrayMenu() {
  if (!tray) return;
  const loginItem = app.getLoginItemSettings();
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open ToDoFlow',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: loginItem.openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { quitting = true; app.quit(); },
    },
  ]);
  tray.setContextMenu(menu);
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized() || !mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (!tray) app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });

  app.on('before-quit', () => { quitting = true; });
});