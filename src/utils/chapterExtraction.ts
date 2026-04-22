/**
 * Chapter extraction
 *
 * Segments a document into chapters bounded by heading chunks. The heading
 * level is auto-detected: if the document has two or more H1 headings, H1
 * is the chapter boundary; otherwise H2 (the typical "title + sections"
 * pattern). Documents with no headings return an empty array (callers may
 * treat that as a single implicit chapter).
 */

import type { SpeechChunk } from './speechChunker';

export interface Chapter {
  index: number;
  title: string;
  sourceStart: number;
  chunkStartIndex: number;
}

const pickChapterLevel = (chunks: SpeechChunk[]): 1 | 2 | null => {
  const h1Count = chunks.filter(c => c.kind === 'heading' && c.headingLevel === 1).length;
  const h2Count = chunks.filter(c => c.kind === 'heading' && c.headingLevel === 2).length;
  if (h1Count >= 2) return 1;
  if (h2Count >= 1) return 2;
  if (h1Count >= 1) return 1;
  return null;
};

const stripTrailingPunctuation = (title: string): string => title.replace(/[.!?:,]\s*$/, '').trim();

export const extractChapters = (chunks: SpeechChunk[]): Chapter[] => {
  const level = pickChapterLevel(chunks);
  if (level === null) return [];

  const chapters: Chapter[] = [];
  chunks.forEach((chunk, index) => {
    if (chunk.kind === 'heading' && chunk.headingLevel === level) {
      chapters.push({
        index: chapters.length,
        title: stripTrailingPunctuation(chunk.text) || `Chapter ${chapters.length + 1}`,
        sourceStart: chunk.sourceStart,
        chunkStartIndex: index,
      });
    }
  });
  return chapters;
};
