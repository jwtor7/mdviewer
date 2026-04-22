import { describe, it, expect } from 'vitest';
import { chunkMarkdownForSpeech, findChunkIndexAtOffset } from './speechChunker';

describe('chunkMarkdownForSpeech', () => {
  it('returns empty array for empty input', () => {
    expect(chunkMarkdownForSpeech('')).toEqual([]);
    expect(chunkMarkdownForSpeech('   ')).toEqual([]);
  });

  it('produces a single paragraph chunk with sentence splits', () => {
    const md = 'First sentence. Second sentence. Third sentence.';
    const chunks = chunkMarkdownForSpeech(md);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe('paragraph');
    expect(chunks[0].text).toBe('First sentence. Second sentence. Third sentence.');
    expect(chunks[0].sentences).toHaveLength(3);
    expect(chunks[0].sentences[0].text).toBe('First sentence.');
  });

  it('tags heading chunks with their depth', () => {
    const chunks = chunkMarkdownForSpeech('## Intro\n\nBody.');
    expect(chunks).toHaveLength(2);
    expect(chunks[0].kind).toBe('heading');
    expect(chunks[0].headingLevel).toBe(2);
    expect(chunks[0].text).toBe('Intro.');
    expect(chunks[1].kind).toBe('paragraph');
  });

  it('reports source offsets relative to the original markdown', () => {
    const md = '---\ntitle: demo\n---\n\n# Heading\n\nBody text.';
    const chunks = chunkMarkdownForSpeech(md);
    expect(chunks).toHaveLength(2);
    const headingStart = md.indexOf('# Heading');
    expect(chunks[0].sourceStart).toBe(headingStart);
  });

  it('keeps list text in a single chunk with kind "list"', () => {
    const chunks = chunkMarkdownForSpeech('- One\n- Two');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe('list');
    expect(chunks[0].text).toBe('One. Two.');
  });

  it('wraps blockquotes with Quote/End quote markers', () => {
    const chunks = chunkMarkdownForSpeech('> Important.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe('quote');
    expect(chunks[0].text).toBe('Quote: Important. End quote.');
  });

  it('emits code-announcement chunks without the code contents', () => {
    const chunks = chunkMarkdownForSpeech('```ts\nconst x = 1;\n```');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe('code-announcement');
    expect(chunks[0].text).toBe('ts code block skipped.');
  });

  it('renders small tables as prose chunks', () => {
    const md = '| Name | Age |\n|------|-----|\n| Alice | 30 |';
    const chunks = chunkMarkdownForSpeech(md);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe('table');
    expect(chunks[0].text).toContain('Row 1: Name is Alice, Age is 30');
  });

  it('skips thematic breaks but keeps surrounding chunks', () => {
    const chunks = chunkMarkdownForSpeech('Before.\n\n---\n\nAfter.');
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('Before.');
    expect(chunks[1].text).toBe('After.');
  });

  it('assigns a monotonically increasing index', () => {
    const md = ['# One', 'body one.', '# Two', 'body two.'].join('\n\n');
    const chunks = chunkMarkdownForSpeech(md);
    chunks.forEach((chunk, idx) => {
      expect(chunk.index).toBe(idx);
    });
  });

  it('does not split mid-abbreviation like Dr. Smith', () => {
    const chunks = chunkMarkdownForSpeech('Dr. Smith arrived. He was late.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sentences).toHaveLength(2);
    expect(chunks[0].sentences[0].text).toContain('Dr. Smith arrived.');
  });

  it('does not split single-letter dotted acronyms like U.S.', () => {
    const chunks = chunkMarkdownForSpeech('We visited the U.S. Capitol last week. It was impressive.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sentences).toHaveLength(2);
    expect(chunks[0].sentences[0].text).toContain('U.S. Capitol');
  });

  it('does not split common latinisms like e.g. and i.e.', () => {
    const chunks = chunkMarkdownForSpeech('Use e.g. this example. Then finish.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sentences).toHaveLength(2);
    expect(chunks[0].sentences[0].text).toContain('e.g. this example');
  });
});

describe('findChunkIndexAtOffset', () => {
  const md = '# Alpha\n\nParagraph one.\n\n## Beta\n\nParagraph two.';
  const chunks = chunkMarkdownForSpeech(md);

  it('returns -1 for empty chunk list', () => {
    expect(findChunkIndexAtOffset([], 0)).toBe(-1);
  });

  it('returns the first chunk for offsets before the first block', () => {
    expect(findChunkIndexAtOffset(chunks, 0)).toBe(0);
  });

  it('returns the last chunk for offsets beyond the end', () => {
    expect(findChunkIndexAtOffset(chunks, md.length + 100)).toBe(chunks.length - 1);
  });

  it('locates the chunk containing an interior offset', () => {
    const paragraphOneStart = md.indexOf('Paragraph one');
    expect(findChunkIndexAtOffset(chunks, paragraphOneStart + 2)).toBe(1);
  });

  it('rounds down to the nearest chunk when offset falls between blocks', () => {
    const betweenBlocks = md.indexOf('## Beta') - 1;
    const result = findChunkIndexAtOffset(chunks, betweenBlocks);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(chunks.length);
  });
});
