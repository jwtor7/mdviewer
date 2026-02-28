/**
 * useIPCListeners Hook
 *
 * Consolidates IPC event subscriptions from the main process.
 * Handles: onRequestUnsavedDocs, onSaveAllAndQuit, onFormatText,
 * onToggleWordWrap, and onCloseTab events.
 */

import { useEffect } from 'react';
import type { Document } from '../types/document';

export interface UseIPCListenersProps {
  documents: Document[];
  handleSave: () => Promise<void>;
  setActiveTabId: (id: string) => void;
  handleFormat: (format: 'bold' | 'italic' | 'list' | 'code' | 'quote' | 'hr' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => void;
  toggleWordWrap: () => void;
  handleCloseTab: (e: React.MouseEvent<HTMLButtonElement>, id: string) => Promise<void>;
  activeTabId: string;
}

/**
 * Hook to manage IPC event listeners from the Electron main process.
 * This is a side-effect only hook that sets up listeners on mount
 * and cleans them up on unmount or when dependencies change.
 */
export const useIPCListeners = ({
  documents,
  handleSave,
  setActiveTabId,
  handleFormat,
  toggleWordWrap,
  handleCloseTab,
  activeTabId,
}: UseIPCListenersProps): void => {
  // Security: Use proper IPC to respond to unsaved documents requests (LOW PRIORITY fix)
  useEffect(() => {
    const cleanup = window.electronAPI?.onRequestUnsavedDocs?.(() => {
      return documents.filter(d => d.dirty).map(d => d.name);
    });

    return () => cleanup?.();
  }, [documents]);

  // Handle save-all-and-quit event from main process
  useEffect(() => {
    if (!window.electronAPI?.onSaveAllAndQuit) return;

    const cleanup = window.electronAPI.onSaveAllAndQuit(async () => {
      // Save all dirty documents
      const dirtyDocs = documents.filter(d => d.dirty);

      for (const doc of dirtyDocs) {
        // Switch to the document
        setActiveTabId(doc.id);
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        // Save it
        await handleSave();
      }

      // After all saves, close the window
      if (window.electronAPI?.closeWindow) {
        window.electronAPI.closeWindow();
      }
    });

    return cleanup;
  }, [documents, handleSave, setActiveTabId]);

  // Listen for format-text IPC events from context menu
  useEffect(() => {
    const cleanup = window.electronAPI.onFormatText((format) => {
      handleFormat(format as 'bold' | 'italic' | 'list');
    });
    return cleanup;
  }, [handleFormat]);

  // Listen for toggle-word-wrap IPC events from View menu
  useEffect(() => {
    const cleanup = window.electronAPI.onToggleWordWrap(() => {
      toggleWordWrap();
    });
    return cleanup;
  }, [toggleWordWrap]);

  // Listen for close-tab IPC events from File menu
  useEffect(() => {
    if (!window.electronAPI?.onCloseTab) return;
    const cleanup = window.electronAPI.onCloseTab(() => {
      // Close the currently active tab
      handleCloseTab({ stopPropagation: () => { } } as React.MouseEvent<HTMLButtonElement>, activeTabId);
    });
    return cleanup;
  }, [activeTabId, handleCloseTab]);

};

export default useIPCListeners;
