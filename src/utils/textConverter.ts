/**
 * Text Converter Utility
 *
 * Converts Markdown to readable plain text by parsing the AST
 * and transforming each node type according to conversion rules.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Content, Parent, PhrasingContent, TableCell, TableRow } from 'mdast';

// Horizontal rule character (box drawing character for clean appearance)
const HORIZONTAL_RULE = '\u2500'.repeat(40);

// Box-drawing characters for ASCII tables
const BOX = {
  topLeft: '\u250C',     // ┌
  topRight: '\u2510',    // ┐
  bottomLeft: '\u2514',  // └
  bottomRight: '\u2518', // ┘
  horizontal: '\u2500',  // ─
  vertical: '\u2502',    // │
  topT: '\u252C',        // ┬
  bottomT: '\u2534',     // ┴
  leftT: '\u251C',       // ├
  rightT: '\u2524',      // ┤
  cross: '\u253C',       // ┼
};

/**
 * Calculate the maximum width for each column in a table
 */
const getColumnWidths = (rows: TableRow[], extractFn: (cell: TableCell) => string): number[] => {
  if (rows.length === 0) return [];

  const columnCount = rows[0].children.length;
  const widths: number[] = new Array(columnCount).fill(0);

  for (const row of rows) {
    const cells = row.children as TableCell[];
    cells.forEach((cell, index) => {
      if (index < columnCount) {
        const text = extractFn(cell);
        widths[index] = Math.max(widths[index], text.length);
      }
    });
  }

  // Ensure minimum width of 1 for each column
  return widths.map(w => Math.max(w, 1));
};

/**
 * Create a separator line for the table (top, middle, or bottom)
 */
const createSeparator = (
  widths: number[],
  type: 'top' | 'middle' | 'bottom'
): string => {
  if (widths.length === 0) return '';

  const left = type === 'top' ? BOX.topLeft : type === 'middle' ? BOX.leftT : BOX.bottomLeft;
  const right = type === 'top' ? BOX.topRight : type === 'middle' ? BOX.rightT : BOX.bottomRight;
  const joint = type === 'top' ? BOX.topT : type === 'middle' ? BOX.cross : BOX.bottomT;

  const segments = widths.map(w => BOX.horizontal.repeat(w + 2));
  return left + segments.join(joint) + right;
};

/**
 * Create a data row with cell content padded to column widths
 */
const createTableRow = (
  cells: TableCell[],
  widths: number[],
  extractFn: (cell: TableCell) => string
): string => {
  const paddedCells = widths.map((width, index) => {
    const cell = cells[index];
    const text = cell ? extractFn(cell) : '';
    return ' ' + text.padEnd(width) + ' ';
  });
  return BOX.vertical + paddedCells.join(BOX.vertical) + BOX.vertical;
};

/**
 * Convert a table to ASCII box-drawing format
 */
const convertTableToAscii = (rows: TableRow[], extractFn: (node: Content | Root) => string): string => {
  if (rows.length === 0) return '';

  // Type-safe extract function for TableCell
  const extractCell = (cell: TableCell): string => extractFn(cell);

  const widths = getColumnWidths(rows, extractCell);
  if (widths.length === 0) return '';

  const lines: string[] = [];

  // Top border
  lines.push(createSeparator(widths, 'top'));

  // Header row (first row)
  const headerCells = rows[0].children as TableCell[];
  lines.push(createTableRow(headerCells, widths, extractCell));

  // Header separator
  lines.push(createSeparator(widths, 'middle'));

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const dataCells = rows[i].children as TableCell[];
    lines.push(createTableRow(dataCells, widths, extractCell));
  }

  // Bottom border
  lines.push(createSeparator(widths, 'bottom'));

  return lines.join('\n');
};

/**
 * Extract plain text from a node's children recursively
 */
const extractText = (node: Content | Root): string => {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }

  if ('children' in node) {
    return (node as Parent).children.map(child => extractText(child)).join('');
  }

  return '';
};

/**
 * Convert a single MDAST node to plain text
 */
