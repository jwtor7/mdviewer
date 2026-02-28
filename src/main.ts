/* eslint-disable security/detect-non-literal-fs-filename */
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import os from 'node:os';
import { SECURITY_CONFIG, IMAGE_CONFIG } from './constants/index.js';
import type { FileOpenData } from './types/electron';
import { generatePDFHTML } from './utils/pdfRenderer.js';
import { convertMarkdownToText } from './utils/textConverter.js';
import { validateFileContent } from './utils/fileValidator.js';
import { withIPCHandlerNoInput, withValidatedIPCHandler } from './main/security/ipcValidation.js';
import { isPathSafe, sanitizeError, validateExternalUrl } from './main/security/pathValidation.js';
import {
  SaveFileDataSchema,
  ReadFileDataSchema,
  ExportPdfDataSchema,
  CreateWindowForTabDataSchema,
  ShowUnsavedDialogDataSchema,
  RevealInFinderDataSchema,
  ReadImageFileDataSchema,
  CopyImageToDocumentDataSchema,
  SaveImageFromDataSchema,
  OpenExternalUrlDataSchema,
  type SaveFileDataInput,
  type ReadFileDataInput,
  type ExportPdfDataInput,
} from './types/ipc-schemas.js';
import {
  createMenu,
  createWindow,
  setMainWindow,
  getOpenWindowCount,
} from './main/windowManager.js';
import { watchFile, unwatchFile, unwatchAllForWindow } from './main/fileWatcher.js';

/**
 * Gets the default directory for save dialogs.
 * Attempts to use ~/Documents/ if it exists, otherwise falls back to home directory.
 *
 * @returns The default directory path
 */
const getDefaultSaveDirectory = (): string => {
  try {
    const homeDir = os.homedir();
    const documentsDir = path.join(homeDir, 'Documents');

    // Check if Documents directory exists
    if (fs.existsSync(documentsDir)) {
      return documentsDir;
    }

    // Fall back to home directory
    return homeDir;
  } catch (error) {
    console.error('Error determining default save directory:', error);
    // Ultimate fallback to current working directory
    return process.cwd();
  }
};


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingFileToOpen: string | null = null;

// Recent files management
const MAX_RECENT_FILES = 50;
let recentFiles: string[] = [];

// Preferences management
interface AppPreferences {
  alwaysOnTop: boolean;
}

let appPreferences: AppPreferences = { alwaysOnTop: false };


/**
 * Gets the path to the preferences storage JSON file.
 * Stored in the app's userData directory for persistence across sessions.
 */
const getPreferencesPath = (): string => {
  return path.join(app.getPath('userData'), 'preferences.json');
};

/**
 * Loads app preferences from persistent storage.
 * Uses async file operations to avoid blocking the main thread.
 */
const loadPreferences = async (): Promise<void> => {
  try {
    const preferencesPath = getPreferencesPath();
    // Check if file exists before reading
    try {
      await fsPromises.access(preferencesPath);
    } catch {
      // File doesn't exist, use defaults
      appPreferences = { alwaysOnTop: false };
      return;
    }

    const data = await fsPromises.readFile(preferencesPath, 'utf-8');
    const parsed = JSON.parse(data);
    if (typeof parsed === 'object' && parsed !== null) {
      appPreferences = {
        alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : false
      };
    }
  } catch (error) {
    console.error('Failed to load preferences:', error);
    appPreferences = { alwaysOnTop: false };
  }
};

/**
 * Saves app preferences to persistent storage.
 * Uses async file operations with debouncing to avoid blocking the main thread.
 */
let savePreferencesTimeout: NodeJS.Timeout | null = null;

