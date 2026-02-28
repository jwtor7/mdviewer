import React, { useState, useEffect, useRef } from 'react';
import type { ViewMode } from '../constants/index';

export interface FindReplaceProps {
  content: string;
  onClose: () => void;
  onReplace: (newContent: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onHighlightedContentChange: (content: React.ReactNode | null) => void;
  viewMode: ViewMode;
  onRenderedHighlight?: (searchTerm: string, caseSensitive: boolean, currentMatchIndex: number) => void;
  onTextHighlight?: (searchTerm: string, caseSensitive: boolean, currentMatchIndex: number) => void;
}

interface Match {
  start: number;
  end: number;
}

const FindReplace: React.FC<FindReplaceProps> = ({
  content,
  onClose,
  onReplace,
  textareaRef,
  onHighlightedContentChange,
  viewMode,
  onRenderedHighlight,
  onTextHighlight
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [debouncedFindText, setDebouncedFindText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 10 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const findInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus find input when component mounts
  useEffect(() => {
    findInputRef.current?.focus();
  }, []);

  // Debounce find text to avoid expensive scans on every keystroke
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFindText(findText);
    }, 150);
    return () => window.clearTimeout(timeoutId);
  }, [findText]);

  // Find all matches when search text or case sensitivity changes
  useEffect(() => {
    if (!debouncedFindText) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const foundMatches: Match[] = [];
    const searchText = caseSensitive ? debouncedFindText : debouncedFindText.toLowerCase();
    const searchContent = caseSensitive ? content : content.toLowerCase();

    let index = 0;
    while (index < searchContent.length) {
      const foundIndex = searchContent.indexOf(searchText, index);
      if (foundIndex === -1) break;

      foundMatches.push({
        start: foundIndex,
        end: foundIndex + debouncedFindText.length,
      });
      index = foundIndex + 1;
    }

    setMatches(foundMatches);
    setCurrentMatchIndex(foundMatches.length > 0 ? 0 : -1);
  }, [debouncedFindText, content, caseSensitive]);

  // Generate highlighted content for the CodeEditor (Raw and Split views)
  useEffect(() => {
    if (viewMode === 'raw' || viewMode === 'split') {
      if (!debouncedFindText || matches.length === 0) {
        onHighlightedContentChange(null);
        return;
      }

      // Build highlighted content with <mark> tags
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;

      matches.forEach((match, idx) => {
        // Add text before match
        if (match.start > lastIndex) {
          parts.push(content.substring(lastIndex, match.start));
        }

        // Add highlighted match
        const matchText = content.substring(match.start, match.end);
        const isCurrent = idx === currentMatchIndex;
        parts.push(
          <mark key={`match-${idx}`} className={isCurrent ? 'current-match' : ''}>
            {matchText}
          </mark>
        );

        lastIndex = match.end;
      });

      // Add remaining text
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      onHighlightedContentChange(<>{parts}</>);
    } else {
      onHighlightedContentChange(null);
    }
  }, [matches, currentMatchIndex, content, debouncedFindText, onHighlightedContentChange, viewMode]);

  // Notify parent components about highlighting needs for Rendered and Text views
  useEffect(() => {
    if (viewMode === 'rendered') {
      if (onRenderedHighlight && debouncedFindText) {
        onRenderedHighlight(debouncedFindText, caseSensitive, currentMatchIndex);
      }
    } else if (viewMode === 'text') {
      if (onTextHighlight && debouncedFindText) {
        onTextHighlight(debouncedFindText, caseSensitive, currentMatchIndex);
      }
    }
  }, [debouncedFindText, caseSensitive, currentMatchIndex, viewMode, onRenderedHighlight, onTextHighlight]);

  // Scroll to current match and sync highlight layer
  useEffect(() => {
    if (currentMatchIndex >= 0 && matches.length > 0 && textareaRef.current) {
      const match = matches[currentMatchIndex];
      const textarea = textareaRef.current;

      // Set selection without stealing focus from find input
      textarea.setSelectionRange(match.start, match.end);

      // Calculate the line position to scroll to
      const textBeforeMatch = content.substring(0, match.start);
      const lines = textBeforeMatch.split('\n');
      const lineNumber = lines.length - 1;

      // Get line height from computed style
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight);

      // Calculate scroll position to center the match in the viewport
      const matchScrollTop = lineNumber * lineHeight;
      const viewportHeight = textarea.clientHeight;
      const centeredScrollTop = matchScrollTop - (viewportHeight / 2) + (lineHeight / 2);

      // Scroll to the match
      textarea.scrollTop = Math.max(0, centeredScrollTop);
    }
  }, [currentMatchIndex, matches, textareaRef, content]);

  // Sync scroll between textarea and highlight layer
  useEffect(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const wrapper = textarea.closest('.code-editor-wrapper');
    if (!wrapper) return;

    const highlightLayer = wrapper.querySelector('.code-editor-highlight-layer') as HTMLElement;
    if (!highlightLayer) return;

    const syncScroll = () => {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
    };

    textarea.addEventListener('scroll', syncScroll);
    return () => textarea.removeEventListener('scroll', syncScroll);
  }, [textareaRef, debouncedFindText, matches]);

  const handleNext = (): void => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const handlePrevious = (): void => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const handleReplaceCurrent = (): void => {
    // Only allow replace in Raw and Split views
    if (viewMode !== 'raw' && viewMode !== 'split') return;
    if (currentMatchIndex < 0 || matches.length === 0 || !textareaRef.current) return;

    const match = matches[currentMatchIndex];
    const textarea = textareaRef.current;

    // Use Selection API to replace text while preserving undo stack
    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);

    // Try modern API first, fallback to execCommand
    if (typeof document.execCommand === 'function') {
      document.execCommand('insertText', false, replaceText);
    } else {
      // Fallback for browsers without execCommand
      const newContent = content.substring(0, match.start) + replaceText + content.substring(match.end);
      onReplace(newContent);
    }

    // After replacement, advance to next match
    if (matches.length > 1) {
      handleNext();
    }
  };

  const handleReplaceAll = (): void => {
    // Only allow replace in Raw and Split views
    if (viewMode !== 'raw' && viewMode !== 'split') return;
    if (!debouncedFindText || matches.length === 0 || !textareaRef.current) return;

    const textarea = textareaRef.current;

    // Build the final content with all replacements
    let newContent = content;
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      newContent = newContent.substring(0, match.start) + replaceText + newContent.substring(match.end);
    }

    // Use Selection API to replace entire content while preserving undo stack
    textarea.focus();
    textarea.select();

    // Try modern API first, fallback to direct state update
    if (typeof document.execCommand === 'function') {
      document.execCommand('insertText', false, newContent);
    } else {
      // Fallback for browsers without execCommand
      onReplace(newContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
      e.preventDefault();
    }
  };

  const handleMouseDown = (e: React.MouseEvent): void => {
    // Don't start dragging if clicking on buttons or inputs
    if ((e.target as HTMLElement).tagName === 'BUTTON' ||
        (e.target as HTMLElement).tagName === 'INPUT') {
      return;
    }

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent): void => {
    if (!isDragging || !panelRef.current) return;

    const panelWidth = panelRef.current.offsetWidth;
    const panelHeight = panelRef.current.offsetHeight;

    // Calculate new position
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // Keep panel within viewport bounds
    newX = Math.max(0, Math.min(newX, window.innerWidth - panelWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - panelHeight));

    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = (): void => {
    setIsDragging(false);
  };

  // Add/remove mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, position]);

  // Update CSS custom properties for position (CSP-compliant)
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.setProperty('--panel-x', `${position.x}px`);
      panelRef.current.style.setProperty('--panel-y', `${position.y}px`);
    }
  }, [position]);

  return (
    <div
      ref={panelRef}
      className={`find-replace-panel${isDragging ? ' is-dragging' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <div
        className="find-replace-header"
        onMouseDown={handleMouseDown}
      >
        <span className="find-replace-title">Find & Replace</span>
        <button
          className="find-replace-close"
          onClick={onClose}
          aria-label="Close find and replace"
          title="Close (Esc)"
        >
          ×
        </button>
      </div>

      <div className="find-replace-content">
        <div className="find-replace-row">
          <input
            ref={findInputRef}
            type="text"
            className="find-replace-input"
            placeholder="Find"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            aria-label="Find text"
          />
          <div className="find-replace-buttons">
            <button
              className="find-replace-btn"
              onClick={handlePrevious}
              disabled={matches.length === 0}
              title="Previous (Shift+Enter)"
              aria-label="Go to previous match"
            >
              ↑
            </button>
            <button
              className="find-replace-btn"
              onClick={handleNext}
              disabled={matches.length === 0}
              title="Next (Enter)"
              aria-label="Go to next match"
            >
              ↓
            </button>
            <span className="find-replace-count">
              {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : 'No matches'}
            </span>
          </div>
        </div>

        {(viewMode === 'raw' || viewMode === 'split') && (
          <div className="find-replace-row">
            <input
              type="text"
              className="find-replace-input"
              placeholder="Replace"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              aria-label="Replace text"
            />
            <div className="find-replace-buttons">
              <button
                className="find-replace-btn"
                onClick={handleReplaceCurrent}
                disabled={matches.length === 0}
                title="Replace current match"
                aria-label="Replace current match"
              >
                Replace
              </button>
              <button
                className="find-replace-btn"
                onClick={handleReplaceAll}
                disabled={matches.length === 0}
                title="Replace all matches"
                aria-label="Replace all matches"
              >
                Replace All
              </button>
            </div>
          </div>
        )}

        <div className="find-replace-options">
          <label className="find-replace-checkbox">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              aria-label="Case sensitive search"
            />
            <span>Case sensitive</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default FindReplace;
