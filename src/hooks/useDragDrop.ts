import { useCallback, useRef } from 'react';
import { RENDERER_SECURITY, IMAGE_CONFIG } from '../constants/index.js';
import type { Document, DraggableDocument } from '../types/document.js';

/**
 * Configuration for the drag-drop hook
 */
export interface UseDragDropConfig {
  /** Current list of documents */
  documents: Document[];
  /** Currently active document */
  activeDoc: Document;
  /** Add a new document tab */
  addDocument: (doc: Partial<Document>) => string;
  /** Update an existing document */
  updateExistingDocument: (id: string, updates: Partial<Document>) => void;
  /** Find document by file path */
  findDocumentByPath: (filePath: string) => Document | undefined;
  /** Set the active tab ID */
  setActiveTabId: (id: string) => void;
  /** Reorder documents in the tab bar */
  reorderDocuments: (fromIndex: number, toIndex: number) => void;
  /** Close a tab/document */
  closeDocument: (id: string) => void;
  /** Update content of active document */
  updateContent: (content: string) => void;
  /** Show error/info notification */
  showError: (message: string, type?: 'error' | 'info') => void;
}

/**
 * Return type for the useDragDrop hook
 */
export interface UseDragDropReturn {
  /** Ref tracking current drag operation ID */
  dragIdRef: React.MutableRefObject<string | null>;
  /** Ref tracking dragged document ID */
  draggedDocIdRef: React.MutableRefObject<string | null>;
  /** Handler for tab drag start */
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, doc: Document, index: number) => void;
  /** Handler for tab drag end (handles tear-off to new window) */
  handleDragEnd: (e: React.DragEvent<HTMLDivElement>, doc: Document) => Promise<void>;
  /** Handler for file drag over (sets drop effect) */
  handleFileDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Handler for file/tab drop */
  handleFileDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Handler for tab reorder drop on individual tabs */
  handleTabDrop: (e: React.DragEvent<HTMLDivElement>, targetDoc: Document) => void;
  /** Handler for tab drag over */
  handleTabDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Close tab or window if last tab */
  closeTabOrWindow: (id: string) => void;
}

/**
 * Custom hook for handling drag-and-drop operations in mdviewer.
 *
 * Handles:
 * - Tab reordering via drag within the tab bar
 * - Tab tear-off to create new windows
 * - File drops (markdown files and images)
 * - Security validation of dropped content
 *
 * @param config - Dependencies for the hook
 * @returns Handlers and refs for drag-drop operations
 */
