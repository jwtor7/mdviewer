import React, { useState, useEffect, useRef } from 'react';

export interface FindReplaceProps {
  content: string;
  onClose: () => void;
  onReplace: (newContent: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

interface Match {
  start: number;
  end: number;
}

const FindReplace: React.FC<FindReplaceProps> = ({ content, onClose, onReplace, textareaRef }) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Focus find input when component mounts
  useEffect(() => {
    findInputRef.current?.focus();
  }, []);

  // Find all matches when search text or case sensitivity changes
  useEffect(() => {
    if (!findText) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const foundMatches: Match[] = [];
    const searchText = caseSensitive ? findText : findText.toLowerCase();
    const searchContent = caseSensitive ? content : content.toLowerCase();

    let index = 0;
    while (index < searchContent.length) {
      const foundIndex = searchContent.indexOf(searchText, index);
      if (foundIndex === -1) break;

      foundMatches.push({
        start: foundIndex,
        end: foundIndex + findText.length,
      });
      index = foundIndex + 1;
    }

    setMatches(foundMatches);
    setCurrentMatchIndex(foundMatches.length > 0 ? 0 : -1);
  }, [findText, content, caseSensitive]);

  // Highlight current match in textarea
  useEffect(() => {
    if (currentMatchIndex >= 0 && matches.length > 0 && textareaRef.current) {
      const match = matches[currentMatchIndex];
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(match.start, match.end);
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight * (match.start / content.length);
    }
  }, [currentMatchIndex, matches, textareaRef, content.length]);

  const handleNext = (): void => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const handlePrevious = (): void => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const handleReplaceCurrent = (): void => {
    if (currentMatchIndex < 0 || matches.length === 0) return;

    const match = matches[currentMatchIndex];
    const newContent = content.substring(0, match.start) + replaceText + content.substring(match.end);
    onReplace(newContent);

    // After replacement, advance to next match
    if (matches.length > 1) {
      handleNext();
    }
  };

  const handleReplaceAll = (): void => {
    if (!findText || matches.length === 0) return;

    let newContent = content;
    const searchText = caseSensitive ? findText : findText.toLowerCase();
    const searchContent = caseSensitive ? newContent : newContent.toLowerCase();

    // Replace from end to start to maintain indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      newContent = newContent.substring(0, match.start) + replaceText + newContent.substring(match.end);
    }

    onReplace(newContent);
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

  return (
    <div className="find-replace-panel" onKeyDown={handleKeyDown}>
      <div className="find-replace-header">
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
