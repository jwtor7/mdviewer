import type { RefObject } from 'react';
import { CALCULATIONS, VIEW_MODES, type ViewMode } from '../constants/index.js';

type FormatType = 'bold' | 'italic' | 'list' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'code' | 'quote' | 'hr';

export interface UseTextFormattingReturn {
  handleFormat: (type: FormatType) => void;
}

export const useTextFormatting = (
  content: string,
  setContent: (content: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  viewMode: ViewMode
): UseTextFormattingReturn => {
  const handleFormat = (type: FormatType): void => {
    if (viewMode === VIEW_MODES.RENDERED || viewMode === VIEW_MODES.TEXT) return;
    if (!textareaRef?.current) return;

    const textarea = textareaRef.current;
    const start: number = textarea.selectionStart;
    const end: number = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let newText = '';
    let cursorOffset = 0; // Offset from start of newText for cursor placement

    switch (type) {
      case 'bold':
        newText = `**${selectedText}**`;
        cursorOffset = newText.length;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        cursorOffset = newText.length;
        break;
      case 'list':
        newText = `\n- ${selectedText}`;
        cursorOffset = newText.length;
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        // For headings, apply to the entire line(s)
        const level = parseInt(type.substring(1));
        const prefix = '#'.repeat(level) + ' ';

        // Find the start of the line
        let lineStart = start;
        while (lineStart > 0 && content[lineStart - 1] !== '\n') {
          lineStart--;
        }

        // Find the end of the line
        let lineEnd = end;
        while (lineEnd < content.length && content[lineEnd] !== '\n') {
          lineEnd++;
        }

        const lineText = content.substring(lineStart, lineEnd);

        // Remove existing heading markers if present
        const cleanedLine = lineText.replace(/^#{1,6}\s+/, '');
        newText = prefix + cleanedLine;

        // Update the content with the heading applied to the entire line
        const newContent = content.substring(0, lineStart) + newText + content.substring(lineEnd);
        setContent(newContent);

        // Restore focus and cursor at end of heading
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(lineStart + newText.length, lineStart + newText.length);
        }, CALCULATIONS.FOCUS_RESTORE_DELAY);
        return;
      }
      case 'code': {
        // For code blocks, wrap in triple backticks
        if (selectedText) {
          newText = `\`\`\`\n${selectedText}\n\`\`\``;
          cursorOffset = newText.length;
        } else {
          newText = '\`\`\`\n\n\`\`\`';
          cursorOffset = 4; // Position cursor between the backticks
        }
        break;
      }
      case 'quote': {
        // For blockquotes, prefix lines with >
        if (selectedText) {
          const lines = selectedText.split('\n');
          newText = lines.map(line => `> ${line}`).join('\n');
          cursorOffset = newText.length;
        } else {
          newText = '> ';
          cursorOffset = newText.length;
        }
        break;
      }
      case 'hr': {
        // For horizontal rule, insert --- on its own line with spacing
        newText = '\n\n---\n\n';
        cursorOffset = newText.length;
        break;
      }
      default:
        return;
    }

    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);

    // Restore focus and cursor
    setTimeout(() => {
      textarea.focus();
      if (type === 'code' && !selectedText) {
        // Position cursor inside empty code block
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
      } else {
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }
    }, CALCULATIONS.FOCUS_RESTORE_DELAY);
  };

  return { handleFormat };
};
