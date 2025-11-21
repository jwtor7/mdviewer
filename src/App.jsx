import React, { useState, useEffect } from 'react';
import MarkdownPreview from './components/MarkdownPreview';
import CodeEditor from './components/CodeEditor';
import './index.css';

const App = () => {
    const [content, setContent] = useState('# Welcome to Markdown Viewer\n\nStart typing or open a file to begin.');
    const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'

    useEffect(() => {
        // Listen for file content from main process
        if (window.electronAPI) {
            window.electronAPI.onFileOpen((value) => {
                setContent(value);
            });
        }
    }, []);

    return (
        <div className="app-container">
            <div className="toolbar">
                <div className="toolbar-title">Markdown Viewer</div>
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
            <div className="content-area">
                {viewMode === 'preview' ? (
                    <MarkdownPreview content={content} />
                ) : (
                    <CodeEditor content={content} onChange={setContent} />
                )}
            </div>
        </div>
    );
};

export default App;
