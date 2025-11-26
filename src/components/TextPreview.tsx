import React, { memo, useMemo, useEffect, useRef } from 'react';
import { convertMarkdownToText } from '../utils/textConverter';

export interface TextPreviewProps {
  content: string;
  searchTerm?: string;
  caseSensitive?: boolean;
  currentMatchIndex?: number;
}

// Helper to highlight text content with search term
const highlightText = (text: string, searchTerm: string, caseSensitive: boolean, currentMatchIndex: number): React.ReactNode => {
  if (!searchTerm) return text;

  const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  const compareText = caseSensitive ? text : text.toLowerCase();

  const matches: { start: number; end: number }[] = [];
  let index = 0;
  while (index < compareText.length) {
    const foundIndex = compareText.indexOf(searchText, index);
    if (foundIndex === -1) break;
    matches.push({ start: foundIndex, end: foundIndex + searchTerm.length });
    index = foundIndex + 1;
  }

  if (matches.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }

    const isCurrent = idx === currentMatchIndex;
    parts.push(
      <mark
        key={`match-${idx}`}
        className={isCurrent ? 'search-highlight-current' : 'search-highlight'}
        data-match-index={idx}
      >
        {text.substring(match.start, match.end)}
      </mark>
    );
    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
};

/**
 * TextPreview Component
 *
 * Displays markdown content as plain, readable text with formatting stripped.
 * Uses a monospace font for consistent readability and supports scrolling
 * for large documents.
 */
const TextPreview = memo(({ content, searchTerm = '', caseSensitive = false, currentMatchIndex = 0 }: TextPreviewProps) => {
  const previewRef = useRef<HTMLDivElement>(null);

  // Memoize the conversion to avoid reprocessing on every render
  const plainText = useMemo(() => convertMarkdownToText(content), [content]);

  // Memoize the highlighted content
  const highlightedContent = useMemo(() => {
    return highlightText(plainText, searchTerm, caseSensitive, currentMatchIndex);
  }, [plainText, searchTerm, caseSensitive, currentMatchIndex]);

  // Scroll to current match after render
  useEffect(() => {
    if (!previewRef.current || !searchTerm) return;

    const currentMark = previewRef.current.querySelector('mark.search-highlight-current');
    if (currentMark) {
      currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchTerm, currentMatchIndex]);

  return (
    <div
      ref={previewRef}
      className="text-preview"
      role="document"
      aria-label="Plain text preview"
    >
      <pre className="text-preview-content">{highlightedContent}</pre>
    </div>
  );
});

TextPreview.displayName = 'TextPreview';

export default TextPreview;
