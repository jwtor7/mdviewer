import { useEffect } from 'react';
import { DEFAULT_DOCUMENT } from '../constants/index.js';

export const useFileHandler = (addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId, documents, closeTab) => {
  useEffect(() => {
    // Listen for file content from main process
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onFileOpen((value) => {
        // value is { filePath, content, name } or just string (legacy)
        const filePath = value.filePath || null;
        const fileContent = value.content || value;
        const fileName = value.name || 'Untitled';

        // Check if document with this path already exists
        const existing = findDocumentByPath(filePath);
        if (existing && filePath) {
          // Update existing document
          updateExistingDocument(existing.id, { content: fileContent });
          setActiveTabId(existing.id);
        } else {
          // Check if default untouched document exists
          const defaultDoc = documents.find(d =>
            d.id === 'default' &&
            d.filePath === null &&
            d.content === DEFAULT_DOCUMENT.content
          );

          if (defaultDoc && documents.length === 1) {
            // Replace default document with the new file
            updateExistingDocument('default', {
              name: fileName,
              content: fileContent,
              filePath,
              id: Date.now().toString(),
            });
          } else {
            // Add new document
            const newId = Date.now().toString();
            addDocument({
              id: newId,
              name: fileName,
              content: fileContent,
              filePath,
            });
          }
        }
      });

      // Cleanup listener on unmount or dependency change
      return cleanup;
    }
  }, [addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId, documents, closeTab]);
};