const savePreferences = (): void => {
  // Debounce saves to avoid excessive disk writes
  if (savePreferencesTimeout) {
    clearTimeout(savePreferencesTimeout);
  }

  savePreferencesTimeout = setTimeout(async () => {
    try {
      const preferencesPath = getPreferencesPath();
      const dir = path.dirname(preferencesPath);
      // Ensure directory exists
      await fsPromises.mkdir(dir, { recursive: true });
      await fsPromises.writeFile(preferencesPath, JSON.stringify(appPreferences, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }, 500); // 500ms debounce
};


/**
 * Gets the path to the recent files storage JSON file.
 * Stored in the app's userData directory for persistence across sessions.
 */
const getRecentFilesPath = (): string => {
  return path.join(app.getPath('userData'), 'recent-files.json');
};

/**
 * Loads recent files list from persistent storage.
 * Uses async file operations to avoid blocking the main thread (LOW PRIORITY fix).
 */
const loadRecentFiles = async (): Promise<void> => {
  try {
    const recentFilesPath = getRecentFilesPath();
    // Check if file exists before reading
    try {
      await fsPromises.access(recentFilesPath);
    } catch {
      // File doesn't exist, use empty array
      recentFiles = [];
      return;
    }

    const data = await fsPromises.readFile(recentFilesPath, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      recentFiles = parsed.filter((file): file is string => typeof file === 'string');
    }
  } catch (error) {
    console.error('Failed to load recent files:', error);
    recentFiles = [];
  }
};

/**
 * Saves recent files list to persistent storage.
 * Uses async file operations with debouncing to avoid blocking the main thread (LOW PRIORITY fix).
 */
let saveRecentFilesTimeout: NodeJS.Timeout | null = null;

const saveRecentFiles = (): void => {
  // Debounce saves to avoid excessive disk writes
  if (saveRecentFilesTimeout) {
    clearTimeout(saveRecentFilesTimeout);
  }

  saveRecentFilesTimeout = setTimeout(async () => {
    try {
      const recentFilesPath = getRecentFilesPath();
      const dir = path.dirname(recentFilesPath);
      // Ensure directory exists
      await fsPromises.mkdir(dir, { recursive: true });
      await fsPromises.writeFile(recentFilesPath, JSON.stringify(recentFiles, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save recent files:', error);
    }
  }, 500); // 500ms debounce
};

/**
 * Adds a file to the recent files list.
 * Removes duplicates and maintains max size of 10 files.
 *
 * @param filePath - The file path to add to recent files
 */
const addRecentFile = (filePath: string): void => {
  // Remove if already exists (to move it to front)
  recentFiles = recentFiles.filter(f => f !== filePath);

  // Add to front
  recentFiles.unshift(filePath);

  // Limit to MAX_RECENT_FILES
  if (recentFiles.length > MAX_RECENT_FILES) {
    recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
  }

  // Persist changes
  saveRecentFiles();

  // Rebuild menu to reflect changes
  createMenu(recentFiles, appPreferences, openFile, clearRecentFiles, savePreferences);
};

/**
 * Clears all recent files.
 */
const clearRecentFiles = (): void => {
  recentFiles = [];
  saveRecentFiles();
  createMenu(recentFiles, appPreferences, openFile, clearRecentFiles, savePreferences);
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

    // Security: Read file as Buffer first for integrity validation (MEDIUM-2 fix)
    const buffer = await fsPromises.readFile(filepath);

    // Security: Validate file content integrity (UTF-8, BOM, binary detection)
    const validation = validateFileContent(buffer);
    if (!validation.valid || !validation.content) {
      console.warn(`[SECURITY] File integrity validation failed for: ${path.basename(filepath)}`);
      dialog.showErrorBox(
        'Invalid File Content',
        validation.error || 'File content could not be validated.'
      );
      return;
    }

    // Send validated content to renderer if window is still valid
    if (targetWindow && !targetWindow.isDestroyed()) {
      const fileData: FileOpenData = {
        filePath: filepath,
        content: validation.content,
        name: path.basename(filepath)
      };
      targetWindow.webContents.send('file-open', fileData);

      // Add to recent files list
      addRecentFile(filepath);
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    console.error('Failed to read file:', sanitizeError(error));
    dialog.showErrorBox('Error', 'Failed to read file. Please try again.');
  }
};

// Tab drag and drop status tracking


if (!app.isPackaged) {
  ipcMain.on('log-debug', (_event, { message, data }) => {
    console.log(`[RENDERER-DEBUG] ${message}`, data ? JSON.stringify(data) : '');
  });
}

// File watcher IPC: renderer tells main which files to watch for external changes
ipcMain.on('watch-file', (event, data: unknown) => {
  if (!data || typeof data !== 'object' || !('filePath' in data)) return;
  const { filePath } = data as { filePath: string };
  if (typeof filePath !== 'string') return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) watchFile(filePath, win);
});

ipcMain.on('unwatch-file', (event, data: unknown) => {
  if (!data || typeof data !== 'object' || !('filePath' in data)) return;
  const { filePath } = data as { filePath: string };
  if (typeof filePath !== 'string') return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) unwatchFile(filePath, win);
});

// close-window: Refactored to use IPC validation wrapper
ipcMain.handle(
  'close-window',
  withIPCHandlerNoInput<void>({ handlerName: 'close-window' }, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.close();
    }
  })
);

ipcMain.handle(
  'open-external-url',
  withValidatedIPCHandler(
    { schema: OpenExternalUrlDataSchema, handlerName: 'open-external-url' },
    async (url: string, event): Promise<void> => {
      // Security: Comprehensive URL validation (HIGH-3 fix)
      // Uses allowlist approach with explicit blocklist for logging
      const validation = validateExternalUrl(url);
      if (!validation.isValid || !validation.sanitizedUrl) {
        console.warn(`[SECURITY] Blocked external URL: ${validation.error}`);
        throw new Error(validation.error || 'Invalid URL');
      }

      const sanitizedUrl = validation.sanitizedUrl;

      // Get the window to show the dialog
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        throw new Error('Window not found');
      }

      try {
        // Security: Show confirmation dialog before opening external URL
        // This prevents unintended navigation from malicious markdown content
        const result = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['Open in Browser', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
          title: 'Open External Link',
          message: 'Do you want to open this link in your default browser?',
          detail: sanitizedUrl,
        });

        // If user clicked "Open in Browser" (index 0)
        if (result.response === 0) {
          // Security: Use sanitized URL (normalized by URL parser)
          await shell.openExternal(sanitizedUrl);
          const parsedUrl = new URL(sanitizedUrl);
          console.log(`[SECURITY] Opened external URL: ${parsedUrl.origin}${parsedUrl.pathname}`);
        } else {
          console.log('[SECURITY] User cancelled external URL open');
        }
      } catch (err) {
        const error = err as Error;
        console.error('[SECURITY] Failed to open external URL:', error.message);
        throw new Error('Failed to open URL in browser');
      }
    }
  )
);

