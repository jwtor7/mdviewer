import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTextFormatting } from './useTextFormatting';
import { VIEW_MODES } from '../constants/index';

describe('useTextFormatting', () => {
  let mockSetContent: ReturnType<typeof vi.fn>;
  let mockTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    // Create a real textarea for testing
    textarea = document.createElement('textarea');
    textarea.value = 'Hello world';
    document.body.appendChild(textarea);

    mockSetContent = vi.fn();
    mockTextareaRef = { current: textarea };
  });

  afterEach(() => {
    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
    vi.clearAllMocks();
  });

  describe('Bold formatting', () => {
    it('should wrap selected text with ** for bold', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5); // Select "Hello"

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).toHaveBeenCalledWith('**Hello** world');
    });

    it('should handle bold formatting on empty selection', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 0); // No selection

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).toHaveBeenCalledWith('****Hello world');
    });
  });

  describe('Italic formatting', () => {
    it('should wrap selected text with * for italic', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(6, 11); // Select "world"

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('italic');
      });

      expect(mockSetContent).toHaveBeenCalledWith('Hello *world*');
    });

    it('should handle italic formatting on empty selection', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(5, 5); // No selection at position 5

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('italic');
      });

      expect(mockSetContent).toHaveBeenCalledWith('Hello** world');
    });
  });

  describe('Code formatting', () => {
    it('should wrap selected text with triple backticks', () => {
      const content = 'const x = 5;';
      textarea.value = content;
      textarea.setSelectionRange(0, 12); // Select all

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('code');
      });

      expect(mockSetContent).toHaveBeenCalledWith('```\nconst x = 5;\n```');
    });

    it('should insert empty code block when no selection', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 0); // No selection

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('code');
      });

      expect(mockSetContent).toHaveBeenCalledWith('```\n\n```Hello world');
    });
  });

  describe('Heading formatting (H1-H6)', () => {
    it('should convert line to H1 heading', () => {
      const content = 'My Title\nOther content';
      textarea.value = content;
      textarea.setSelectionRange(0, 8); // Select "My Title"

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('h1');
      });

      expect(mockSetContent).toHaveBeenCalledWith('# My Title\nOther content');
    });

    it('should convert line to H2 heading', () => {
      const content = 'Subtitle\nContent';
      textarea.value = content;
      textarea.setSelectionRange(0, 8); // Select "Subtitle"

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('h2');
      });

      expect(mockSetContent).toHaveBeenCalledWith('## Subtitle\nContent');
    });

    it('should convert line to H3 heading', () => {
      const content = 'Heading three';
      textarea.value = content;
      textarea.setSelectionRange(0, 13);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('h3');
      });

      expect(mockSetContent).toHaveBeenCalledWith('### Heading three');
    });

    it('should replace existing heading marker when applying new heading level', () => {
      const content = '## Old Heading\nContent';
      textarea.value = content;
      textarea.setSelectionRange(0, 13); // Select "## Old Heading"

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('h1');
      });

      expect(mockSetContent).toHaveBeenCalledWith('# Old Heading\nContent');
    });

    it('should handle heading on multi-level selection (H4, H5, H6)', () => {
      const content = 'Heading four';
      textarea.value = content;
      textarea.setSelectionRange(0, 12);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('h4');
      });

      expect(mockSetContent).toHaveBeenCalledWith('#### Heading four');
    });
  });

  describe('Quote formatting', () => {
    it('should prefix selected text with > for blockquote', () => {
      const content = 'This is a quote';
      textarea.value = content;
      textarea.setSelectionRange(0, 14); // Select all

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('quote');
      });

      expect(mockSetContent).toHaveBeenCalledWith('> This is a quote');
    });

    it('should prefix multiple lines with > for blockquote', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      textarea.value = content;
      textarea.setSelectionRange(0, 20); // Select all

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('quote');
      });

      expect(mockSetContent).toHaveBeenCalledWith('> Line 1\n> Line 2\n> Line 3');
    });

    it('should insert empty quote when no selection', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 0); // No selection

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('quote');
      });

      expect(mockSetContent).toHaveBeenCalledWith('> Hello world');
    });
  });

  describe('Horizontal rule formatting', () => {
    it('should insert horizontal rule with spacing', () => {
      const content = 'Content above\nContent below';
      textarea.value = content;
      textarea.setSelectionRange(13, 13); // Position at newline

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('hr');
      });

      // The newline at position 13 is preserved after the hr insertion
      expect(mockSetContent).toHaveBeenCalledWith('Content above\n\n---\n\n\nContent below');
    });

    it('should insert horizontal rule at the end of content', () => {
      const content = 'Content';
      textarea.value = content;
      textarea.setSelectionRange(7, 7); // End of content

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('hr');
      });

      expect(mockSetContent).toHaveBeenCalledWith('Content\n\n---\n\n');
    });
  });

  describe('List formatting', () => {
    it('should prefix selected text with - for list item', () => {
      const content = 'First item';
      textarea.value = content;
      textarea.setSelectionRange(0, 10); // Select all

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('list');
      });

      expect(mockSetContent).toHaveBeenCalledWith('\n- First item');
    });

    it('should handle list formatting on partial selection', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5); // Select "Hello"

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('list');
      });

      expect(mockSetContent).toHaveBeenCalledWith('\n- Hello world');
    });
  });

  describe('View mode filtering', () => {
    it('should not apply formatting in RENDERED mode', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RENDERED)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).not.toHaveBeenCalled();
    });

    it('should not apply formatting in TEXT mode', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.TEXT)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).not.toHaveBeenCalled();
    });

    it('should apply formatting in RAW mode', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).toHaveBeenCalledWith('**Hello** world');
    });

    it('should apply formatting in SPLIT mode', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.SPLIT)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).toHaveBeenCalledWith('**Hello** world');
    });
  });

  describe('Textarea ref handling', () => {
    it('should handle null textarea ref gracefully', () => {
      const nullRef = { current: null };
      const content = 'Hello world';

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, nullRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).not.toHaveBeenCalled();
    });

    it('should handle undefined ref gracefully', () => {
      const undefinedRef = undefined as unknown as React.RefObject<HTMLTextAreaElement | null>;
      const content = 'Hello world';

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, undefinedRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).not.toHaveBeenCalled();
    });
  });

  describe('Focus restoration', () => {
    it('should restore focus after formatting', async () => {
      const content = 'My Title\nOther';
      textarea.value = content;
      textarea.setSelectionRange(0, 8);
      const focusSpy = vi.spyOn(textarea, 'focus');

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('h1');
      });

      // Wait for the setTimeout in handleFormat (FOCUS_RESTORE_DELAY is 0 in tests)
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should set cursor position at end of formatted text for bold', async () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5);
      const setSelectionRangeSpy = vi.spyOn(textarea, 'setSelectionRange');

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(setSelectionRangeSpy).toHaveBeenCalledWith(9, 9); // "**Hello**" is 9 chars
    });
  });

  describe('Edge cases', () => {
    it('should handle formatting at start of content', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(0, 5);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).toHaveBeenCalledWith('**Hello** world');
    });

    it('should handle formatting at end of content', () => {
      const content = 'Hello world';
      textarea.value = content;
      textarea.setSelectionRange(6, 11);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).toHaveBeenCalledWith('Hello **world**');
    });

    it('should handle empty content', () => {
      const content = '';
      textarea.value = content;
      textarea.setSelectionRange(0, 0);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('bold');
      });

      expect(mockSetContent).toHaveBeenCalledWith('****');
    });

    it('should handle special characters in selected text', () => {
      const content = 'Test & Special <Chars>';
      textarea.value = content;
      textarea.setSelectionRange(5, 21);

      const { result } = renderHook(() =>
        useTextFormatting(content, mockSetContent, mockTextareaRef, VIEW_MODES.RAW)
      );

      act(() => {
        result.current.handleFormat('italic');
      });

      expect(mockSetContent).toHaveBeenCalledWith('Test *& Special <Chars*>');
    });
  });
});
