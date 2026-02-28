/**
 * Tests for useFileHandler hook
 *
 * Covers: IPC listener setup/cleanup, file content validation, duplicate detection,
 * default document replacement, new tab creation, file path handling, error handling,
 * and new file creation with numbered Untitled documents.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileHandler } from './useFileHandler';
import { RENDERER_SECURITY, DEFAULT_DOCUMENT } from '../constants/index';
import type { Document } from '../types/document';
import { mockElectronAPI } from '../test/setup';

describe('useFileHandler', () => {
  // Mock callbacks
  let mockAddDocument: ReturnType<typeof vi.fn>;
  let mockUpdateExistingDocument: ReturnType<typeof vi.fn>;
  let mockFindDocumentByPath: ReturnType<typeof vi.fn>;
  let mockSetActiveTabId: ReturnType<typeof vi.fn>;
  let mockCloseTab: ReturnType<typeof vi.fn>;
  let mockShowError: ReturnType<typeof vi.fn>;
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnNewFile: ReturnType<typeof vi.fn>;

  // Test data
  let testDocuments: Document[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize mock functions
    mockAddDocument = vi.fn(() => 'new-id');
    mockUpdateExistingDocument = vi.fn();
    mockFindDocumentByPath = vi.fn();
    mockSetActiveTabId = vi.fn();
    mockCloseTab = vi.fn();
    mockShowError = vi.fn();
    mockOnSave = vi.fn();
    mockOnNewFile = vi.fn();

    // Initialize test documents
    testDocuments = [
      {
        id: 'default',
        name: 'Untitled',
        content: DEFAULT_DOCUMENT.content,
        filePath: null,
      },
    ];

    // Mock electronAPI listeners
    (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
    (mockElectronAPI.onFileNew as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
    (mockElectronAPI.onFileSave as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =============================================================================
  // IPC Listener Setup Tests
  // =============================================================================

  describe('IPC listener setup', () => {
    it('should register onFileOpen listener on mount', () => {
      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      expect(mockElectronAPI.onFileOpen).toHaveBeenCalled();
    });

    it('should register onFileNew listener on mount', () => {
      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      expect(mockElectronAPI.onFileNew).toHaveBeenCalled();
    });

    it('should register onFileSave listener when onSave callback provided', () => {
      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError,
          mockOnSave
        )
      );

      expect(mockElectronAPI.onFileSave).toHaveBeenCalled();
    });

    it('should not register onFileSave listener when onSave callback not provided', () => {
      (mockElectronAPI.onFileSave as ReturnType<typeof vi.fn>).mockClear();

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
          // No onSave callback provided
        )
      );

      // onFileSave should NOT be called when onSave callback is not provided
      expect(mockElectronAPI.onFileSave).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Cleanup Tests
  // =============================================================================

  describe('cleanup on unmount', () => {
    it('should call cleanup function for onFileOpen on unmount', () => {
      const mockCleanup = vi.fn();
      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockReturnValue(mockCleanup);

      const { unmount } = renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      unmount();
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should call cleanup function for onFileNew on unmount', () => {
      const mockCleanup = vi.fn();
      (mockElectronAPI.onFileNew as ReturnType<typeof vi.fn>).mockReturnValue(mockCleanup);

      const { unmount } = renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      unmount();
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should call cleanup function for onFileSave on unmount when callback provided', () => {
      const mockCleanup = vi.fn();
      (mockElectronAPI.onFileSave as ReturnType<typeof vi.fn>).mockReturnValue(mockCleanup);

      const { unmount } = renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError,
          mockOnSave
        )
      );

      unmount();
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // File Content Validation Tests
  // =============================================================================

  describe('file content validation', () => {
    it('should reject content exceeding MAX_CONTENT_LENGTH', () => {
      const oversizedContent = 'x'.repeat(RENDERER_SECURITY.MAX_CONTENT_LENGTH + 1);
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/test/file.md',
          content: oversizedContent,
          name: 'Large File',
        });
      });

      expect(mockShowError).toHaveBeenCalledWith(
        `File too large. Maximum size is ${RENDERER_SECURITY.MAX_CONTENT_SIZE_MB}MB.`
      );
      expect(mockAddDocument).not.toHaveBeenCalled();
    });

    it('should accept content at MAX_CONTENT_LENGTH boundary', () => {
      const maxContent = 'x'.repeat(RENDERER_SECURITY.MAX_CONTENT_LENGTH);
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      const multiDocs = [
        {
          id: 'default',
          name: 'Untitled',
          content: DEFAULT_DOCUMENT.content,
          filePath: null,
        },
        {
          id: 'doc2',
          name: 'Other',
          content: 'Other',
          filePath: null,
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          multiDocs,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/test/file.md',
          content: maxContent,
          name: 'Max File',
        });
      });

      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockAddDocument).toHaveBeenCalled();
    });

    it('should accept normal-sized content', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      const multiDocs = [
        {
          id: 'default',
          name: 'Untitled',
          content: DEFAULT_DOCUMENT.content,
          filePath: null,
        },
        {
          id: 'doc2',
          name: 'Other',
          content: 'Other',
          filePath: null,
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          multiDocs,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/test/file.md',
          content: '# Hello\n\nThis is a test file.',
          name: 'Test.md',
        });
      });

      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockAddDocument).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Duplicate Detection Tests
  // =============================================================================

  describe('duplicate detection', () => {
    it('should update existing document when file with same path opened', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      const existingDoc: Document = {
        id: 'existing',
        name: 'Test.md',
        content: 'Old content',
        filePath: '/path/to/test.md',
      };

      mockFindDocumentByPath.mockReturnValue(existingDoc);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/path/to/test.md',
          content: 'New content',
          name: 'Test.md',
        });
      });

      expect(mockUpdateExistingDocument).toHaveBeenCalledWith('existing', {
        content: 'New content',
      });
      expect(mockSetActiveTabId).toHaveBeenCalledWith('existing');
      expect(mockAddDocument).not.toHaveBeenCalled();
    });

    it('should find document by exact path match', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/exact/path.md',
          content: 'Test content',
          name: 'Test.md',
        });
      });

      expect(mockFindDocumentByPath).toHaveBeenCalledWith('/exact/path.md');
    });

    it('should not search by path when filePath is null', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      const multiDocs = [
        {
          id: 'default',
          name: 'Untitled',
          content: DEFAULT_DOCUMENT.content,
          filePath: null,
        },
        {
          id: 'doc2',
          name: 'Other',
          content: 'Other',
          filePath: null,
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          multiDocs,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: null,
          content: 'Test content',
          name: 'Untitled',
        });
      });

      // Should never call findDocumentByPath when filePath is null
      expect(mockFindDocumentByPath).not.toHaveBeenCalled();
      expect(mockAddDocument).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Default Document Replacement Tests
  // =============================================================================

  describe('default document replacement', () => {
    it('should replace default untouched document when it is the only document', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      const defaultDocs = [
        {
          id: 'default',
          name: 'Untitled',
          content: DEFAULT_DOCUMENT.content,
          filePath: null,
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          defaultDocs,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/new/file.md',
          content: 'New content',
          name: 'File.md',
        });
      });

      expect(mockUpdateExistingDocument).toHaveBeenCalledWith('default', {
        name: 'File.md',
        content: 'New content',
        filePath: '/new/file.md',
      });
      expect(mockAddDocument).not.toHaveBeenCalled();
    });

    it('should not replace default document when it has been modified', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      const modifiedDefaultDocs = [
        {
          id: 'default',
          name: 'Untitled',
          content: 'User has typed here',
          filePath: null,
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          modifiedDefaultDocs,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/new/file.md',
          content: 'New content',
          name: 'File.md',
        });
      });

      expect(mockUpdateExistingDocument).not.toHaveBeenCalled();
      expect(mockAddDocument).toHaveBeenCalled();
    });

    it('should not replace default document when there are multiple documents', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      const multipleDocs = [
        {
          id: 'default',
          name: 'Untitled',
          content: DEFAULT_DOCUMENT.content,
          filePath: null,
        },
        {
          id: 'doc2',
          name: 'Other.md',
          content: 'Other content',
          filePath: '/path/other.md',
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          multipleDocs,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/new/file.md',
          content: 'New content',
          name: 'File.md',
        });
      });

      expect(mockUpdateExistingDocument).not.toHaveBeenCalled();
      expect(mockAddDocument).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // New Tab Creation Tests
  // =============================================================================

  describe('new tab creation', () => {
    it('should create new document when file not found and default not replaceable', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      const multipleDocs = [
        {
          id: 'default',
          name: 'Untitled',
          content: DEFAULT_DOCUMENT.content,
          filePath: null,
        },
        {
          id: 'other',
          name: 'Other',
          content: 'Other content',
          filePath: null,
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          multipleDocs,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/test/file.md',
          content: 'Test content',
          name: 'File.md',
        });
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.name).toBe('File.md');
      expect(callArg.content).toBe('Test content');
      expect(callArg.filePath).toBe('/test/file.md');
      expect(callArg.id).toBeUndefined();
    });
  });

  // =============================================================================
  // File Path Handling Tests
  // =============================================================================

  describe('file path handling', () => {
    it('should extract filePath from FileOpenData object', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          [
            {
              id: 'default',
              name: 'Other',
              content: 'Other',
              filePath: null,
            },
          ],
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/Users/john/Documents/file.md',
          content: 'Content',
          name: 'file.md',
        });
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.filePath).toBe('/Users/john/Documents/file.md');
    });

    it('should handle null filePath for unsaved documents', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          [
            {
              id: 'default',
              name: 'Other',
              content: 'Other',
              filePath: null,
            },
          ],
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: null,
          content: 'Content',
          name: 'Untitled',
        });
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.filePath).toBeNull();
    });
  });

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('error handling', () => {
    it('should handle legacy string-only file data format', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          [
            {
              id: 'default',
              name: 'Other',
              content: 'Other',
              filePath: null,
            },
          ],
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.('Legacy string content');
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.content).toBe('Legacy string content');
      expect(callArg.name).toBe('Untitled');
      expect(callArg.filePath).toBeNull();
    });

    it('should handle FileOpenData with missing optional fields', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          [
            {
              id: 'default',
              name: 'Other',
              content: 'Other',
              filePath: null,
            },
          ],
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/path/file.md',
          content: 'Content',
          name: 'file.md',
        });
      });

      expect(mockAddDocument).toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // File New Event Tests (Numbered Untitled Documents)
  // =============================================================================

  describe('onFileNew event - numbered Untitled documents', () => {
    it('should create numbered Untitled when one Untitled exists', () => {
      let fileNewCallback: (() => void) | null = null;

      (mockElectronAPI.onFileNew as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: () => void) => {
          fileNewCallback = cb;
          return vi.fn();
        }
      );

      // testDocuments contains 'Untitled', so next should be 'Untitled 2'
      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError,
          undefined,
          mockOnNewFile
        )
      );

      act(() => {
        fileNewCallback?.();
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.name).toBe('Untitled 2');
      expect(callArg.content).toBe('');
      expect(callArg.filePath).toBeNull();
    });

    it('should create first Untitled when no Untitled documents exist', () => {
      let fileNewCallback: (() => void) | null = null;

      (mockElectronAPI.onFileNew as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: () => void) => {
          fileNewCallback = cb;
          return vi.fn();
        }
      );

      const noUntitledDocs = [
        {
          id: 'doc1',
          name: 'README.md',
          content: '# Test',
          filePath: '/path/readme.md',
        },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          noUntitledDocs,
          mockCloseTab,
          mockShowError,
          undefined,
          mockOnNewFile
        )
      );

      act(() => {
        fileNewCallback?.();
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.name).toBe('Untitled');
    });

    it('should skip gaps in Untitled numbering', () => {
      let fileNewCallback: (() => void) | null = null;

      (mockElectronAPI.onFileNew as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: () => void) => {
          fileNewCallback = cb;
          return vi.fn();
        }
      );

      const docsWithGap = [
        { id: 'doc1', name: 'Untitled', content: '', filePath: null },
        { id: 'doc2', name: 'Untitled 2', content: '', filePath: null },
        // Untitled 3 doesn't exist
        { id: 'doc4', name: 'Untitled 4', content: '', filePath: null },
      ];

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          docsWithGap,
          mockCloseTab,
          mockShowError,
          undefined,
          mockOnNewFile
        )
      );

      act(() => {
        fileNewCallback?.();
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.name).toBe('Untitled 5');
    });

    it('should create empty document for file-new event', () => {
      let fileNewCallback: (() => void) | null = null;

      (mockElectronAPI.onFileNew as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: () => void) => {
          fileNewCallback = cb;
          return vi.fn();
        }
      );

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError,
          undefined,
          mockOnNewFile
        )
      );

      act(() => {
        fileNewCallback?.();
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.content).toBe('');
      expect(callArg.filePath).toBeNull();
    });

    it('should call onNewFile callback when provided', () => {
      let fileNewCallback: (() => void) | null = null;

      (mockElectronAPI.onFileNew as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: () => void) => {
          fileNewCallback = cb;
          return vi.fn();
        }
      );

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError,
          undefined,
          mockOnNewFile
        )
      );

      expect(mockOnNewFile).not.toHaveBeenCalled();

      act(() => {
        fileNewCallback?.();
      });

      expect(mockOnNewFile).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // File Save Event Tests
  // =============================================================================

  describe('onFileSave event', () => {
    it('should call onSave callback when file-save event fires', () => {
      let fileSaveCallback: (() => void) | null = null;

      (mockElectronAPI.onFileSave as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: () => void) => {
          fileSaveCallback = cb;
          return vi.fn();
        }
      );

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError,
          mockOnSave
        )
      );

      expect(mockOnSave).not.toHaveBeenCalled();

      act(() => {
        fileSaveCallback?.();
      });

      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Edge Cases and Integration Tests
  // =============================================================================

  describe('edge cases and integration', () => {
    it('should handle empty file content', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          testDocuments,
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/test/empty.md',
          content: '',
          name: 'empty.md',
        });
      });

      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockUpdateExistingDocument).toHaveBeenCalledWith('default', {
        name: 'empty.md',
        content: '',
        filePath: '/test/empty.md',
      });
    });

    it('should handle file with special characters in name', () => {
      let fileOpenCallback: ((value: any) => void) | null = null;

      (mockElectronAPI.onFileOpen as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (value: any) => void) => {
          fileOpenCallback = cb;
          return vi.fn();
        }
      );

      mockFindDocumentByPath.mockReturnValue(undefined);

      renderHook(() =>
        useFileHandler(
          mockAddDocument,
          mockUpdateExistingDocument,
          mockFindDocumentByPath,
          mockSetActiveTabId,
          [
            {
              id: 'default',
              name: 'Other',
              content: 'Other',
              filePath: null,
            },
          ],
          mockCloseTab,
          mockShowError
        )
      );

      act(() => {
        fileOpenCallback?.({
          filePath: '/path/file-with-special_chars.md',
          content: 'Content',
          name: 'file-with-special_chars.md',
        });
      });

      const callArg = mockAddDocument.mock.calls[0][0];
      expect(callArg.name).toBe('file-with-special_chars.md');
    });
  });
});
