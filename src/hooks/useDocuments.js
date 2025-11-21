import { useState } from 'react';
import { DEFAULT_DOCUMENT } from '../constants/index.js';

export const useDocuments = () => {
  const [documents, setDocuments] = useState([DEFAULT_DOCUMENT]);
  const [activeTabId, setActiveTabId] = useState('default');

  const activeDoc = documents.find(d => d.id === activeTabId) || documents[0];

  const updateContent = (newContent) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === activeTabId ? { ...doc, content: newContent } : doc
    ));
  };

  const addDocument = (doc) => {
    const newDoc = {
      id: doc.id || Date.now().toString(),
      name: doc.name || 'Untitled',
      content: doc.content || '',
      filePath: doc.filePath || null,
    };
    setDocuments(prev => [...prev, newDoc]);
    setActiveTabId(newDoc.id);
    return newDoc.id;
  };

  const updateExistingDocument = (id, updates) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === id ? { ...doc, ...updates } : doc
    ));
  };

  const findDocumentByPath = (filePath) => {
    return documents.find(d => d.filePath === filePath);
  };

  const closeTab = (id) => {
    // Calculate new state outside of setters
    const newDocs = documents.filter(d => d.id !== id);

    if (newDocs.length === 0) {
      const defaultDoc = { id: 'default', name: 'Untitled', content: '', filePath: null };
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
