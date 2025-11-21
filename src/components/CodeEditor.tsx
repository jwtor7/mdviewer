import React, { forwardRef, memo } from 'react';

export interface CodeEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const CodeEditor = memo(forwardRef<HTMLTextAreaElement, CodeEditorProps>(
  ({ content, onChange }, ref) => {
    return (
      <textarea
        ref={ref}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="code-editor"
        spellCheck="false"
        aria-label="Markdown source code editor"
      />
    );
  }
));

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
