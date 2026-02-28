/**
 * useFileWatcher Hook
 *
 * Watches all open file-backed documents for external changes.
 * When a file changes on disk and the document has no local edits (not dirty),
 * the content is automatically reloaded from disk.
 * Dirty documents are left untouched to preserve user edits.
 */

import { useEffect, useRef } from 'react';
import type { Document } from '../types/document';
import type { DocumentUpdate } from './useDocuments';

export interface UseFileWatcherProps {
  documents: Document[];
  updateExistingDocument: (id: string, updates: DocumentUpdate) => void;
  markDocumentSaved: (id: string) => void;
}

export const useFileWatcher = ({
  documents,
  updateExistingDocument,
  markDocumentSaved,
}: UseFileWatcherProps): void => {
  // Use ref to access current documents in the file-changed callback
  // without re-registering the listener on every documents change
  const documentsRef = useRef(documents);
  documentsRef.current = documents;

  const watchedPathsRef = useRef<Set<string>>(new Set());

  // Sync watched paths with open documents
  useEffect(() => {
    if (!window.electronAPI?.watchFile || !window.electronAPI?.unwatchFile) return;

    const currentPaths = new Set(
      documents.filter(d => d.filePath).map(d => d.filePath!)
    );

    // Watch newly opened files
    for (const p of currentPaths) {
      if (!watchedPathsRef.current.has(p)) {
        window.electronAPI.watchFile(p);
      }
    }

    // Unwatch closed files
    for (const p of watchedPathsRef.current) {
      if (!currentPaths.has(p)) {
        window.electronAPI.unwatchFile(p);
      }
    }

    watchedPathsRef.current = currentPaths;
  }, [documents]);

  // Cleanup all watchers on unmount
  useEffect(() => {
    return () => {
      if (!window.electronAPI?.unwatchFile) return;
      for (const p of watchedPathsRef.current) {
        window.electronAPI.unwatchFile(p);
      }
      watchedPathsRef.current.clear();
    };
  }, []);

  // Listen for file-changed events from main process
  useEffect(() => {
    if (!window.electronAPI?.onFileChanged) return;

    const cleanup = window.electronAPI.onFileChanged(async ({ filePath }) => {
      const docs = documentsRef.current;
      const doc = docs.find(d => d.filePath === filePath);
      if (!doc) return;

      // Don't overwrite local edits
      if (doc.dirty) return;

      try {
        const result = await window.electronAPI.readFile(filePath);
        if (!result.success) return;

        // Only update if content actually differs (avoids unnecessary re-renders
        // and handles the case where WE just saved the file)
        if (result.data.content !== doc.content) {
          updateExistingDocument(doc.id, { content: result.data.content });
          markDocumentSaved(doc.id);
        }
      } catch {
        // Silent fail — file may have been deleted or become inaccessible
      }
    });

    return cleanup;
  }, [updateExistingDocument, markDocumentSaved]);
};
