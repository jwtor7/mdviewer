import type { RefObject } from 'react';
import { CALCULATIONS, VIEW_MODES, type ViewMode } from '../constants/index.js';

type FormatType = 'bold' | 'italic' | 'list';

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
    if (viewMode === VIEW_MODES.RENDERED) return;
    if (!textareaRef?.current) return;

    const textarea = textareaRef.current;
    const start: number = textarea.selectionStart;
    const end: number = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let newText = '';

    switch (type) {
      case 'bold':
        newText = `**${selectedText}**`;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        break;
      case 'list':
        newText = `\n- ${selectedText}`;
        break;
      default:
        return;
    }

    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);

    // Restore focus and cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, CALCULATIONS.FOCUS_RESTORE_DELAY);
  };

  return { handleFormat };
};
