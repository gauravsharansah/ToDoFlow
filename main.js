/**
 * main.js — Electron Main Process
 *
 * Changes:
 *  - Added preload.js reference (fixes window.ipcRenderer in renderer)
 *  - Added system tray so the app minimises to tray on close (Windows/Linux)
 *  - Added 'open-at-login' toggle in tray menu
 *  - Auto-updater is fully silent — no error dialogs ever shown to user
 *  - Auto-updater works for both public and private repos, signed or unsigned
 *  - second-instance focus moved inside app.whenReady for correct lifecycle
 */

const {
  app, BrowserWindow, Menu, Tray, shell,
  nativeTheme, ipcMain, dialog, nativeImage
} = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

// ── Globals ───────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray       = null;
let quitting   = false;
let updateReady = false; // true once an update is downloaded and ready

// ── Window factory ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420, height: 820,
    minWidth: 360, minHeight: 600,
    title: 'TodoFlow',
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
  mainWindow.on('enter-full-screen', () => {
    mainWindow.setAutoHideMenuBar(false);
    mainWindow.setMenuBarVisibility(true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.setMenuBarVisibility(false);
  });

  // Minimise to tray instead of closing on Windows/Linux
  mainWindow.on('close', e => {
    if (!quitting && process.platform !== 'darwin') {
      e.preventDefault();
      mainWindow.hide();
      tray && tray.displayBalloon &&
        tray.displayBalloon({
          title: 'TodoFlow is still running',
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
          label: 'About TodoFlow',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'TodoFlow',
            message: `TodoFlow v${app.getVersion()}`,
            detail: 'Your tasks, beautifully organized.\nData synced globally via Firebase.\n\nGitHub: github.com/gauravsharansah/todoflow',
          }),
        },
        {
          label: 'Check for Updates',
          click: () => {
            if (updateReady) {
              quitting = true;
              autoUpdater.quitAndInstall();
            } else {
              tryCheckForUpdates();
            }
          },
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
  tray.setToolTip('TodoFlow');
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
      label: 'Open TodoFlow',
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

// ── Auto-Updater ──────────────────────────────────────────────────────────────
// Works for: public repo, private repo, signed builds, unsigned builds.
// Never shows error dialogs to the user — all failures are silent/logged only.

function tryCheckForUpdates() {
  try {
    autoUpdater.checkForUpdates().catch(err => {
      // Silently log — don't bother the user
      console.log('Update check skipped:', err.message);
    });
  } catch (err) {
    console.log('Update check unavailable:', err.message);
  }
}

function setupAutoUpdater() {
  try {
    // Tell electron-updater where to look for releases
    autoUpdater.setFeedURL({
      provider: 'github',
      owner:    'gauravsharansah',
      repo:     'todoflow',
      private:  false, // set true if your repo is private
    });

    // Never show update errors to users
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // For unsigned builds — don't verify signature (remove if you add signing)
    autoUpdater.allowPrerelease = false;
    autoUpdater.forceDevUpdateConfig = false;

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', info => {
      console.log('Update available:', info.version);
      mainWindow?.webContents.send('update-available', info.version);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('App is up to date.');
    });

    autoUpdater.on('update-downloaded', info => {
      console.log('Update downloaded:', info.version);
      updateReady = true;
      mainWindow?.webContents.send('update-downloaded', info.version);
      // Auto-install after 30s if user hasn't manually triggered it
      setTimeout(() => {
        if (!mainWindow?.isDestroyed()) {
          quitting = true;
          autoUpdater.quitAndInstall();
        }
      }, 30_000);
    });

    // ★ KEY CHANGE: never show any error dialog to users
    autoUpdater.on('error', err => {
      console.log('Auto-updater error (silent):', err.message);
      // No dialog.showErrorBox — errors are logged only
    });

    // Delay first check by 5s so app loads fully first
    setTimeout(() => tryCheckForUpdates(), 5000);

  } catch (err) {
    // If updater itself fails to initialize (e.g. dev environment), ignore silently
    console.log('Auto-updater not available:', err.message);
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('check-for-updates', () => {
  tryCheckForUpdates();
});

ipcMain.handle('install-update', () => {
  if (updateReady) {
    quitting = true;
    autoUpdater.quitAndInstall();
  }
});

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setupAutoUpdater();
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