import React, { useState, useRef, useMemo, useCallback, memo } from 'react';
import MarkdownPreview from './components/MarkdownPreview';
import CodeEditor from './components/CodeEditor';
import ErrorNotification from './components/ErrorNotification';
import { useDocuments, useTheme, useTextFormatting, useFileHandler, useErrorHandler, useKeyboardShortcuts } from './hooks/index.js';
import { VIEW_MODES } from './constants/index.js';
import { calculateTextStats } from './utils/textCalculations.js';
import './index.css';

const App = () => {
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
    const [viewMode, setViewMode] = useState(VIEW_MODES.PREVIEW);
    const textareaRef = useRef(null);

    const { handleFormat } = useTextFormatting(activeDoc.content, updateContent, textareaRef, viewMode);
    useFileHandler(addDocument, updateExistingDocument, findDocumentByPath, setActiveTabId);

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onBold: () => handleFormat('bold'),
        onItalic: () => handleFormat('italic'),
        onToggleView: useCallback(() => {
            setViewMode(prev => prev === VIEW_MODES.PREVIEW ? VIEW_MODES.CODE : VIEW_MODES.PREVIEW);
        }, []),
        onToggleTheme: handleThemeToggle,
    });

    // Performance: Memoize text statistics
    const textStats = useMemo(
        () => calculateTextStats(activeDoc.content),
        [activeDoc.content]
    );

    const handleCopy = useCallback(async () => {
        try {
            if (viewMode === VIEW_MODES.CODE) {
                await navigator.clipboard.writeText(activeDoc.content);
            } else {
                const previewElement = document.querySelector('.markdown-preview');
                if (previewElement) {
                    try {
                        const htmlBlob = new Blob([previewElement.innerHTML], { type: 'text/html' });
                        const textBlob = new Blob([previewElement.innerText], { type: 'text/plain' });
                        const data = [new ClipboardItem({
                            'text/html': htmlBlob,
                            'text/plain': textBlob
                        })];
                        await navigator.clipboard.write(data);
                    } catch (err) {
                        // Fallback to plain text
                        await navigator.clipboard.writeText(previewElement.innerText);
                    }
                }
            }
        } catch (err) {
            showError('Failed to copy to clipboard');
        }
    }, [viewMode, activeDoc.content, showError]);

    const handleCloseTab = (e, id) => {
        e.stopPropagation();
        closeDocument(id);
    };

    const handleDragStart = (e, doc) => {
        e.dataTransfer.setData('text/plain', JSON.stringify(doc));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = (e, doc) => {
        // Check if dropped outside the window
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
                closeDocument(doc.id);
            }
        }
    };

    return (
        <div className="app-container">
            <ErrorNotification errors={errors} onDismiss={dismissError} />
            <div className="tab-bar" role="tablist" aria-label="Open documents">
                {documents.map(doc => (
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
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.PREVIEW}
                            aria-controls="content-area"
                        >
                            Preview
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === VIEW_MODES.CODE ? 'active' : ''}`}
                            onClick={() => setViewMode(VIEW_MODES.CODE)}
                            role="tab"
                            aria-selected={viewMode === VIEW_MODES.CODE}
                            aria-controls="content-area"
                        >
                            Code
                        </button>
                    </div>
                </div>
            </div>
            <div
                className="content-area"
                id="content-area"
                role="tabpanel"
                aria-label={viewMode === VIEW_MODES.PREVIEW ? 'Markdown preview' : 'Markdown editor'}
            >
                {viewMode === VIEW_MODES.PREVIEW ? (
                    <MarkdownPreview content={activeDoc.content} />
                ) : (
                    <CodeEditor ref={textareaRef} content={activeDoc.content} onChange={updateContent} />
                )}
            </div>
            <div className="status-bar" role="status" aria-live="polite">
                <div className="status-item" aria-label="Word count">Words: {textStats.wordCount}</div>
                <div className="status-item" aria-label="Character count">Chars: {textStats.charCount}</div>
                <div className="status-item" aria-label="Estimated tokens">Tokens: {textStats.tokenCount}</div>
            </div>
        </div>
    );
};

export default App;
