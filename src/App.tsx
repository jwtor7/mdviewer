import React, { useState, useRef, useMemo, useCallback } from 'react';
import MarkdownPreview from './components/MarkdownPreview';
import CodeEditor from './components/CodeEditor';
import ErrorNotification from './components/ErrorNotification';
import FindReplace from './components/FindReplace';
import { useDocuments, useTheme, useTextFormatting, useFileHandler, useErrorHandler, useKeyboardShortcuts } from './hooks/index';
import { VIEW_MODES, type ViewMode } from './constants/index';
import type { Document, DraggableDocument } from './types/document';
import { calculateTextStats } from './utils/textCalculations';
import pkg from '../package.json';
import './index.css';

const App: React.FC = () => {
    const {
        documents,
        activeDoc,
        activeTabId,
        setActiveTabId,
        updateContent,
        addDocument,
        updateExistingDocument,
        findDocumentByPath,
        closeTab: closeDocument,
    } = useDocuments();

    const { theme, handleThemeToggle, getThemeIcon } = useTheme();
    const { errors, showError, dismissError } = useErrorHandler();
    const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.PREVIEW);
    const [showFindReplace, setShowFindReplace] = useState(false);
    const [splitDividerPosition, setSplitDividerPosition] = useState(50); // percentage
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { handleFormat } = useTextFormatting(activeDoc.content, updateContent, textareaRef, viewMode);
    useFileHandler(addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId, documents, closeDocument);

    // Handle save
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
                const isPDF = result.filePath?.toLowerCase().endsWith('.pdf') || false;
                const message = isPDF ? 'PDF exported successfully!' : 'Markdown saved successfully!';
                showError(message, 'info');
            } else {
                if (result.error !== 'Cancelled') {
                    showError(result.error || 'Failed to save file');
                }
            }
        } catch (err) {
            showError('Failed to save file');
        }
    }, [activeDoc.content, activeDoc.name, activeDoc.filePath, showError]);

    // Handle find
    const handleFind = useCallback((): void => {
        // Only show find/replace in CODE or SPLIT view
        if (viewMode === VIEW_MODES.PREVIEW) {
            showError('Find & Replace is only available in Code or Split view', 'info');
            return;
        }
        setShowFindReplace(true);
    }, [viewMode, showError]);

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onBold: () => handleFormat('bold'),
        onItalic: () => handleFormat('italic'),
        onToggleView: useCallback(() => {
            setViewMode(prev => {
                if (prev === VIEW_MODES.PREVIEW) return VIEW_MODES.CODE;
                if (prev === VIEW_MODES.CODE) return VIEW_MODES.SPLIT;
                return VIEW_MODES.PREVIEW;
            });
        }, []),
        onToggleTheme: handleThemeToggle,
        onSave: handleSave,
        onFind: handleFind,
    });

    // Performance: Memoize text statistics
    const textStats = useMemo(
        () => calculateTextStats(activeDoc.content),
        [activeDoc.content]
    );

    const handleCopy = useCallback(async (): Promise<void> => {
        try {
            if (viewMode === VIEW_MODES.CODE) {
                await navigator.clipboard.writeText(activeDoc.content);
            } else {
                const previewElement = document.querySelector('.markdown-preview') as HTMLElement | null;
                if (previewElement) {
                    try {
                        const htmlBlob = new Blob([previewElement.innerHTML], { type: 'text/html' });
                        const textBlob = new Blob([previewElement.innerText], { type: 'text/plain' });
                        const data = [new ClipboardItem({
                            'text/html': htmlBlob,
                            'text/plain': textBlob
                        })];
                        await navigator.clipboard.write(data);
                    } catch (richCopyErr) {
                        // Fallback to plain text if rich text copy fails
                        // This error will propagate to outer catch if plain text also fails
                        await navigator.clipboard.writeText(previewElement.innerText);
                    }
                }
            }
        } catch (err) {
            showError('Failed to copy to clipboard');
        }
    }, [viewMode, activeDoc.content, showError]);

    const handleCloseTab = (e: React.MouseEvent<HTMLButtonElement>, id: string): void => {
        e.stopPropagation();
        closeDocument(id);
    };

    // Track the current drag operation ID
    const dragIdRef = useRef<string | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, doc: Document): void => {
        const dragId = Date.now().toString();
        dragIdRef.current = dragId;

        // Ensure filePath is included in the dragged data
        const dragData: DraggableDocument = {
            ...doc,
            filePath: doc.filePath || null, // Explicitly include, even if null
            dragId
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        e.dataTransfer.effectAllowed = 'move';
    };

    const closeTabOrWindow = (id: string): void => {
        if (documents.length === 1 && documents[0].id === id) {
            if (window.electronAPI && window.electronAPI.closeWindow) {
                window.electronAPI.closeWindow();
            } else {
                closeDocument(id);
            }
        } else {
            closeDocument(id);
        }
    };

    const handleDragEnd = async (e: React.DragEvent<HTMLDivElement>, doc: Document): Promise<void> => {
        const currentDragId = dragIdRef.current;

        // Check if the tab was dropped and handled by ANY window (including this one)
        let handled = false;
        if (window.electronAPI && window.electronAPI.checkTabDropped && currentDragId) {
            handled = await window.electronAPI.checkTabDropped(currentDragId);
        }

        if (handled) {
            // The tab was successfully dropped into a window.
            // We should close it here to "move" it.
            closeTabOrWindow(doc.id);
            return;
        }

        // If NOT handled, check if dropped outside to create a new window
        if (e.screenX < window.screenX ||
            e.screenX > window.screenX + window.outerWidth ||
            e.screenY < window.screenY ||
            e.screenY > window.screenY + window.outerHeight) {

            if (window.electronAPI && window.electronAPI.createWindowForTab) {
                window.electronAPI.createWindowForTab({
                    filePath: doc.filePath,
                    content: doc.content
                });
                // Close the tab in current window
                closeTabOrWindow(doc.id);
            }
        }

        // Reset drag ID
        dragIdRef.current = null;
    };

    // Handle file drops onto the app window
    const handleFileDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
        // Allow dropping files
        e.dataTransfer.dropEffect = 'copy'; // Default to copy for files

        // If it's our own tab, we might want 'move'
        if (e.dataTransfer.types.includes('text/plain')) {
            e.dataTransfer.dropEffect = 'move';
        }
    }, []);

    const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();

        // Check for internal tab drop
        const textData = e.dataTransfer.getData('text/plain');
        if (textData) {
            try {
                const doc = JSON.parse(textData) as DraggableDocument;

                if (doc.id && doc.content && doc.filePath) {
                    // It's a tab!

                    // Notify main process that this tab was dropped/handled
                    // BUT only if it's not a self-drop (optional optimization, but safer to just notify)
                    // Actually, if we notify on self-drop, handleDragEnd will close it.
                    // We need to prevent closing on self-drop.

                    // Check if this is a self-drop
                    if (dragIdRef.current === doc.dragId) {
                        // Self-drop! Do NOT notify main process.
                        // handleDragEnd will see handled=false.
                        // It will check "outside". It is NOT outside.
                        // So it will do nothing. Tab stays. Perfect.
                    } else {
                        if (window.electronAPI && window.electronAPI.notifyTabDropped) {
                            window.electronAPI.notifyTabDropped(doc.dragId);
                        }
                    }

                    // Check if we already have this doc (by path)
                    const existing = doc.filePath ? findDocumentByPath(doc.filePath) : undefined;
                    if (existing) {
                        setActiveTabId(existing.id);
                    } else {
                        // Add it
                        addDocument({
                            id: doc.id, // Keep ID or generate new? keeping ID might be good for tracking
                            name: doc.name,
                            content: doc.content,
                            filePath: doc.filePath
                        });
                    }
                    return; // Handled
                }
            } catch (err) {
                // Not JSON or not our tab, ignore
            }
        }

        const files = Array.from(e.dataTransfer.files);
        const markdownFiles = files.filter((file: File) =>
            file.name.endsWith('.md') || file.name.endsWith('.markdown')
        );

        markdownFiles.forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (event: ProgressEvent<FileReader>): void => {
                const content = event.target?.result as string;
                // Electron file objects have a 'path' property
                const filePath = (file as File & { path?: string }).path || null;
                const existing = filePath ? findDocumentByPath(filePath) : undefined;

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
            };
            reader.onerror = (): void => {
                showError(`Failed to read file: ${file.name}`);
            };
            reader.readAsText(file);
        });
    }, [addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId, showError, documents]);

    return (
        <div
            className="app-container"
            onDragOver={handleFileDragOver}
            onDrop={handleFileDrop}
        >
            <ErrorNotification errors={errors} onDismiss={dismissError} />
            <div className="tab-bar" role="tablist" aria-label="Open documents">
                {documents.map((doc: Document) => (
                    <div
                        key={doc.id}
                        className={`tab ${activeTabId === doc.id ? 'active' : ''}`}
                        onClick={() => setActiveTabId(doc.id)}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, doc)}
                        onDragEnd={(e) => handleDragEnd(e, doc)}
                        role="tab"
                        aria-selected={activeTabId === doc.id}
                        aria-controls="content-area"
                        tabIndex={activeTabId === doc.id ? 0 : -1}
                    >
                        <span>{doc.name}</span>
                        <button
                            className="tab-close"
                            onClick={(e) => handleCloseTab(e, doc.id)}
                            aria-label={`Close ${doc.name}`}
                            title={`Close ${doc.name}`}
                            tabIndex={-1}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            <div className="toolbar">
                <div className="toolbar-group">
                    <div className="toolbar-title">Markdown Viewer</div>
                </div>

                <div className="toolbar-group">
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('bold')}
                        title="Bold (Cmd+B)"
                        aria-label="Format selected text as bold"
                        disabled={viewMode === VIEW_MODES.PREVIEW}
                    >
                        <b>B</b>
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('italic')}
                        title="Italic (Cmd+I)"
                        aria-label="Format selected text as italic"
                        disabled={viewMode === VIEW_MODES.PREVIEW}
                    >
                        <i>I</i>
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('list')}
                        title="List"
                        aria-label="Format selected text as list item"
                        disabled={viewMode === VIEW_MODES.PREVIEW}
                    >
                        •
                    </button>
                    <div className="toolbar-divider" role="separator"></div>

                    <button
                        className="icon-btn"
                        onClick={handleCopy}
                        title="Copy (Cmd+C)"
                        aria-label={viewMode === VIEW_MODES.CODE ? 'Copy markdown source' : 'Copy rendered preview'}
                    >
                        📋
                    </button>

                    <button
                        className="icon-btn"
                        onClick={handleSave}
                        title="Save As... (Markdown or PDF) (Cmd+S)"
                        aria-label="Save document as Markdown or PDF"
                    >
                        💾
                    </button>

                    <button
                        className="icon-btn"
                        onClick={handleFind}
                        title="Find & Replace (Cmd+F)"
                        aria-label="Open find and replace"
                        disabled={viewMode === VIEW_MODES.PREVIEW}
                    >
                        🔍
                    </button>

                    <button
                        className="icon-btn"
                        onClick={handleThemeToggle}
                        title={`Theme: ${theme} (Cmd+T)`}
                        aria-label={`Current theme: ${theme}. Click to change theme.`}
                    >
                        {getThemeIcon()}
                    </button>

                    <div className="toggle-container" role="tablist" aria-label="View mode">
                        <button
                            className={`toggle-btn ${viewMode === VIEW_MODES.PREVIEW ? 'active' : ''}`}
                            onClick={() => setViewMode(VIEW_MODES.PREVIEW)}
                            title="Preview Mode (Cmd+E to cycle)"
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.PREVIEW}
                            aria-controls="content-area"
                        >
                            Preview
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === VIEW_MODES.CODE ? 'active' : ''}`}
                            onClick={() => setViewMode(VIEW_MODES.CODE)}
                            title="Code Mode (Cmd+E to cycle)"
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.CODE}
                            aria-controls="content-area"
                        >
                            Code
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === VIEW_MODES.SPLIT ? 'active' : ''}`}
                            onClick={() => setViewMode(VIEW_MODES.SPLIT)}
                            title="Split Mode (Cmd+E to cycle)"
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.SPLIT}
                            aria-controls="content-area"
                        >
                            Split
                        </button>
                    </div>
                </div>
            </div>
            <div
                className="content-area"
                id="content-area"
                role="tabpanel"
                aria-label={
                    viewMode === VIEW_MODES.PREVIEW
                        ? 'Markdown preview'
                        : viewMode === VIEW_MODES.SPLIT
                        ? 'Split view: code and preview'
                        : 'Markdown editor'
                }
            >
                {showFindReplace && (viewMode === VIEW_MODES.CODE || viewMode === VIEW_MODES.SPLIT) && (
                    <FindReplace
                        content={activeDoc.content}
                        onClose={() => setShowFindReplace(false)}
                        onReplace={updateContent}
                        textareaRef={textareaRef}
                    />
                )}
                {viewMode === VIEW_MODES.PREVIEW ? (
                    <MarkdownPreview content={activeDoc.content} theme={theme} />
                ) : viewMode === VIEW_MODES.CODE ? (
                    <CodeEditor ref={textareaRef} content={activeDoc.content} onChange={updateContent} />
                ) : (
                    <div className="split-view">
                        <div className="split-pane split-pane-left" style={{ width: `${splitDividerPosition}%` }}>
                            <CodeEditor ref={textareaRef} content={activeDoc.content} onChange={updateContent} />
                        </div>
                        <div
                            className="split-divider"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startWidth = splitDividerPosition;

                                const handleMouseMove = (moveEvent: MouseEvent): void => {
                                    const deltaX = moveEvent.clientX - startX;
                                    const containerWidth = (e.currentTarget as HTMLElement).parentElement?.clientWidth || 1;
                                    const deltaPercent = (deltaX / containerWidth) * 100;
                                    const newWidth = Math.min(Math.max(20, startWidth + deltaPercent), 80);
                                    setSplitDividerPosition(newWidth);
                                };

                                const handleMouseUp = (): void => {
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                };

                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                            }}
                        />
                        <div className="split-pane split-pane-right" style={{ width: `${100 - splitDividerPosition}%` }}>
                            <MarkdownPreview content={activeDoc.content} theme={theme} />
                        </div>
                    </div>
                )}
            </div>
            <div className="status-bar" role="status" aria-live="polite">
                <div className="status-item" aria-label="Word count">Words: {textStats.wordCount}</div>
                <div className="status-item" aria-label="Character count">Chars: {textStats.charCount}</div>
                <div className="status-item" aria-label="Estimated tokens">Tokens: {textStats.tokenCount}</div>
                <div className="status-item status-version" aria-label="App version">v{pkg.version}</div>
            </div>
        </div>
    );
};

export default App;
