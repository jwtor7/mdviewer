/**
 * Markdown-to-Speech Converter
 *
 * Converts Markdown into speech-friendly prose for the macOS `say` command.
 * Unlike textConverter.ts (which targets visual display), this strips URLs,
 * box-drawing characters, and code block contents that would be read verbatim
 * as noise by a TTS engine.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Content, Parent, PhrasingContent, TableCell, TableRow, ListItem } from 'mdast';

const MAX_SPEECH_LENGTH = 100_000;
const TRUNCATION_SUFFIX = ' Document truncated for speech.';
const TABLE_PROSE_ROW_THRESHOLD = 5;

const stripFrontmatter = (markdown: string): string =>
  markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

const extractInlineText = (nodes: PhrasingContent[]): string =>
  nodes.map(node => renderInline(node)).join('');

const renderInline = (node: PhrasingContent): string => {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'emphasis':
    case 'strong':
    case 'delete':
      return extractInlineText(node.children as PhrasingContent[]);
    case 'inlineCode':
      return node.value;
    case 'link':
      return extractInlineText(node.children as PhrasingContent[]);
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
        return extractInlineText((node as unknown as Parent).children as PhrasingContent[]);
      }
      return '';
  }
};

const stripHtmlTags = (value: string): string =>
  value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const normalizeWhitespace = (value: string): string =>
  value.replace(/[ \t]+/g, ' ').replace(/\s+$/g, '').trim();

const endWithPeriod = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  if (/[.!?:,]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
};

const renderListItem = (item: ListItem, ordered: boolean, index: number): string => {
  const parts: string[] = [];
  for (const child of item.children as Content[]) {
    parts.push(renderBlock(child));
  }
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

const renderTableAsProse = (rows: TableRow[]): string => {
  if (rows.length === 0) return '';
  const header = rows[0].children as TableCell[];
  const headers = header.map(cell => normalizeWhitespace(extractInlineText(cell.children as PhrasingContent[])));
  const columnList = headers.filter(Boolean).join(', ');

  if (rows.length === 1) {
    return `Table with columns ${columnList}.`;
  }

  const dataRows = rows.slice(1);
  const rowSentences = dataRows.map((row, rowIndex) => {
    const cells = row.children as TableCell[];
    const pairs = cells.map((cell, colIndex) => {
      const value = normalizeWhitespace(extractInlineText(cell.children as PhrasingContent[]));
      const label = headers[colIndex] ?? `Column ${colIndex + 1}`;
      return `${label} is ${value}`;
    }).filter(pair => !/is\s*$/.test(pair));
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

const renderBlock = (node: Content): string => {
  switch (node.type) {
    case 'heading': {
      const text = normalizeWhitespace(extractInlineText(node.children as PhrasingContent[]));
      return endWithPeriod(text);
    }
    case 'paragraph': {
      const text = normalizeWhitespace(extractInlineText(node.children as PhrasingContent[]));
      return endWithPeriod(text);
    }
    case 'blockquote': {
      const inner = (node.children as Content[])
        .map(child => renderBlock(child))
        .filter(Boolean)
        .join(' ');
      const body = normalizeWhitespace(inner);
      if (body.length === 0) return '';
      return `Quote: ${endWithPeriod(body)} End quote.`;
    }
    case 'list': {
      const items = (node.children as ListItem[])
        .map((item, index) => renderListItem(item, Boolean(node.ordered), index))
        .filter(Boolean);
      return items.join(' ');
    }
    case 'listItem':
      return renderListItem(node as ListItem, false, 0);
    case 'code': {
      const language = typeof node.lang === 'string' && node.lang.trim().length > 0
        ? `${node.lang.trim()} code block skipped.`
        : 'Code block skipped.';
      return language;
    }
    case 'thematicBreak':
      return '';
    case 'table':
      return renderTable(node.children as TableRow[]);
    case 'html':
      return stripHtmlTags(node.value);
    case 'yaml':
      return '';
    case 'definition':
    case 'footnoteDefinition':
      return '';
    default:
      if ('children' in node) {
        return (node as unknown as Parent).children
          .map(child => renderBlock(child as Content))
          .filter(Boolean)
          .join(' ');
      }
      return '';
  }
};

/**
 * Convert Markdown content into speech-ready prose.
 *
 * @param markdown - The markdown source to convert.
 * @returns Plain-text string suitable for feeding to the macOS `say` command.
 */
export const convertMarkdownToSpeech = (markdown: string): string => {
  if (!markdown || markdown.trim().length === 0) {
    return '';
  }

  const stripped = stripFrontmatter(markdown);
  let result: string;

  try {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(stripped) as Root;
    const blocks = tree.children
      .map(node => renderBlock(node as Content))
      .filter(block => block.trim().length > 0)
      .map(block => block.trim());
    result = blocks.join(' ');
  } catch (error) {
    console.error('Failed to convert markdown to speech:', error);
    result = stripped
      .replace(/```[\s\S]*?```/g, ' Code block skipped. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, alt: string) => alt ? `Image: ${alt}.` : 'Image.')
      .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  result = result.replace(/\s+/g, ' ').trim();

  if (result.length > MAX_SPEECH_LENGTH) {
    const budget = MAX_SPEECH_LENGTH - TRUNCATION_SUFFIX.length;
    const truncated = result.slice(0, Math.max(0, budget)).trim();
    return `${truncated}${TRUNCATION_SUFFIX}`;
  }

  return result;
};

export default convertMarkdownToSpeech;
