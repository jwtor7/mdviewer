import React, { forwardRef, memo } from 'react';

export interface CodeEditorProps {
  content: string;
  onChange: (content: string) => void;
  highlightedContent?: React.ReactNode;
}

const CodeEditor = memo(forwardRef<HTMLTextAreaElement, CodeEditorProps>(
  ({ content, onChange, highlightedContent }, ref) => {
    return (
      <div className="code-editor-wrapper">
        {highlightedContent && (
          <div className="code-editor-highlight-layer" aria-hidden="true">
            {highlightedContent}
          </div>
        )}
        <textarea
          ref={ref}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="code-editor"
          spellCheck="false"
          aria-label="Markdown source code editor"
        />
      </div>
    );
  }
));

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
