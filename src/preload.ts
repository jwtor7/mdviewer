import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import type { ElectronAPI, FileOpenData } from './types/electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpen: (callback: (data: FileOpenData) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, value: FileOpenData): void => callback(value);
    ipcRenderer.on('file-open', handler);
    // Return cleanup function to remove listener
    return (): void => {
      ipcRenderer.removeListener('file-open', handler);
    };
  },
  onFileNew: (callback: () => void): (() => void) => {
    const handler = (_event: IpcRendererEvent): void => callback();
    ipcRenderer.on('file-new', handler);
    // Return cleanup function to remove listener
    return (): void => {
      ipcRenderer.removeListener('file-new', handler);
    };
  },
  onFileSave: (callback: () => void): (() => void) => {
    const handler = (_event: IpcRendererEvent): void => callback();
    ipcRenderer.on('file-save', handler);
    // Return cleanup function to remove listener
    return (): void => {
      ipcRenderer.removeListener('file-save', handler);
    };
  },
  onSaveAllAndQuit: (callback: () => void): (() => void) => {
    const handler = (_event: IpcRendererEvent): void => callback();
    ipcRenderer.on('save-all-and-quit', handler);
    // Return cleanup function to remove listener
    return (): void => {
      ipcRenderer.removeListener('save-all-and-quit', handler);
    };
  },
  onRequestUnsavedDocs: (callback: () => string[]): (() => void) => {
    const handler = (_event: IpcRendererEvent): void => {
      const docs = callback();
      ipcRenderer.send('unsaved-docs-response', docs);
    };
    ipcRenderer.on('request-unsaved-docs', handler);
    // Return cleanup function to remove listener
    return (): void => {
      ipcRenderer.removeListener('request-unsaved-docs', handler);
    };
  },
  createWindowForTab: (data: { filePath: string | null; content: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('create-window-for-tab', data),
  notifyTabDropped: (dragId: string): Promise<boolean> =>
    ipcRenderer.invoke('tab-dropped', dragId),
  checkTabDropped: (dragId: string): Promise<boolean> =>
    ipcRenderer.invoke('check-tab-dropped', dragId),
  closeWindow: (): Promise<void> =>
    ipcRenderer.invoke('close-window'),
  openExternalUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external-url', url),
  exportPDF: (data: { content: string; filename: string }): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('export-pdf', data),
  saveFile: (data: { content: string; filename: string; filePath: string | null }): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('save-file', data),
  readFile: (filePath: string): Promise<{ content: string; error?: string }> =>
    ipcRenderer.invoke('read-file', { filePath }),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  showUnsavedDialog: (filename: string): Promise<{ response: 'save' | 'dont-save' | 'cancel' }> =>
    ipcRenderer.invoke('show-unsaved-dialog', { filename }),
  getUnsavedDocuments: (): Promise<string[]> =>
    ipcRenderer.invoke('get-unsaved-documents'),
} satisfies ElectronAPI);
