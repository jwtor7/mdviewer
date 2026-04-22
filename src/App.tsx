import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import MarkdownPreview from './components/MarkdownPreview';
import CodeEditor from './components/CodeEditor';
import ErrorNotification from './components/ErrorNotification';
import FindReplace from './components/FindReplace';
import TextPreview from './components/TextPreview';
import ReadAloudMenu from './components/ReadAloudMenu';
import {
    useDocuments,
    useTheme,
    useTextFormatting,
    useFileHandler,
    useErrorHandler,
    useKeyboardShortcuts,
    useFileWatcher,
    useWordWrap,
    useDragDrop,
    useClipboardCopy,
    useSaveFile,
    useIPCListeners,
    useSplitPaneDivider,
    useOutsideClickHandler,
    useTextToSpeech,
    useTTSPreferences,
} from './hooks/index';
import { VIEW_MODES, type ViewMode } from './constants/index';
import type { Document } from './types/document';
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
        markDocumentSaved,
        undo,
        redo,
        reorderDocuments,
    } = useDocuments();

    const { theme, handleThemeToggle, getThemeIcon } = useTheme();
    const { wordWrap, toggleWordWrap } = useWordWrap();
    const { errors, showError, dismissError } = useErrorHandler();

    // Drag-and-drop handling for tabs and files
    const {
        handleDragStart,
        handleDragEnd,
        handleFileDragOver,
        handleFileDrop,
        handleTabDrop,
        handleTabDragOver,
        closeTabOrWindow,
    } = useDragDrop({
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
    });

    const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.RENDERED);
    const [showFindReplace, setShowFindReplace] = useState(false);
    const [showGoalInput, setShowGoalInput] = useState(false);
    const [goalInputValue, setGoalInputValue] = useState('');
    const [splitDividerPosition, setSplitDividerPosition] = useState(50); // percentage
    const [highlightedContent, setHighlightedContent] = useState<React.ReactNode | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
    const [searchCurrentMatch, setSearchCurrentMatch] = useState(0);
    const [tabTooltip, setTabTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
    const [showHeadingsMenu, setShowHeadingsMenu] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; docId: string } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const splitViewRef = useRef<HTMLDivElement>(null);
    const headingsMenuRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Integrate useOutsideClickHandler for headings menu
    useOutsideClickHandler({
        ref: headingsMenuRef,
        isOpen: showHeadingsMenu,
        onClose: () => setShowHeadingsMenu(false)
    });

    // Integrate useOutsideClickHandler for context menu
    useOutsideClickHandler({
        ref: contextMenuRef,
        isOpen: !!contextMenu,
        onClose: () => setContextMenu(null)
    });

    // Update CSS custom property for split pane position (CSP-compliant)
    useEffect(() => {
        if (splitViewRef.current) {
            splitViewRef.current.style.setProperty('--split-position', `${splitDividerPosition}%`);
        }
    }, [splitDividerPosition]);

    const { handleFormat } = useTextFormatting(activeDoc.content, updateContent, textareaRef, viewMode);

    // Integrate useSaveFile hook
    const { handleSave } = useSaveFile({
        activeDoc,
        updateExistingDocument,
        markDocumentSaved,
        showError,
    });

    // Integrate useClipboardCopy hook
    const { handleCopy } = useClipboardCopy({
        viewMode,
        content: activeDoc.content,
        showError,
    });

    // Text-to-speech narration
    const {
        isSpeaking,
        status: ttsStatus,
        speak,
        stop: stopSpeech,
        pause: pauseSpeech,
        resume: resumeSpeech,
        nextSentence: ttsNextSentence,
        prevSentence: ttsPrevSentence,
        nextChunk: ttsNextChapter,
        prevChunk: ttsPrevChapter,
        setLiveRate: ttsSetLiveRate,
        setLiveVoice: ttsSetLiveVoice,
        currentSourceOffset: ttsCurrentOffset,
        chapters: ttsChapters,
        speakingTabId,
    } = useTextToSpeech({ showError, activeTabId });
    const { voice: ttsVoice, rate: ttsRate, setVoice: setTTSVoice, setRate: setTTSRate } = useTTSPreferences();
    const [showReadAloudMenu, setShowReadAloudMenu] = useState(false);
    const readAloudMenuRef = useRef<HTMLDivElement>(null);

    // Push rate/voice changes into the active narration so the user hears
    // them within one sentence instead of having to stop and restart.
    useEffect(() => {
        void ttsSetLiveRate(ttsRate);
    }, [ttsRate, ttsSetLiveRate]);

    useEffect(() => {
        void ttsSetLiveVoice(ttsVoice);
    }, [ttsVoice, ttsSetLiveVoice]);

    useOutsideClickHandler({
        ref: readAloudMenuRef,
        isOpen: showReadAloudMenu,
        onClose: () => setShowReadAloudMenu(false)
    });

    const handleReadAloud = useCallback((): void => {
        if (ttsStatus === 'speaking') {
            pauseSpeech();
            return;
        }
        if (ttsStatus === 'paused') {
            resumeSpeech();
            return;
        }
        if (!activeDoc.content || activeDoc.content.trim().length === 0) {
            showError('Nothing to read');
            return;
        }
        speak(activeDoc.content, { voice: ttsVoice, rate: ttsRate, tabId: activeDoc.id });
    }, [ttsStatus, pauseSpeech, resumeSpeech, activeDoc.content, activeDoc.id, speak, showError, ttsVoice, ttsRate]);

    const handleStopSpeech = useCallback((): void => {
        if (ttsStatus === 'idle') return;
        stopSpeech();
    }, [ttsStatus, stopSpeech]);

    const handleTestVoice = useCallback((): void => {
        speak('The quick brown fox jumps over the lazy dog.', { voice: ttsVoice, rate: ttsRate, tabId: activeDoc.id });
    }, [speak, ttsVoice, ttsRate, activeDoc.id]);

    const handleNextSentence = useCallback((): void => {
        if (ttsStatus === 'idle') return;
        void ttsNextSentence();
    }, [ttsStatus, ttsNextSentence]);

    const handlePrevSentence = useCallback((): void => {
        if (ttsStatus === 'idle') return;
        void ttsPrevSentence();
    }, [ttsStatus, ttsPrevSentence]);

    const handleNextChapter = useCallback((): void => {
        if (ttsStatus === 'idle') return;
        void ttsNextChapter();
    }, [ttsStatus, ttsNextChapter]);

    const handlePrevChapter = useCallback((): void => {
        if (ttsStatus === 'idle') return;
        void ttsPrevChapter();
    }, [ttsStatus, ttsPrevChapter]);

    const canReadFromCursor = viewMode === VIEW_MODES.RAW || viewMode === VIEW_MODES.SPLIT;

    const handleReadFromCursor = useCallback((): void => {
        if (!canReadFromCursor) {
            showError('Read from cursor only works in Raw or Split view');
            return;
        }
        if (!activeDoc.content || activeDoc.content.trim().length === 0) {
            showError('Nothing to read');
            return;
        }
        const offset = textareaRef.current?.selectionStart ?? 0;
        console.log('[tts] handleReadFromCursor offset=', offset, 'rate=', ttsRate, 'voice=', ttsVoice, 'textareaRef?', !!textareaRef.current);
        speak(activeDoc.content, { voice: ttsVoice, rate: ttsRate, tabId: activeDoc.id, fromOffset: offset });
    }, [canReadFromCursor, activeDoc.content, activeDoc.id, speak, ttsVoice, ttsRate, showError]);

    const handleChapterSelect = useCallback((chapterIndex: number): void => {
        if (!activeDoc.content || activeDoc.content.trim().length === 0) {
            showError('Nothing to read');
            return;
        }
        speak(activeDoc.content, { voice: ttsVoice, rate: ttsRate, tabId: activeDoc.id, chapterIndex });
        setShowReadAloudMenu(false);
    }, [activeDoc.content, activeDoc.id, speak, ttsVoice, ttsRate, showError]);

    // Source offsets for the speaking paragraph, passed to MarkdownPreview for highlighting.
    const speakingOffsetStart = ttsCurrentOffset?.start ?? null;
    const speakingOffsetEnd = ttsCurrentOffset?.end ?? null;

    // Handle heading format with menu close
    const handleHeadingFormat = useCallback((level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'): void => {
        handleFormat(level);
        setShowHeadingsMenu(false);
    }, [handleFormat]);

    // Keep the window title in sync with the active document state
    useEffect(() => {
        const dirtyPrefix = activeDoc.dirty ? '* ' : '';
        document.title = `${dirtyPrefix}${activeDoc.name} - mdviewer`;
    }, [activeDoc.name, activeDoc.dirty]);

    // Wire up file handlers (open, new, save from menu)
    useFileHandler(
        addDocument,
        updateExistingDocument,
        findDocumentByPath,
        setActiveTabId,
        documents,
        closeDocument,
        showError,
        handleSave,
        () => setViewMode(VIEW_MODES.RAW) // Switch to Raw view when File → New is triggered
    );

    // Integrate useSplitPaneDivider hook
    const { handleDividerMouseDown } = useSplitPaneDivider({
        splitDividerPosition,
        setSplitDividerPosition,
    });

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

    // Handle new document creation
    const handleNewDocument = useCallback((): void => {
        addDocument({
            name: 'Untitled',
            content: '',
            filePath: null,
        });
        // Switch to Raw view for new empty documents
        setViewMode(VIEW_MODES.RAW);
    }, [addDocument]);

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
        onToggleWordWrap: toggleWordWrap,
        onSave: handleSave,
        onFind: handleFind,
        onUndo: undo,
        onRedo: redo,
        onNew: handleNewDocument,
        onReadAloud: handleReadAloud,
        // Sentence/chapter/stop bindings only register while TTS is active so
        // that Cmd+Shift+←/→ and Cmd+Shift+. don't steal text-selection or
        // other keys during normal editing.
        onStopReading: ttsStatus !== 'idle' ? handleStopSpeech : undefined,
        onNextSentence: ttsStatus !== 'idle' ? handleNextSentence : undefined,
        onPrevSentence: ttsStatus !== 'idle' ? handlePrevSentence : undefined,
        onNextChapter: ttsStatus !== 'idle' ? handleNextChapter : undefined,
        onPrevChapter: ttsStatus !== 'idle' ? handlePrevChapter : undefined,
        onReadFromCursor: handleReadFromCursor,
    });

    // Performance: Memoize text statistics
    const textStats = useMemo(
        () => calculateTextStats(activeDoc.content),
        [activeDoc.content]
    );

    const goalProgress = useMemo(() => {
        const goal = activeDoc.wordCountGoal;
        if (!goal || goal <= 0) return { ratio: 0, bar: 0, tier: '' as const };
        const ratio = textStats.wordCount / goal;
        const bar = Math.min(ratio, 1);
        const tier = ratio >= 1.2 ? 'goal-way-over'
            : ratio >= 1.0 ? 'goal-over'
            : ratio >= 0.9 ? 'goal-near'
            : '';
        return { ratio, bar, tier };
    }, [activeDoc.wordCountGoal, textStats.wordCount]);

    // Close goal input when switching tabs
    useEffect(() => {
        setShowGoalInput(false);
    }, [activeTabId]);

    const goalBlurRef = useRef(false);

    const handleWordCountClick = useCallback(() => {
        if (goalBlurRef.current) {
            goalBlurRef.current = false;
            return;
        }
        if (showGoalInput) return;
        setShowGoalInput(true);
        setGoalInputValue(activeDoc.wordCountGoal?.toString() ?? '');
    }, [showGoalInput, activeDoc.wordCountGoal]);

    const handleGoalSubmit = useCallback(() => {
        goalBlurRef.current = true;
        const parsed = parseInt(goalInputValue, 10);
        const goal = parsed > 0 ? parsed : undefined;
        updateExistingDocument(activeDoc.id, { wordCountGoal: goal });
        setShowGoalInput(false);
        setTimeout(() => { goalBlurRef.current = false; }, 0);
    }, [goalInputValue, activeDoc.id, updateExistingDocument]);

    const handleGoalKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleGoalSubmit();
        } else if (e.key === 'Escape') {
            setShowGoalInput(false);
        }
    }, [handleGoalSubmit]);

    const handleCloseTab = async (e: React.MouseEvent<HTMLButtonElement>, id: string): Promise<void> => {
        e.stopPropagation();

        // Stop narration if we're closing the tab that owns it.
        if (speakingTabId === id) {
            stopSpeech();
        }

        // Check if document has unsaved changes
        const doc = documents.find(d => d.id === id);
        if (doc?.dirty && window.electronAPI?.showUnsavedDialog) {
            try {
                const result = await window.electronAPI.showUnsavedDialog(doc.name);
                if (!result.success) {
                    showError(result.error || 'Failed to show unsaved changes dialog');
                    return;
                }

                if (result.data.response === 'cancel') {
                    return; // Don't close
                } else if (result.data.response === 'save') {
                    // Save first, then close
                    // Switch to the document to save it
                    if (id !== activeTabId) {
                        setActiveTabId(id);
                    }
                    await handleSave();
                    // Close after save
                    closeTabOrWindow(id);
                } else {
                    // Don't save, just close
                    closeTabOrWindow(id);
                }
            } catch {
                showError('Failed to show unsaved changes dialog');
                return;
            }
        } else {
            closeTabOrWindow(id);
        }
    };

    // Handle tab context menu (right-click)
    const handleTabContextMenu = (e: React.MouseEvent<HTMLDivElement>, docId: string): void => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            docId
        });
    };

    // Handle reveal in Finder
    const handleRevealInFinder = async (docId: string): Promise<void> => {
        const doc = documents.find(d => d.id === docId);
        if (!doc?.filePath || !window.electronAPI?.revealInFinder) {
            return;
        }

        try {
                const result = await window.electronAPI.revealInFinder(doc.filePath);
                if (!result.success) {
                    showError(result.error || 'Failed to reveal file in Finder');
                }
        } catch {
            showError('Failed to reveal file in Finder');
        } finally {
            setContextMenu(null);
        }
    };

    // Handle copy path to clipboard
    const handleCopyPath = async (docId: string): Promise<void> => {
        const doc = documents.find(d => d.id === docId);
        if (!doc?.filePath) {
            return;
        }

        try {
            await navigator.clipboard.writeText(doc.filePath);
        } catch {
            showError('Failed to copy path to clipboard');
        } finally {
            setContextMenu(null);
        }
    };

    // Integrate useIPCListeners hook (after handleCloseTab is declared)
    useIPCListeners({
        documents,
        handleSave,
        setActiveTabId,
        handleFormat,
        toggleWordWrap,
        handleCloseTab,
        activeTabId,
    });

    // Watch open files for external changes and auto-reload when clean
    useFileWatcher({
        documents,
        updateExistingDocument,
        markDocumentSaved,
    });

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
                        className={`tab ${activeTabId === doc.id ? 'active' : ''} ${doc.dirty ? 'dirty' : ''}`}
                        onClick={() => setActiveTabId(doc.id)}
                        onContextMenu={(e) => handleTabContextMenu(e, doc.id)}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, doc, documents.indexOf(doc))}
                        onDragEnd={(e) => handleDragEnd(e, doc)}
                        onDragOver={handleTabDragOver}
                        onDrop={(e) => handleTabDrop(e, doc)}
                        role="tab"
                        aria-selected={activeTabId === doc.id}
                        aria-label={`${doc.name}${doc.dirty ? ' (unsaved changes)' : ''}`}
                        aria-controls="content-area"
                        tabIndex={activeTabId === doc.id ? 0 : -1}
                        onMouseEnter={(e) => {
                            if (doc.filePath) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTabTooltip({ text: doc.filePath, x: rect.left, y: rect.bottom + 4 });
                            }
                        }}
                        onMouseLeave={() => setTabTooltip(null)}
                    >
                        {doc.dirty && <span className="tab-dirty-indicator" aria-hidden="true" />}
                        <span className="tab-label">{doc.name}</span>
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
                <button
                    className="new-tab-btn"
                    onClick={handleNewDocument}
                    aria-label="New document (Cmd+N)"
                    title="New document (Cmd+N)"
                >
                    +
                </button>
            </div>
            {tabTooltip && (
                <div
                    className="tab-tooltip"
                    style={{ left: tabTooltip.x, top: tabTooltip.y }}
                >
                    {tabTooltip.text}
                </div>
            )}
            <div className="toolbar">
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
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('hr')}
                        title="Horizontal Rule"
                        aria-label="Insert horizontal rule"
                        disabled={viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT}
                    >
                        ―
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
                        title="Save As... (Markdown, PDF, or Text) (Cmd+S)"
                        aria-label="Save document as Markdown, PDF, or Text"
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

                    <div className="read-aloud-wrapper" ref={readAloudMenuRef}>
                        <button
                            className="icon-btn"
                            onClick={handleReadAloud}
                            title={
                                ttsStatus === 'speaking' ? 'Pause Reading (Cmd+Shift+R)' :
                                ttsStatus === 'paused' ? 'Resume Reading (Cmd+Shift+R)' :
                                'Read Aloud (Cmd+Shift+R)'
                            }
                            aria-label={
                                ttsStatus === 'speaking' ? 'Pause reading aloud' :
                                ttsStatus === 'paused' ? 'Resume reading aloud' :
                                'Read document aloud'
                            }
                            disabled={ttsStatus === 'idle' && (!activeDoc.content || activeDoc.content.trim().length === 0)}
                        >
                            {ttsStatus === 'speaking' ? '⏸' : ttsStatus === 'paused' ? '▶' : '🔊'}
                        </button>
                        {ttsStatus !== 'idle' && (
                            <>
                                <button
                                    className="icon-btn"
                                    onClick={handlePrevChapter}
                                    title="Previous Chapter (Cmd+Shift+[)"
                                    aria-label="Jump to previous chapter"
                                    disabled={ttsChapters.length === 0}
                                >
                                    ⏮
                                </button>
                                <button
                                    className="icon-btn"
                                    onClick={handlePrevSentence}
                                    title="Previous Sentence (Cmd+Shift+←)"
                                    aria-label="Jump to previous sentence"
                                >
                                    ⏪
                                </button>
                                <button
                                    className="icon-btn"
                                    onClick={handleNextSentence}
                                    title="Next Sentence (Cmd+Shift+→)"
                                    aria-label="Jump to next sentence"
                                >
                                    ⏩
                                </button>
                                <button
                                    className="icon-btn"
                                    onClick={handleNextChapter}
                                    title="Next Chapter (Cmd+Shift+])"
                                    aria-label="Jump to next chapter"
                                    disabled={ttsChapters.length === 0}
                                >
                                    ⏭
                                </button>
                                <button
                                    className="icon-btn"
                                    onClick={handleStopSpeech}
                                    title="Stop Reading (Cmd+Shift+.)"
                                    aria-label="Stop reading aloud"
                                >
                                    ⏹
                                </button>
                            </>
                        )}
                        <button
                            className="icon-btn read-aloud-caret"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setShowReadAloudMenu(prev => !prev)}
                            title="Read Aloud settings"
                            aria-label="Open text-to-speech settings"
                            aria-expanded={showReadAloudMenu}
                            aria-haspopup="true"
                        >
                            ▾
                        </button>
                        {showReadAloudMenu && (
                            <ReadAloudMenu
                                voice={ttsVoice}
                                rate={ttsRate}
                                onVoiceChange={setTTSVoice}
                                onRateChange={setTTSRate}
                                onTestVoice={handleTestVoice}
                                chapters={ttsChapters.map(ch => ({ index: ch.index, title: ch.title }))}
                                onSelectChapter={handleChapterSelect}
                                canReadFromCursor={canReadFromCursor}
                                onReadFromCursor={() => { handleReadFromCursor(); setShowReadAloudMenu(false); }}
                            />
                        )}
                    </div>

                    <button
                        className="icon-btn"
                        onClick={toggleWordWrap}
                        title={`Word Wrap: ${wordWrap ? 'On' : 'Off'} (Cmd+Alt+W)`}
                        aria-label={`Toggle word wrap. Currently ${wordWrap ? 'on' : 'off'}.`}
                    >
                        {wordWrap ? '⤸' : '→'}
                    </button>

                    <button
                        className="icon-btn"
                        onClick={handleThemeToggle}
                        title={`Theme: ${theme} (Cmd+T)`}
                        aria-label={`Current theme: ${theme}. Click to change theme.`}
                    >
                        {getThemeIcon()}
                    </button>
                </div>

                <div className="toolbar-group toolbar-group-right">
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
                        filePath={activeDoc.filePath || undefined}
                        onContentChange={updateContent}
                        speakingOffsetStart={speakingOffsetStart}
                        speakingOffsetEnd={speakingOffsetEnd}
                    />
                ) : viewMode === VIEW_MODES.RAW ? (
                    <CodeEditor
                        ref={textareaRef}
                        content={activeDoc.content}
                        onChange={updateContent}
                        highlightedContent={highlightedContent}
                        wordWrap={wordWrap}
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
                                wordWrap={wordWrap}
                            />
                        </div>
                        <div
                            className="split-divider"
                            onMouseDown={handleDividerMouseDown}
                        />
                        <div className="split-pane split-pane-right">
                            <MarkdownPreview
                                content={activeDoc.content}
                                theme={theme}
                                searchTerm={searchTerm}
                                caseSensitive={searchCaseSensitive}
                                currentMatchIndex={searchCurrentMatch}
                                filePath={activeDoc.filePath || undefined}
                                onContentChange={updateContent}
                                speakingOffsetStart={speakingOffsetStart}
                                speakingOffsetEnd={speakingOffsetEnd}
                            />
                        </div>
                    </div>
                )}
            </div>
            <div className="status-bar" role="status" aria-live="polite">
                <div
                    className={`status-item status-item-wordcount${goalProgress.tier ? ` ${goalProgress.tier}` : ''}`}
                    style={activeDoc.wordCountGoal ? { '--goal-progress': goalProgress.bar } as React.CSSProperties : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={activeDoc.wordCountGoal ? `Word count: ${textStats.wordCount} of ${activeDoc.wordCountGoal} goal. Click to change.` : 'Word count. Click to set goal.'}
                    onClick={handleWordCountClick}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleWordCountClick(); }}
                >
                    Words: {textStats.wordCount}{activeDoc.wordCountGoal ? ` / ${activeDoc.wordCountGoal}` : ''}
                    {showGoalInput && (
                        <input
                            type="number"
                            className="word-goal-input"
                            value={goalInputValue}
                            onChange={(e) => setGoalInputValue(e.target.value)}
                            onKeyDown={handleGoalKeyDown}
                            onBlur={handleGoalSubmit}
                            aria-label="Set word count goal"
                            min="0"
                            placeholder="Goal..."
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>
                <div className="status-item" aria-label="Character count">Chars: {textStats.charCount}</div>
                <div className="status-item" aria-label="Estimated tokens">Tokens: {textStats.tokenCount}</div>
                <div className="status-item" aria-label="Estimated reading time">~{textStats.readingTime} min read</div>
                <div className="status-item status-version" aria-label="App version">v{pkg.version}</div>
                <div className="status-item status-copyright" aria-label="Copyright">© Junior Williams</div>
            </div>
            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    className="tab-context-menu"
                    style={{
                        left: `${contextMenu.x}px`,
                        top: `${contextMenu.y}px`
                    }}
                    role="menu"
                >
                    <button
                        className="context-menu-item"
                        onClick={() => handleRevealInFinder(contextMenu.docId)}
                        disabled={!documents.find(d => d.id === contextMenu.docId)?.filePath}
                        role="menuitem"
                    >
                        Reveal in Finder
                    </button>
                    <button
                        className="context-menu-item"
                        onClick={() => handleCopyPath(contextMenu.docId)}
                        disabled={!documents.find(d => d.id === contextMenu.docId)?.filePath}
                        role="menuitem"
                    >
                        Copy Path
                    </button>
                </div>
            )}
        </div>
    );
};

export default App;
