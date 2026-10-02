/**
 * open-file event router.
 *
 * Pure logic for the four `app.on('open-file')` branches, extracted so the
 * focus-stealing behavior can be unit-tested without an Electron runtime.
 *
 * `app.on('open-file')` only fires for OS-level routing — Finder double-click,
 * drag-onto-icon, "Open With", `open file.md` from a terminal. Every such
 * event is by definition external. App-level defocus happens in `main.ts`
 * before routing so every branch, including no-op and cold-launch paths, gets
 * the same Launch Services activation workaround.
 *
 * Branches:
 *  (A) file already open in a tab        → no-op (file watcher refresh handles it)
 *  (B) main window exists, new file      → open in tab
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
}

export type OpenFileRouterResult =
  | { action: 'no-op-already-watched' }
  | { action: 'opened-existing-window' }
  | { action: 'created-window'; window: BrowserWindow; inactive: boolean }
  | { action: 'pending' };

export function routeOpenFile(deps: OpenFileRouterDeps): OpenFileRouterResult {
  const { filePath, mainWindow, isAppReady } = deps;

  if (mainWindow && !mainWindow.isDestroyed() && deps.isFileWatched(filePath)) {
    return { action: 'no-op-already-watched' };
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    deps.openFile(filePath);
    return { action: 'opened-existing-window' };
  }

  if (isAppReady) {
    const window = deps.createWindow(filePath, { inactive: true });
    return { action: 'created-window', window, inactive: true };
  }

  deps.setPendingFile(filePath);
  return { action: 'pending' };
}
