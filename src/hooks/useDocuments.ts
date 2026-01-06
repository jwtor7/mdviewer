import { useState, useCallback, useRef } from 'react';
import { DEFAULT_DOCUMENT } from '../constants/index.js';
import type { Document } from '../types/document.js';

// Undo/Redo history configuration
/** Maximum undo history entries per document to limit memory usage. Prevents unbounded growth during extended editing sessions. */
const MAX_HISTORY_SIZE = 100;
/** Debounce delay in milliseconds to group rapid consecutive changes into a single history entry, reducing noise and improving UX. */
const DEBOUNCE_MS = 300;

interface HistoryState {
  past: string[];
  future: string[];
}

export interface DocumentUpdate {
  name?: string;
  content?: string;
  filePath?: string | null;
  id?: string;
}

export interface UseDocumentsReturn {
  documents: Document[];
  activeDoc: Document;
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  updateContent: (newContent: string) => void;
  addDocument: (doc: Partial<Document>) => string;
  updateExistingDocument: (id: string, updates: DocumentUpdate) => void;
  findDocumentByPath: (filePath: string) => Document | undefined;
  closeTab: (id: string) => void;
  markDocumentSaved: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reorderDocuments: (fromIndex: number, toIndex: number) => void;
}

export const useDocuments = (): UseDocumentsReturn => {
  const [documents, setDocuments] = useState<Document[]>([DEFAULT_DOCUMENT]);
  const [activeTabId, setActiveTabId] = useState<string>('default');

  // Per-document history state
  const historyRef = useRef<Map<string, HistoryState>>(new Map());
  const lastUpdateRef = useRef<Map<string, number>>(new Map());

  // Force re-render when history changes
  const [historyVersion, setHistoryVersion] = useState(0);

  const activeDoc = documents.find(d => d.id === activeTabId) || documents[0];

  // Get or initialize history for a document
  const getHistory = useCallback((docId: string): HistoryState => {
    if (!historyRef.current.has(docId)) {
      historyRef.current.set(docId, { past: [], future: [] });
    }
    return historyRef.current.get(docId)!;
  }, []);

  const updateContent = useCallback((newContent: string): void => {
    const now = Date.now();
    const lastUpdate = lastUpdateRef.current.get(activeTabId) || 0;
    const history = getHistory(activeTabId);

    // Get current content before update
    const currentDoc = documents.find(d => d.id === activeTabId);
    const currentContent = currentDoc?.content || '';

    // Only add to history if content actually changed
    if (currentContent !== newContent) {
      // Debounce: only create new history entry if enough time passed
      if (now - lastUpdate > DEBOUNCE_MS) {
        // Push current state to past
        history.past = [...history.past, currentContent].slice(-MAX_HISTORY_SIZE);
      }
      // Clear future on new change (standard undo behavior)
      history.future = [];
      lastUpdateRef.current.set(activeTabId, now);
    }

    setDocuments(prev => prev.map(doc => {
      if (doc.id === activeTabId) {
        // Mark as dirty if content changed from last saved state
        const lastSaved = doc.lastSavedContent ?? doc.content;
        const isDirty = newContent !== lastSaved;
        return { ...doc, content: newContent, dirty: isDirty };
      }
      return doc;
    }));
  }, [activeTabId, documents, getHistory]);

  const addDocument = useCallback((doc: Partial<Document>): string => {
    const newDoc: Document = {
      id: doc.id || Date.now().toString(),
      name: doc.name || 'Untitled',
      content: doc.content || '',
      filePath: doc.filePath || null,
    };
    setDocuments(prev => [...prev, newDoc]);
    setActiveTabId(newDoc.id);
    return newDoc.id;
  }, []);

  const updateExistingDocument = useCallback((id: string, updates: DocumentUpdate): void => {
    setDocuments(prev => prev.map(doc =>
      doc.id === id ? { ...doc, ...updates } : doc
    ));
  }, []);

  const findDocumentByPath = useCallback((filePath: string): Document | undefined => {
    return documents.find(d => d.filePath === filePath);
  }, [documents]);

  const markDocumentSaved = useCallback((id: string): void => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === id) {
        return { ...doc, dirty: false, lastSavedContent: doc.content };
      }
      return doc;
    }));
  }, []);

  const closeTab = useCallback((id: string): void => {
    setDocuments(prev => {
      // Calculate new state
      const newDocs = prev.filter(d => d.id !== id);

      // Clean up history for closed document
      historyRef.current.delete(id);
      lastUpdateRef.current.delete(id);

      if (newDocs.length === 0) {
        const defaultDoc: Document = { id: 'default', name: 'Untitled', content: '', filePath: null };
        setActiveTabId('default');
        return [defaultDoc];
      }

      return newDocs;
    });

    // If closing the active tab, switch to the last tab
    setDocuments(currentDocs => {
      if (activeTabId === id && currentDocs.length > 0) {
        setActiveTabId(currentDocs[currentDocs.length - 1].id);
      }
      return currentDocs;
    });
  }, [activeTabId]);

  // Undo function
  const undo = useCallback((): void => {
    const history = getHistory(activeTabId);
    if (history.past.length === 0) return;

    const currentDoc = documents.find(d => d.id === activeTabId);
    const currentContent = currentDoc?.content || '';

    // Pop from past, push current to future
    const previous = history.past[history.past.length - 1];
    history.past = history.past.slice(0, -1);
    history.future = [currentContent, ...history.future];

    // Update document without creating new history entry
    setDocuments(prev => prev.map(doc =>
      doc.id === activeTabId ? { ...doc, content: previous } : doc
    ));

    // Force re-render to update canUndo/canRedo
    setHistoryVersion(v => v + 1);
  }, [activeTabId, documents, getHistory]);

  // Redo function
  const redo = useCallback((): void => {
    const history = getHistory(activeTabId);
    if (history.future.length === 0) return;

    const currentDoc = documents.find(d => d.id === activeTabId);
    const currentContent = currentDoc?.content || '';

    // Pop from future, push current to past
    const next = history.future[0];
    history.future = history.future.slice(1);
    history.past = [...history.past, currentContent];

    // Update document without creating new history entry
    setDocuments(prev => prev.map(doc =>
      doc.id === activeTabId ? { ...doc, content: next } : doc
    ));

    // Force re-render to update canUndo/canRedo
    setHistoryVersion(v => v + 1);
  }, [activeTabId, documents, getHistory]);

  // Computed values for UI state
  const history = getHistory(activeTabId);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Include historyVersion in dependencies to trigger re-renders
  void historyVersion;

  return {
    documents,
    activeDoc,
    activeTabId,
    setActiveTabId,
    updateContent,
    addDocument,
    updateExistingDocument,
    findDocumentByPath,
    closeTab,
    markDocumentSaved,
    undo,
    redo,
    canUndo,
    canRedo,
    reorderDocuments: useCallback((fromIndex: number, toIndex: number): void => {
      setDocuments(prev => {
        const newDocs = [...prev];
        const [movedDoc] = newDocs.splice(fromIndex, 1);
        newDocs.splice(toIndex, 0, movedDoc);
        return newDocs;
      });
    }, []),
  };
};