const convertNode = (node: Content, depth: number = 0): string => {
  switch (node.type) {
    case 'heading': {
      const text = extractText(node);
      // H1 = UPPERCASE, H2+ = Title Case (keep as-is for simplicity)
      if (node.depth === 1) {
        return `\n${text.toUpperCase()}\n`;
      }
      return `\n${text}\n`;
    }

    case 'paragraph': {
      const content = (node.children as PhrasingContent[])
        .map(child => convertInlineNode(child))
        .join('');
      return `${content}\n\n`;
    }

    case 'text':
      return node.value;

    case 'emphasis':
    case 'strong':
      // Strip formatting, just return text
      return extractText(node);

    case 'inlineCode':
      return node.value;

    case 'code': {
      // Indent code blocks with 4 spaces per line
      const lines = node.value.split('\n');
      const indented = lines.map(line => `    ${line}`).join('\n');
      return `\n${indented}\n\n`;
    }

    case 'blockquote': {
      // Preserve > prefix for blockquotes
      const content = (node.children as Content[])
        .map(child => convertNode(child, depth))
        .join('')
        .trim();
      const lines = content.split('\n');
      const quoted = lines.map(line => `> ${line}`).join('\n');
      return `${quoted}\n\n`;
    }

    case 'list': {
      const items = node.children.map((item, index) => {
        const content = (item.children as Content[])
          .map(child => convertNode(child, depth + 1))
          .join('')
          .trim();

        if (node.ordered) {
          return `${index + 1}. ${content}`;
        }
        // Bullet list - use hyphen
        return `- ${content}`;
      });
      return `${items.join('\n')}\n\n`;
    }

    case 'listItem': {
      return (node.children as Content[])
        .map(child => convertNode(child, depth))
        .join('');
    }

    case 'link': {
      const text = extractText(node);
      // Format: text (url)
      return `${text} (${node.url})`;
    }

    case 'image': {
      // Format: [Image: alt]
      return `[Image: ${node.alt || 'image'}]`;
    }

    case 'thematicBreak':
      return `\n${HORIZONTAL_RULE}\n\n`;

    case 'table': {
      // Convert table to ASCII box-drawing format
      const rows = node.children as TableRow[];
      const asciiTable = convertTableToAscii(rows, extractText);
      return asciiTable ? `\n${asciiTable}\n\n` : '';
    }

    case 'html':
      // Strip HTML tags, just return empty (HTML is for rendering)
      return '';

    case 'break':
      return '\n';

    default:
      // For any other node types, try to extract text
      if ('children' in node) {
        return (node as Parent).children
          .map(child => convertNode(child as Content, depth))
          .join('');
      }
      return '';
  }
};

/**
 * Convert inline/phrasing content nodes
 */
const convertInlineNode = (node: PhrasingContent): string => {
  switch (node.type) {
    case 'text':
      return node.value;

    case 'emphasis':
    case 'strong':
      // Strip formatting
      return (node.children as PhrasingContent[])
        .map(child => convertInlineNode(child))
        .join('');

    case 'inlineCode':
      return node.value;

    case 'link': {
      const text = (node.children as PhrasingContent[])
        .map(child => convertInlineNode(child))
        .join('');
      return `${text} (${node.url})`;
    }

    case 'image':
      return `[Image: ${node.alt || 'image'}]`;

    case 'break':
      return '\n';

    case 'delete':
      // Strikethrough - just return the text
      return (node.children as PhrasingContent[])
        .map(child => convertInlineNode(child))
        .join('');

    default:
      if ('value' in node && typeof node.value === 'string') {
        return node.value;
      }
      if ('children' in node) {
        return ((node as unknown as Parent).children as PhrasingContent[])
          .map(child => convertInlineNode(child))
          .join('');
      }
      return '';
  }
};

/**
 * Convert Markdown content to plain, readable text
 *
 * @param markdown - The markdown content to convert
 * @returns Plain text representation
 */
export const convertMarkdownToText = (markdown: string): string => {
  try {
    // Parse markdown to AST
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm);

    const tree = processor.parse(markdown) as Root;

    // Convert each top-level node
    const result = tree.children
      .map(node => convertNode(node))
      .join('')
      .trim();

    // Clean up excessive whitespace
    return result
      .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
      .trim();
  } catch (error) {
    console.error('Failed to convert markdown to text:', error);
    // Fallback: return raw markdown with basic cleanup
    return markdown
      .replace(/#{1,6}\s+/g, '')           // Remove heading markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')   // Remove bold
      .replace(/\*([^*]+)\*/g, '$1')       // Remove italic
      .replace(/`([^`]+)`/g, '$1')         // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Simplify links
      .trim();
  }
};

export default convertMarkdownToText;
