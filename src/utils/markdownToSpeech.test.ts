import { describe, it, expect } from 'vitest';
import { convertMarkdownToSpeech } from './markdownToSpeech';

describe('convertMarkdownToSpeech', () => {
  it('returns empty string for empty input', () => {
    expect(convertMarkdownToSpeech('')).toBe('');
    expect(convertMarkdownToSpeech('   \n  ')).toBe('');
  });

  it('ends a plain paragraph with a period', () => {
    expect(convertMarkdownToSpeech('Hello world')).toBe('Hello world.');
  });

  it('preserves existing sentence punctuation', () => {
    expect(convertMarkdownToSpeech('Did it work?')).toBe('Did it work?');
  });

  it('narrates headings without level announcement', () => {
    const result = convertMarkdownToSpeech('# Intro\n\nBody text.');
    expect(result).toBe('Intro. Body text.');
  });

  it('handles all heading levels', () => {
    for (let level = 1; level <= 6; level += 1) {
      const md = `${'#'.repeat(level)} Heading ${level}`;
      expect(convertMarkdownToSpeech(md)).toBe(`Heading ${level}.`);
    }
  });

  it('strips bold, italic, and strikethrough markers', () => {
    const result = convertMarkdownToSpeech('This is **bold**, *italic*, and ~~struck~~.');
    expect(result).toBe('This is bold, italic, and struck.');
  });

  it('strips backticks from inline code', () => {
    const result = convertMarkdownToSpeech('Run `npm test` now.');
    expect(result).toBe('Run npm test now.');
  });

  it('replaces unfenced code block with announcement', () => {
    const md = '```\nconst x = 1;\n```';
    expect(convertMarkdownToSpeech(md)).toBe('Code block skipped.');
  });

  it('announces code block language when present', () => {
    const md = '```javascript\nconst x = 1;\n```';
    expect(convertMarkdownToSpeech(md)).toBe('javascript code block skipped.');
  });

  it('reads link text but drops URL', () => {
    const result = convertMarkdownToSpeech('Visit [our site](https://example.com) today.');
    expect(result).toBe('Visit our site today.');
  });

  it('reads image alt text when available', () => {
    expect(convertMarkdownToSpeech('![A cat photo](cat.png)')).toBe('Image: A cat photo.');
  });

  it('reads "Image." for images without alt text', () => {
    expect(convertMarkdownToSpeech('![](cat.png)')).toBe('Image.');
  });

  it('wraps blockquote with Quote/End quote markers', () => {
    const result = convertMarkdownToSpeech('> Important point.');
    expect(result).toBe('Quote: Important point. End quote.');
  });

  it('joins unordered list items with pauses', () => {
    const md = '- First item\n- Second item';
    expect(convertMarkdownToSpeech(md)).toBe('First item. Second item.');
  });

  it('preserves numbers in ordered lists', () => {
    const md = '1. Alpha\n2. Beta\n3. Gamma';
    expect(convertMarkdownToSpeech(md)).toBe('1. Alpha. 2. Beta. 3. Gamma.');
  });

  it('handles nested lists via pause-based flow', () => {
    const md = '- Parent\n  - Child\n- Sibling';
    const result = convertMarkdownToSpeech(md);
    expect(result).toContain('Parent');
    expect(result).toContain('Child');
    expect(result).toContain('Sibling');
  });

  it('formats small tables as prose', () => {
    const md = [
      '| Name | Age |',
      '|------|-----|',
      '| Alice | 30 |',
      '| Bob | 25 |',
    ].join('\n');
    const result = convertMarkdownToSpeech(md);
    expect(result).toContain('Table with columns Name, Age');
    expect(result).toContain('Row 1: Name is Alice, Age is 30');
    expect(result).toContain('Row 2: Name is Bob, Age is 25');
  });

  it('announces but skips large tables (>5 data rows)', () => {
    const header = ['| A | B |', '|---|---|'];
    const rows = ['| 1 | 2 |', '| 3 | 4 |', '| 5 | 6 |', '| 7 | 8 |', '| 9 | 10 |', '| 11 | 12 |'];
    const md = [...header, ...rows].join('\n');
    const result = convertMarkdownToSpeech(md);
    expect(result).toBe('Table with 6 rows and 2 columns, skipped.');
  });

  it('treats 5-row tables as prose (boundary)', () => {
    const header = ['| A | B |', '|---|---|'];
    const rows = ['| 1 | 2 |', '| 3 | 4 |', '| 5 | 6 |', '| 7 | 8 |', '| 9 | 10 |'];
    const md = [...header, ...rows].join('\n');
    const result = convertMarkdownToSpeech(md);
    expect(result).toContain('Row 5:');
    expect(result).not.toContain('skipped');
  });

  it('reads task list items with Completed/Todo labels', () => {
    const md = '- [x] Ship feature\n- [ ] Write tests';
    const result = convertMarkdownToSpeech(md);
    expect(result).toContain('Completed: Ship feature');
    expect(result).toContain('Todo: Write tests');
  });

  it('strips raw HTML tags but keeps text content', () => {
    const md = 'Hello <strong>world</strong> and <em>friends</em>.';
    const result = convertMarkdownToSpeech(md);
    expect(result).toContain('Hello');
    expect(result).not.toContain('<strong>');
    expect(result).not.toContain('<em>');
  });

  it('skips YAML frontmatter', () => {
    const md = '---\ntitle: My Doc\nauthor: Jane\n---\n\nBody.';
    expect(convertMarkdownToSpeech(md)).toBe('Body.');
  });

  it('skips footnote references', () => {
    const md = 'Fact[^1] here.\n\n[^1]: source';
    const result = convertMarkdownToSpeech(md);
    expect(result).not.toContain('1');
    expect(result).toContain('Fact');
  });

  it('ignores thematic breaks (horizontal rules)', () => {
    const md = 'Before\n\n---\n\nAfter';
    expect(convertMarkdownToSpeech(md)).toBe('Before. After.');
  });

  it('truncates input over 100,000 characters without exceeding the IPC budget', () => {
    const huge = 'word '.repeat(30_000);
    const result = convertMarkdownToSpeech(huge);
    expect(result.length).toBeLessThanOrEqual(100_000);
    expect(result).toContain('Document truncated for speech.');
  });

  it('handles mixed document end-to-end', () => {
    const md = [
      '# Title',
      '',
      'First paragraph with **bold** text.',
      '',
      '- One',
      '- Two',
      '',
      '```js',
      'console.log("hi");',
      '```',
      '',
      '> A thought',
      '',
      'See [link](https://example.com) for details.',
    ].join('\n');
    const result = convertMarkdownToSpeech(md);
    expect(result).toContain('Title.');
    expect(result).toContain('First paragraph with bold text.');
    expect(result).toContain('One. Two.');
    expect(result).toContain('js code block skipped.');
    expect(result).toContain('Quote: A thought. End quote.');
    expect(result).toContain('See link for details.');
    expect(result).not.toContain('https://');
  });
});
