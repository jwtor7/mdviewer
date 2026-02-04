import { app } from 'electron';
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'node:fs';

/**
 * Maximum number of recent files to store.
 */
export const MAX_RECENT_FILES = 50;

/**
 * Gets the path to the recent files storage JSON file.
 * Stored in the app's userData directory for persistence across sessions.
 */
export const getRecentFilesPath = (): string => {
  return path.join(app.getPath('userData'), 'recent-files.json');
};

/**
 * Loads recent files list from persistent storage.
 * Uses async file operations to avoid blocking the main thread.
 *
 * @returns Array of recent file paths
 */
export const loadRecentFiles = async (): Promise<string[]> => {
  try {
    const recentFilesPath = getRecentFilesPath();
    // Check if file exists before reading
    try {
      await fsPromises.access(recentFilesPath);
    } catch {
      // File doesn't exist, use empty array
      return [];
    }

    const data = await fsPromises.readFile(recentFilesPath, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.filter((file): file is string => typeof file === 'string');
    }
    return [];
  } catch (error) {
    console.error('Failed to load recent files:', error);
    return [];
  }
};

/**
 * Saves recent files list to persistent storage.
 * Uses async file operations with debouncing to avoid blocking the main thread.
 *
 * @param recentFiles - Array of recent file paths to save
 * @returns A promise that resolves when the save is complete
 */
let saveRecentFilesTimeout: NodeJS.Timeout | null = null;

export const saveRecentFiles = (recentFiles: string[]): Promise<void> => {
  return new Promise((resolve) => {
    // Debounce saves to avoid excessive disk writes
    if (saveRecentFilesTimeout) {
      clearTimeout(saveRecentFilesTimeout);
    }

    saveRecentFilesTimeout = setTimeout(async () => {
      try {
        const recentFilesPath = getRecentFilesPath();
        const dir = path.dirname(recentFilesPath);
        // Ensure directory exists
        await fsPromises.mkdir(dir, { recursive: true });
        await fsPromises.writeFile(recentFilesPath, JSON.stringify(recentFiles, null, 2), 'utf-8');
      } catch (error) {
        console.error('Failed to save recent files:', error);
      } finally {
        resolve();
      }
    }, 500); // 500ms debounce
  });
};

/**
 * Adds a file to the recent files list.
 * Removes duplicates and maintains max size.
 *
 * @param filePath - The file path to add to recent files
 * @param recentFiles - The current list of recent files (will be modified)
 * @returns The updated recent files array
 */
export const addRecentFile = (filePath: string, recentFiles: string[]): string[] => {
  // Remove if already exists (to move it to front)
  const updated = recentFiles.filter(f => f !== filePath);

  // Add to front
  updated.unshift(filePath);

  // Limit to MAX_RECENT_FILES
  if (updated.length > MAX_RECENT_FILES) {
    updated.splice(MAX_RECENT_FILES);
  }

  return updated;
};

/**
 * Filters out non-existent files from the recent files list.
 * Updates the list to remove files that no longer exist on disk.
 *
 * @param recentFiles - The list of recent file paths
 * @returns The filtered list containing only existing files
 */
export const filterExistingFiles = (recentFiles: string[]): string[] => {
  return recentFiles.filter(filePath => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });
};
