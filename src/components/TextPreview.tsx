import React, { memo, useMemo } from 'react';
import { convertMarkdownToText } from '../utils/textConverter';

export interface TextPreviewProps {
  content: string;
}

/**
 * TextPreview Component
 *
 * Displays markdown content as plain, readable text with formatting stripped.
 * Uses a monospace font for consistent readability and supports scrolling
 * for large documents.
 */
const TextPreview = memo(({ content }: TextPreviewProps) => {
  // Memoize the conversion to avoid reprocessing on every render
  const plainText = useMemo(() => convertMarkdownToText(content), [content]);

  return (
    <div
      className="text-preview"
      role="document"
      aria-label="Plain text preview"
    >
      <pre className="text-preview-content">{plainText}</pre>
    </div>
  );
});

TextPreview.displayName = 'TextPreview';

export default TextPreview;
