import React, { forwardRef, memo, useEffect, useRef } from 'react';

export interface CodeEditorProps {
  content: string;
  onChange: (content: string) => void;
  highlightedContent?: React.ReactNode;
  wordWrap?: boolean;
}

const CodeEditor = memo(forwardRef<HTMLTextAreaElement, CodeEditorProps>(
  ({ content, onChange, highlightedContent, wordWrap = true }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);

    // Use internal ref or forwarded ref
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    useEffect(() => {
      const textarea = textareaRef.current;
      const thumb = thumbRef.current;
      if (!textarea || !thumb) return;

      const updateScrollIndicator = () => {
        const { scrollTop, scrollHeight, clientHeight } = textarea;

        // Calculate thumb height as a percentage of visible area
        const visibleRatio = clientHeight / scrollHeight;
        const thumbHeight = Math.max(30, clientHeight * visibleRatio); // Minimum 30px

        // Calculate thumb position
        const scrollableHeight = scrollHeight - clientHeight;
        const scrollPercentage = scrollableHeight > 0 ? scrollTop / scrollableHeight : 0;
        const maxThumbTop = clientHeight - thumbHeight;
        const thumbTop = maxThumbTop * scrollPercentage;

        // Update CSS custom properties (CSP-compliant)
        thumb.style.setProperty('--thumb-top', `${thumbTop}px`);
        thumb.style.setProperty('--thumb-height', `${thumbHeight}px`);
      };

      // Update on scroll
      textarea.addEventListener('scroll', updateScrollIndicator);

      // Update on content change or resize
      updateScrollIndicator();
      const resizeObserver = new ResizeObserver(updateScrollIndicator);
      resizeObserver.observe(textarea);

      return () => {
        textarea.removeEventListener('scroll', updateScrollIndicator);
        resizeObserver.disconnect();
      };
    }, [content, textareaRef]);

    return (
      <div className="code-editor-wrapper">
        {highlightedContent && (
          <div className={`code-editor-highlight-layer ${wordWrap ? 'word-wrap' : 'no-wrap'}`} aria-hidden="true">
            {highlightedContent}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className={`code-editor ${wordWrap ? 'word-wrap' : 'no-wrap'}`}
          spellCheck="false"
          aria-label="Markdown source code editor"
        />
        <div className="scroll-indicator">
          <div ref={thumbRef} className="scroll-indicator-thumb" />
        </div>
      </div>
    );
  }
));

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