ipcMain.handle(
  'create-window-for-tab',
  withValidatedIPCHandler(
    { schema: CreateWindowForTabDataSchema, handlerName: 'create-window-for-tab' },
    async (data): Promise<void> => {
      const { filePath, content } = data;

      // Security: Validate content size
      if (content.length > SECURITY_CONFIG.MAX_CONTENT_SIZE) {
        const maxSizeMB = SECURITY_CONFIG.MAX_CONTENT_SIZE / (1024 * 1024);
        console.warn(`Content exceeds maximum size of ${maxSizeMB}MB`);
        throw new Error('Content too large');
      }

      // Security: Enforce window limit to prevent resource exhaustion
      if (getOpenWindowCount() >= SECURITY_CONFIG.MAX_WINDOWS) {
        console.warn(`Maximum window limit (${SECURITY_CONFIG.MAX_WINDOWS}) reached`);
        throw new Error('Too many windows open');
      }

      // Security: Sanitize filePath to prevent path traversal
      const safePath = filePath ? path.basename(filePath) : null;

      const win = createWindow(appPreferences, openFile);
      win.once('ready-to-show', () => {
        const fileData: FileOpenData = {
          filePath: safePath,
          content,
          name: safePath ? path.basename(safePath) : 'Untitled'
        };
        win.webContents.send('file-open', fileData);
      });
    }
  )
);

