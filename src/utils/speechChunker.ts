/**
 * Speech Chunker
 *
 * Converts markdown into an ordered array of speech chunks, each tagged with
 * the byte offsets of its source range and split into sentences. Enables
 * paragraph-level highlighting, sentence-level navigation, and chapter jumps
 * without requiring word-boundary events from the TTS engine.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Content, Parent, PhrasingContent, TableCell, TableRow, ListItem, Heading } from 'mdast';

export type SpeechChunkKind =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'quote'
  | 'table'
  | 'code-announcement';

export interface SpeechSentence {
  text: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface SpeechChunk {
  index: number;
  kind: SpeechChunkKind;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  sentences: SpeechSentence[];
}

const TABLE_PROSE_ROW_THRESHOLD = 5;

const stripFrontmatterWithLength = (markdown: string): { body: string; offset: number } => {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) return { body: markdown, offset: 0 };
  return { body: markdown.slice(match[0].length), offset: match[0].length };
};

const stripHtmlTags = (value: string): string =>
  value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const normalizeWhitespace = (value: string): string =>
  value.replace(/[ \t\r\n]+/g, ' ').trim();

const endWithPeriod = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  if (/[.!?:,]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
};

const renderInline = (node: PhrasingContent): string => {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'emphasis':
    case 'strong':
    case 'delete':
      return (node.children as PhrasingContent[]).map(renderInline).join('');
    case 'inlineCode':
      return node.value;
    case 'link':
      return (node.children as PhrasingContent[]).map(renderInline).join('');
    case 'image':
      return node.alt ? `Image: ${node.alt}.` : 'Image.';
    case 'break':
      return ', ';
    case 'html':
      return stripHtmlTags(node.value);
    case 'footnoteReference':
      return '';
    default:
      if ('value' in node && typeof (node as { value?: unknown }).value === 'string') {
        return (node as { value: string }).value;
      }
      if ('children' in node) {
        return ((node as unknown as Parent).children as PhrasingContent[]).map(renderInline).join('');
      }
      return '';
  }
};

const inlineText = (nodes: PhrasingContent[]): string => nodes.map(renderInline).join('');

const renderListItem = (item: ListItem, ordered: boolean, index: number): string => {
  const parts = (item.children as Content[]).map(renderChildForListItem).filter(Boolean);
  const body = endWithPeriod(normalizeWhitespace(parts.join(' ')));
  if (body.length === 0) return '';

  if (typeof item.checked === 'boolean') {
    const prefix = item.checked ? 'Completed: ' : 'Todo: ';
    return `${prefix}${body}`;
  }
  if (ordered) {
    return `${index + 1}. ${body}`;
  }
  return body;
};

const renderChildForListItem = (node: Content): string => {
  if (node.type === 'paragraph') {
    return normalizeWhitespace(inlineText(node.children as PhrasingContent[]));
  }
  if (node.type === 'list') {
    return (node.children as ListItem[])
      .map((item, idx) => renderListItem(item, Boolean(node.ordered), idx))
      .filter(Boolean)
      .join(' ');
  }
  if (node.type === 'code') {
    const language = typeof node.lang === 'string' && node.lang.trim().length > 0
      ? `${node.lang.trim()} code block skipped.`
      : 'Code block skipped.';
    return language;
  }
  if ('children' in node) {
    const children = (node as unknown as Parent).children;
    return (children as Content[]).map(renderChildForListItem).filter(Boolean).join(' ');
  }
  return '';
};

const renderTableAsProse = (rows: TableRow[]): string => {
  if (rows.length === 0) return '';
  const header = rows[0].children as TableCell[];
  const headers = header.map(cell => normalizeWhitespace(inlineText(cell.children as PhrasingContent[])));
  const columnList = headers.filter(Boolean).join(', ');

  if (rows.length === 1) {
    return `Table with columns ${columnList}.`;
  }

  const dataRows = rows.slice(1);
  const rowSentences = dataRows.map((row, rowIndex) => {
    const cells = row.children as TableCell[];
    const pairs = cells
      .map((cell, colIndex) => {
        const value = normalizeWhitespace(inlineText(cell.children as PhrasingContent[]));
        const label = headers[colIndex] ?? `Column ${colIndex + 1}`;
        return `${label} is ${value}`;
      })
      .filter(pair => !/is\s*$/.test(pair));
    return `Row ${rowIndex + 1}: ${pairs.join(', ')}.`;
  });

  return `Table with columns ${columnList}. ${rowSentences.join(' ')}`;
};

const renderTable = (rows: TableRow[]): string => {
  const dataRowCount = Math.max(0, rows.length - 1);
  if (dataRowCount > TABLE_PROSE_ROW_THRESHOLD) {
    const columnCount = rows[0]?.children.length ?? 0;
    return `Table with ${dataRowCount} rows and ${columnCount} columns, skipped.`;
  }
  return renderTableAsProse(rows);
};

const renderBlock = (node: Content): { text: string; kind: SpeechChunkKind } | null => {
  switch (node.type) {
    case 'heading': {
      const text = normalizeWhitespace(inlineText((node as Heading).children as PhrasingContent[]));
      const body = endWithPeriod(text);
      return body ? { text: body, kind: 'heading' } : null;
    }
    case 'paragraph': {
      const text = normalizeWhitespace(inlineText(node.children as PhrasingContent[]));
      const body = endWithPeriod(text);
      return body ? { text: body, kind: 'paragraph' } : null;
    }
    case 'blockquote': {
      const inner = (node.children as Content[])
        .map(child => {
          const rendered = renderBlock(child);
          return rendered ? rendered.text : '';
        })
        .filter(Boolean)
        .join(' ');
      const body = normalizeWhitespace(inner);
      if (body.length === 0) return null;
      return { text: `Quote: ${endWithPeriod(body)} End quote.`, kind: 'quote' };
    }
    case 'list': {
      const items = (node.children as ListItem[])
        .map((item, index) => renderListItem(item, Boolean(node.ordered), index))
        .filter(Boolean)
        .join(' ');
      return items ? { text: items, kind: 'list' } : null;
    }
    case 'code': {
      const language = typeof node.lang === 'string' && node.lang.trim().length > 0
        ? `${node.lang.trim()} code block skipped.`
        : 'Code block skipped.';
      return { text: language, kind: 'code-announcement' };
    }
    case 'table':
      return { text: renderTable(node.children as TableRow[]), kind: 'table' };
    case 'thematicBreak':
      return null;
    case 'html': {
      const stripped = stripHtmlTags(node.value);
      return stripped ? { text: endWithPeriod(stripped), kind: 'paragraph' } : null;
    }
    default:
      return null;
  }
};

const SENTENCE_BOUNDARY = /(?<=[.!?])(?=\s+[A-Z"(\[])/g;

// Known abbreviations that end in a period but should NOT terminate a sentence.
// Checked against the trailing word of each candidate sentence.
const ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'st', 'prof', 'gen', 'capt', 'sgt',
  'lt', 'col', 'vs', 'etc', 'no', 'inc', 'ltd', 'co', 'corp', 'ave', 'blvd',
]);
const TRAILING_WORD = /([A-Za-z]+)\.\s*$/;
// Single-letter-dot patterns that form multi-dot acronyms like "U.S.", "e.g.",
// "i.e.", "a.m.". The trailing segment of the prior fragment looks like a bare
// `X.` or `X.Y.` — if the next fragment starts with another capital, we should
// merge rather than split.
const MULTI_DOT_ACRONYM_TAIL = /(?:\b|^)[A-Za-z](?:\.[A-Za-z])*\.\s*$/;

const endsInAbbreviation = (fragment: string): boolean => {
  if (MULTI_DOT_ACRONYM_TAIL.test(fragment)) return true;
  const match = TRAILING_WORD.exec(fragment);
  if (!match) return false;
  return ABBREVIATIONS.has(match[1].toLowerCase());
};

const splitSentences = (text: string, chunkStart: number): SpeechSentence[] => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const rawParts = trimmed.split(SENTENCE_BOUNDARY).map(part => part.trim()).filter(Boolean);

  if (rawParts.length === 0) {
    return [{ text: trimmed, sourceStart: chunkStart, sourceEnd: chunkStart + text.length }];
  }

  // Merge fragments whose trailing word is a known abbreviation with the following fragment.
  const merged: string[] = [];
  for (const part of rawParts) {
    if (merged.length > 0 && endsInAbbreviation(merged[merged.length - 1])) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`;
    } else {
      merged.push(part);
    }
  }

  // Source offsets are approximate within a chunk: we allocate evenly by
  // character length. Fine for highlighting granularity.
  const sentences: SpeechSentence[] = [];
  let cursor = chunkStart;
  const totalRenderedLength = merged.reduce((sum, part) => sum + part.length, 0) || 1;
  const chunkSourceLength = text.length;

  merged.forEach((part, idx) => {
    const share = idx === merged.length - 1
      ? chunkStart + chunkSourceLength - cursor
      : Math.round((part.length / totalRenderedLength) * chunkSourceLength);
    sentences.push({
      text: part,
      sourceStart: cursor,
      sourceEnd: cursor + share,
    });
    cursor += share;
  });

  return sentences;
};

/**
 * Parse markdown into an ordered array of speech chunks.
 * Source offsets reference the ORIGINAL markdown string (including any
 * frontmatter), so callers can map chunks back to editor positions.
 */
