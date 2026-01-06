import { app } from 'electron';
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';

/**
 * Preferences interface for app-wide settings.
 */
export interface AppPreferences {
  alwaysOnTop: boolean;
}

/**
 * Default preferences when none are stored.
 */
const DEFAULT_PREFERENCES: AppPreferences = {
  alwaysOnTop: false
};

/**
 * Gets the path to the preferences storage JSON file.
 * Stored in the app's userData directory for persistence across sessions.
 */
export const getPreferencesPath = (): string => {
  return path.join(app.getPath('userData'), 'preferences.json');
};

/**
 * Loads app preferences from persistent storage.
 * Uses async file operations to avoid blocking the main thread.
 *
 * @returns The loaded preferences
 */
export const loadPreferences = async (): Promise<AppPreferences> => {
  try {
    const preferencesPath = getPreferencesPath();
    // Check if file exists before reading
    try {
      await fsPromises.access(preferencesPath);
    } catch {
      // File doesn't exist, use defaults
      return DEFAULT_PREFERENCES;
    }

    const data = await fsPromises.readFile(preferencesPath, 'utf-8');
    const parsed = JSON.parse(data);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : false
      };
    }
    return DEFAULT_PREFERENCES;
  } catch (error) {
    console.error('Failed to load preferences:', error);
    return DEFAULT_PREFERENCES;
  }
};

/**
 * Saves app preferences to persistent storage.
 * Uses async file operations with debouncing to avoid blocking the main thread.
 *
 * @param preferences - The preferences to save
 * @returns A promise that resolves when the save is complete
 */
let savePreferencesTimeout: NodeJS.Timeout | null = null;

export const savePreferences = (preferences: AppPreferences): Promise<void> => {
  return new Promise((resolve) => {
    // Debounce saves to avoid excessive disk writes
    if (savePreferencesTimeout) {
      clearTimeout(savePreferencesTimeout);
    }

    savePreferencesTimeout = setTimeout(async () => {
      try {
        const preferencesPath = getPreferencesPath();
        const dir = path.dirname(preferencesPath);
        // Ensure directory exists
        await fsPromises.mkdir(dir, { recursive: true });
        await fsPromises.writeFile(preferencesPath, JSON.stringify(preferences, null, 2), 'utf-8');
      } catch (error) {
        console.error('Failed to save preferences:', error);
      } finally {
        resolve();
      }
    }, 500); // 500ms debounce
  });
};
