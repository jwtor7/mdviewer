import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    onFileOpen: (callback) => ipcRenderer.on('file-open', (_event, value) => callback(value)),
    createWindowForTab: (data) => ipcRenderer.invoke('create-window-for-tab', data),
});
