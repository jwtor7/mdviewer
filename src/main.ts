import { app, BrowserWindow, ipcMain, Menu, dialog, IpcMainInvokeEvent, MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'node:fs';
import { WINDOW_CONFIG } from './constants/index.js';
import type { FileOpenData, IPCMessage } from './types/electron';

/**
 * Type helper for IPC handlers that extracts the correct data type for a given channel.
 * This ensures handlers receive properly typed data based on the IPCMessage union.
 *
 * @example
 * const handler: IPCHandler<'file-open'> = (event, data) => {
 *   // data is correctly typed as FileOpenData
 * };
 */
type IPCHandler<T extends IPCMessage['channel']> = (
  event: IpcMainInvokeEvent,
  data: Extract<IPCMessage, { channel: T }>['data']
) => any;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingFileToOpen: string | null = null;

const createMenu = (): void => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async (): Promise<void> => {
            if (!mainWindow) return;

            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Markdown Files', extensions: ['md', 'markdown'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
              openFile(result.filePaths[0]);
            }
          }
        },
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
        { role: 'selectAll' }
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
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const createWindow = (initialFile: string | null = null): BrowserWindow => {
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

const openFile = (filepath: string, targetWindow: BrowserWindow | null = mainWindow): void => {
  fs.readFile(filepath, 'utf-8', (err: NodeJS.ErrnoException | null, data: string) => {
    if (err) {
      console.error('Failed to read file', err);
      return;
    }
    if (targetWindow && !targetWindow.isDestroyed()) {
      const fileData: FileOpenData = {
        filePath: filepath,
        content: data,
        name: filepath ? path.basename(filepath) : 'Untitled'
      };
      targetWindow.webContents.send('file-open', fileData);
    }
  });
};



const droppedTabs = new Set<string>();

ipcMain.handle('tab-dropped', (_event: IpcMainInvokeEvent, dragId: string): boolean => {
  droppedTabs.add(dragId);
  // Auto-cleanup after 5 seconds to prevent memory leaks
  setTimeout(() => {
    droppedTabs.delete(dragId);
  }, 5000);
  return true;
});

ipcMain.handle('check-tab-dropped', (_event: IpcMainInvokeEvent, dragId: string): boolean => {
  const wasDropped = droppedTabs.has(dragId);
  // Optional: remove immediately if checked?
  // Better to keep it briefly in case of race conditions or multiple checks,
  // but usually one check is enough. Let's keep it for the timeout duration to be safe.
  return wasDropped;
});

ipcMain.handle('close-window', (event: IpcMainInvokeEvent): void => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipcMain.handle('create-window-for-tab', (_event: IpcMainInvokeEvent, { filePath, content }: { filePath: string | null; content: string }): { success: boolean } => {
  const win = createWindow();
  win.once('ready-to-show', () => {
    const fileData: FileOpenData = {
      filePath,
      content,
      name: filePath ? path.basename(filePath) : 'Untitled'
    };
    win.webContents.send('file-open', fileData);
  });
  return { success: true };
});

// Handle file opening on macOS (must be registered BEFORE app.whenReady)
// This catches files opened via "Open With" or drag-and-drop onto app icon
app.on('open-file', (event: Electron.Event, filePath: string) => {
  event.preventDefault();

  if (mainWindow && mainWindow.webContents) {
    // Window exists and is ready
    openFile(filePath);
  } else {
    // Window not ready yet, queue the file
    pendingFileToOpen = filePath;
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createMenu();
  mainWindow = createWindow();

  // If a file was queued before the window was ready, open it now
  if (pendingFileToOpen) {
    mainWindow.once('ready-to-show', () => {
      if (pendingFileToOpen) {
        openFile(pendingFileToOpen);
        pendingFileToOpen = null;
      }
    });
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