// export-pdf: Refactored to use Zod validation wrapper
ipcMain.handle(
  'export-pdf',
  withValidatedIPCHandler(
    { schema: ExportPdfDataSchema, handlerName: 'export-pdf' },
    async (data: ExportPdfDataInput, event): Promise<{ filePath?: string; error?: string }> => {
      const { content, filename } = data;

      // Security: Validate content size
      if (content.length > SECURITY_CONFIG.MAX_CONTENT_SIZE) {
        throw new Error('Content too large');
      }

      // Get the requesting window for dialog parent
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      if (!parentWindow) {
        throw new Error('Window not found');
      }

      // Show save dialog
      const result = await dialog.showSaveDialog(parentWindow, {
        title: 'Export PDF',
        defaultPath: filename.replace(/\.(md|markdown)$/, '.pdf'),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Cancelled');
      }

      // Create a temporary hidden window to render the content
      const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      try {
        // Generate HTML with inline CSS for PDF rendering
        const htmlContent = await generatePDFHTML(content);

        await pdfWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
        );

        // Ensure fonts are ready before printing (more reliable than a fixed timeout)
        try {
          await pdfWindow.webContents.executeJavaScript(
            'document.fonts ? document.fonts.ready : Promise.resolve()'
          );
        } catch {
          // Ignore font readiness errors and proceed to print
        }

        // Generate PDF
        const pdfData = await pdfWindow.webContents.printToPDF({
          printBackground: true,
          margins: {
            top: 0.5,
            bottom: 0.5,
            left: 0.5,
            right: 0.5,
          },
        });

        // Save to file
        await fsPromises.writeFile(result.filePath, pdfData);

        return { filePath: result.filePath };
      } catch (err) {
        console.error('PDF export error:', err);
        throw new Error('Failed to export PDF');
      } finally {
        // Security: Guaranteed cleanup to prevent memory leak (MEDIUM PRIORITY fix)
        pdfWindow.destroy();
      }
    }
  )
);

// save-file: Refactored to use Zod validation wrapper
ipcMain.handle(
  'save-file',
  withValidatedIPCHandler(
    { schema: SaveFileDataSchema, handlerName: 'save-file' },
    async (data: SaveFileDataInput, event): Promise<{ filePath?: string; error?: string }> => {
      const { content, filename, filePath } = data;

      // Security: Validate content size
      if (content.length > SECURITY_CONFIG.MAX_CONTENT_SIZE) {
        throw new Error('Content too large');
      }

      // Get the requesting window for dialog parent
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      if (!parentWindow) {
        throw new Error('Window not found');
      }

      // Determine default path
      // For new/untitled files (filePath is null), ALWAYS default to ~/Documents/
      // This overrides macOS's remembered last directory behavior
      const defaultDir = getDefaultSaveDirectory();
      const defaultPath = filePath ? filePath : path.join(defaultDir, filename);

      // Show save dialog with Markdown, PDF, and TXT options
      const result = await dialog.showSaveDialog(parentWindow, {
        title: 'Save As',
        defaultPath: defaultPath,
        filters: [
          { name: 'Markdown Files', extensions: ['md', 'markdown'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Cancelled');
      }

      // Determine format based on file extension
      const ext = path.extname(result.filePath).toLowerCase();

      if (ext === '.pdf') {
        // Export as PDF using existing PDF generation logic
        // Create a temporary hidden window to render the content
        const pdfWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });

        try {
          // Generate HTML with inline CSS for PDF rendering
          const htmlContent = await generatePDFHTML(content);

          await pdfWindow.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
          );

          // Ensure fonts are ready before printing (more reliable than a fixed timeout)
          try {
            await pdfWindow.webContents.executeJavaScript(
              'document.fonts ? document.fonts.ready : Promise.resolve()'
            );
          } catch {
            // Ignore font readiness errors and proceed to print
          }

          // Generate PDF
          const pdfData = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            margins: {
              top: 0.5,
              bottom: 0.5,
              left: 0.5,
              right: 0.5,
            },
          });

          // Save to file
          await fsPromises.writeFile(result.filePath, pdfData);

          return { filePath: result.filePath };
        } catch (pdfErr) {
          console.error('PDF export error:', pdfErr);
          throw new Error('Failed to export PDF');
        } finally {
          // Security: Guaranteed cleanup to prevent memory leak (MEDIUM PRIORITY fix)
          pdfWindow.destroy();
        }
      } else if (ext === '.txt') {
        // Save as plain text (convert markdown to text)
        try {
          const plainText = convertMarkdownToText(content);
          await fsPromises.writeFile(result.filePath, plainText, 'utf-8');
          return { filePath: result.filePath };
        } catch (txtErr) {
          console.error('Text export error:', txtErr);
          throw new Error('Failed to export text file');
        }
      } else {
        // Save as Markdown (default)
        await fsPromises.writeFile(result.filePath, content, 'utf-8');

        // Add to recent files if it's a markdown file
        if (ext === '.md' || ext === '.markdown') {
          addRecentFile(result.filePath);
        }

        return { filePath: result.filePath };
      }
    }
  )
);

