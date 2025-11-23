/**
 * Default markdown content loaded on application startup
 * Includes feature roadmap, recent changelog, and test elements for rapid testing
 */

export const DEFAULT_CONTENT = `# mdviewer Test Document

Welcome to mdviewer! This test document includes the feature roadmap, recent changes, and various markdown elements to test all features.

---

## 🚧 Upcoming Features

- [ ] **Synchronized Text Selection**: Bidirectional highlighting between Raw and Rendered views - select text in Raw view and see it highlighted in Rendered, and vice versa
- [ ] **Markdown Formatting Toolbar**: Add toolbar buttons for common markdown elements (Heading 1, Heading 2, Heading 3, Raw Block, Quote, Link, Image, etc.) to complement the existing Bold, Italic, and List buttons
- [ ] **Markdown Lint**: Real-time linting and style suggestions
- [ ] **Table Editor**: Visual table editing interface

---

## 📝 Recent Changelog

### [2.6.4] - 2025-11-23
- **UI/UX Refactoring**:
  - Renamed view modes for improved clarity: "Preview" → "Rendered", "Raw" → "Raw"
  - Updated all button labels, tooltips, and keyboard shortcut descriptions
  - Updated error messages and accessibility labels
  - "Rendered" now clearly indicates processed markdown output
  - "Raw" now clearly indicates unprocessed markdown source
  - View mode cycle: Rendered → Raw → Split → Rendered

### [2.6.3] - 2025-11-23
- **UI/UX Improvements**:
  - Added scroll position indicator to Raw view - visual bar shows current position in document
  - Indicator height represents visible content ratio, position shows scroll location
  - Increased right-side padding from 20px to 80px in Raw view to prevent text cutoff by scrollbar
  - Increased right-side padding from 20px to 60px in Rendered view
  - Added proper box-sizing to ensure padding is calculated correctly
  - Fixed horizontal scrolling in Rendered view with \`overflow-x: hidden\`
  - Long URLs now wrap properly in Rendered view instead of being cut off
  - Added \`word-break\` and \`overflow-wrap\` to links for better text wrapping

### [2.6.2] - 2025-11-23
- **Find & Replace Enhancements**:
  - Added real-time incremental search highlighting - highlights update as you type
  - Highlights appear immediately when typing in find input (e.g., "T" → all Ts highlighted)
  - Match counter updates in real-time showing "X of Y"
  - Current match highlighted in orange, other matches in yellow
  - Perfect scroll synchronization using mirrored content layer approach
  - Case-sensitive toggle respected in real-time highlighting

- **Bug Fixes**:
  - Fixed undo/redo functionality after using "Replace All" - now uses \`document.execCommand('insertText')\` to preserve undo stack
  - Fixed highlight alignment issues with complete redesign using background layer approach

- **Developer Experience**:
  - Added comprehensive default test content on startup (240-line test document)
  - Default content includes feature roadmap, recent changelog, and test elements
  - 50+ instances of "test" for Find & Replace validation
  - Wide code blocks and long lines for scroll testing
  - Updated CLAUDE.md with complete TypeScript references and project structure
  - Updated mdviewer-lead-dev agent with correct file extensions and project context

### [2.6.1] - 2025-11-22
- **PDF Export Improvements**:
  - Fixed scroll bars appearing in code blocks in PDF exports
  - Implemented proper text wrapping for long code lines using \`white-space: pre-wrap\`
  - Added \`word-wrap: break-word\` for code blocks, tables, and URLs
  - Long URLs now break at appropriate points instead of causing overflow
  - Table cells wrap content properly without scroll bars
  - Added \`page-break-inside: avoid\` for code blocks and tables to keep them together when possible
  - All PDF content is now fully readable without horizontal or vertical scroll bars

---

## 🧪 Test Elements

### Wide Raw Block (Test Horizontal Scrolling)

\`\`\`typescript
const veryLongLineOfRawThatExceedsTheViewportWidthAndRequiresHorizontalScrollingToViewTheEntireLineOfRawWhichIsUsefulForTestingScrollBehaviorInBothRawViewAndRenderedMode = "This is a very long string that should create a horizontal scrollbar for testing purposes";

function anotherLongFunctionNameThatExceedsNormalLineLengthsAndIsUsedForTestingHorizontalScrollingBehaviorInRawBlocksWithinTheMarkdownRendered(parameterWithAVeryLongNameForTesting: string): void {
  console.log("Testing horizontal scroll with a very long line of code that goes beyond the normal viewport width");
}
\`\`\`

### Table Test

Test table rendering, scrolling, and Find & Replace in tables:

| Feature | Status | Priority | Description | Version | Keyword Test |
|---------|--------|----------|-------------|---------|--------------|
| Find & Replace | ✅ Complete | High | Comprehensive search functionality in Raw and Split views | 2.5.0 | test |
| PDF Export | ✅ Complete | Medium | Export markdown documents as PDF files | 2.4.0 | test |
| Split View | ✅ Complete | High | Side-by-side code and preview | 2.5.0 | test |
| Solarized Theme | ✅ Complete | Low | Beautiful Solarized color schemes | 2.4.0 | test |
| Multi-Tab Support | ✅ Complete | High | Work with multiple documents simultaneously | 2.0.0 | feature |
| Drag-to-Spawn | ✅ Complete | Medium | Drag tabs to create new windows | 2.0.0 | feature |
| Security Hardening | ✅ Complete | Critical | Comprehensive security improvements | 2.2.0 | feature |

### Long Line Test (No Wrapping)

This is a very long single line of text that should not wrap and should create a horizontal scrollbar for testing horizontal scrolling behavior in the code editor view when you switch from preview mode to code mode using the view toggle buttons or keyboard shortcuts.

### Headers Test

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

### Lists Test

**Unordered List:**
- First item with the word test
- Second item with the word test
- Third item with the word test
  - Nested item one
  - Nested item two with test
    - Deeply nested item with test

**Ordered List:**
1. First numbered item
2. Second numbered item
3. Third numbered item
   1. Nested numbered item
   2. Another nested item

**Task List:**
- [x] Completed task with test word
- [x] Another completed task
- [ ] Incomplete task with test word
- [ ] Another incomplete task

### Blockquotes Test

> This is a blockquote with the word test in it.
> It can span multiple lines and contains test words.
>
> > This is a nested blockquote with test word.
> > It also contains the word test for testing Find & Replace.

### Raw Inline Test

Here are some inline code examples: \`const test = "example"\`, \`let value = 42\`, \`function test() {}\`, and \`if (test === true) { return test; }\`

### Links Test

- [mdviewer on GitHub](https://github.com/jwtor7/mdviewer) - Test link one
- [Electron Documentation](https://www.electronjs.org/) - Test link two
- [React Documentation](https://react.dev/) - Test link three
- Very long URL test: [https://www.example.com/very/long/path/that/exceeds/normal/viewport/width/and/requires/horizontal/scrolling/to/view/the/entire/url](https://www.example.com/very/long/path/that/exceeds/normal/viewport/width)

### Emphasis Test

**Bold text with test word** and *italic text with test word* and ***bold italic with test word***.

~~Strikethrough text with test word~~ and **~~bold strikethrough with test~~**.

### Horizontal Rule Test

---

***

___

### Repeated Words for Find & Replace Testing

The quick brown fox jumps over the lazy dog. The fox is quick and the dog is lazy. Testing find and replace with the word "the" and "test". The word test appears multiple times in this test document for testing the Find & Replace feature. You can test case-sensitive search by searching for "Test" vs "test" and test the replace functionality by replacing "test" with "example" or any other word you want to test.

### Raw Block Languages Test

**JavaScript:**
\`\`\`javascript
function test() {
  const result = "test value";
  return result;
}
\`\`\`

**Python:**
\`\`\`python
def test_function():
    result = "test value"
    return result
\`\`\`

**JSON:**
\`\`\`json
{
  "test": "value",
  "feature": "test",
  "example": {
    "nested": "test"
  }
}
\`\`\`

**Bash:**
\`\`\`bash
#!/bin/bash
echo "Running test script"
npm run test
\`\`\`

---

## 🎯 Quick Testing Guide

1. **Find & Replace**: Press \`Cmd+F\` to open Find & Replace panel, search for "test" (appears 50+ times)
2. **View Modes**: Press \`Cmd+E\` to cycle through Rendered → Raw → Split modes
3. **Themes**: Press \`Cmd+T\` to cycle through all 5 themes
4. **Horizontal Scrolling**: Switch to Raw view to test wide code blocks and long lines
5. **PDF Export**: Press \`Cmd+S\` and save as \`.pdf\` to test PDF generation
6. **Copy**: Test "Copy to Clipboard" in both Rendered mode (rich HTML) and Raw mode (plain text)

---

**mdviewer v2.6.4** - Built with Electron, React, and TypeScript
`;
