/**
 * open-file event router.
 *
 * Pure logic for the four `app.on('open-file')` branches, extracted so the
 * focus-stealing behavior can be unit-tested without an Electron runtime.
 *
 * Branches:
 *  (A) file already open in a tab        → no-op (file watcher refresh handles it)
 *  (B) main window exists, new file      → open in tab; hide app on darwin if unfocused
 *  (C) no window, app ready              → create window, inactive if unfocused
 *  (D) app not ready                     → queue as pending file
 */

import type { BrowserWindow } from 'electron';

export interface OpenFileRouterDeps {
  filePath: string;
  mainWindow: BrowserWindow | null;
  isAppReady: boolean;
  mdviewerHasFocus: boolean;
  platform: NodeJS.Platform;
  isFileWatched: (filePath: string) => boolean;
  openFile: (filePath: string) => void;
  createWindow: (filePath: string, options: { inactive: boolean }) => BrowserWindow;
  setPendingFile: (filePath: string) => void;
  hideApp: () => void;
}

export type OpenFileRouterResult =
  | { action: 'no-op-already-watched' }
  | { action: 'opened-existing-window'; hidApp: boolean }
  | { action: 'created-window'; window: BrowserWindow; inactive: boolean }
  | { action: 'pending' };

export function routeOpenFile(deps: OpenFileRouterDeps): OpenFileRouterResult {
  const { filePath, mainWindow, isAppReady, mdviewerHasFocus, platform } = deps;

  if (mainWindow && !mainWindow.isDestroyed() && deps.isFileWatched(filePath)) {
    return { action: 'no-op-already-watched' };
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    const wasUnfocused = !mdviewerHasFocus;
    deps.openFile(filePath);
    if (wasUnfocused && platform === 'darwin') {
      deps.hideApp();
      return { action: 'opened-existing-window', hidApp: true };
    }
    return { action: 'opened-existing-window', hidApp: false };
  }

  if (isAppReady) {
    const inactive = !mdviewerHasFocus;
    const window = deps.createWindow(filePath, { inactive });
    return { action: 'created-window', window, inactive };
  }

  deps.setPendingFile(filePath);
  return { action: 'pending' };
}
