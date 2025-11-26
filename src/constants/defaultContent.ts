/* eslint-disable no-secrets/no-secrets */
/**
 * Default markdown content loaded on application startup
 * Includes feature roadmap, recent changelog, and test elements for rapid testing
 */

import readmeRaw from '../../README.md?raw';

/**
 * Helper to extract a section from markdown content
 */
const extractSection = (content: string, startMarker: string, endMarker?: string): string => {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) return '';

  const contentFromStart = content.substring(startIndex);

  if (endMarker) {
    const endIndex = contentFromStart.indexOf(endMarker);
    // If end marker not found, return everything (or handle as error if strictness needed)
    if (endIndex === -1) return contentFromStart;
    return contentFromStart.substring(0, endIndex).trim();
  }

  return contentFromStart.trim();
};

// Extract sections from README
const roadmap = extractSection(readmeRaw, '## 🚀 Feature Roadmap', '## 📝 Changelog');
const changelog = extractSection(readmeRaw, '## 📝 Changelog', '## 🤝🏽 Contributing');

export const DEFAULT_CONTENT = `# mdviewer Test Document

Welcome to mdviewer! This test document includes the feature roadmap, recent changes, and various markdown elements to test all features.

---

${roadmap}

---

${changelog}

---

## 🧪 Test Elements

### Wide Raw Block (Test Horizontal Scrolling)

\`\`\`typescript
const veryLongLineOfRawThatExceedsTheViewportWidthAndRequiresHorizontalScrollingToViewTheEntireLineOfRawWhichIsUsefulForTestingScrollBehaviorInBothRawViewAndRenderedMode = "This is a very long string that should create a horizontal scrollbar for testing purposes"; // eslint-disable-line no-secrets/no-secrets

function anotherLongFunctionNameThatExceedsNormalLineLengthsAndIsUsedForTestingHorizontalScrollingBehaviorInRawBlocksWithinTheMarkdownRendered(parameterWithAVeryLongNameForTesting: string): void { // eslint-disable-line no-secrets/no-secrets
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
2. **View Modes**: Press \`Cmd+E\` to cycle through Rendered → Raw → Split → Text modes
3. **Themes**: Press \`Cmd+T\` to cycle through all 5 themes
4. **Horizontal Scrolling**: Switch to Raw view to test wide code blocks and long lines
5. **Text Export**: Press \`Cmd+S\` and save as \`.txt\` to export plain text (markdown stripped)
6. **PDF Export**: Press \`Cmd+S\` and save as \`.pdf\` to test PDF generation
7. **Copy**: Test "Copy to Clipboard" in both Rendered mode (rich HTML) and Raw mode (plain text)

---

**mdviewer v2.8.4** - Built with Electron, React, and TypeScript
`;
