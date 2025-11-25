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
        // Bullet list - use bullet character
        return `\u2022 ${content}`;
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
      // Convert table to tab-separated values for Excel/Sheets pasting
      const rows = node.children as TableRow[];
      const tsv = rows.map(row => {
        const cells = row.children as TableCell[];
        return cells.map(cell => extractText(cell)).join('\t');
      }).join('\n');
      return `\n${tsv}\n\n`;
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
