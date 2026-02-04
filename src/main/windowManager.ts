/**
 * Window Management Module
 * Handles Electron BrowserWindow creation and application menu building.
 */

import { app, BrowserWindow, Menu, dialog, shell, MenuItemConstructorOptions, ipcMain } from 'electron';
import path from 'node:path';
/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'node:fs';
import { WINDOW_CONFIG } from '../constants/index.js';

/**
 * Vite-injected global variables for dev/prod environments
 */
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let openWindowCount = 0;

export const getMainWindow = (): BrowserWindow | null => mainWindow;
export const setMainWindow = (window: BrowserWindow | null): void => { mainWindow = window; };
export const getOpenWindowCount = (): number => openWindowCount;
export const incrementWindowCount = (): void => { openWindowCount++; };
export const decrementWindowCount = (): void => { openWindowCount--; };

export const createMenu = (
  recentFiles: string[],
  appPreferences: { alwaysOnTop: boolean },
  onOpenFile: (filePath: string) => void,
  onClearRecentFiles: () => void,
  onSavePreferences: () => void
): void => {
  const recentFilesSubmenu: MenuItemConstructorOptions[] = [];

  const existingRecentFiles = recentFiles.filter(filePath => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });

  if (existingRecentFiles.length > 0) {
    existingRecentFiles.forEach((filePath) => {
      recentFilesSubmenu.push({
        label: filePath,
        click: (): void => { onOpenFile(filePath); }
      });
    });
    recentFilesSubmenu.push({ type: 'separator' });
  }

  recentFilesSubmenu.push({
    label: 'Clear Recent',
    enabled: existingRecentFiles.length > 0,
    click: (): void => { onClearRecentFiles(); }
  });

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: (): void => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            mainWindow.webContents.send('file-new');
          }
        },
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
              onOpenFile(result.filePaths[0]);
            }
          }
        },
        { label: 'Open Recent', submenu: recentFilesSubmenu },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: (): void => {
          if (!mainWindow || mainWindow.isDestroyed()) return;
          mainWindow.webContents.send('close-tab');
        }},
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: (): void => {
          if (!mainWindow || mainWindow.isDestroyed()) return;
          mainWindow.webContents.send('file-save');
        }},
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
        {
          label: 'Wrap Lines',
          type: 'checkbox',
          checked: true,
          accelerator: 'CmdOrCtrl+Alt+W',
          click: (): void => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            mainWindow.webContents.send('toggle-word-wrap');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
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
        {
          label: 'Keep on Top',
          type: 'checkbox',
          checked: appPreferences.alwaysOnTop,
          click: (menuItem): void => {
            appPreferences.alwaysOnTop = menuItem.checked;
            BrowserWindow.getAllWindows().forEach(win => {
              win.setAlwaysOnTop(menuItem.checked);
            });
            onSavePreferences();
            createMenu(recentFiles, appPreferences, onOpenFile, onClearRecentFiles, onSavePreferences);
          }
        },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

export const createWindow = (
  appPreferences: { alwaysOnTop: boolean },
  onOpenFile: (filePath: string, targetWindow: BrowserWindow) => void,
  initialFile: string | null = null
): BrowserWindow => {

  const win = new BrowserWindow({
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
    alwaysOnTop: appPreferences.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  incrementWindowCount();

  win.webContents.on('context-menu', (_event, params) => {
    const { selectionText, isEditable, editFlags } = params;
    const menuItems: MenuItemConstructorOptions[] = [];

    if (editFlags.canCut) menuItems.push({ label: 'Cut', role: 'cut' });
    if (editFlags.canCopy || selectionText) menuItems.push({ label: 'Copy', role: 'copy' });
    if (editFlags.canPaste) menuItems.push({ label: 'Paste', role: 'paste' });
    menuItems.push({ type: 'separator' });
    menuItems.push({ label: 'Select All', role: 'selectAll' });

    if (selectionText) {
      menuItems.push({ type: 'separator' });
      menuItems.push({
        label: 'Search with Perplexity',
        click: (): void => {
          const query = encodeURIComponent(selectionText);
          shell.openExternal('https://www.perplexity.ai/search?q=' + query);
        }
      });
    }

    if (isEditable && selectionText) {
      menuItems.push({ type: 'separator' });
      menuItems.push({ label: 'Bold', click: (): void => win.webContents.send('format-text', 'bold') });
      menuItems.push({ label: 'Italic', click: (): void => win.webContents.send('format-text', 'italic') });
      menuItems.push({ label: 'List', click: (): void => win.webContents.send('format-text', 'list') });
    }

    const menu = Menu.buildFromTemplate(menuItems);
    menu.popup();
  });

  win.on('close', async (e) => {
    try {
      const unsavedDocs = await new Promise<string[]>((resolve) => {
        const timeout = setTimeout(() => resolve([]), 1000);
        ipcMain.once('unsaved-docs-response', (_event, docs) => {
          clearTimeout(timeout);
          resolve(Array.isArray(docs) ? docs : []);
        });
        win.webContents.send('request-unsaved-docs');
      });

      if (unsavedDocs && unsavedDocs.length > 0) {
        e.preventDefault();

        const result = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Save All', "Don't Save", 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          title: 'Unsaved Changes',
          message: 'You have ' + unsavedDocs.length + ' unsaved document(s).',
          detail: 'Documents: ' + unsavedDocs.join(', ') + '\n\nDo you want to save them before quitting?',
        });

        if (result.response === 2) {
          return;
        } else if (result.response === 0) {
          win.webContents.send('save-all-and-quit');
        } else {
          win.destroy();
        }
      }
    } catch (err) {
      console.error('Error checking unsaved documents:', err);
    }
  });

  win.on('closed', () => {
    decrementWindowCount();
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/' + MAIN_WINDOW_VITE_NAME + '/index.html'));
  }

  if (initialFile) {
    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) {
        onOpenFile(initialFile, win);
      }
    });
  }

  return win;
};