export const useDragDrop = (config: UseDragDropConfig): UseDragDropReturn => {
  const {
    documents,
    activeDoc,
    addDocument,
    updateExistingDocument,
    findDocumentByPath,
    setActiveTabId,
    reorderDocuments,
    closeDocument,
    updateContent,
    showError,
  } = config;

  // Track the current drag operation ID and Document ID
  const dragIdRef = useRef<string | null>(null);
  const draggedDocIdRef = useRef<string | null>(null);

  /**
   * Close tab, or close window if this is the last tab
   */
  const closeTabOrWindow = useCallback((id: string): void => {
    if (documents.length === 1 && documents[0].id === id) {
      if (window.electronAPI && window.electronAPI.closeWindow) {
        window.electronAPI.closeWindow();
      } else {
        closeDocument(id);
      }
    } else {
      closeDocument(id);
    }
  }, [documents, closeDocument]);

  /**
   * Handle start of tab drag - set up data transfer
   */
  const handleDragStart = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    doc: Document,
    index: number
  ): void => {
    const dragId = Date.now().toString();
    dragIdRef.current = dragId;
    draggedDocIdRef.current = doc.id;

    // Ensure filePath is included in the dragged data
    const dragData: DraggableDocument = {
      ...doc,
      filePath: doc.filePath || null, // Explicitly include, even if null
      dragId
    };
    e.dataTransfer.setData('application/x-mdviewer-tab', JSON.stringify(dragData));
    e.dataTransfer.setData('application/x-mdviewer-tab-index', index.toString());
    e.dataTransfer.effectAllowed = 'copyMove';
  }, []);

  /**
   * Handle end of tab drag - create new window if dragged outside
   */
  const handleDragEnd = useCallback(async (
    e: React.DragEvent<HTMLDivElement>,
    doc: Document
  ): Promise<void> => {
    // Drag-to-new-window logic:
    // If we dragged explicitly outside the window and the drop wasn't handled by us (reorder),
    // we create a new window.

    const isOutside = (
      e.clientX < 0 ||
      e.clientX > window.innerWidth ||
      e.clientY < 0 ||
      e.clientY > window.innerHeight
    );

    // Create new window if dragged outside, regardless of dropEffect
    // The dropEffect check was preventing tab tear-off from working
    if (isOutside) {
      if (window.electronAPI && window.electronAPI.createWindowForTab) {
        const result = await window.electronAPI.createWindowForTab({
          filePath: doc.filePath,
          content: doc.content
        });
        if (result.success) {
          // Close the tab as we created a new window for it
          closeTabOrWindow(doc.id);
        } else {
          showError(result.error || 'Failed to open a new window for the tab');
        }
      }
    }

    // Reset drag ID
    dragIdRef.current = null;
    draggedDocIdRef.current = null;
  }, [closeTabOrWindow, showError]);

  /**
   * Handle file drag over the app window
   */
  const handleFileDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    // Allow dropping files
    e.dataTransfer.dropEffect = 'copy'; // Default to copy for files

    // If it's our own tab, we might want 'move'
    if (e.dataTransfer.types.includes('application/x-mdviewer-tab')) {
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  /**
   * Handle file/tab drop on the app window
   */
  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();

    // Check for internal tab drop
    const textData = e.dataTransfer.getData('application/x-mdviewer-tab');
    if (textData) {
      try {
        const doc = JSON.parse(textData) as DraggableDocument;

        if (doc.id && doc.content !== undefined) {
          // Security: Validate content size before processing (HIGH-2 fix)
          if (doc.content.length > RENDERER_SECURITY.MAX_CONTENT_LENGTH) {
            showError(`Content too large. Maximum size is ${RENDERER_SECURITY.MAX_CONTENT_SIZE_MB}MB.`);
            return;
          }

          // It's a tab!

          // CRITICAL CHANGE: Disable re-integration from other windows.
          // Only allow drops if the drag originated in THIS window (internal reorder/self-drop).
          if (dragIdRef.current !== doc.dragId) {
            // External drop - IGNORE IT.
            return;
          }

          // Check if we already have this doc (by ID or path)
          const existingById = documents.find(d => d.id === doc.id);
          const existingByPath = doc.filePath ? findDocumentByPath(doc.filePath) : undefined;

          if (existingById) {
            setActiveTabId(existingById.id);
          } else if (existingByPath) {
            setActiveTabId(existingByPath.id);
          } else {
            // Add it (only if internal, though internal usually means it exists...)
            // This case handles a theoretical "we dragged it out then back in same window"
            // but if we dragged it out, we haven't closed it yet (dragEnd happens after).

            // Actually, if it's internal, it MUST exist unless we deleted it mid-drag?
            // Safe to just activate if found.

            if (!existingById && !existingByPath) {
              addDocument({
                id: doc.id,
                name: doc.name,
                content: doc.content,
                filePath: doc.filePath
              });
            }
          }
          return; // Handled
        }
      } catch {
        // Not JSON or not our tab, ignore
      }
    }

    const files = Array.from(e.dataTransfer.files);

    // Separate markdown files and image files
    const markdownFiles = files.filter((file: File) =>
      file.name.endsWith('.md') || file.name.endsWith('.markdown')
    );

    const imageFiles = files.filter((file: File) => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      return (IMAGE_CONFIG.ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
    });

    // Handle image file drops
    if (imageFiles.length > 0) {
      // Check if document is saved
      if (!activeDoc.filePath) {
        showError('Please save the document before embedding images');
        return;
      }

      // Process each image file asynchronously
      (async () => {
        for (const imageFile of imageFiles) {
          try {
            // Get file path
            let imagePath: string | null = null;
            if (window.electronAPI?.getPathForFile) {
              try {
                imagePath = window.electronAPI.getPathForFile(imageFile);
              } catch (error) {
                console.error('Failed to get path for image file', error);
              }
            }

            if (!imagePath || !window.electronAPI?.copyImageToDocument) {
              showError('Cannot process image file');
              continue;
            }

            // Copy image to document's images directory
            const result = await window.electronAPI.copyImageToDocument(imagePath, activeDoc.filePath!);

            if (result.error) {
              showError(result.error);
              continue;
            }

            if (result.relativePath) {
              // Insert markdown image syntax at cursor or end of content
              const filename = imageFile.name;
              const imageMarkdown = `![${filename}](${encodeURI(result.relativePath)})`;

              // Append to content (you could enhance this to insert at cursor position)
              const newContent = activeDoc.content + '\n\n' + imageMarkdown;
              updateContent(newContent);

              showError(`Image embedded: ${filename}`, 'info');
            }
          } catch {
            showError(`Failed to embed image: ${imageFile.name}`);
          }
        }
      })();
    }

    // Handle markdown file drops
    markdownFiles.forEach(async (file: File) => {
      // Use secure method to get file path (works in Electron renderer)
      let filePath: string | null = null;

      if (window.electronAPI?.getPathForFile) {
        try {
          filePath = window.electronAPI.getPathForFile(file);
        } catch (error) {
          console.error('Failed to get path for file', error);
        }
      } else {
        // Fallback for older Electron versions or dev mode if API missing
        filePath = (file as File & { path?: string }).path || null;
      }

      if (!filePath || !window.electronAPI?.readFile) {
        // Fallback for web/dev environment if needed, or show error
        showError('Cannot read file path');
        return;
      }

      try {
        const result = await window.electronAPI.readFile(filePath);

        if (!result.success) {
          showError(result.error);
          return;
        }

        const content = result.data.content;

        // Security: Defense-in-depth validation of content size (HIGH-2 fix)
        // Main process already validates, but renderer should also verify
        if (content.length > RENDERER_SECURITY.MAX_CONTENT_LENGTH) {
          showError(`File too large. Maximum size is ${RENDERER_SECURITY.MAX_CONTENT_SIZE_MB}MB.`);
          return;
        }

        const existing = findDocumentByPath(filePath);

        if (existing) {
          // Update existing document
          updateExistingDocument(existing.id, { content });
          setActiveTabId(existing.id);
        } else {
          // Add new document
          addDocument({
            id: Date.now().toString() + Math.random(),
            name: file.name,
            content,
            filePath,
          });
        }
      } catch {
        showError(`Failed to read file: ${file.name}`);
      }
    });
  }, [
    documents,
    activeDoc,
    addDocument,
    updateExistingDocument,
    findDocumentByPath,
    setActiveTabId,
    updateContent,
    showError
  ]);

  /**
   * Handle drag over for tab reordering
   */
  const handleTabDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/x-mdviewer-tab-index')) {
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  /**
   * Handle drop on individual tabs for reordering
   */
  const handleTabDrop = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    targetDoc: Document
  ): void => {
    e.preventDefault();

    // Check if this is an internal reorder (tab belongs to THIS window)
    // We do this by checking if the dragged document ID exists in our documents list
    let isInternal = false;
    try {
      const textData = e.dataTransfer.getData('application/x-mdviewer-tab');
      if (textData) {
        const draggedDoc = JSON.parse(textData) as DraggableDocument;
        if (draggedDoc.id && documents.some(d => d.id === draggedDoc.id)) {
          isInternal = true;
        }
      }
    } catch {
      // Ignore parse error, treat as external
    }

    if (isInternal) {
      e.stopPropagation(); // Stop bubbling only if we handle it here
      const fromIndexStr = e.dataTransfer.getData('application/x-mdviewer-tab-index');
      if (fromIndexStr) {
        const fromIndex = parseInt(fromIndexStr, 10);
        const toIndex = documents.indexOf(targetDoc);

        if (fromIndex !== toIndex && fromIndex >= 0 && toIndex >= 0) {
          reorderDocuments(fromIndex, toIndex);
        }
      }
    }
    // If NOT internal (external drop), we let it bubble up to the container's handleFileDrop
  }, [documents, reorderDocuments]);

  return {
    dragIdRef,
    draggedDocIdRef,
    handleDragStart,
    handleDragEnd,
    handleFileDragOver,
    handleFileDrop,
    handleTabDrop,
    handleTabDragOver,
    closeTabOrWindow,
  };
};
