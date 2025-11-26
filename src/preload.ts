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
} satisfies ElectronAPI);
