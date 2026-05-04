/**
 * Tests for windowManager.createWindow.
 *
 * Focused on the new `inactive` option that lets externally-triggered
 * `app.on('open-file')` events create background tabs without stealing
 * focus from the user's current app.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Vite-injected globals consumed by windowManager. Stub before importing.
(globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined;
(globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_NAME = 'test';

interface RecordedHandler {
  event: string;
  fn: (...args: unknown[]) => void;
}

interface MockWindowInstance {
  args: Record<string, unknown>;
  handlers: RecordedHandler[];
  showInactive: ReturnType<typeof vi.fn>;
  loadURL: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
  setAlwaysOnTop: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  webContents: { on: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
  isDestroyed: () => boolean;
  once: (event: string, fn: (...args: unknown[]) => void) => void;
  on: (event: string, fn: (...args: unknown[]) => void) => void;
  triggerOnce: (event: string) => void;
}

const recorder = vi.hoisted(() => {
  const constructorArgs: Array<Record<string, unknown>> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdWindows: any[] = [];

  // Defined inside hoisted factory so it's available at the top of any
  // hoisted vi.mock call.
  class MockBrowserWindow {
    args: Record<string, unknown>;
    handlers: RecordedHandler[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    showInactive: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadURL: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadFile: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAlwaysOnTop: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destroy: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webContents: any;

    constructor(args: Record<string, unknown>) {
      this.args = args;
      this.showInactive = vi.fn();
      this.loadURL = vi.fn();
      this.loadFile = vi.fn();
      this.setAlwaysOnTop = vi.fn();
      this.destroy = vi.fn();
      this.webContents = { on: vi.fn(), send: vi.fn() };
      constructorArgs.push(args);
      createdWindows.push(this);
    }

    isDestroyed(): boolean {
      return false;
    }

    once(event: string, fn: (...args: unknown[]) => void): void {
      this.handlers.push({ event, fn });
    }

    on(event: string, fn: (...args: unknown[]) => void): void {
      this.handlers.push({ event, fn });
    }

    triggerOnce(event: string): void {
      for (const h of this.handlers.filter((h) => h.event === event)) {
        h.fn();
      }
    }
  }

  return { constructorArgs, createdWindows, MockBrowserWindow };
});

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/mock'), isReady: () => true },
  BrowserWindow: recorder.MockBrowserWindow,
  Menu: {
    setApplicationMenu: vi.fn(),
    buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })),
  },
  dialog: { showOpenDialog: vi.fn(), showMessageBox: vi.fn(), showErrorBox: vi.fn() },
  shell: { openExternal: vi.fn() },
  ipcMain: { on: vi.fn(), off: vi.fn(), removeListener: vi.fn() },
}));

vi.mock('./markitdown.js', () => ({
  getFileDialogFilters: () => [],
}));

vi.mock('./fileWatcher.js', () => ({
  unwatchAllForWindow: vi.fn(),
}));

import { createWindow } from './windowManager';

describe('createWindow inactive option', () => {
  beforeEach(() => {
    recorder.constructorArgs.length = 0;
    recorder.createdWindows.length = 0;
  });

  it('passes show=true to BrowserWindow when no options provided', () => {
    createWindow({ alwaysOnTop: false }, () => {});
    expect(recorder.constructorArgs[0].show).toBe(true);
  });

  it('passes show=false to BrowserWindow when inactive=true', () => {
    createWindow({ alwaysOnTop: false }, () => {}, null, { inactive: true });
    expect(recorder.constructorArgs[0].show).toBe(false);
  });

  it('passes show=true when inactive=false', () => {
    createWindow({ alwaysOnTop: false }, () => {}, null, { inactive: false });
    expect(recorder.constructorArgs[0].show).toBe(true);
  });

  it('calls showInactive on ready-to-show when inactive=true', () => {
    createWindow({ alwaysOnTop: false }, () => {}, null, { inactive: true });
    const win = recorder.createdWindows[0] as MockWindowInstance;
    win.triggerOnce('ready-to-show');
    expect(win.showInactive).toHaveBeenCalledTimes(1);
  });

  it('does not call showInactive when inactive=false', () => {
    createWindow({ alwaysOnTop: false }, () => {}, null, { inactive: false });
    const win = recorder.createdWindows[0] as MockWindowInstance;
    win.triggerOnce('ready-to-show');
    expect(win.showInactive).not.toHaveBeenCalled();
  });

  it('does not call showInactive when no options provided', () => {
    createWindow({ alwaysOnTop: false }, () => {});
    const win = recorder.createdWindows[0] as MockWindowInstance;
    win.triggerOnce('ready-to-show');
    expect(win.showInactive).not.toHaveBeenCalled();
  });

  it('still invokes onOpenFile handler when initialFile and inactive both set', () => {
    const onOpenFile = vi.fn();
    createWindow({ alwaysOnTop: false }, onOpenFile, '/tmp/file.md', { inactive: true });
    const win = recorder.createdWindows[0] as MockWindowInstance;
    win.triggerOnce('ready-to-show');
    expect(win.showInactive).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledWith('/tmp/file.md', win);
  });
});
