import React, { useState, useEffect, useRef } from 'react';
import MarkdownPreview from './components/MarkdownPreview';
import CodeEditor from './components/CodeEditor';
import './index.css';

const App = () => {
    const [documents, setDocuments] = useState([
        { id: 'default', name: 'Untitled', content: '# Welcome to Markdown Viewer\n\nStart typing or open a file to begin.', filePath: null }
    ]);
    const [activeTabId, setActiveTabId] = useState('default');
    const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
    const [theme, setTheme] = useState('system'); // 'system' | 'light' | 'dark'
    const textareaRef = useRef(null);

    const activeDoc = documents.find(d => d.id === activeTabId) || documents[0];
    const content = activeDoc.content;

    const setContent = (newContent) => {
        setDocuments(prev => prev.map(doc =>
            doc.id === activeTabId ? { ...doc, content: newContent } : doc
        ));
    };

    useEffect(() => {
        // Listen for file content from main process
        if (window.electronAPI) {
            window.electronAPI.onFileOpen((value) => {
                // value is { filePath, content, name } or just string (legacy)
                const filePath = value.filePath || null;
                const fileContent = value.content || value;
                const fileName = value.name || 'Untitled';

                setDocuments(prev => {
                    const existing = prev.find(d => d.filePath === filePath);
                    if (existing && filePath) {
                        setActiveTabId(existing.id);
                        return prev.map(d => d.id === existing.id ? { ...d, content: fileContent } : d);
                    }
                    const newId = Date.now().toString();
                    setActiveTabId(newId);
                    return [...prev, { id: newId, name: fileName, content: fileContent, filePath }];
                });
            });
        }
    }, []);

    useEffect(() => {
        const applyTheme = (newTheme) => {
            const root = document.documentElement;
            const isDark = newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            root.setAttribute('data-theme', isDark ? 'dark' : 'light');
        };

        applyTheme(theme);

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                applyTheme('system');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const handleCopy = async () => {
        if (viewMode === 'code') {
            await navigator.clipboard.writeText(content);
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
                    console.error('Failed to copy rich text:', err);
                    // Fallback to plain text
                    await navigator.clipboard.writeText(previewElement.innerText);
                }
            }
        }
    };

    const handleThemeToggle = () => {
        setTheme(prev => {
            if (prev === 'system') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    };

    const handleFormat = (type) => {
        if (viewMode === 'preview') return;
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        let newText = '';
        let newCursorPos = end;

        switch (type) {
            case 'bold':
                newText = `**${selectedText}**`;
                newCursorPos += 4;
                break;
            case 'italic':
                newText = `*${selectedText}*`;
                newCursorPos += 2;
                break;
            case 'list':
                newText = `\n- ${selectedText}`;
                newCursorPos += 3;
                break;
            default:
                return;
        }

        const newContent = content.substring(0, start) + newText + content.substring(end);
        setContent(newContent);

        // Restore focus and cursor
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + newText.length, start + newText.length);
        }, 0);
    };

    const getThemeIcon = () => {
        if (theme === 'system') return '⚙️';
        if (theme === 'light') return '☀️';
        return '🌙';
    };

    const closeTab = (e, id) => {
        e.stopPropagation();
        setDocuments(prev => {
            const newDocs = prev.filter(d => d.id !== id);
            if (newDocs.length === 0) {
                return [{ id: 'default', name: 'Untitled', content: '', filePath: null }];
            }
            if (activeTabId === id) {
                setActiveTabId(newDocs[newDocs.length - 1].id);
            }
            return newDocs;
        });
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
                closeTab({ stopPropagation: () => { } }, doc.id);
            }
        }
    };

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    const charCount = content.length;
    const tokenCount = Math.ceil(content.length / 4);

    return (
        <div className="app-container">
            <div className="tab-bar">
                {documents.map(doc => (
                    <div
                        key={doc.id}
                        className={`tab ${activeTabId === doc.id ? 'active' : ''}`}
                        onClick={() => setActiveTabId(doc.id)}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, doc)}
                        onDragEnd={(e) => handleDragEnd(e, doc)}
                    >
                        <span>{doc.name}</span>
                        <span className="tab-close" onClick={(e) => closeTab(e, doc.id)}>×</span>
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
                        title="Bold"
                        disabled={viewMode === 'preview'}
                    >
                        <b>B</b>
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('italic')}
                        title="Italic"
                        disabled={viewMode === 'preview'}
                    >
                        <i>I</i>
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => handleFormat('list')}
                        title="List"
                        disabled={viewMode === 'preview'}
                    >
                        •
                    </button>
                    <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--toolbar-border)', margin: '0 5px' }}></div>

                    <button className="icon-btn" onClick={handleCopy} title="Copy Markdown">
                        📋
                    </button>

                    <button className="icon-btn" onClick={handleThemeToggle} title={`Theme: ${theme}`}>
                        {getThemeIcon()}
                    </button>

                    <div className="toggle-container">
                        <button
                            className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
                            onClick={() => setViewMode('preview')}
                        >
                            Preview
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
                            onClick={() => setViewMode('code')}
                        >
                            Code
                        </button>
                    </div>
                </div>
            </div>
            <div className="content-area">
                {viewMode === 'preview' ? (
                    <MarkdownPreview content={content} />
                ) : (
                    <CodeEditor ref={textareaRef} content={content} onChange={setContent} />
                )}
            </div>
            <div className="status-bar">
                <div className="status-item">Words: {wordCount}</div>
                <div className="status-item">Chars: {charCount}</div>
                <div className="status-item">Tokens: {tokenCount}</div>
            </div>
        </div>
    );
};

export default App;
