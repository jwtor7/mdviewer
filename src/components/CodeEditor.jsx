import React, { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';

const CodeEditor = memo(forwardRef(({ content, onChange }, ref) => {
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
}));

CodeEditor.displayName = 'CodeEditor';

CodeEditor.propTypes = {
  content: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default CodeEditor;
