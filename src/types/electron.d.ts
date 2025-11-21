export interface FileOpenData {
  filePath: string | null;
  content: string;
  name: string;
}

export interface ElectronAPI {
  onFileOpen: (callback: (data: FileOpenData) => void) => () => void;
  createWindowForTab: (data: { filePath: string | null; content: string }) => Promise<{ success: boolean }>;
  notifyTabDropped: (dragId: string) => Promise<boolean>;
  checkTabDropped: (dragId: string) => Promise<boolean>;
  closeWindow: () => Promise<void>;
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
