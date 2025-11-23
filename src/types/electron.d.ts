export interface FileOpenData {
  filePath: string | null;
  content: string;
  name: string;
}

export interface PDFExportData {
  content: string;
  filename: string;
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
  | { channel: 'export-pdf'; data: PDFExportData };

export interface ElectronAPI {
  onFileOpen: (callback: (data: FileOpenData) => void) => () => void;
  createWindowForTab: (data: { filePath: string | null; content: string }) => Promise<{ success: boolean }>;
  notifyTabDropped: (dragId: string) => Promise<boolean>;
  checkTabDropped: (dragId: string) => Promise<boolean>;
  closeWindow: () => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  exportPDF: (data: PDFExportData) => Promise<{ success: boolean; filePath?: string; error?: string }>;
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