export const chunkMarkdownForSpeech = (markdown: string): SpeechChunk[] => {
  if (!markdown || markdown.trim().length === 0) return [];

  const { body, offset: frontmatterOffset } = stripFrontmatterWithLength(markdown);

  let tree: Root;
  try {
    tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;
  } catch (err) {
    console.error('Failed to chunk markdown for speech:', err);
    return [];
  }

  const chunks: SpeechChunk[] = [];

  for (const node of tree.children as Content[]) {
    const rendered = renderBlock(node);
    if (!rendered) continue;

    const nodePosition = (node as { position?: { start?: { offset?: number }; end?: { offset?: number } } }).position;
    const localStart = nodePosition?.start?.offset ?? 0;
    const localEnd = nodePosition?.end?.offset ?? localStart + rendered.text.length;
    const sourceStart = localStart + frontmatterOffset;
    const sourceEnd = localEnd + frontmatterOffset;

    const chunk: SpeechChunk = {
      index: chunks.length,
      kind: rendered.kind,
      text: rendered.text,
      sourceStart,
      sourceEnd,
      sentences: splitSentences(rendered.text, sourceStart),
    };

    if (node.type === 'heading') {
      chunk.headingLevel = (node as Heading).depth as 1 | 2 | 3 | 4 | 5 | 6;
    }

    chunks.push(chunk);
  }

  return chunks;
};

/**
 * Find the chunk whose source range contains the given offset. Returns the
 * chunk immediately at or after the offset if the offset falls in a gap
 * (e.g., a blank line between blocks). Returns 0 for offsets before the
 * first chunk and chunks.length-1 for offsets beyond the last chunk.
 */
export const findChunkIndexAtOffset = (chunks: SpeechChunk[], offset: number): number => {
  if (chunks.length === 0) return -1;
  if (offset <= chunks[0].sourceStart) return 0;
  if (offset >= chunks[chunks.length - 1].sourceEnd) return chunks.length - 1;

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    if (offset >= chunk.sourceStart && offset <= chunk.sourceEnd) return i;
    if (i < chunks.length - 1 && offset < chunks[i + 1].sourceStart) return i + 1;
  }

  return chunks.length - 1;
};
