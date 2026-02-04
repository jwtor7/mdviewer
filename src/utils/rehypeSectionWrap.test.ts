/* eslint-disable no-secrets/no-secrets */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypeSectionWrap } from './rehypeSectionWrap';

const processMarkdown = async (markdown: string): Promise<string> => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSectionWrap)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
};

describe('rehypeSectionWrap', () => {
  describe('basic section wrapping', () => {
    it('wraps a single h2 and its content in a section', async () => {
      const markdown = `## Header

Some paragraph content.`;

      const html = await processMarkdown(markdown);

      expect(html).toContain('<section class="pdf-section">');
      expect(html).toContain('<h2>Header</h2>');
      expect(html).toContain('<p>Some paragraph content.</p>');
      expect(html).toContain('</section>');
    });

    it('wraps multiple h2 sections separately', async () => {
      const markdown = `## First Section

First content.

## Second Section

Second content.`;

      const html = await processMarkdown(markdown);

      // Count sections - should have 2
      const sectionCount = (html.match(/<section class="pdf-section">/g) || []).length;
      expect(sectionCount).toBe(2);

      // Both headers should be in sections
      expect(html).toContain('<section class="pdf-section"><h2>First Section</h2>');
      expect(html).toContain('<section class="pdf-section"><h2>Second Section</h2>');
    });

    it('wraps h1, h2, h3 headers each in their own sections', async () => {
      const markdown = `# Main Title

Intro text.

## Sub Section

Sub content.

### Deep Section

Deep content.`;

      const html = await processMarkdown(markdown);

      // Should have 3 sections (h1, h2, h3)
      const sectionCount = (html.match(/<section class="pdf-section">/g) || []).length;
      expect(sectionCount).toBe(3);
    });
  });

  describe('content before first header', () => {
    it('keeps content before first header unwrapped', async () => {
      const markdown = `Some intro text before any headers.

## First Header

Header content.`;

      const html = await processMarkdown(markdown);

      // Intro should NOT be in a section
      expect(html).toMatch(/<p>Some intro text before any headers\.<\/p>\s*<section/);

      // Header content should be in a section
      expect(html).toContain('<section class="pdf-section"><h2>First Header</h2>');
    });
  });

  describe('header hierarchy', () => {
    it('closes h2 section when encountering another h2', async () => {
      const markdown = `## Section A

Content A.

## Section B

Content B.`;

      const html = await processMarkdown(markdown);

      // Each h2 should start its own section
      expect(html).toContain('</section><section class="pdf-section"><h2>Section B</h2>');
    });

    it('closes h2 section when encountering h1', async () => {
      const markdown = `## Sub Section

Sub content.

# Main Section

Main content.`;

      const html = await processMarkdown(markdown);

      // h1 should close the h2 section
      expect(html).toContain('</section><section class="pdf-section"><h1>Main Section</h1>');
    });

    it('h3 under h2 creates a new section (flat structure)', async () => {
      const markdown = `## Parent

Parent content.

### Child

Child content.`;

      const html = await processMarkdown(markdown);

      // Should have 2 sections (h2 and h3 each get their own)
      const sectionCount = (html.match(/<section class="pdf-section">/g) || []).length;
      expect(sectionCount).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles header with no following content', async () => {
      const markdown = `## Empty Header`;

      const html = await processMarkdown(markdown);

      expect(html).toContain('<section class="pdf-section"><h2>Empty Header</h2></section>');
    });

    it('handles headers immediately followed by headers', async () => {
      const markdown = `## First

## Second

## Third`;

      const html = await processMarkdown(markdown);

      // Each header should be in its own section
      const sectionCount = (html.match(/<section class="pdf-section">/g) || []).length;
      expect(sectionCount).toBe(3);
    });

    it('handles all header levels h1-h6', async () => {
      const markdown = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

      const html = await processMarkdown(markdown);

      // All 6 headers should create sections
      const sectionCount = (html.match(/<section class="pdf-section">/g) || []).length;
      expect(sectionCount).toBe(6);

      expect(html).toContain('<h1>H1</h1>');
      expect(html).toContain('<h2>H2</h2>');
      expect(html).toContain('<h3>H3</h3>');
      expect(html).toContain('<h4>H4</h4>');
      expect(html).toContain('<h5>H5</h5>');
      expect(html).toContain('<h6>H6</h6>');
    });

    it('handles empty document', async () => {
      const markdown = '';

      const html = await processMarkdown(markdown);

      // Should not have any sections
      expect(html).not.toContain('<section');
    });

    it('handles document with only paragraphs (no headers)', async () => {
      const markdown = `First paragraph.

Second paragraph.`;

      const html = await processMarkdown(markdown);

      // Should not have any sections
      expect(html).not.toContain('<section');
      expect(html).toContain('<p>First paragraph.</p>');
      expect(html).toContain('<p>Second paragraph.</p>');
    });
  });

  describe('complex content', () => {
    it('includes lists within sections', async () => {
      const markdown = `## Features

- Feature 1
- Feature 2
- Feature 3`;

      const html = await processMarkdown(markdown);

      expect(html).toContain('<section class="pdf-section"><h2>Features</h2>');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Feature 1</li>');
    });

    it('includes code blocks within sections', async () => {
      const markdown = `## Code Example

\`\`\`javascript
const x = 1;
\`\`\``;

      const html = await processMarkdown(markdown);

      expect(html).toContain('<section class="pdf-section"><h2>Code Example</h2>');
      expect(html).toContain('<pre>');
      expect(html).toContain('<code');
    });

    it('includes blockquotes within sections', async () => {
      const markdown = `## Quote Section

> This is a quote`;

      const html = await processMarkdown(markdown);

      expect(html).toContain('<section class="pdf-section"><h2>Quote Section</h2>');
      expect(html).toContain('<blockquote>');
    });
  });
});
