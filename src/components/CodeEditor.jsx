import React, { forwardRef } from 'react';

const CodeEditor = forwardRef(({ content, onChange }, ref) => {
  return (
    <textarea
      ref={ref}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        height: '100%',
        padding: '20px',
        fontFamily: 'monospace',
        fontSize: '14px',
        border: 'none',
        resize: 'none',
        outline: 'none',
        backgroundColor: 'var(--editor-bg)',
        color: 'var(--editor-text)',
      }}
    />
  );
});

export default CodeEditor;