// read-file: Refactored to use Zod validation wrapper
ipcMain.handle(
  'read-file',
  withValidatedIPCHandler(
    { schema: ReadFileDataSchema, handlerName: 'read-file' },
    async (data: ReadFileDataInput): Promise<{ content: string; error?: string }> => {
      const { filePath } = data;

      // Security: Validate file path to prevent path traversal and enforce allowed extensions
      if (!isPathSafe(filePath)) {
        console.warn(`Blocked attempt to read unsafe file: ${filePath}`);
        throw new Error('Invalid file type or path');
      }

      // Security: Check file size to prevent memory exhaustion
      const stats = await fsPromises.stat(filePath);
      if (stats.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
        const maxSizeMB = SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024);
        throw new Error(`File exceeds maximum size of ${maxSizeMB}MB`);
      }

      // Security: Read file as Buffer first for integrity validation (MEDIUM-2 fix)
      const buffer = await fsPromises.readFile(filePath);

      // Security: Validate file content integrity (UTF-8, BOM, binary detection)
      const validation = validateFileContent(buffer);
      if (!validation.valid || !validation.content) {
        console.warn(
          `[SECURITY] File integrity validation failed for: ${path.basename(filePath)}`
        );
        throw new Error(validation.error || 'File content could not be validated');
      }

      // Add to recent files (for drag-and-drop opened files)
      addRecentFile(filePath);

      return { content: validation.content };
    }
  )
);

ipcMain.handle(
  'show-unsaved-dialog',
  withValidatedIPCHandler(
    { schema: ShowUnsavedDialogDataSchema, handlerName: 'show-unsaved-dialog' },
    async (data, event): Promise<{ response: 'save' | 'dont-save' | 'cancel' }> => {
      const { filename } = data;

      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        return { response: 'cancel' };
      }

      try {
        const result = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Save', "Don't Save", 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          title: 'Unsaved Changes',
          message: `Do you want to save changes to "${filename}"?`,
          detail: 'Your changes will be lost if you don\'t save them.',
        });

        if (result.response === 0) return { response: 'save' };
        if (result.response === 1) return { response: 'dont-save' };
        return { response: 'cancel' };
      } catch (err) {
        console.error('Show unsaved dialog error:', err);
        return { response: 'cancel' };
      }
    }
  )
);

ipcMain.handle(
  'reveal-in-finder',
  withValidatedIPCHandler(
    { schema: RevealInFinderDataSchema, handlerName: 'reveal-in-finder' },
    async (data): Promise<void> => {
      const { filePath } = data;

      try {
        // Security: Validate file path to prevent path traversal
        if (!isPathSafe(filePath)) {
          console.warn(`Blocked attempt to reveal unsafe file: ${filePath}`);
          throw new Error('Invalid file path');
        }

        // Security: Verify file exists before revealing
        const stats = await fsPromises.stat(filePath);
        if (!stats.isFile()) {
          throw new Error('Path is not a file');
        }

        // Reveal file in Finder (macOS), Explorer (Windows), or file manager (Linux)
        shell.showItemInFolder(filePath);
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        console.error('Reveal in Finder error:', sanitizeError(error));
        throw new Error('Failed to reveal file');
      }
    }
  )
);

