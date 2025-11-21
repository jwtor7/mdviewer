import { FORMATTING, CALCULATIONS } from '../constants/index.js';

export const useTextFormatting = (content, setContent, textareaRef, viewMode) => {
  const handleFormat = (type) => {
    if (viewMode === 'preview') return;
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
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
