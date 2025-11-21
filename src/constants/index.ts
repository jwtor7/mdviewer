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

export interface Document {
  id: string;
  name: string;
  content: string;
  filePath: string | null;
}

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
