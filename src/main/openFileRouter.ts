/**
 * open-file event router.
 *
 * Pure logic for the four `app.on('open-file')` branches, extracted so the
 * focus-stealing behavior can be unit-tested without an Electron runtime.
 *
 * `app.on('open-file')` only fires for OS-level routing — Finder double-click,
 * drag-onto-icon, "Open With", `open file.md` from a terminal. Every such
 * event is by definition external, so we never bring mdviewer to the
 * foreground from this path. The previous focus-state heuristic was racy:
 * macOS activates the app before delivering the open-file event, so the
 * focus flag had already flipped to true by the time we checked it.
 *
 * Branches:
 *  (A) file already open in a tab        → no-op (file watcher refresh handles it)
 *  (B) main window exists, new file      → open in tab; hide app on darwin
 *  (C) no window, app ready              → create window inactive
 *  (D) app not ready                     → queue as pending file
 */

import type { BrowserWindow } from 'electron';

export interface OpenFileRouterDeps {
  filePath: string;
  mainWindow: BrowserWindow | null;
  isAppReady: boolean;
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
  const { filePath, mainWindow, isAppReady, platform } = deps;

  if (mainWindow && !mainWindow.isDestroyed() && deps.isFileWatched(filePath)) {
    return { action: 'no-op-already-watched' };
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    deps.openFile(filePath);
    if (platform === 'darwin') {
      deps.hideApp();
      return { action: 'opened-existing-window', hidApp: true };
    }
    return { action: 'opened-existing-window', hidApp: false };
  }

  if (isAppReady) {
    const window = deps.createWindow(filePath, { inactive: true });
    return { action: 'created-window', window, inactive: true };
  }

  deps.setPendingFile(filePath);
  return { action: 'pending' };
}
