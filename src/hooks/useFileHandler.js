import { useEffect } from 'react';

export const useFileHandler = (addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId) => {
  useEffect(() => {
    // Listen for file content from main process
    if (window.electronAPI) {
      window.electronAPI.onFileOpen((value) => {
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
          // Add new document
          const newId = Date.now().toString();
          addDocument({
            id: newId,
            name: fileName,
            content: fileContent,
            filePath,
          });
        }
      });
    }
  }, [addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId]);
};
