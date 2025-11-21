import React from 'react';

const CodeEditor = ({ content, onChange }) => {
  return (
    <textarea
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
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
      }}
    />
  );
};

export default CodeEditor;
