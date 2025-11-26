import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import MarkdownPreview from './components/MarkdownPreview';
import CodeEditor from './components/CodeEditor';
import ErrorNotification from './components/ErrorNotification';
import FindReplace from './components/FindReplace';
import TextPreview from './components/TextPreview';
import { useDocuments, useTheme, useTextFormatting, useFileHandler, useErrorHandler, useKeyboardShortcuts } from './hooks/index';
import { VIEW_MODES, RENDERER_SECURITY, type ViewMode } from './constants/index';
import { convertMarkdownToText } from './utils/textConverter';
import { sanitizeHtmlForClipboard, sanitizeTextForClipboard } from './utils/clipboardSanitizer';
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
        undo,
        redo,
        canUndo,
        canRedo,
    } = useDocuments();

    const { theme, handleThemeToggle, getThemeIcon } = useTheme();
    const { errors, showError, dismissError } = useErrorHandler();
    const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.RENDERED);
    const [showFindReplace, setShowFindReplace] = useState(false);
    const [splitDividerPosition, setSplitDividerPosition] = useState(50); // percentage
    const [highlightedContent, setHighlightedContent] = useState<React.ReactNode | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
    const [searchCurrentMatch, setSearchCurrentMatch] = useState(0);
    const [showHeadingsMenu, setShowHeadingsMenu] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const splitViewRef = useRef<HTMLDivElement>(null);
    const headingsMenuRef = useRef<HTMLDivElement>(null);

    // Update CSS custom property for split pane position (CSP-compliant)
    useEffect(() => {
        if (splitViewRef.current) {
            splitViewRef.current.style.setProperty('--split-position', `${splitDividerPosition}%`);
        }
    }, [splitDividerPosition]);

    // Close headings menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (showHeadingsMenu && headingsMenuRef.current && !headingsMenuRef.current.contains(event.target as Node)) {
                setShowHeadingsMenu(false);
            }
        };

        if (showHeadingsMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHeadingsMenu]);

    const { handleFormat } = useTextFormatting(activeDoc.content, updateContent, textareaRef, viewMode);
    useFileHandler(addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId, documents, closeDocument, showError);

    // Handle heading format with menu close
    const handleHeadingFormat = useCallback((level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'): void => {
        handleFormat(level);
        setShowHeadingsMenu(false);
    }, [handleFormat]);

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
                const filePath = result.filePath?.toLowerCase() || '';
                let message = 'Markdown saved successfully!';
                if (filePath.endsWith('.pdf')) {
                    message = 'PDF exported successfully!';
                } else if (filePath.endsWith('.txt')) {
                    message = 'Text file saved successfully!';
                }
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

    // Handle find - now works in all view modes
    const handleFind = useCallback((): void => {
        setShowFindReplace(true);
    }, []);

    // Handle search highlight updates from FindReplace component
    const handleRenderedHighlight = useCallback((term: string, caseSensitive: boolean, matchIndex: number): void => {
        setSearchTerm(term);
        setSearchCaseSensitive(caseSensitive);
        setSearchCurrentMatch(matchIndex);
    }, []);

    const handleTextHighlight = useCallback((term: string, caseSensitive: boolean, matchIndex: number): void => {
        setSearchTerm(term);
        setSearchCaseSensitive(caseSensitive);
        setSearchCurrentMatch(matchIndex);
    }, []);

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onBold: () => handleFormat('bold'),
        onItalic: () => handleFormat('italic'),
        onToggleView: useCallback(() => {
            setViewMode(prev => {
                if (prev === VIEW_MODES.RENDERED) return VIEW_MODES.RAW;
                if (prev === VIEW_MODES.RAW) return VIEW_MODES.SPLIT;
                if (prev === VIEW_MODES.SPLIT) return VIEW_MODES.TEXT;
                return VIEW_MODES.RENDERED;
            });
        }, []),
        onToggleTheme: handleThemeToggle,
        onSave: handleSave,
        onFind: handleFind,
        onUndo: undo,
        onRedo: redo,
    });

    // Performance: Memoize text statistics
    const textStats = useMemo(
        () => calculateTextStats(activeDoc.content),
        [activeDoc.content]
    );

    const handleCopy = useCallback(async (): Promise<void> => {
        try {
            if (viewMode === VIEW_MODES.RAW) {
                // Security: Sanitize text to remove control characters
                const sanitizedText = sanitizeTextForClipboard(activeDoc.content);
                await navigator.clipboard.writeText(sanitizedText);
            } else if (viewMode === VIEW_MODES.TEXT) {
                // Copy plain text conversion with sanitization
                const plainText = convertMarkdownToText(activeDoc.content);
                const sanitizedText = sanitizeTextForClipboard(plainText);
                await navigator.clipboard.writeText(sanitizedText);
            } else {
                // Rendered or Split mode: Copy HTML with sanitization
                const previewElement = document.querySelector('.markdown-preview') as HTMLElement | null;
                if (previewElement) {
                    try {
                        // Security: Sanitize HTML before copying to clipboard (HIGH-4 fix)
                        // This removes dangerous elements (script, iframe, etc.),
                        // event handlers (onclick, onerror, etc.), and unsafe URLs
                        const sanitizedHtml = sanitizeHtmlForClipboard(previewElement.innerHTML);
                        const sanitizedText = sanitizeTextForClipboard(previewElement.innerText);

                        const htmlBlob = new Blob([sanitizedHtml], { type: 'text/html' });
                        const textBlob = new Blob([sanitizedText], { type: 'text/plain' });
                        const data = [new ClipboardItem({
                            'text/html': htmlBlob,
                            'text/plain': textBlob
                        })];
                        await navigator.clipboard.write(data);
                    } catch (richCopyErr) {
                        // Fallback to plain text if rich text copy fails
                        // Security: Still sanitize the text fallback
                        const sanitizedText = sanitizeTextForClipboard(previewElement.innerText);
                        await navigator.clipboard.writeText(sanitizedText);
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
                    // Security: Validate content size before processing (HIGH-2 fix)
                    if (doc.content.length > RENDERER_SECURITY.MAX_CONTENT_LENGTH) {
                        showError(`Content too large. Maximum size is ${RENDERER_SECURITY.MAX_CONTENT_SIZE_MB}MB.`);
                        return;
                    }

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

        markdownFiles.forEach(async (file: File) => {
            // Use secure method to get file path (works in Electron renderer)
            let filePath: string | null = null;

            if (window.electronAPI?.getPathForFile) {
                try {
                    filePath = window.electronAPI.getPathForFile(file);
                } catch (e) {
                    console.error('Failed to get path for file', e);
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

                if (result.error) {
                    showError(result.error);
                    return;
                }

                const content = result.content;

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
            } catch (err) {
                showError(`Failed to read file: ${file.name}`);
            }
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
                        disabled={viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT}
                    >
                        <b>B</b>
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('italic')}
                        title="Italic (Cmd+I)"
                        aria-label="Format selected text as italic"
                        disabled={viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT}
                    >
                        <i>I</i>
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('list')}
                        title="List"
                        aria-label="Format selected text as list item"
                        disabled={viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT}
                    >
                        •
                    </button>
                    <div className="toolbar-divider" role="separator"></div>

                    <div className="headings-dropdown-wrapper" ref={headingsMenuRef}>
                        <button
                            className="icon-btn"
                            onClick={() => setShowHeadingsMenu(!showHeadingsMenu)}
                            title="Headings"
                            aria-label="Insert heading"
                            aria-expanded={showHeadingsMenu}
                            aria-haspopup="true"
                            disabled={viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT}
                        >
                            H▾
                        </button>
                        {showHeadingsMenu && (
                            <div className="headings-dropdown-menu" role="menu">
                                <button
                                    className="headings-menu-item"
                                    onClick={() => handleHeadingFormat('h1')}
                                    role="menuitem"
                                    tabIndex={0}
                                >
                                    <span className="heading-preview h1-preview">Heading 1</span>
                                </button>
                                <button
                                    className="headings-menu-item"
                                    onClick={() => handleHeadingFormat('h2')}
                                    role="menuitem"
                                    tabIndex={0}
                                >
                                    <span className="heading-preview h2-preview">Heading 2</span>
                                </button>
                                <button
                                    className="headings-menu-item"
                                    onClick={() => handleHeadingFormat('h3')}
                                    role="menuitem"
                                    tabIndex={0}
                                >
                                    <span className="heading-preview h3-preview">Heading 3</span>
                                </button>
                                <button
                                    className="headings-menu-item"
                                    onClick={() => handleHeadingFormat('h4')}
                                    role="menuitem"
                                    tabIndex={0}
                                >
                                    <span className="heading-preview h4-preview">Heading 4</span>
                                </button>
                                <button
                                    className="headings-menu-item"
                                    onClick={() => handleHeadingFormat('h5')}
                                    role="menuitem"
                                    tabIndex={0}
                                >
                                    <span className="heading-preview h5-preview">Heading 5</span>
                                </button>
                                <button
                                    className="headings-menu-item"
                                    onClick={() => handleHeadingFormat('h6')}
                                    role="menuitem"
                                    tabIndex={0}
                                >
                                    <span className="heading-preview h6-preview">Heading 6</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('code')}
                        title="Code Block"
                        aria-label="Insert code block"
                        disabled={viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT}
                    >
                        &lt;/&gt;
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('quote')}
                        title="Blockquote"
                        aria-label="Insert blockquote"
                        disabled={viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT}
                    >
                        &ldquo;&rdquo;
                    </button>
                    <div className="toolbar-divider" role="separator"></div>

                    <button
                        className="icon-btn"
                        onClick={handleCopy}
                        title="Copy (Cmd+C)"
                        aria-label={viewMode === VIEW_MODES.RAW ? 'Copy raw markdown' : viewMode === VIEW_MODES.TEXT ? 'Copy plain text' : 'Copy rendered content'}
                    >
                        📋
                    </button>

                    <button
                        className="icon-btn"
                        onClick={handleSave}
                        title="Save As... (Markdown, PDF, or TXT) (Cmd+S)"
                        aria-label="Save document as Markdown, PDF, or TXT"
                    >
                        💾
                    </button>

                    <button
                        className="icon-btn"
                        onClick={handleFind}
                        title="Find (Cmd+F)"
                        aria-label="Open find panel"
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
                            className={`toggle-btn ${viewMode === VIEW_MODES.RENDERED ? 'active' : ''}`}
                            onClick={() => setViewMode(VIEW_MODES.RENDERED)}
                            title="Rendered Mode (Cmd+E to cycle)"
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.RENDERED}
                            aria-controls="content-area"
                        >
                            Rendered
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === VIEW_MODES.RAW ? 'active' : ''}`}
                            onClick={() => setViewMode(VIEW_MODES.RAW)}
                            title="Raw Mode (Cmd+E to cycle)"
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.RAW}
                            aria-controls="content-area"
                        >
                            Raw
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
                        <button
                            className={`toggle-btn ${viewMode === VIEW_MODES.TEXT ? 'active' : ''}`}
                            onClick={() => setViewMode(VIEW_MODES.TEXT)}
                            title="Text Mode (Cmd+E to cycle)"
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.TEXT}
                            aria-controls="content-area"
                        >
                            Text
                        </button>
                    </div>
                </div>
            </div>
            <div
                className="content-area"
                id="content-area"
                role="tabpanel"
                aria-label={
                    viewMode === VIEW_MODES.RENDERED
                        ? 'Markdown preview'
                        : viewMode === VIEW_MODES.SPLIT
                            ? 'Split view: code and preview'
                            : viewMode === VIEW_MODES.TEXT
                                ? 'Plain text preview'
                                : 'Markdown editor'
                }
            >
                {showFindReplace && (
                    <FindReplace
                        content={activeDoc.content}
                        onClose={() => {
                            setShowFindReplace(false);
                            setHighlightedContent(null);
                            setSearchTerm('');
                        }}
                        onReplace={updateContent}
                        textareaRef={textareaRef}
                        onHighlightedContentChange={setHighlightedContent}
                        viewMode={viewMode}
                        onRenderedHighlight={handleRenderedHighlight}
                        onTextHighlight={handleTextHighlight}
                    />
                )}
                {viewMode === VIEW_MODES.RENDERED ? (
                    <MarkdownPreview
                        content={activeDoc.content}
                        theme={theme}
                        searchTerm={searchTerm}
                        caseSensitive={searchCaseSensitive}
                        currentMatchIndex={searchCurrentMatch}
                    />
                ) : viewMode === VIEW_MODES.RAW ? (
                    <CodeEditor
                        ref={textareaRef}
                        content={activeDoc.content}
                        onChange={updateContent}
                        highlightedContent={highlightedContent}
                    />
                ) : viewMode === VIEW_MODES.TEXT ? (
                    <TextPreview
                        content={activeDoc.content}
                        searchTerm={searchTerm}
                        caseSensitive={searchCaseSensitive}
                        currentMatchIndex={searchCurrentMatch}
                    />
                ) : (
                    <div ref={splitViewRef} className="split-view">
                        <div className="split-pane split-pane-left">
                            <CodeEditor
                                ref={textareaRef}
                                content={activeDoc.content}
                                onChange={updateContent}
                                highlightedContent={highlightedContent}
                            />
                        </div>
                        <div
                            className="split-divider"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startWidth = splitDividerPosition;
                                // Capture container width at mousedown time (not during mousemove)
                                const containerWidth = (e.currentTarget as HTMLElement).parentElement?.clientWidth || 1;

                                const handleMouseMove = (moveEvent: MouseEvent): void => {
                                    const deltaX = moveEvent.clientX - startX;
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
                        <div className="split-pane split-pane-right">
                            <MarkdownPreview
                                content={activeDoc.content}
                                theme={theme}
                                searchTerm={searchTerm}
                                caseSensitive={searchCaseSensitive}
                                currentMatchIndex={searchCurrentMatch}
                            />
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
