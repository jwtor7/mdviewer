import { useState, useCallback, useRef } from 'react';
import { DEFAULT_DOCUMENT } from '../constants/index.js';
import type { Document } from '../types/document.js';

// Undo/Redo history configuration
const MAX_HISTORY_SIZE = 100;
const DEBOUNCE_MS = 300; // Group rapid changes into single history entry

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
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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

    setDocuments(prev => prev.map(doc =>
      doc.id === activeTabId ? { ...doc, content: newContent } : doc
    ));
  }, [activeTabId, documents, getHistory]);

  const addDocument = (doc: Partial<Document>): string => {
    const newDoc: Document = {
      id: doc.id || Date.now().toString(),
      name: doc.name || 'Untitled',
      content: doc.content || '',
      filePath: doc.filePath || null,
    };
    setDocuments(prev => [...prev, newDoc]);
    setActiveTabId(newDoc.id);
    return newDoc.id;
  };

  const updateExistingDocument = (id: string, updates: DocumentUpdate): void => {
    setDocuments(prev => prev.map(doc =>
      doc.id === id ? { ...doc, ...updates } : doc
    ));
  };

  const findDocumentByPath = (filePath: string): Document | undefined => {
    return documents.find(d => d.filePath === filePath);
  };

  const closeTab = (id: string): void => {
    // Calculate new state outside of setters
    const newDocs = documents.filter(d => d.id !== id);

    // Clean up history for closed document
    historyRef.current.delete(id);
    lastUpdateRef.current.delete(id);

    if (newDocs.length === 0) {
      const defaultDoc: Document = { id: 'default', name: 'Untitled', content: '', filePath: null };
      setDocuments([defaultDoc]);
      setActiveTabId('default');
      return;
    }

    // If closing the active tab, switch to the last tab
    if (activeTabId === id) {
      setActiveTabId(newDocs[newDocs.length - 1].id);
    }

    setDocuments(newDocs);
  };

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
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
