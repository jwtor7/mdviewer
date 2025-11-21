import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'node:fs';
import { WINDOW_CONFIG } from './constants/index.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow;

const createWindow = (initialFile = null) => {
  // Create the browser window.
  const win = new BrowserWindow({
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  // win.webContents.openDevTools();

  if (initialFile) {
    win.once('ready-to-show', () => {
      openFile(initialFile, win);
    });
  }

  return win;
};

const openFile = (filepath, targetWindow = mainWindow) => {
  fs.readFile(filepath, 'utf-8', (err, data) => {
    if (err) {
      console.error('Failed to read file', err);
      return;
    }
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('file-open', {
        filePath: filepath,
        content: data,
        name: filepath ? path.basename(filepath) : 'Untitled'
      });
    }
  });
};

ipcMain.handle('create-window-for-tab', (event, { filePath, content }) => {
  const win = createWindow();
  win.once('ready-to-show', () => {
    win.webContents.send('file-open', {
      filePath,
      content,
      name: filePath ? path.basename(filePath) : 'Untitled'
    });
  });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  mainWindow = createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Handle file opening on launch (e.g. drag and drop onto app icon)
  app.on('open-file', (event, path) => {
    event.preventDefault();
    if (mainWindow) {
      openFile(path);
    } else {
      // If window not ready, wait for it
      app.once('browser-window-created', () => {
        openFile(path);
      });
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
