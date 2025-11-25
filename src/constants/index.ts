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
import { DEFAULT_CONTENT } from './defaultContent.js';

export const DEFAULT_DOCUMENT: Document = {
  id: 'default',
  name: 'Test Document',
  content: DEFAULT_CONTENT,
  filePath: null,
};

export const THEME_MODES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
  SOLARIZED_LIGHT: 'solarized-light',
  SOLARIZED_DARK: 'solarized-dark',
} as const;

export const VIEW_MODES = {
  RENDERED: 'rendered',
  RAW: 'raw',
  SPLIT: 'split',
  TEXT: 'text',
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

// Renderer-side security limits (for validation before processing)
export const RENDERER_SECURITY = {
  // Maximum content size to process in renderer (10MB matches IPC limit)
  // Prevents memory exhaustion from malicious drag-drop or IPC data
  MAX_CONTENT_LENGTH: 10 * 1024 * 1024, // 10MB in characters
  // Human-readable size for error messages
  MAX_CONTENT_SIZE_MB: 10,
} as const;

// External URL Security Configuration
// Controls which URLs can be opened from markdown links
export const URL_SECURITY = {
  // Only these protocols are allowed for external links
  ALLOWED_PROTOCOLS: ['https:', 'http:'] as const,

  // Explicitly blocked protocols (for security logging and documentation)
  // These are dangerous protocols that could:
  // - Execute code: javascript:, vbscript:
  // - Access local files: file://
  // - Embed malicious content: data:
  // - Trigger system handlers: ms-*, com.*, tel:, mailto: (excluding safe ones)
  BLOCKED_PROTOCOLS: [
    'javascript:',  // XSS attack vector
    'vbscript:',    // Windows script execution
    'file:',        // Local file access
    'data:',        // Inline content injection
    'blob:',        // Memory object access
    'about:',       // Browser internals
    'chrome:',      // Chrome internals
    'chrome-extension:', // Extension access
  ] as const,

  // Maximum URL length to prevent DoS via extremely long URLs
  MAX_URL_LENGTH: 2048,
} as const;

// File Integrity Validation Configuration
// Controls validation of file content to prevent binary/corrupted files
export const FILE_INTEGRITY = {
  // Maximum ratio of control characters to total content (10%)
  // Text files typically have < 1%, binary files have much higher ratios
  MAX_CONTROL_CHAR_RATIO: 0.1,

  // Control characters that are allowed in text files
  // These are normal whitespace/formatting characters
  ALLOWED_CONTROL_CHARS: ['\n', '\r', '\t'] as const,
} as const;
