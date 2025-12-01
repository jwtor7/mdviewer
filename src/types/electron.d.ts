export interface FileOpenData {
  filePath: string | null;
  content: string;
  name: string;
}

export interface PDFExportData {
  content: string;
  filename: string;
}

export interface SaveFileData {
  content: string;
  filename: string;
  filePath: string | null;
}

/**
 * Discriminated union representing all IPC message types in the application.
 *
 * This type provides compile-time safety for IPC communication between the main
 * and renderer processes. Each message type includes:
 * - channel: The IPC channel identifier
 * - data: The payload type for that specific channel
 *
 * @example
 * // In main process handler:
 * ipcMain.handle('file-open', (event, data: Extract<IPCMessage, { channel: 'file-open' }>['data']) => {
 *   // data is correctly typed as FileOpenData
 * });
 */
export type IPCMessage =
  /** Sent when a file should be opened in the renderer */
  | { channel: 'file-open'; data: FileOpenData }
  /** Request to create a new window for a tab that was dragged out */
  | { channel: 'create-window-for-tab'; data: { filePath: string | null; content: string } }
  /** Notify that a tab was dropped (for drag-and-drop tracking) */
  | { channel: 'notify-tab-dropped'; data: { dragId: string } }
  /** Check if a tab was dropped (for drag-and-drop validation) */
  | { channel: 'check-tab-dropped'; data: { dragId: string } }
  /** Request to close the current window */
  | { channel: 'close-window'; data: void }
  /** Request to open an external URL in the default browser */
  | { channel: 'open-external-url'; data: { url: string } }
  /** Request to export document as PDF */
  | { channel: 'export-pdf'; data: PDFExportData }
  /** Request to save file to disk */
  | { channel: 'save-file'; data: SaveFileData }
  /** Request to read a file securely */
  | { channel: 'read-file'; data: { filePath: string } }
  /** Show confirmation dialog for unsaved changes */
  | { channel: 'show-unsaved-dialog'; data: { filename: string } }
  /** Get list of unsaved document names */
  | { channel: 'get-unsaved-documents'; data: void }
  /** Reveal file in Finder (macOS), Explorer (Windows), or file manager (Linux) */
  | { channel: 'reveal-in-finder'; data: { filePath: string } }
  /** Read an image file and return as base64 data URI */
  | { channel: 'read-image-file'; data: { imagePath: string; markdownFilePath: string } }
  /** Copy an image file to the document's images directory */
  | { channel: 'copy-image-to-document'; data: { imagePath: string; markdownFilePath: string } };

export interface ElectronAPI {
  onFileOpen: (callback: (data: FileOpenData) => void) => () => void;
  onFileNew: (callback: () => void) => () => void;
  onFileSave: (callback: () => void) => () => void;
  onSaveAllAndQuit: (callback: () => void) => () => void;
  onFormatText: (callback: (format: string) => void) => () => void;
  onToggleWordWrap: (callback: () => void) => () => void;
  onRequestUnsavedDocs: (callback: () => string[]) => () => void;
  createWindowForTab: (data: { filePath: string | null; content: string }) => Promise<{ success: boolean }>;
  notifyTabDropped: (dragId: string) => Promise<boolean>;
  checkTabDropped: (dragId: string) => Promise<boolean>;
  closeWindow: () => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  exportPDF: (data: PDFExportData) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  saveFile: (data: SaveFileData) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  readFile: (filePath: string) => Promise<{ content: string; error?: string }>;
  getPathForFile: (file: File) => string;
  showUnsavedDialog: (filename: string) => Promise<{ response: 'save' | 'dont-save' | 'cancel' }>;
  getUnsavedDocuments: () => Promise<string[]>;
  revealInFinder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  readImageFile: (imagePath: string, markdownFilePath: string) => Promise<{ dataUri?: string; error?: string }>;
  copyImageToDocument: (imagePath: string, markdownFilePath: string) => Promise<{ relativePath?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
    MAIN_WINDOW_VITE_NAME: string;
  }
}

// Vite global constants injected by Electron Forge
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Make these available in main process as well
declare global {
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const MAIN_WINDOW_VITE_NAME: string;
}
