import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    onFileOpen: (callback) => {
        const handler = (_event, value) => callback(value);
        ipcRenderer.on('file-open', handler);
        // Return cleanup function to remove listener
        return () => ipcRenderer.removeListener('file-open', handler);
    },
    createWindowForTab: (data) => ipcRenderer.invoke('create-window-for-tab', data),
    notifyTabDropped: (dragId) => ipcRenderer.invoke('tab-dropped', dragId),
    checkTabDropped: (dragId) => ipcRenderer.invoke('check-tab-dropped', dragId),
    closeWindow: () => ipcRenderer.invoke('close-window'),
});
