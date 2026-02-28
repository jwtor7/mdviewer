/**
 * Test setup file for Vitest
 *
 * This file runs before all test files and sets up:
 * - @testing-library/jest-dom matchers
 * - Browser API mocks (matchMedia, Electron APIs)
 * - Global test utilities
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test automatically
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
});

// Mock window.matchMedia (required for theme tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, // Default to light mode
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated but still used by some libraries
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Electron API (window.electronAPI)
const mockElectronAPI = {
  // IPC event listeners (return cleanup functions)
  onFileOpen: vi.fn(() => vi.fn()), // Returns cleanup function
  onFileNew: vi.fn(() => vi.fn()),
  onFileSave: vi.fn(() => vi.fn()),
  onSaveAllAndQuit: vi.fn(() => vi.fn()),
  onRequestUnsavedDocs: vi.fn(() => vi.fn()),
  onFormatText: vi.fn(() => vi.fn()),
  onToggleWordWrap: vi.fn(() => vi.fn()),
  onCloseTab: vi.fn(() => vi.fn()),

  // IPC invoke functions
  createWindowForTab: vi.fn(() => Promise.resolve({ success: true, data: undefined })),
  closeWindow: vi.fn(() => Promise.resolve()),
  openExternalUrl: vi.fn(() => Promise.resolve({ success: true, data: undefined })),
  exportPDF: vi.fn(() => Promise.resolve({ success: true, data: { filePath: '/test/path.pdf' } })),
  saveFile: vi.fn(() => Promise.resolve({ success: true, data: { filePath: '/test/path.md' } })),
  readFile: vi.fn(() => Promise.resolve({ success: true, data: { content: 'test content' } })),
  getPathForFile: vi.fn((file: File) => `/mock/path/${file.name}`),
  showUnsavedDialog: vi.fn(() => Promise.resolve({ success: true, data: { response: 'dont-save' as const } })),
  revealInFinder: vi.fn(() => Promise.resolve({ success: true, data: undefined })),
  readImageFile: vi.fn(() => Promise.resolve({ success: true, data: { dataUri: 'data:image/png;base64,test' } })),
  copyImageToDocument: vi.fn(() => Promise.resolve({ success: true, data: { relativePath: './images/test.png' } })),
  saveImageFromData: vi.fn(() => Promise.resolve({ success: true, data: { relativePath: './images/pasted.png' } })),
  logDebug: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

// Export mocks for test file access
export { mockElectronAPI };

// Mock HTMLElement methods that aren't implemented in jsdom
HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver (required for CodeEditor tests)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Suppress console errors during tests (optional - remove if you want to see them)
// const originalError = console.error;
// beforeAll(() => {
//   console.error = (...args: unknown[]) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('Not implemented: HTMLFormElement.prototype.submit')
//     ) {
//       return;
//     }
//     originalError.call(console, ...args);
//   };
// });

// afterAll(() => {
//   console.error = originalError;
// });