ipcMain.handle(
  'read-image-file',
  withValidatedIPCHandler(
    { schema: ReadImageFileDataSchema, handlerName: 'read-image-file' },
    async (data): Promise<{ dataUri: string }> => {
      const { imagePath, markdownFilePath } = data;

      try {
        // Security: Validate markdown file path to avoid writing/reading beside arbitrary paths
        if (!isPathSafe(markdownFilePath)) {
          throw new Error('Invalid markdown file path');
        }

        const markdownStats = await fsPromises.stat(markdownFilePath);
        if (!markdownStats.isFile()) {
          throw new Error('Markdown path is not a file');
        }

        // Security: Resolve paths to prevent traversal
        const resolvedMarkdownPath = path.resolve(markdownFilePath);
        const markdownDir = path.dirname(resolvedMarkdownPath);

        // If image path is relative, resolve it relative to markdown file directory
        let resolvedImagePath: string;
        if (path.isAbsolute(imagePath)) {
          resolvedImagePath = path.resolve(imagePath);
        } else {
          resolvedImagePath = path.resolve(markdownDir, imagePath);
        }

        // Security: Verify resolved image path is within markdown directory or its subdirectories
        // This prevents accessing files outside the markdown file's directory tree
        const relativePath = path.relative(markdownDir, resolvedImagePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          console.warn(`Blocked attempt to read image outside markdown directory: ${resolvedImagePath}`);
          throw new Error('Image path must be relative to markdown file');
        }

        // Security: Validate image file extension
        const ext = path.extname(resolvedImagePath).toLowerCase();
        const allowedExtensions = IMAGE_CONFIG.ALLOWED_IMAGE_EXTENSIONS as readonly string[];
        if (!allowedExtensions.includes(ext)) {
          console.warn(`Rejected image file with invalid extension: ${ext}`);
          throw new Error(`Invalid image type. Allowed: ${allowedExtensions.join(', ')}`);
        }

        // Security: Check file size to prevent memory exhaustion
        const stats = await fsPromises.stat(resolvedImagePath);
        if (stats.size > IMAGE_CONFIG.MAX_IMAGE_FILE_SIZE) {
          const maxSizeMB = IMAGE_CONFIG.MAX_IMAGE_FILE_SIZE / (1024 * 1024);
          throw new Error(`Image exceeds maximum size of ${maxSizeMB}MB`);
        }

        // Read file as buffer
        const buffer = await fsPromises.readFile(resolvedImagePath);

        // Determine MIME type based on extension
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp',
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Convert to base64 data URI
        const base64 = buffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        return { dataUri };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        console.error('Read image file error:', sanitizeError(error));
        throw new Error('Failed to read image file');
      }
    }
  )
);

ipcMain.handle(
  'copy-image-to-document',
  withValidatedIPCHandler(
    { schema: CopyImageToDocumentDataSchema, handlerName: 'copy-image-to-document' },
    async (data): Promise<{ relativePath: string }> => {
      const { imagePath, markdownFilePath } = data;

      try {
        // Security: Validate markdown file path to avoid writing beside arbitrary paths
        if (!isPathSafe(markdownFilePath)) {
          throw new Error('Invalid markdown file path');
        }

        const markdownStats = await fsPromises.stat(markdownFilePath);
        if (!markdownStats.isFile()) {
          throw new Error('Markdown path is not a file');
        }

        // Security: Resolve paths to prevent traversal
        const resolvedImagePath = path.resolve(imagePath);
        const resolvedMarkdownPath = path.resolve(markdownFilePath);

        // Security: Validate image file extension
        const ext = path.extname(resolvedImagePath).toLowerCase();
        const allowedExtensions = IMAGE_CONFIG.ALLOWED_IMAGE_EXTENSIONS as readonly string[];
        if (!allowedExtensions.includes(ext)) {
          console.warn(`Rejected image file with invalid extension: ${ext}`);
          throw new Error(`Invalid image type. Allowed: ${allowedExtensions.join(', ')}`);
        }

        // Security: Check source file size to prevent memory exhaustion
        const stats = await fsPromises.stat(resolvedImagePath);
        if (stats.size > IMAGE_CONFIG.MAX_IMAGE_FILE_SIZE) {
          const maxSizeMB = IMAGE_CONFIG.MAX_IMAGE_FILE_SIZE / (1024 * 1024);
          throw new Error(`Image exceeds maximum size of ${maxSizeMB}MB`);
        }

        // Create images directory next to markdown file
        const markdownDir = path.dirname(resolvedMarkdownPath);
        const imagesDir = path.join(markdownDir, 'images');
        await fsPromises.mkdir(imagesDir, { recursive: true });

        // Generate destination filename (handle collisions)
        const originalBasename = path.basename(resolvedImagePath);
        const baseName = path.basename(originalBasename, ext);
        let destFilename = originalBasename;
        let counter = 1;

        while (await fsPromises.access(path.join(imagesDir, destFilename)).then(() => true).catch(() => false)) {
          destFilename = `${baseName}-${counter}${ext}`;
          counter++;
        }

        const destPath = path.join(imagesDir, destFilename);

        // Copy the file
        await fsPromises.copyFile(resolvedImagePath, destPath);

        // Return relative path from markdown file
        const relativePath = `./images/${destFilename}`;
        return { relativePath };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        console.error('Copy image to document error:', sanitizeError(error));
        throw new Error('Failed to copy image file');
      }
    }
  )
);

