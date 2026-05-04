/**
 * Tests for fileWatcher module
 *
 * Focused on the isFileWatched helper used by the open-file handler in
 * src/main.ts to short-circuit re-opens of already-watched files (which
 * would otherwise steal focus and trigger the dirty-reload confirm dialog).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock'),
  },
  BrowserWindow: vi.fn(),
}));

import { watchFile, unwatchFile, isFileWatched } from './fileWatcher';

interface FakeWindow {
  isDestroyed: () => boolean;
  webContents: { send: (...args: unknown[]) => void };
}

function makeFakeWindow(): FakeWindow {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  };
}

describe('fileWatcher.isFileWatched', () => {
  let tmpDir: string;
  let mdFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdviewer-fw-'));
    mdFile = path.join(tmpDir, 'note.md');
    fs.writeFileSync(mdFile, '# hello');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('returns false when no watcher is registered', () => {
    expect(isFileWatched(mdFile)).toBe(false);
  });

  it('returns true after watchFile registers the path', () => {
    const win = makeFakeWindow() as unknown as Parameters<typeof watchFile>[1];
    watchFile(mdFile, win);
    expect(isFileWatched(mdFile)).toBe(true);
    unwatchFile(mdFile, win);
  });

  it('returns false again after the last window unwatches', () => {
    const win = makeFakeWindow() as unknown as Parameters<typeof watchFile>[1];
    watchFile(mdFile, win);
    unwatchFile(mdFile, win);
    expect(isFileWatched(mdFile)).toBe(false);
  });

  it('treats unresolved relative paths the same as resolved absolute paths', () => {
    const win = makeFakeWindow() as unknown as Parameters<typeof watchFile>[1];
    watchFile(mdFile, win);
    // path.resolve normalizes both inputs; isFileWatched must do the same lookup
    const relative = path.relative(process.cwd(), mdFile);
    expect(isFileWatched(relative)).toBe(true);
    unwatchFile(mdFile, win);
  });

  it('rejects disallowed extensions (no watcher created)', () => {
    const exeFile = path.join(tmpDir, 'malicious.exe');
    fs.writeFileSync(exeFile, 'MZ');
    const win = makeFakeWindow() as unknown as Parameters<typeof watchFile>[1];
    watchFile(exeFile, win);
    expect(isFileWatched(exeFile)).toBe(false);
  });
});
