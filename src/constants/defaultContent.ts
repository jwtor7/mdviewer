/**
 * Default markdown content loaded on application startup
 * Includes feature roadmap, recent changelog, and test elements for rapid testing
 */

export const DEFAULT_CONTENT = `# mdviewer Test Document

Welcome to mdviewer! This test document includes the feature roadmap, recent changes, and various markdown elements to test all features.

---

## 🚧 Upcoming Features

- [ ] **Markdown Formatting Toolbar**: Add toolbar buttons for common markdown elements (Heading 1, Heading 2, Heading 3, Code Block, Quote, Link, Image, etc.) to complement the existing Bold, Italic, and List buttons
- [ ] **Markdown Lint**: Real-time linting and style suggestions
- [ ] **Table Editor**: Visual table editing interface
- [ ] **Custom Themes**: User-configurable color schemes

---

## 📝 Recent Changelog

### [2.6.1] - 2025-11-22
- **PDF Export Improvements**:
  - Fixed scroll bars appearing in code blocks in PDF exports
  - Implemented proper text wrapping for long code lines using \`white-space: pre-wrap\`
  - Added \`word-wrap: break-word\` for code blocks, tables, and URLs
  - Long URLs now break at appropriate points instead of causing overflow
  - Table cells wrap content properly without scroll bars
  - Added \`page-break-inside: avoid\` for code blocks and tables to keep them together when possible
  - All PDF content is now fully readable without horizontal or vertical scroll bars

### [2.6.0] - 2025-11-22
- **Enhanced Save As Functionality**:
  - Save As (💾) now offers both Markdown and PDF export in a single unified dialog
  - File format automatically detected based on chosen file extension (.md, .markdown, or .pdf)
  - Format-specific success messages ("Markdown saved!" vs "PDF exported!")
  - Removed separate Export PDF button to simplify toolbar UI
  - Reuses existing PDF generation logic for consistent output
  - Security: Rate limiting, content size validation, and input sanitization

### [2.5.0] - 2025-11-22
- **Save As Functionality**:
  - Added Save button (💾) to toolbar with Cmd+S keyboard shortcut
  - Opens native file save dialog allowing user to choose location and filename
  - Supports both new files and overwriting existing files
  - Success/error notifications with existing error notification system
  - Security: Rate limiting, content size validation, and input sanitization

- **Find & Replace**:
  - Comprehensive search functionality in Code and Split views
  - Case-sensitive/insensitive search toggle
  - Navigate between matches with Previous/Next buttons (↑/↓)
  - Keyboard navigation: Enter for next match, Shift+Enter for previous
  - Replace current match or replace all matches at once
  - Live match count display (e.g., "1 of 5")
  - Floating panel with Esc to close
  - Auto-focus find input when opened with Cmd+F
  - Visual match highlighting in the editor

- **Split View Mode**:
  - New view mode showing code editor and preview side-by-side
  - Resizable divider between panes (drag to adjust, 20-80% range)
  - Smooth resizing with visual feedback on hover
  - All editing features work in split view (formatting, find/replace)
  - Synchronized content between code and preview panes
  - Cycle through views: Preview → Code → Split → Preview

### [2.4.0] - 2025-11-22
- **Solarized Theme Support**:
  - Added Solarized Light theme with warm beige background (#fdf6e3)
  - Added Solarized Dark theme with deep blue-black background (#002b36)
  - Theme cycling now includes 5 themes: System → Light → Dark → Solarized Light → Solarized Dark
  - Theme-aware syntax highlighting: code blocks automatically use Solarized syntax themes when active
  - Updated theme icons: 🌅 for Solarized Light, 🌃 for Solarized Dark
  - Unified Solarized blue (#268bd2) for links, focus indicators, and active tab borders

- **PDF Export Functionality**:
  - Export markdown documents as PDF files with professional formatting
  - PDF export button (📄) added to toolbar
  - Save dialog allows custom filename and location
  - Preserves all markdown formatting: headers, lists, tables, code blocks, images
  - Syntax-highlighted code blocks in PDF output
  - Security: Rate limiting, content size validation (10MB max), and input sanitization

---

## 🧪 Test Elements

### Wide Code Block (Test Horizontal Scrolling)

\`\`\`typescript
const veryLongLineOfCodeThatExceedsTheViewportWidthAndRequiresHorizontalScrollingToViewTheEntireLineOfCodeWhichIsUsefulForTestingScrollBehaviorInBothCodeViewAndPreviewMode = "This is a very long string that should create a horizontal scrollbar for testing purposes";

function anotherLongFunctionNameThatExceedsNormalLineLengthsAndIsUsedForTestingHorizontalScrollingBehaviorInCodeBlocksWithinTheMarkdownPreview(parameterWithAVeryLongNameForTesting: string): void {
  console.log("Testing horizontal scroll with a very long line of code that goes beyond the normal viewport width");
}
\`\`\`

### Table Test

Test table rendering, scrolling, and Find & Replace in tables:

| Feature | Status | Priority | Description | Version | Keyword Test |
|---------|--------|----------|-------------|---------|--------------|
| Find & Replace | ✅ Complete | High | Comprehensive search functionality in Code and Split views | 2.5.0 | test |
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

### Code Inline Test

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

### Code Block Languages Test

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
2. **View Modes**: Press \`Cmd+E\` to cycle through Preview → Code → Split modes
3. **Themes**: Press \`Cmd+T\` to cycle through all 5 themes
4. **Horizontal Scrolling**: Switch to Code view to test wide code blocks and long lines
5. **PDF Export**: Press \`Cmd+S\` and save as \`.pdf\` to test PDF generation
6. **Copy**: Test "Copy to Clipboard" in both Preview mode (rich HTML) and Code mode (plain text)

---

**mdviewer v2.6.1** - Built with Electron, React, and TypeScript
`;
