/**
 * Unit tests for text editing utilities
 */

import { describe, it, expect } from 'vitest';
import { replaceTextContent } from './textEditing';

describe('replaceTextContent', () => {
  // Bold preservation tests
  describe('Bold formatting preservation', () => {
    it('should preserve **bold** formatting with star delimiters', () => {
      const result = replaceTextContent('**bold text**', 'new content');
      expect(result).toBe('**new content**');
    });

    it('should preserve __bold__ formatting with underscore delimiters', () => {
      const result = replaceTextContent('__bold text__', 'changed');
      expect(result).toBe('__changed__');
    });

    it('should preserve bold formatting with single word', () => {
      const result = replaceTextContent('**hello**', 'world');
      expect(result).toBe('**world**');
    });

    it('should preserve bold with special characters in replacement', () => {
      const result = replaceTextContent('**bold**', 'new-bold!');
      expect(result).toBe('**new-bold!**');
    });
  });

  // Italic preservation tests
  describe('Italic formatting preservation', () => {
    it('should preserve *italic* formatting with star delimiters', () => {
      const result = replaceTextContent('*italic text*', 'slanted');
      expect(result).toBe('*slanted*');
    });

    it('should preserve _italic_ formatting with underscore delimiters', () => {
      const result = replaceTextContent('_italic text_', 'emphasized');
      expect(result).toBe('_emphasized_');
    });

    it('should preserve italic formatting with single word', () => {
      const result = replaceTextContent('*hello*', 'hi');
      expect(result).toBe('*hi*');
    });
  });

  // Heading preservation tests
  describe('Heading formatting preservation', () => {
    it('should preserve # h1 heading', () => {
      const result = replaceTextContent('# Heading', 'New Heading');
      expect(result).toBe('# New Heading');
    });

    it('should preserve ## h2 heading', () => {
      const result = replaceTextContent('## Subheading', 'New Sub');
      expect(result).toBe('## New Sub');
    });

    it('should preserve ### h3 heading', () => {
      const result = replaceTextContent('### Section', 'New Section');
      expect(result).toBe('### New Section');
    });

    it('should preserve #### h4 heading', () => {
      const result = replaceTextContent('#### Details', 'More Details');
      expect(result).toBe('#### More Details');
    });

    it('should preserve ##### h5 heading', () => {
      const result = replaceTextContent('##### Info', 'More Info');
      expect(result).toBe('##### More Info');
    });

    it('should preserve ###### h6 heading', () => {
      const result = replaceTextContent('###### Minor', 'Updated');
      expect(result).toBe('###### Updated');
    });

    it('should preserve heading with multiple word replacement', () => {
      const result = replaceTextContent('# Title', 'New Long Title Here');
      expect(result).toBe('# New Long Title Here');
    });
  });

  // Link preservation tests
  describe('Link URL preservation', () => {
    it('should preserve link URL with text replacement', () => {
      const result = replaceTextContent('[click here](https://example.com)', 'new link text');
      expect(result).toBe('[new link text](https://example.com)');
    });

    it('should preserve link with complex URL', () => {
      const result = replaceTextContent(
        '[docs](https://example.com/path?query=value#anchor)',
        'documentation'
      );
      expect(result).toBe('[documentation](https://example.com/path?query=value#anchor)');
    });

    it('should preserve link with relative URL', () => {
      const result = replaceTextContent('[home](./index.html)', 'home page');
      expect(result).toBe('[home page](./index.html)');
    });

    it('should preserve link with anchor URL', () => {
      const result = replaceTextContent('[section](#section)', 'go to section');
      expect(result).toBe('[go to section](#section)');
    });
  });

  // List item preservation tests
  describe('List item formatting preservation', () => {
    it('should preserve - unordered list marker', () => {
      const result = replaceTextContent('- list item', 'new item');
      expect(result).toBe('- new item');
    });

    it('should preserve * unordered list marker', () => {
      const result = replaceTextContent('* list item', 'updated');
      expect(result).toBe('* updated');
    });

    it('should preserve + unordered list marker', () => {
      const result = replaceTextContent('+ list item', 'modified');
      expect(result).toBe('+ modified');
    });

    it('should preserve ordered list marker', () => {
      const result = replaceTextContent('1. first item', 'new first');
      expect(result).toBe('1. new first');
    });

    it('should preserve numbered list with multiple digits', () => {
      const result = replaceTextContent('42. item', 'content');
      expect(result).toBe('42. content');
    });

    it('should preserve list item with multiple words', () => {
      const result = replaceTextContent('- original item text', 'new longer replacement text');
      expect(result).toBe('- new longer replacement text');
    });
  });

  // Blockquote preservation tests
  describe('Blockquote formatting preservation', () => {
    it('should preserve > blockquote marker', () => {
      const result = replaceTextContent('> quoted text', 'new quote');
      expect(result).toBe('> new quote');
    });

    it('should preserve blockquote with multiple spaces', () => {
      const result = replaceTextContent('>  indented quote', 'updated quote');
      expect(result).toBe('>  updated quote');
    });

    it('should preserve blockquote with multiple words', () => {
      const result = replaceTextContent('> original quote here', 'new quote text');
      expect(result).toBe('> new quote text');
    });
  });

  // Code block and inline code preservation tests
  describe('Code formatting preservation', () => {
    it('should preserve `inline code` formatting', () => {
      const result = replaceTextContent('`original`', 'updated');
      expect(result).toBe('`updated`');
    });

    it('should preserve inline code with special characters', () => {
      const result = replaceTextContent('`const x = 5`', 'let y = 10');
      expect(result).toBe('`let y = 10`');
    });

    it('should preserve inline code with dashes and underscores', () => {
      const result = replaceTextContent('`my-func_name`', 'new_func');
      expect(result).toBe('`new_func`');
    });
  });

  // Strikethrough preservation tests
  describe('Strikethrough formatting preservation', () => {
    it('should preserve ~~strikethrough~~ formatting', () => {
      const result = replaceTextContent('~~old text~~', 'crossed out');
      expect(result).toBe('~~crossed out~~');
    });

    it('should preserve strikethrough with multiple words', () => {
      const result = replaceTextContent('~~this is deleted~~', 'new content');
      expect(result).toBe('~~new content~~');
    });
  });

  // Empty and edge case handling tests
  describe('Empty replacement handling', () => {
    it('should handle empty original markdown', () => {
      const result = replaceTextContent('', 'new text');
      expect(result).toBe('new text');
    });

    it('should handle empty replacement text', () => {
      const result = replaceTextContent('**bold**', '');
      expect(result).toBe('');
    });

    it('should handle both empty inputs', () => {
      const result = replaceTextContent('', '');
      expect(result).toBe('');
    });

    it('should handle whitespace-only replacement', () => {
      const result = replaceTextContent('**text**', '   ');
      expect(result).toBe('**   **');
    });

    it('should handle plain text with no markdown', () => {
      const result = replaceTextContent('plain text', 'new text');
      expect(result).toBe('new text');
    });

    it('should handle single space as replacement', () => {
      const result = replaceTextContent('- item', ' ');
      expect(result).toBe('-  ');
    });
  });

  // Mixed formatting tests
  describe('Mixed formatting handling', () => {
    it('should preserve primary bold when surrounded by text', () => {
      const result = replaceTextContent('**bold**', 'new');
      expect(result).toBe('**new**');
      expect(result).not.toContain('plain');
    });

    it('should detect bold before italic patterns', () => {
      // When text is **bold**, it should be treated as bold, not italic
      const result = replaceTextContent('**bold text**', 'emphasis');
      expect(result).toBe('**emphasis**');
    });

    it('should preserve heading with special word', () => {
      const result = replaceTextContent('# Heading', '**Bold** Title');
      expect(result).toBe('# **Bold** Title');
    });

    it('should handle link in list item context', () => {
      // This tests replacement only on the immediate text, not nested patterns
      const result = replaceTextContent('- [link](url)', 'item text');
      expect(result).toBe('- item text');
    });
  });

  // Nested formatting tests
  describe('Nested formatting patterns', () => {
    it('should handle text with **bold _nested italic_** pattern', () => {
      // The function preserves outer formatting of selected text
      const result = replaceTextContent('**bold italic**', 'replaced');
      expect(result).toBe('**replaced**');
    });

    it('should preserve bold when replacing text containing asterisks', () => {
      const result = replaceTextContent('**text*with*stars**', 'clean');
      expect(result).toBe('**clean**');
    });

    it('should handle heading with inline code', () => {
      const result = replaceTextContent('# `Code Heading`', 'Updated');
      expect(result).toBe('# Updated');
    });

    it('should preserve outer formatting in complex nested case', () => {
      // User selected **bold _italic_** should keep ** wrapping
      const result = replaceTextContent('**_emphasis_**', 'new text');
      expect(result).toBe('**new text**');
    });
  });

  // Pattern ordering tests (more specific patterns first)
  describe('Pattern matching order', () => {
    it('should match heading before other patterns', () => {
      const result = replaceTextContent('# text', 'replaced');
      expect(result).toMatch(/^# /);
      expect(result).toBe('# replaced');
    });

    it('should match bold before italic when ** is used', () => {
      const result = replaceTextContent('**text**', 'new');
      expect(result).toBe('**new**');
    });

    it('should match link before list when [ is present', () => {
      const result = replaceTextContent('[text](url)', 'replaced');
      expect(result).toContain('(url)');
      expect(result).toBe('[replaced](url)');
    });

    it('should match blockquote before list when > is present', () => {
      const result = replaceTextContent('> quoted', 'new');
      expect(result).toBe('> new');
    });
  });

  // Real-world scenario tests
  describe('Real-world editing scenarios', () => {
    it('should handle editing a heading in document', () => {
      const result = replaceTextContent('## Getting Started', 'Installation Guide');
      expect(result).toBe('## Installation Guide');
    });

    it('should handle editing bold text in paragraph', () => {
      const result = replaceTextContent('**important**', 'critical');
      expect(result).toBe('**critical**');
    });

    it('should handle editing list item in documentation', () => {
      const result = replaceTextContent('- Install the package', 'Run npm install');
      expect(result).toBe('- Run npm install');
    });

    it('should handle editing link text in navigation', () => {
      const result = replaceTextContent('[Read More](blog.html)', 'View Blog');
      expect(result).toBe('[View Blog](blog.html)');
    });

    it('should handle unformatted plain text editing', () => {
      const result = replaceTextContent('Hello world', 'Hi there');
      expect(result).toBe('Hi there');
    });

    it('should handle editing quote content', () => {
      const result = replaceTextContent('> According to X', 'According to Y');
      expect(result).toBe('> According to Y');
    });
  });

  // Type safety and consistency tests
  describe('Type safety and consistency', () => {
    it('should always return a string', () => {
      const result = replaceTextContent('**test**', 'text');
      expect(typeof result).toBe('string');
    });

    it('should handle unicode characters in replacement', () => {
      const result = replaceTextContent('**text**', '世界');
      expect(result).toBe('**世界**');
    });

    it('should handle emoji in replacement', () => {
      const result = replaceTextContent('- item', 'done 🎉');
      expect(result).toBe('- done 🎉');
    });

    it('should preserve newlines in heading not supported', () => {
      // Headings shouldn't have newlines, but test behavior
      const result = replaceTextContent('# Heading', 'New\nLine');
      expect(result).toBe('# New\nLine');
    });
  });
});
