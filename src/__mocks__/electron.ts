/**
 * Mock for Electron module
 *
 * This mock is used for testing components and code that imports from 'electron'.
 * It provides minimal implementations of Electron APIs needed for tests.
 */

import { vi } from 'vitest';

export const ipcRenderer = {
  on: vi.fn(),
  send: vi.fn(),
  invoke: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

export const contextBridge = {
  exposeInMainWorld: vi.fn(),
};

export const webUtils = {
  getPathForFile: vi.fn((file: File) => `/mock/path/${file.name}`),
};

export const app = {
  getPath: vi.fn((name: string) => `/mock/${name}`),
  getName: vi.fn(() => 'mdviewer'),
  getVersion: vi.fn(() => '2.8.8'),
  quit: vi.fn(),
  on: vi.fn(),
};

export const BrowserWindow = vi.fn(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  on: vi.fn(),
  webContents: {
    send: vi.fn(),
    openDevTools: vi.fn(),
  },
  show: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
}));

export const dialog = {
  showOpenDialog: vi.fn(() => Promise.resolve({ filePaths: [], canceled: false })),
  showSaveDialog: vi.fn(() => Promise.resolve({ filePath: undefined, canceled: false })),
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0, checkboxChecked: false })),
};

export const Menu = {
  buildFromTemplate: vi.fn(),
  setApplicationMenu: vi.fn(),
};

export const shell = {
  openExternal: vi.fn(() => Promise.resolve()),
};

// Default export (some imports might use default)
export default {
  ipcRenderer,
  contextBridge,
  webUtils,
  app,
  BrowserWindow,
  dialog,
  Menu,
  shell,
};
