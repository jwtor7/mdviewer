import { useState } from 'react';
import { DEFAULT_DOCUMENT } from '../constants/index.js';
import type { Document } from '../types/document.js';

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
}

export const useDocuments = (): UseDocumentsReturn => {
  const [documents, setDocuments] = useState<Document[]>([DEFAULT_DOCUMENT]);
  const [activeTabId, setActiveTabId] = useState<string>('default');

  const activeDoc = documents.find(d => d.id === activeTabId) || documents[0];

  const updateContent = (newContent: string): void => {
    setDocuments(prev => prev.map(doc =>
      doc.id === activeTabId ? { ...doc, content: newContent } : doc
    ));
  };

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
  };
};
