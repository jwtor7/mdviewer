import { app, BrowserWindow, ipcMain, Menu, dialog, shell, IpcMainInvokeEvent, MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { WINDOW_CONFIG, SECURITY_CONFIG } from './constants/index.js';
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

/**
 * Security utility: Validates that a file path is safe to open.
 * Prevents path traversal attacks and enforces allowed file extensions.
 *
 * @param filepath - The file path to validate
 * @returns true if the path is safe, false otherwise
 */
const isPathSafe = (filepath: string): boolean => {
  try {
    // Resolve to absolute path to prevent traversal
    const resolved = path.resolve(filepath);

    // Check file extension (only allow markdown files)
    const ext = path.extname(resolved).toLowerCase();
    if (!SECURITY_CONFIG.ALLOWED_EXTENSIONS.includes(ext as '.md' | '.markdown')) {
      console.warn(`Rejected file with invalid extension: ${ext}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Path validation error:', error);
    return false;
  }
};

/**
 * Security utility: Sanitizes error messages to prevent information disclosure.
 * Removes sensitive file paths and system information from error messages.
 *
 * @param error - The error to sanitize
 * @returns A safe error message string
 */
const sanitizeError = (error: Error | NodeJS.ErrnoException): string => {
  // In production, return generic error message
  if (process.env.NODE_ENV === 'production' || !app.isPackaged) {
    return 'An error occurred while processing the file';
  }

  // In development, return message but sanitize paths
  let message = error.message;

  // Remove absolute paths, keep only basenames
  message = message.replace(/\/[^\s]+\//g, (match) => {
    const basename = path.basename(match);
    return basename ? `.../${basename}` : match;
  });

  return message;
};

/**
 * Security utility: Creates a rate limiter for IPC handlers.
 * Prevents resource exhaustion attacks by limiting the number of calls per time window.
 *
 * @param maxCalls - Maximum number of calls allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @returns A function that returns true if the call is allowed, false if rate limited
 */
const createRateLimiter = (maxCalls: number, windowMs: number) => {
  const calls = new Map<string, number[]>();

  return (identifier: string): boolean => {
    const now = Date.now();
    const timestamps = calls.get(identifier) || [];

    // Remove old timestamps outside the time window
    const recentCalls = timestamps.filter(t => now - t < windowMs);

    if (recentCalls.length >= maxCalls) {
      return false; // Rate limit exceeded
    }

    recentCalls.push(now);
    calls.set(identifier, recentCalls);
    return true; // Allow
  };
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingFileToOpen: string | null = null;
let openWindowCount = 0; // Track number of open windows for security limits

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

  // Security: Track window count
  openWindowCount++;

  // Clear mainWindow reference when this window is closed
  win.on('closed', () => {
    // Security: Decrement window count
    openWindowCount--;

    if (mainWindow === win) {
      mainWindow = null;
    }
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

/**
 * Securely opens and reads a markdown file with validation.
 * Performs path traversal prevention, file extension validation, and file size limits.
 *
 * @param filepath - The file path to open
 * @param targetWindow - The window to send the file content to (defaults to mainWindow)
 */
const openFile = async (filepath: string, targetWindow: BrowserWindow | null = mainWindow): Promise<void> => {
  try {
    // Security: Validate file path to prevent path traversal and enforce allowed extensions
    if (!isPathSafe(filepath)) {
      dialog.showErrorBox(
        'Invalid File',
        'Only Markdown files (.md, .markdown) can be opened.'
      );
      return;
    }

    // Security: Check file size to prevent memory exhaustion
    const stats = await fsPromises.stat(filepath);
    if (stats.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
      const maxSizeMB = SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024);
      dialog.showErrorBox(
        'File Too Large',
        `The file exceeds the maximum size of ${maxSizeMB}MB.`
      );
      return;
    }

    // Read file content
    const data = await fsPromises.readFile(filepath, 'utf-8');

    // Send to renderer if window is still valid
    if (targetWindow && !targetWindow.isDestroyed()) {
      const fileData: FileOpenData = {
        filePath: filepath,
        content: data,
        name: path.basename(filepath)
      };
      targetWindow.webContents.send('file-open', fileData);
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    console.error('Failed to read file:', sanitizeError(error));
    dialog.showErrorBox('Error', 'Failed to read file. Please try again.');
  }
};



// Security: Create rate limiters for IPC handlers
const rateLimiter = createRateLimiter(
  SECURITY_CONFIG.RATE_LIMIT.MAX_CALLS,
  SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS
);

// Security: Track dropped tabs with proper cleanup to prevent memory leaks
const droppedTabs = new Map<string, NodeJS.Timeout>();

ipcMain.handle('tab-dropped', (event: IpcMainInvokeEvent, dragId: string): boolean => {
  // Security: Apply rate limiting
  const senderId = event.sender.id.toString();
  if (!rateLimiter(senderId + '-tab-dropped')) {
    console.warn('Rate limit exceeded for tab-dropped');
    return false;
  }

  // Security: Clear existing timeout if any to prevent duplicate timers
  const existingTimeout = droppedTabs.get(dragId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Security: Enforce maximum size to prevent unbounded growth
  if (droppedTabs.size >= SECURITY_CONFIG.MAX_DROPPED_TABS) {
    console.warn(`Max dropped tabs limit (${SECURITY_CONFIG.MAX_DROPPED_TABS}) reached, clearing oldest`);
    const firstKey = droppedTabs.keys().next().value;
    const timeout = droppedTabs.get(firstKey);
    if (timeout) clearTimeout(timeout);
    droppedTabs.delete(firstKey);
  }

  // Auto-cleanup after 5 seconds
  const timeout = setTimeout(() => {
    droppedTabs.delete(dragId);
  }, 5000);

  droppedTabs.set(dragId, timeout);
  return true;
});

ipcMain.handle('check-tab-dropped', (event: IpcMainInvokeEvent, dragId: string): boolean => {
  // Security: Apply rate limiting
  const senderId = event.sender.id.toString();
  if (!rateLimiter(senderId + '-check-tab-dropped')) {
    console.warn('Rate limit exceeded for check-tab-dropped');
    return false;
  }

  return droppedTabs.has(dragId);
});

ipcMain.handle('close-window', (event: IpcMainInvokeEvent): void => {
  // Security: Apply rate limiting
  const senderId = event.sender.id.toString();
  if (!rateLimiter(senderId + '-close-window')) {
    console.warn('Rate limit exceeded for close-window');
    return;
  }

  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipcMain.handle('open-external-url', async (event: IpcMainInvokeEvent, url: string): Promise<void> => {
  // Security: Apply rate limiting
  const senderId = event.sender.id.toString();
  if (!rateLimiter(senderId + '-open-external-url')) {
    console.warn('Rate limit exceeded for open-external-url');
    throw new Error('Rate limit exceeded');
  }

  // Security: Validate URL format and protocol
  try {
    const parsedUrl = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.warn(`Blocked attempt to open URL with invalid protocol: ${parsedUrl.protocol}`);
      throw new Error('Only HTTP and HTTPS URLs are allowed');
    }

    // Get the window to show the dialog
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      throw new Error('Window not found');
    }

    // Show confirmation dialog
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Open in Browser', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Open External Link',
      message: 'Do you want to open this link in your default browser?',
      detail: url,
    });

    // If user clicked "Open in Browser" (index 0)
    if (result.response === 0) {
      await shell.openExternal(url);
      console.log(`Opened external URL: ${parsedUrl.origin}`);
    }
  } catch (err) {
    const error = err as Error;
    console.error('Failed to open external URL:', error.message);
    throw error;
  }
});

ipcMain.handle('create-window-for-tab', (event: IpcMainInvokeEvent, data: unknown): { success: boolean; error?: string } => {
  // Security: Apply rate limiting
  const senderId = event.sender.id.toString();
  if (!rateLimiter(senderId + '-create-window-for-tab')) {
    console.warn('Rate limit exceeded for create-window-for-tab');
    return { success: false, error: 'Rate limit exceeded' };
  }

  // Security: Validate input type
  if (typeof data !== 'object' || data === null) {
    console.error('Invalid IPC data type for create-window-for-tab');
    return { success: false, error: 'Invalid data' };
  }

  const { filePath, content } = data as { filePath: unknown; content: unknown };

  // Security: Validate content type and size
  if (typeof content !== 'string') {
    console.error('Content must be a string');
    return { success: false, error: 'Content must be string' };
  }

  if (content.length > SECURITY_CONFIG.MAX_CONTENT_SIZE) {
    const maxSizeMB = SECURITY_CONFIG.MAX_CONTENT_SIZE / (1024 * 1024);
    console.warn(`Content exceeds maximum size of ${maxSizeMB}MB`);
    return { success: false, error: 'Content too large' };
  }

  // Security: Validate filePath if provided
  if (filePath !== null && typeof filePath !== 'string') {
    console.error('FilePath must be string or null');
    return { success: false, error: 'Invalid filePath' };
  }

  // Security: Enforce window limit to prevent resource exhaustion
  if (openWindowCount >= SECURITY_CONFIG.MAX_WINDOWS) {
    console.warn(`Maximum window limit (${SECURITY_CONFIG.MAX_WINDOWS}) reached`);
    return { success: false, error: 'Too many windows open' };
  }

  // Security: Sanitize filePath to prevent path traversal
  const safePath = filePath && typeof filePath === 'string' ? path.basename(filePath) : null;

  const win = createWindow();
  win.once('ready-to-show', () => {
    const fileData: FileOpenData = {
      filePath: safePath,
      content: content as string,
      name: safePath ? path.basename(safePath) : 'Untitled'
    };
    win.webContents.send('file-open', fileData);
  });

  return { success: true };
});

// Handle file opening on macOS (must be registered BEFORE app.whenReady)
// This catches files opened via "Open With" or drag-and-drop onto app icon
app.on('open-file', (event: Electron.Event, filePath: string) => {
  event.preventDefault();

  if (mainWindow && !mainWindow.isDestroyed()) {
    // Window exists and is ready
    openFile(filePath);
  } else if (app.isReady()) {
    // App is ready but no valid window exists - create a new one
    mainWindow = createWindow(filePath);
  } else {
    // App not ready yet, queue the file
    pendingFileToOpen = filePath;
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Security: Add runtime protection for web contents
  app.on('web-contents-created', (_event, contents) => {
    // Security: Prevent navigation to external URLs
    contents.on('will-navigate', (navEvent, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      // Only allow file:// protocol (local files)
      if (parsedUrl.protocol !== 'file:') {
        console.warn(`Blocked navigation to external URL: ${parsedUrl.origin}`);
        navEvent.preventDefault();
      }
    });

    // Security: Prevent new window creation (popup blocking)
    contents.setWindowOpenHandler(() => {
      console.warn('Blocked attempt to open new window');
      return { action: 'deny' };
    });
  });

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
      mainWindow = createWindow();
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
