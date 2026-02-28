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
  showError: (message: string) => void,
  onSave?: () => void,
  onNewFile?: () => void
): void => {
  useEffect(() => {
    // Listen for file content from main process
    if (window.electronAPI) {
      const cleanupFileOpen = window.electronAPI.onFileOpen((value: FileOpenData | string) => {
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
          // Guard against overwriting unsaved changes
          if (existing.dirty && existing.content !== fileContent) {
            const confirmReload = window.confirm(
              `"${existing.name}" has unsaved changes. Reload from disk and discard changes?`
            );
            if (!confirmReload) {
              return;
            }
          }

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
            // Replace default document with the new file content
            // Update in place instead of close+add to avoid creating a blank tab
            updateExistingDocument('default', {
              name: fileName,
              content: fileContent,
              filePath,
            });
          } else {
            // Add new document
            addDocument({
              name: fileName,
              content: fileContent,
              filePath,
            });
          }
        }
      });

      // Listen for file-new event from main process (File → New menu)
      const cleanupFileNew = window.electronAPI.onFileNew(() => {
        // Generate unique "Untitled" name
        const untitledDocs = documents.filter(d => d.name.startsWith('Untitled'));
        let newName = 'Untitled';
        if (untitledDocs.length > 0) {
          // Find the highest number in existing "Untitled N" documents
          const numbers = untitledDocs
            .map(d => {
              // eslint-disable-next-line security/detect-unsafe-regex
              const match = d.name.match(/^Untitled(?: (\d+))?$/);
              return match ? (match[1] ? parseInt(match[1], 10) : 1) : 0;
            })
            .filter(n => n > 0);
          const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
          newName = `Untitled ${maxNumber + 1}`;
        }

        // Create new empty document
        addDocument({
          name: newName,
          content: '',
          filePath: null,
        });

        // Switch to Raw view when creating new document
        if (onNewFile) {
          onNewFile();
        }
      });

      // Listen for file-save event from main process (File → Save menu)
      const cleanupFileSave = onSave ? window.electronAPI.onFileSave(() => {
        onSave();
      }) : null;

      // Cleanup listeners on unmount or dependency change
      return () => {
        cleanupFileOpen();
        cleanupFileNew();
        if (cleanupFileSave) cleanupFileSave();
      };
    }
  }, [addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId, documents, closeTab, showError, onSave, onNewFile]);
};
