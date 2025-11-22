export const WINDOW_CONFIG = {
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 600,
} as const;

export const EDITOR_CONFIG = {
  FONT_FAMILY: 'monospace',
  FONT_SIZE: '14px',
  PADDING: '20px',
} as const;

export const CALCULATIONS = {
  TOKEN_ESTIMATE_DIVISOR: 4,
  FOCUS_RESTORE_DELAY: 0,
} as const;

import type { Document } from '../types/document';

export const DEFAULT_DOCUMENT: Document = {
  id: 'default',
  name: 'Untitled',
  content: '# Welcome to Markdown Viewer\n\nStart typing or open a file to begin.',
  filePath: null,
};

export const THEME_MODES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export const VIEW_MODES = {
  PREVIEW: 'preview',
  CODE: 'code',
} as const;

export type ThemeMode = typeof THEME_MODES[keyof typeof THEME_MODES];
export type ViewMode = typeof VIEW_MODES[keyof typeof VIEW_MODES];

export const ERROR_DISPLAY_DURATION = 5000;

export const DEBOUNCE_DELAY = 300;

// Security Configuration
export const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB - Maximum file size for markdown files
  MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB - Maximum content size for IPC messages
  MAX_WINDOWS: 10, // Maximum number of concurrent windows
  MAX_DROPPED_TABS: 1000, // Maximum number of drag-drop operations to track
  ALLOWED_EXTENSIONS: ['.md', '.markdown'] as const, // Allowed file extensions
  RATE_LIMIT: {
    MAX_CALLS: 100, // Maximum IPC calls per window
    WINDOW_MS: 1000, // Rate limit window in milliseconds
  },
} as const;
