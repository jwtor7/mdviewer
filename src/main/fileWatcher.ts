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

  try {
    const watcher = fs.watch(resolved, { persistent: false }, (eventType) => {
      if (eventType !== 'change') return;

      const entry = watchers.get(resolved);
      if (!entry) return;

      // Debounce: fs.watch fires multiple events per write
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
    });

    watcher.on('error', (err) => {
      console.error(`[FileWatcher] Error watching ${path.basename(resolved)}:`, err.message);
      unwatchFile(resolved, window);
    });

    watchers.set(resolved, { watcher, windows: new Set([window]), debounceTimer: null });
  } catch (err) {
    console.error(`[FileWatcher] Failed to watch ${path.basename(resolved)}:`, (err as Error).message);
  }
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