ipcMain.handle(
  'save-image-from-data',
  withValidatedIPCHandler(
    { schema: SaveImageFromDataSchema, handlerName: 'save-image-from-data' },
    async (data): Promise<{ relativePath: string }> => {
      const { imageData, markdownFilePath } = data;

      try {
        // Security: Validate markdown file path to avoid writing beside arbitrary paths
        if (!isPathSafe(markdownFilePath)) {
          throw new Error('Invalid markdown file path');
        }

        const markdownStats = await fsPromises.stat(markdownFilePath);
        if (!markdownStats.isFile()) {
          throw new Error('Markdown path is not a file');
        }

        const resolvedMarkdownPath = path.resolve(markdownFilePath);

        // Parse data URI
        // Format: data:image/png;base64,.....
        const matches = imageData.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (!matches) {
          throw new Error('Invalid data URI format');
        }

        const ext = '.' + matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Security: Validate extension
        // Note: mime type handling might be slightly different than extensions (jpeg vs jpg).
        // We'll normalize generic check.
        if (!['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
          throw new Error('Invalid image type');
        }

        // Security: Check size
        if (buffer.length > IMAGE_CONFIG.MAX_IMAGE_FILE_SIZE) {
          throw new Error('Image too large');
        }

        // Create images directory
        const markdownDir = path.dirname(resolvedMarkdownPath);
        const imagesDir = path.join(markdownDir, 'images');
        await fsPromises.mkdir(imagesDir, { recursive: true });

        // Generate filename based on document name
        const docBasename = path.basename(resolvedMarkdownPath, path.extname(resolvedMarkdownPath));
        // Sanitize basename slightly to avoid really bad chars in image filenames,
        // but keep spaces if user uses them (as requested "match file name")
        // We mainly want to avoid chars that might be problematic in some filesystems/urls even if valid in doc names
        const invalidFilenameChars = new RegExp('[\\\\/:*?"<>|]', 'g');
        const safeDocName = docBasename.replace(invalidFilenameChars, '-');

        let counter = 1;
        let destFilename = `${safeDocName}-${counter}${ext}`;

        while (await fsPromises.access(path.join(imagesDir, destFilename)).then(() => true).catch(() => false)) {
          counter++;
          destFilename = `${safeDocName}-${counter}${ext}`;
        }

        const destPath = path.join(imagesDir, destFilename);
        await fsPromises.writeFile(destPath, buffer);

        const relativePath = `./images/${destFilename}`;
        return { relativePath };

      } catch (err) {
        console.error('Save image from data error:', err);
        throw new Error('Failed to save pasted image');
      }
    }
  )
);


// Handle file opening on macOS (must be registered BEFORE app.whenReady)
// This catches files opened via "Open With" or drag-and-drop onto app icon
app.on('open-file', (event: Electron.Event, filePath: string) => {
  event.preventDefault();

  if (mainWindow && !mainWindow.isDestroyed()) {
    // Window exists and is ready
    openFile(filePath);
  } else if (app.isReady()) {
    // App is ready but no valid window exists - create a new one
    mainWindow = createWindow(appPreferences, openFile, filePath);
  } else {
    // App not ready yet, queue the file
    pendingFileToOpen = filePath;
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
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

  // Load preferences and recent files from persistent storage
  await loadPreferences();
  await loadRecentFiles();

  createMenu(recentFiles, appPreferences, openFile, clearRecentFiles, savePreferences);
  mainWindow = createWindow(appPreferences, openFile);
  setMainWindow(mainWindow);

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
      mainWindow = createWindow(appPreferences, openFile);
      setMainWindow(mainWindow);
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
