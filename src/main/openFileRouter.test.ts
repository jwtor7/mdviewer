/**
 * Tests for openFileRouter.
 *
 * Covers the four `app.on('open-file')` branches. The router always treats
 * external open-file events as background events: every successful route
 * either hides mdviewer (existing window) or opens an inactive window.
 */

import { describe, it, expect, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { routeOpenFile, type OpenFileRouterDeps } from './openFileRouter';

function makeFakeWindow(destroyed = false): BrowserWindow {
  return {
    isDestroyed: () => destroyed,
  } as unknown as BrowserWindow;
}

function makeDeps(overrides: Partial<OpenFileRouterDeps> = {}): OpenFileRouterDeps {
  const fakeWindow = makeFakeWindow();
  return {
    filePath: '/tmp/file.md',
    mainWindow: fakeWindow,
    isAppReady: true,
    platform: 'darwin',
    isFileWatched: vi.fn().mockReturnValue(false),
    openFile: vi.fn(),
    createWindow: vi.fn().mockReturnValue(fakeWindow),
    setPendingFile: vi.fn(),
    hideApp: vi.fn(),
    ...overrides,
  };
}

describe('routeOpenFile', () => {
  describe('branch (A): file already watched', () => {
    it('no-ops when an existing window has the file watched', () => {
      const deps = makeDeps({ isFileWatched: vi.fn().mockReturnValue(true) });
      const result = routeOpenFile(deps);
      expect(result).toEqual({ action: 'no-op-already-watched' });
      expect(deps.openFile).not.toHaveBeenCalled();
      expect(deps.hideApp).not.toHaveBeenCalled();
      expect(deps.createWindow).not.toHaveBeenCalled();
      expect(deps.setPendingFile).not.toHaveBeenCalled();
    });

    it('does not no-op when window is destroyed (treats as no window)', () => {
      const deps = makeDeps({
        mainWindow: makeFakeWindow(true),
        isFileWatched: vi.fn().mockReturnValue(true),
      });
      const result = routeOpenFile(deps);
      // Destroyed window short-circuits before isFileWatched is consulted; we
      // fall through to the "create window" branch.
      expect(result.action).toBe('created-window');
    });
  });

  describe('branch (B): existing window, new file', () => {
    it('opens file and hides app on darwin', () => {
      const deps = makeDeps({ platform: 'darwin' });
      const result = routeOpenFile(deps);
      expect(result).toEqual({ action: 'opened-existing-window', hidApp: true });
      expect(deps.openFile).toHaveBeenCalledWith('/tmp/file.md');
      expect(deps.hideApp).toHaveBeenCalledTimes(1);
    });

    it('opens file but does not hide app on non-darwin platforms', () => {
      const deps = makeDeps({ platform: 'linux' });
      const result = routeOpenFile(deps);
      expect(result).toEqual({ action: 'opened-existing-window', hidApp: false });
      expect(deps.openFile).toHaveBeenCalledWith('/tmp/file.md');
      expect(deps.hideApp).not.toHaveBeenCalled();
    });
  });

  describe('branch (C): no window, app ready', () => {
    it('creates window inactive', () => {
      const newWindow = makeFakeWindow();
      const deps = makeDeps({
        mainWindow: null,
        createWindow: vi.fn().mockReturnValue(newWindow),
      });
      const result = routeOpenFile(deps);
      expect(deps.createWindow).toHaveBeenCalledWith('/tmp/file.md', { inactive: true });
      expect(result).toEqual({ action: 'created-window', window: newWindow, inactive: true });
    });

    it('treats destroyed window the same as no window', () => {
      const deps = makeDeps({
        mainWindow: makeFakeWindow(true),
      });
      routeOpenFile(deps);
      expect(deps.createWindow).toHaveBeenCalledWith('/tmp/file.md', { inactive: true });
    });
  });

  describe('branch (D): app not ready', () => {
    it('queues file as pending when no window and app not ready', () => {
      const deps = makeDeps({
        mainWindow: null,
        isAppReady: false,
      });
      const result = routeOpenFile(deps);
      expect(result).toEqual({ action: 'pending' });
      expect(deps.setPendingFile).toHaveBeenCalledWith('/tmp/file.md');
      expect(deps.createWindow).not.toHaveBeenCalled();
      expect(deps.openFile).not.toHaveBeenCalled();
    });
  });
});
