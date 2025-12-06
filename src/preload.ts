import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import type { ElectronAPI, FileOpenData } from './types/electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpen: (callback: (data: { content: string; filePath: string; name: string }) => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, data: { content: string; filePath: string; name: string }) => callback(data);
    ipcRenderer.on('file-open', subscription);
    return () => ipcRenderer.removeListener('file-open', subscription);
  },
  onFileNew: (callback: () => void): (() => void) => {
    const subscription = () => callback();
    ipcRenderer.on('file-new', subscription);
    return () => ipcRenderer.removeListener('file-new', subscription);
  },
  onFileSave: (callback: (request: any) => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, request: any) => callback(request);
    ipcRenderer.on('file-save', subscription);
    return () => ipcRenderer.removeListener('file-save', subscription);
  },
  onSaveAllAndQuit: (callback: () => void): (() => void) => {
    const subscription = () => callback();
    ipcRenderer.on('save-all-and-quit', subscription);
    return () => ipcRenderer.removeListener('save-all-and-quit', subscription);
  },
  onFormatText: (callback: (format: string) => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, format: string) => callback(format);
    ipcRenderer.on('format-text', subscription);
    return () => ipcRenderer.removeListener('format-text', subscription);
  },
  onToggleWordWrap: (callback: () => void): (() => void) => {
    const subscription = () => callback();
    ipcRenderer.on('toggle-word-wrap', subscription);
    return () => ipcRenderer.removeListener('toggle-word-wrap', subscription);
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
  onCloseTab: (callback: () => void): (() => void) => {
    const handler = (_event: IpcRendererEvent): void => callback();
    ipcRenderer.on('close-tab', handler);
    // Return cleanup function to remove listener
    return (): void => {
      ipcRenderer.removeListener('close-tab', handler);
    };
  },
  createWindowForTab: (data: { filePath: string | null; content: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('create-window-for-tab', data),
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
  revealInFinder: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('reveal-in-finder', { filePath }),
  readImageFile: (imagePath: string, markdownFilePath: string): Promise<{ dataUri?: string; error?: string }> =>
    ipcRenderer.invoke('read-image-file', { imagePath, markdownFilePath }),
  copyImageToDocument: (imagePath: string, markdownFilePath: string): Promise<{ relativePath?: string; error?: string }> =>
    ipcRenderer.invoke('copy-image-to-document', { imagePath, markdownFilePath }),
  saveImageFromData: (imageData: string, markdownFilePath: string): Promise<{ relativePath?: string; error?: string }> =>
    ipcRenderer.invoke('save-image-from-data', { imageData, markdownFilePath }),
  logDebug: (message: string, data?: any): void => ipcRenderer.send('log-debug', { message, data }),
} satisfies ElectronAPI);
