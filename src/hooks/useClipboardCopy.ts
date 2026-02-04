/**
 * useClipboardCopy Hook
 *
 * Handles copy-to-clipboard functionality with sanitization for security.
 * Supports different copy modes based on the current view mode:
 * - Raw: Copies plain markdown text
 * - Text: Copies plain text conversion of markdown
 * - Rendered/Split: Copies HTML with plain text fallback
 */

import { useCallback } from 'react';
import { VIEW_MODES, type ViewMode } from '../constants/index';
import { convertMarkdownToText } from '../utils/textConverter';
import { sanitizeHtmlForClipboard, sanitizeTextForClipboard } from '../utils/clipboardSanitizer';

export interface UseClipboardCopyProps {
  viewMode: ViewMode;
  content: string;
  showError: (message: string, type?: 'error' | 'info') => void;
}

export interface UseClipboardCopyReturn {
  handleCopy: () => Promise<void>;
}

export const useClipboardCopy = ({
  viewMode,
  content,
  showError,
}: UseClipboardCopyProps): UseClipboardCopyReturn => {
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      if (viewMode === VIEW_MODES.RAW) {
        // Security: Sanitize text to remove control characters
        const sanitizedText = sanitizeTextForClipboard(content);
        await navigator.clipboard.writeText(sanitizedText);
      } else if (viewMode === VIEW_MODES.TEXT) {
        // Copy plain text conversion with sanitization
        const plainText = convertMarkdownToText(content);
        const sanitizedText = sanitizeTextForClipboard(plainText);
        await navigator.clipboard.writeText(sanitizedText);
      } else {
        // Rendered or Split mode: Copy HTML with sanitization
        const previewElement = document.querySelector('.markdown-preview') as HTMLElement | null;
        if (previewElement) {
          try {
            // Security: Sanitize HTML before copying to clipboard (HIGH-4 fix)
            // This removes dangerous elements (script, iframe, etc.),
            // event handlers (onclick, onerror, etc.), and unsafe URLs
            const sanitizedHtml = sanitizeHtmlForClipboard(previewElement.innerHTML);
            const sanitizedText = sanitizeTextForClipboard(previewElement.innerText);

            const htmlBlob = new Blob([sanitizedHtml], { type: 'text/html' });
            const textBlob = new Blob([sanitizedText], { type: 'text/plain' });
            const data = [new ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob
            })];
            await navigator.clipboard.write(data);
          } catch {
            // Fallback to plain text if rich text copy fails
            // Security: Still sanitize the text fallback
            const sanitizedText = sanitizeTextForClipboard(previewElement.innerText);
            await navigator.clipboard.writeText(sanitizedText);
          }
        }
      }
    } catch {
      showError('Failed to copy to clipboard');
    }
  }, [viewMode, content, showError]);

  return { handleCopy };
};

export default useClipboardCopy;
