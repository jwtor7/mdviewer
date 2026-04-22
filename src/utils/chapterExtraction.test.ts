import { describe, it, expect } from 'vitest';
import { chunkMarkdownForSpeech } from './speechChunker';
import { extractChapters } from './chapterExtraction';

describe('extractChapters', () => {
  it('returns empty array for documents with no headings', () => {
    const chunks = chunkMarkdownForSpeech('Just a paragraph.\n\nAnd another.');
    expect(extractChapters(chunks)).toEqual([]);
  });

  it('detects H2 boundaries when only one H1 exists', () => {
    const md = [
      '# Document Title',
      'Intro paragraph.',
      '## Section One',
      'Body one.',
      '## Section Two',
      'Body two.',
    ].join('\n\n');
    const chunks = chunkMarkdownForSpeech(md);
    const chapters = extractChapters(chunks);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('Section One');
    expect(chapters[1].title).toBe('Section Two');
  });

  it('detects H1 boundaries when multiple H1s exist', () => {
    const md = ['# Part I', 'Body.', '# Part II', 'More.'].join('\n\n');
    const chunks = chunkMarkdownForSpeech(md);
    const chapters = extractChapters(chunks);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('Part I');
    expect(chapters[1].title).toBe('Part II');
  });

  it('falls back to the single H1 when no H2 exists', () => {
    const md = '# Only heading\n\nBody.';
    const chunks = chunkMarkdownForSpeech(md);
    const chapters = extractChapters(chunks);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Only heading');
  });

  it('records the chunk index of each chapter start', () => {
    const md = ['# Alpha', 'Body.', '## Sub', 'More.', '# Beta', 'Done.'].join('\n\n');
    const chunks = chunkMarkdownForSpeech(md);
    const chapters = extractChapters(chunks);
    // Two H1s → H1 boundary
    expect(chapters).toHaveLength(2);
    expect(chunks[chapters[0].chunkStartIndex].text).toBe('Alpha.');
    expect(chunks[chapters[1].chunkStartIndex].text).toBe('Beta.');
  });

  it('ignores deeper headings (H3+) when choosing boundaries', () => {
    const md = ['# Only H1', '### Skipped', 'Body.'].join('\n\n');
    const chunks = chunkMarkdownForSpeech(md);
    const chapters = extractChapters(chunks);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Only H1');
  });
});
