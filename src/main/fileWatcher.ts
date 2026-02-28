/**
 * File Watcher Module
 *
 * Watches open markdown files for external changes and notifies
 * renderer windows via IPC. Debounces rapid fs.watch events and
 * tracks watchers per-window for proper cleanup.
 */

import { BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { isPathSafe } from './security/pathValidation.js';

interface WatcherEntry {
  watcher: fs.FSWatcher;
  windows: Set<BrowserWindow>;
  debounceTimer: NodeJS.Timeout | null;
}

const watchers = new Map<string, WatcherEntry>();

/** Debounce delay for fs.watch events (fires multiple times per save) */
const DEBOUNCE_MS = 250;

/**
 * Notify all windows watching a given file path that it changed.
 * Debounced to coalesce rapid fs.watch events.
 */
function notifyChange(resolved: string): void {
  const entry = watchers.get(resolved);
  if (!entry) return;

  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
  }

  entry.debounceTimer = setTimeout(() => {
    entry.debounceTimer = null;
    for (const win of entry.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('file-changed', { filePath: resolved });
      }
    }
  }, DEBOUNCE_MS);
}

/**
 * Create (or re-create) the fs.watch watcher for a resolved path.
 * Preserves the existing window set if re-creating after a rename event.
 */
function createWatcher(resolved: string, windows: Set<BrowserWindow>): void {
  try {
    const watcher = fs.watch(resolved, { persistent: false }, (eventType) => {
      // Handle both 'change' and 'rename' events.
      // macOS editors often use atomic saves (write temp + rename),
      // which fires 'rename' instead of 'change'.
      notifyChange(resolved);

      // After a 'rename', the watcher may be stale (inode changed).
      // Re-create it so we keep watching the new file at the same path.
      if (eventType === 'rename') {
        const entry = watchers.get(resolved);
        if (!entry) return;
        entry.watcher.close();

        // Brief delay: the file may not exist yet mid-atomic-write
        setTimeout(() => {
          try {
            fs.accessSync(resolved);
            createWatcher(resolved, entry.windows);
          } catch {
            // File was deleted, not replaced — stop watching
            watchers.delete(resolved);
          }
        }, 100);
      }
    });

    watcher.on('error', (err) => {
      console.error(`[FileWatcher] Error watching ${path.basename(resolved)}:`, err.message);
      const entry = watchers.get(resolved);
      if (entry) {
        entry.watcher.close();
        watchers.delete(resolved);
      }
    });

    watchers.set(resolved, { watcher, windows, debounceTimer: null });
  } catch (err) {
    console.error(`[FileWatcher] Failed to watch ${path.basename(resolved)}:`, (err as Error).message);
  }
}

/**
 * Start watching a file for external changes.
 * Multiple windows can watch the same file; the watcher is shared.
 */
export function watchFile(filePath: string, window: BrowserWindow): void {
  const resolved = path.resolve(filePath);

  // Security: only watch markdown files
  if (!isPathSafe(resolved)) return;

  const existing = watchers.get(resolved);
  if (existing) {
    existing.windows.add(window);
    return;
  }

  createWatcher(resolved, new Set([window]));
}

/**
 * Stop watching a file for a specific window.
 * Closes the watcher entirely when no windows remain.
 */
export function unwatchFile(filePath: string, window: BrowserWindow): void {
  const resolved = path.resolve(filePath);
  const entry = watchers.get(resolved);
  if (!entry) return;

  entry.windows.delete(window);

  if (entry.windows.size === 0) {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close();
    watchers.delete(resolved);
  }
}

/**
 * Remove all watchers for a specific window (called on window close).
 */
export function unwatchAllForWindow(window: BrowserWindow): void {
  for (const [filePath, entry] of watchers) {
    entry.windows.delete(window);
    if (entry.windows.size === 0) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
      entry.watcher.close();
      watchers.delete(filePath);
    }
  }
}
