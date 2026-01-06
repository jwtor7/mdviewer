/**
 * useSaveFile Hook
 *
 * Orchestrates file saving with format-specific success messages.
 * Handles the save dialog, document updates, and dirty flag management.
 */

import { useCallback } from 'react';
import type { Document } from '../types/document';

export interface UseSaveFileProps {
  activeDoc: Document;
  updateExistingDocument: (id: string, updates: Partial<Document>) => void;
  markDocumentSaved: (id: string) => void;
  showError: (message: string, type?: 'error' | 'info') => void;
}

export interface UseSaveFileReturn {
  handleSave: () => Promise<void>;
}

export const useSaveFile = ({
  activeDoc,
  updateExistingDocument,
  markDocumentSaved,
  showError,
}: UseSaveFileProps): UseSaveFileReturn => {
  const handleSave = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.saveFile) {
      showError('Save functionality not available');
      return;
    }

    try {
      const result = await window.electronAPI.saveFile({
        content: activeDoc.content,
        filename: activeDoc.name,
        filePath: activeDoc.filePath,
      });

      if (result.success) {
        // Show format-specific success message based on file extension
        const filePath = result.filePath?.toLowerCase() || '';
        let message = 'Markdown saved successfully!';
        if (filePath.endsWith('.pdf')) {
          message = 'PDF exported successfully!';
        } else if (filePath.endsWith('.txt')) {
          message = 'Text file saved successfully!';
        }
        showError(message, 'info');

        // Update document with new filepath and filename
        if (result.filePath) {
          const filename = result.filePath.split('/').pop() || 'Untitled';
          updateExistingDocument(activeDoc.id, {
            filePath: result.filePath,
            name: filename
          });
        }

        // Mark document as saved (clear dirty flag)
        markDocumentSaved(activeDoc.id);
      } else {
        if (result.error !== 'Cancelled') {
          showError(result.error || 'Failed to save file');
        }
      }
    } catch (err) {
      showError('Failed to save file');
    }
  }, [
    activeDoc.content,
    activeDoc.name,
    activeDoc.filePath,
    activeDoc.id,
    showError,
    updateExistingDocument,
    markDocumentSaved
  ]);

  return { handleSave };
};

export default useSaveFile;
