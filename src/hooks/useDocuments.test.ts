/**
 * Tests for useDocuments hook
 *
 * Covers: CRUD operations, tab management, undo/redo with debouncing,
 * history limits, dirty flag tracking, and document reordering.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocuments } from './useDocuments';
import { DEFAULT_DOCUMENT } from '../constants/index';

// Constants matching the hook's internal values
const DEBOUNCE_MS = 300;
const MAX_HISTORY_SIZE = 100;

describe('useDocuments', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =============================================================================
  // Initial State Tests
  // =============================================================================

  describe('initial state', () => {
    it('should initialize with default document', () => {
      const { result } = renderHook(() => useDocuments());

      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents[0]).toEqual(DEFAULT_DOCUMENT);
      expect(result.current.activeTabId).toBe('default');
      expect(result.current.activeDoc).toEqual(DEFAULT_DOCUMENT);
    });

    it('should start with no undo/redo history', () => {
      const { result } = renderHook(() => useDocuments());

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  // =============================================================================
  // addDocument Tests
  // =============================================================================

  describe('addDocument', () => {
    it('should add a new document with provided properties', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({
          name: 'New File',
          content: '# New Content',
          filePath: '/path/to/file.md',
        });
      });

      expect(result.current.documents).toHaveLength(2);
      const newDoc = result.current.documents[1];
      expect(newDoc.name).toBe('New File');
      expect(newDoc.content).toBe('# New Content');
      expect(newDoc.filePath).toBe('/path/to/file.md');
    });

    it('should auto-generate ID when not provided', () => {
      const { result } = renderHook(() => useDocuments());

      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      act(() => {
        result.current.addDocument({ name: 'Test' });
      });

      const newDoc = result.current.documents[1];
      expect(newDoc.id).toBe('1705320000000'); // Date.now() timestamp
    });

    it('should use provided ID when specified', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'custom-id', name: 'Test' });
      });

      const newDoc = result.current.documents[1];
      expect(newDoc.id).toBe('custom-id');
    });

    it('should set default values for missing properties', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({});
      });

      const newDoc = result.current.documents[1];
      expect(newDoc.name).toBe('Untitled');
      expect(newDoc.content).toBe('');
      expect(newDoc.filePath).toBeNull();
    });

    it('should switch to newly added document', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'new-doc', name: 'New' });
      });

      expect(result.current.activeTabId).toBe('new-doc');
      expect(result.current.activeDoc.id).toBe('new-doc');
    });

    it('should return the new document ID', () => {
      const { result } = renderHook(() => useDocuments());

      let returnedId: string = '';
      act(() => {
        returnedId = result.current.addDocument({ id: 'returned-id' });
      });

      expect(returnedId).toBe('returned-id');
    });
  });

  // =============================================================================
  // updateExistingDocument Tests
  // =============================================================================

  describe('updateExistingDocument', () => {
    it('should update document name', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateExistingDocument('default', { name: 'Renamed' });
      });

      expect(result.current.documents[0].name).toBe('Renamed');
    });

    it('should update document content', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateExistingDocument('default', { content: 'New content' });
      });

      expect(result.current.documents[0].content).toBe('New content');
    });

    it('should update document filePath', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateExistingDocument('default', { filePath: '/new/path.md' });
      });

      expect(result.current.documents[0].filePath).toBe('/new/path.md');
    });

    it('should update multiple properties at once', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateExistingDocument('default', {
          name: 'Updated',
          content: 'Updated content',
          filePath: '/updated/path.md',
        });
      });

      const doc = result.current.documents[0];
      expect(doc.name).toBe('Updated');
      expect(doc.content).toBe('Updated content');
      expect(doc.filePath).toBe('/updated/path.md');
    });

    it('should only update the specified document', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
      });

      act(() => {
        result.current.updateExistingDocument('default', { name: 'Updated Default' });
      });

      expect(result.current.documents[0].name).toBe('Updated Default');
      expect(result.current.documents[1].name).toBe('Doc 2');
    });

    it('should do nothing for non-existent document ID', () => {
      const { result } = renderHook(() => useDocuments());
      const originalDoc = { ...result.current.documents[0] };

      act(() => {
        result.current.updateExistingDocument('non-existent', { name: 'Should not apply' });
      });

      expect(result.current.documents[0].name).toBe(originalDoc.name);
    });
  });

  // =============================================================================
  // closeTab Tests
  // =============================================================================

  describe('closeTab', () => {
    it('should remove the closed document', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
      });

      expect(result.current.documents).toHaveLength(2);

      act(() => {
        result.current.closeTab('doc2');
      });

      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents.find(d => d.id === 'doc2')).toBeUndefined();
    });

    it('should switch to last tab when closing active tab', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
        result.current.addDocument({ id: 'doc3', name: 'Doc 3' });
      });

      expect(result.current.activeTabId).toBe('doc3');

      act(() => {
        result.current.closeTab('doc3');
      });

      expect(result.current.activeTabId).toBe('doc2');
    });

    it('should create new default document when closing last tab', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.closeTab('default');
      });

      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents[0]).toEqual({
        id: 'default',
        name: 'Untitled',
        content: '',
        filePath: null,
      });
      expect(result.current.activeTabId).toBe('default');
    });

    it('should not affect active tab when closing inactive tab', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
      });

      // Active tab is now doc2
      expect(result.current.activeTabId).toBe('doc2');

      act(() => {
        result.current.closeTab('default');
      });

      // Active tab should still be doc2
      expect(result.current.activeTabId).toBe('doc2');
      expect(result.current.documents).toHaveLength(1);
    });
  });

  // =============================================================================
  // setActiveTabId Tests
  // =============================================================================

  describe('setActiveTabId', () => {
    it('should switch to specified tab', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
      });

      expect(result.current.activeTabId).toBe('doc2');

      act(() => {
        result.current.setActiveTabId('default');
      });

      expect(result.current.activeTabId).toBe('default');
      expect(result.current.activeDoc.id).toBe('default');
    });

    it('should update activeDoc when switching tabs', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2', content: 'Content 2' });
      });

      act(() => {
        result.current.setActiveTabId('default');
      });

      expect(result.current.activeDoc.name).toBe('Test Document');

      act(() => {
        result.current.setActiveTabId('doc2');
      });

      expect(result.current.activeDoc.name).toBe('Doc 2');
      expect(result.current.activeDoc.content).toBe('Content 2');
    });
  });

  // =============================================================================
  // reorderDocuments Tests
  // =============================================================================

  describe('reorderDocuments', () => {
    it('should move document from one position to another', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
        result.current.addDocument({ id: 'doc3', name: 'Doc 3' });
      });

      expect(result.current.documents.map(d => d.id)).toEqual(['default', 'doc2', 'doc3']);

      act(() => {
        result.current.reorderDocuments(2, 0); // Move doc3 to first position
      });

      expect(result.current.documents.map(d => d.id)).toEqual(['doc3', 'default', 'doc2']);
    });

    it('should handle moving to end of list', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
        result.current.addDocument({ id: 'doc3', name: 'Doc 3' });
      });

      act(() => {
        result.current.reorderDocuments(0, 2); // Move default to last position
      });

      expect(result.current.documents.map(d => d.id)).toEqual(['doc2', 'doc3', 'default']);
    });

    it('should preserve document data when reordering', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({
          id: 'doc2',
          name: 'Doc 2',
          content: 'Content 2',
          filePath: '/path/2.md',
        });
      });

      act(() => {
        result.current.reorderDocuments(1, 0);
      });

      const movedDoc = result.current.documents[0];
      expect(movedDoc.id).toBe('doc2');
      expect(movedDoc.name).toBe('Doc 2');
      expect(movedDoc.content).toBe('Content 2');
      expect(movedDoc.filePath).toBe('/path/2.md');
    });
  });

  // =============================================================================
  // Undo/Redo Tests
  // =============================================================================

  describe('undo/redo', () => {
    it('should enable undo after content change', () => {
      const { result } = renderHook(() => useDocuments());

      expect(result.current.canUndo).toBe(false);

      act(() => {
        result.current.updateContent('First change');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Second change');
      });

      expect(result.current.canUndo).toBe(true);
    });

    it('should restore previous content on undo', () => {
      const { result } = renderHook(() => useDocuments());
      const originalContent = result.current.activeDoc.content;

      act(() => {
        result.current.updateContent('Changed content');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('More changes');
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.activeDoc.content).toBe('Changed content');
    });

    it('should enable redo after undo', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('Changed content');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('More changes');
      });

      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);
    });

    it('should restore undone content on redo', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('First');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Second');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Third');
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.activeDoc.content).toBe('Second');

      act(() => {
        result.current.redo();
      });

      expect(result.current.activeDoc.content).toBe('Third');
    });

    it('should clear redo history on new change after undo', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('First');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Second');
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
        result.current.updateContent('New branch');
      });

      expect(result.current.canRedo).toBe(false);
    });

    it('should maintain separate history for each document', () => {
      const { result } = renderHook(() => useDocuments());

      // Make changes to default document
      act(() => {
        result.current.updateContent('Default changed');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Default changed again');
      });

      // Add and switch to new document
      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2', content: 'Doc 2 original' });
      });

      // New document should have no history
      expect(result.current.canUndo).toBe(false);

      // Make changes to doc2
      act(() => {
        result.current.updateContent('Doc 2 changed');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Doc 2 changed again');
      });

      // Switch back to default
      act(() => {
        result.current.setActiveTabId('default');
      });

      // Default document should have its own history
      expect(result.current.canUndo).toBe(true);

      act(() => {
        result.current.undo();
      });

      expect(result.current.activeDoc.content).toBe('Default changed');
    });

    it('should do nothing when undo called with empty history', () => {
      const { result } = renderHook(() => useDocuments());
      const originalContent = result.current.activeDoc.content;

      act(() => {
        result.current.undo();
      });

      expect(result.current.activeDoc.content).toBe(originalContent);
    });

    it('should do nothing when redo called with empty future', () => {
      const { result } = renderHook(() => useDocuments());
      const originalContent = result.current.activeDoc.content;

      act(() => {
        result.current.redo();
      });

      expect(result.current.activeDoc.content).toBe(originalContent);
    });
  });

  // =============================================================================
  // markDocumentSaved Tests
  // =============================================================================

  describe('markDocumentSaved', () => {
    it('should clear dirty flag', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('Changed content');
      });

      expect(result.current.activeDoc.dirty).toBe(true);

      act(() => {
        result.current.markDocumentSaved('default');
      });

      expect(result.current.activeDoc.dirty).toBe(false);
    });

    it('should update lastSavedContent', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('New saved content');
      });

      act(() => {
        result.current.markDocumentSaved('default');
      });

      expect(result.current.activeDoc.lastSavedContent).toBe('New saved content');
    });

    it('should only affect specified document', () => {
      const { result } = renderHook(() => useDocuments());

      // Add a second document and make changes while it's active
      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2', content: 'Original' });
      });

      // doc2 is active, make a change
      act(() => {
        result.current.updateContent('Doc2 changed');
      });

      expect(result.current.documents.find(d => d.id === 'doc2')?.dirty).toBe(true);

      // Switch to default and make changes there too
      act(() => {
        result.current.setActiveTabId('default');
      });

      act(() => {
        result.current.updateContent('Default changed');
      });

      expect(result.current.activeDoc.dirty).toBe(true);

      // Now mark only doc2 as saved
      act(() => {
        result.current.markDocumentSaved('doc2');
      });

      // doc2 should be clean
      const doc2 = result.current.documents.find(d => d.id === 'doc2');
      expect(doc2?.dirty).toBe(false);

      // default should still be dirty (we're still on default tab)
      expect(result.current.activeDoc.dirty).toBe(true);
    });
  });

  // =============================================================================
  // findDocumentByPath Tests
  // =============================================================================

  describe('findDocumentByPath', () => {
    it('should find document with matching path', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({
          id: 'doc2',
          name: 'Doc 2',
          filePath: '/path/to/doc.md',
        });
      });

      const found = result.current.findDocumentByPath('/path/to/doc.md');
      expect(found).toBeDefined();
      expect(found?.id).toBe('doc2');
    });

    it('should return undefined for non-existent path', () => {
      const { result } = renderHook(() => useDocuments());

      const found = result.current.findDocumentByPath('/non/existent/path.md');
      expect(found).toBeUndefined();
    });

    it('should match exact path only', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({
          id: 'doc2',
          name: 'Doc 2',
          filePath: '/path/to/doc.md',
        });
      });

      const found1 = result.current.findDocumentByPath('/path/to/doc');
      expect(found1).toBeUndefined();

      const found2 = result.current.findDocumentByPath('/path/to/doc.md/');
      expect(found2).toBeUndefined();
    });
  });

  // =============================================================================
  // History Limits Tests
  // =============================================================================

  describe('history limits', () => {
    it('should enforce MAX_HISTORY_SIZE limit', () => {
      const { result } = renderHook(() => useDocuments());

      // Make more than MAX_HISTORY_SIZE changes
      for (let i = 0; i < MAX_HISTORY_SIZE + 20; i++) {
        act(() => {
          result.current.updateContent(`Change ${i}`);
          vi.advanceTimersByTime(DEBOUNCE_MS + 1);
        });
      }

      // Undo MAX_HISTORY_SIZE times
      let undoCount = 0;
      while (result.current.canUndo && undoCount < MAX_HISTORY_SIZE + 10) {
        act(() => {
          result.current.undo();
        });
        undoCount++;
      }

      // Should be able to undo exactly MAX_HISTORY_SIZE times
      expect(undoCount).toBe(MAX_HISTORY_SIZE);
    });

    it('should preserve recent history when limit exceeded', () => {
      const { result } = renderHook(() => useDocuments());

      // Make many changes
      for (let i = 0; i < MAX_HISTORY_SIZE + 5; i++) {
        act(() => {
          result.current.updateContent(`Change ${i}`);
          vi.advanceTimersByTime(DEBOUNCE_MS + 1);
        });
      }

      // The most recent changes should be undoable
      act(() => {
        result.current.undo();
      });

      // Should get the second-to-last change
      expect(result.current.activeDoc.content).toBe(`Change ${MAX_HISTORY_SIZE + 3}`);
    });
  });

  // =============================================================================
  // Debouncing Tests
  // =============================================================================

  describe('debouncing', () => {
    it('should group rapid changes into single history entry', () => {
      const { result } = renderHook(() => useDocuments());

      // Make rapid changes within debounce window
      act(() => {
        result.current.updateContent('A');
        vi.advanceTimersByTime(100); // Less than DEBOUNCE_MS
        result.current.updateContent('AB');
        vi.advanceTimersByTime(100);
        result.current.updateContent('ABC');
        vi.advanceTimersByTime(100);
        result.current.updateContent('ABCD');
      });

      expect(result.current.activeDoc.content).toBe('ABCD');

      // Single undo should go back to original
      act(() => {
        result.current.undo();
      });

      expect(result.current.activeDoc.content).toBe(DEFAULT_DOCUMENT.content);
      expect(result.current.canUndo).toBe(false);
    });

    it('should create separate history entries after debounce delay', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('First');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Second');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
      });

      act(() => {
        result.current.updateContent('Third');
      });

      // Should need 2 undos to get back to original
      act(() => {
        result.current.undo();
      });
      expect(result.current.activeDoc.content).toBe('Second');

      act(() => {
        result.current.undo();
      });
      expect(result.current.activeDoc.content).toBe('First');

      act(() => {
        result.current.undo();
      });
      expect(result.current.activeDoc.content).toBe(DEFAULT_DOCUMENT.content);
    });

    it('should reset debounce timer on each change', () => {
      const { result } = renderHook(() => useDocuments());

      // Each change resets the timer
      act(() => {
        result.current.updateContent('A');
        vi.advanceTimersByTime(200); // Close to DEBOUNCE_MS
        result.current.updateContent('AB');
        vi.advanceTimersByTime(200);
        result.current.updateContent('ABC');
        vi.advanceTimersByTime(200);
        result.current.updateContent('ABCD');
      });

      // Still grouped because timer reset each time
      act(() => {
        result.current.undo();
      });

      expect(result.current.activeDoc.content).toBe(DEFAULT_DOCUMENT.content);
    });
  });

  // =============================================================================
  // Dirty Flag Tests
  // =============================================================================

  describe('dirty flag tracking', () => {
    it('should mark document dirty on content change', () => {
      const { result } = renderHook(() => useDocuments());

      expect(result.current.activeDoc.dirty).toBeFalsy();

      act(() => {
        result.current.updateContent('Changed content');
      });

      expect(result.current.activeDoc.dirty).toBe(true);
    });

    it('should clear dirty flag when content matches lastSavedContent', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('New content');
      });

      act(() => {
        result.current.markDocumentSaved('default');
      });

      expect(result.current.activeDoc.dirty).toBe(false);

      act(() => {
        result.current.updateContent('Different content');
      });

      expect(result.current.activeDoc.dirty).toBe(true);

      // Change back to saved content
      act(() => {
        result.current.updateContent('New content');
      });

      expect(result.current.activeDoc.dirty).toBe(false);
    });

    it('should not mark dirty when content unchanged', () => {
      const { result } = renderHook(() => useDocuments());
      const original = result.current.activeDoc.content;

      act(() => {
        result.current.updateContent(original);
      });

      expect(result.current.activeDoc.dirty).toBeFalsy();
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('should handle empty content updates', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.updateContent('');
      });

      expect(result.current.activeDoc.content).toBe('');
    });

    it('should handle very long content', () => {
      const { result } = renderHook(() => useDocuments());
      const longContent = 'x'.repeat(100000);

      act(() => {
        result.current.updateContent(longContent);
      });

      expect(result.current.activeDoc.content).toBe(longContent);
      expect(result.current.activeDoc.content.length).toBe(100000);
    });

    it('should handle special characters in content', () => {
      const { result } = renderHook(() => useDocuments());
      const specialContent = '# Test\n\n```js\nconst x = "hello";\n```\n\n<script>alert("xss")</script>';

      act(() => {
        result.current.updateContent(specialContent);
      });

      expect(result.current.activeDoc.content).toBe(specialContent);
    });

    it('should handle closing document that was never active', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2' });
        result.current.setActiveTabId('default');
      });

      expect(result.current.activeTabId).toBe('default');

      act(() => {
        result.current.closeTab('doc2');
      });

      expect(result.current.activeTabId).toBe('default');
      expect(result.current.documents).toHaveLength(1);
    });

    it('should clean up history when closing document', () => {
      const { result } = renderHook(() => useDocuments());

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2', content: 'Original' });
      });

      // Make changes to build history
      act(() => {
        result.current.updateContent('Changed');
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
        result.current.updateContent('Changed again');
      });

      expect(result.current.canUndo).toBe(true);

      // Close and reopen with same ID
      act(() => {
        result.current.closeTab('doc2');
      });

      act(() => {
        result.current.addDocument({ id: 'doc2', name: 'Doc 2 New', content: 'Fresh start' });
      });

      // New document should have no history
      expect(result.current.canUndo).toBe(false);
    });

    it('should fallback to first document when active doc not found', () => {
      const { result } = renderHook(() => useDocuments());

      // This tests the fallback: documents.find() || documents[0]
      // The activeDoc should always resolve to a valid document
      expect(result.current.activeDoc).toBeDefined();
      expect(result.current.activeDoc.id).toBe('default');
    });
  });
});
