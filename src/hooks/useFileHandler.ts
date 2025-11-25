import { useEffect } from 'react';
import { DEFAULT_DOCUMENT, RENDERER_SECURITY } from '../constants/index.js';
import type { Document } from '../types/document.js';
import type { FileOpenData } from '../types/electron.js';
import type { DocumentUpdate } from './useDocuments.js';

export const useFileHandler = (
  addDocument: (doc: Partial<Document>) => string,
  updateExistingDocument: (id: string, updates: DocumentUpdate) => void,
  findDocumentByPath: (filePath: string) => Document | undefined,
  setActiveTabId: (id: string) => void,
  documents: Document[],
  closeTab: (id: string) => void,
  showError: (message: string) => void
): void => {
  useEffect(() => {
    // Listen for file content from main process
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onFileOpen((value: FileOpenData | string) => {
        // value is { filePath, content, name } or just string (legacy)
        const isFileOpenData = (val: FileOpenData | string): val is FileOpenData => {
          return typeof val === 'object' && 'content' in val;
        };

        const filePath = isFileOpenData(value) ? value.filePath : null;
        const fileContent = isFileOpenData(value) ? value.content : value;
        const fileName = isFileOpenData(value) ? value.name : 'Untitled';

        // Security: Defense-in-depth validation of content size (HIGH-2 fix)
        // Main process already validates, but renderer should also verify
        if (fileContent.length > RENDERER_SECURITY.MAX_CONTENT_LENGTH) {
          showError(`File too large. Maximum size is ${RENDERER_SECURITY.MAX_CONTENT_SIZE_MB}MB.`);
          return;
        }

        // Check if document with this path already exists
        const existing = filePath ? findDocumentByPath(filePath) : undefined;
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
  }, [addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId, documents, closeTab, showError]);
};
