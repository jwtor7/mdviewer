import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableCell,
  TableRow,
  WidthType,
  BorderStyle,
  ExternalHyperlink,
  convertInchesToTwip
} from 'docx';
import type { Root, Heading, Paragraph as MdParagraph, List, ListItem, Code, InlineCode, Blockquote, Table as MdTable, TableRow as MdTableRow, TableCell as MdTableCell, Strong, Emphasis, Link, Text } from 'mdast';
import type { Parent, Node } from 'unist';

/**
 * Type guard to check if a node has children
 */
const hasChildren = (node: Node): node is Parent => {
  return 'children' in node && Array.isArray((node as Parent).children);
};

/**
 * Extracts plain text from a markdown AST node and its children.
 * Used for extracting text content from inline elements.
 */
const extractText = (node: Node): string => {
  if (node.type === 'text') {
    return (node as Text).value;
  }

  if (hasChildren(node)) {
    return node.children.map(extractText).join('');
  }

  return '';
};

/**
 * Converts inline markdown nodes (text, bold, italic, code, links) to DOCX TextRun objects.
 * Handles nested formatting (e.g., bold + italic).
 */
const convertInlineNodes = (nodes: Node[], bold = false, italic = false): TextRun[] => {
  const runs: TextRun[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      const textNode = node as Text;
      runs.push(new TextRun({
        text: textNode.value,
        bold,
        italics: italic,
      }));
    } else if (node.type === 'strong') {
      const strongNode = node as Strong;
      runs.push(...convertInlineNodes(strongNode.children, true, italic));
    } else if (node.type === 'emphasis') {
      const emphasisNode = node as Emphasis;
      runs.push(...convertInlineNodes(emphasisNode.children, bold, true));
    } else if (node.type === 'inlineCode') {
      const codeNode = node as InlineCode;
      runs.push(new TextRun({
        text: codeNode.value,
        font: 'Courier New',
        bold,
        italics: italic,
      }));
    } else if (node.type === 'link') {
      const linkNode = node as Link;
      const linkText = extractText(linkNode);
      // Links need to be handled separately - we'll just show the text with the URL
      runs.push(new TextRun({
        text: linkText,
        bold,
        italics: italic,
        color: '0000FF',
        underline: {},
      }));
      runs.push(new TextRun({
        text: ` (${linkNode.url})`,
        bold,
        italics: italic,
        color: '808080',
      }));
    } else if (hasChildren(node)) {
      runs.push(...convertInlineNodes(node.children, bold, italic));
    }
  }

  return runs;
};

/**
 * Converts a markdown table to a DOCX Table object.
 * Handles headers and data cells with proper borders.
 */
const convertTable = (tableNode: MdTable): Table => {
  const rows: TableRow[] = [];

  for (const rowNode of tableNode.children) {
    const mdRow = rowNode as MdTableRow;
    const cells: TableCell[] = [];

    for (const cellNode of mdRow.children) {
      const mdCell = cellNode as MdTableCell;
      const cellText = extractText(mdCell);

      cells.push(new TableCell({
        children: [new Paragraph({
          children: [new TextRun(cellText)],
        })],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
        },
      }));
    }

    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
};

/**
 * Converts markdown AST nodes to DOCX paragraph/table elements.
 * Main conversion logic for block-level elements.
 */
const convertNodes = (nodes: Node[]): (Paragraph | Table)[] => {
  const elements: (Paragraph | Table)[] = [];

  for (const node of nodes) {
    if (node.type === 'heading') {
      const heading = node as Heading;
      const text = extractText(heading);
      const headingLevels: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };

      elements.push(new Paragraph({
        text,
        heading: headingLevels[heading.depth] || HeadingLevel.HEADING_1,
        spacing: {
          before: convertInchesToTwip(0.2),
          after: convertInchesToTwip(0.1),
        },
      }));
    } else if (node.type === 'paragraph') {
      const para = node as MdParagraph;
      const runs = convertInlineNodes(para.children);

      elements.push(new Paragraph({
        children: runs,
        spacing: {
          after: convertInchesToTwip(0.1),
        },
      }));
    } else if (node.type === 'list') {
      const list = node as List;

      for (let i = 0; i < list.children.length; i++) {
        const item = list.children[i] as ListItem;
        const itemText = extractText(item);
        const bullet = list.ordered ? `${i + 1}.` : '•';

        elements.push(new Paragraph({
          children: [new TextRun(`${bullet} ${itemText}`)],
          spacing: {
            after: convertInchesToTwip(0.05),
          },
          indent: {
            left: convertInchesToTwip(0.5),
          },
        }));
      }
    } else if (node.type === 'code') {
      const code = node as Code;

      // Add language label if present
      if (code.lang) {
        elements.push(new Paragraph({
          children: [new TextRun({
            text: `Language: ${code.lang}`,
            italics: true,
            color: '666666',
          })],
          spacing: {
            before: convertInchesToTwip(0.1),
          },
        }));
      }

      // Split code into lines and create a paragraph for each
      const lines = code.value.split('\n');
      for (const line of lines) {
        elements.push(new Paragraph({
          children: [new TextRun({
            text: line || ' ', // Empty line needs space to render
            font: 'Courier New',
            size: 20, // 10pt
          })],
          spacing: {
            after: 0,
          },
          shading: {
            fill: 'F5F5F5',
          },
          indent: {
            left: convertInchesToTwip(0.25),
          },
        }));
      }

      // Add spacing after code block
      elements.push(new Paragraph({
        children: [new TextRun('')],
        spacing: {
          after: convertInchesToTwip(0.1),
        },
      }));
    } else if (node.type === 'blockquote') {
      const quote = node as Blockquote;
      const quoteText = extractText(quote);

      elements.push(new Paragraph({
        children: [new TextRun({
          text: quoteText,
          italics: true,
          color: '666666',
        })],
        indent: {
          left: convertInchesToTwip(0.5),
        },
        border: {
          left: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: 'E0E0E0',
          },
        },
        spacing: {
          after: convertInchesToTwip(0.1),
        },
      }));
    } else if (node.type === 'table') {
      const table = convertTable(node as MdTable);
      elements.push(table);

      // Add spacing after table
      elements.push(new Paragraph({
        children: [new TextRun('')],
        spacing: {
          after: convertInchesToTwip(0.1),
        },
      }));
    } else if (node.type === 'thematicBreak') {
      elements.push(new Paragraph({
        children: [new TextRun('─'.repeat(50))],
        alignment: AlignmentType.CENTER,
        spacing: {
          before: convertInchesToTwip(0.1),
          after: convertInchesToTwip(0.1),
        },
      }));
    }
  }

  return elements;
};

/**
 * Converts markdown content to a DOCX document buffer.
 *
 * @param markdownContent - The markdown string to convert
 * @returns Promise<Buffer> - The DOCX file as a buffer ready to be written to disk
 */
export const convertMarkdownToDocx = async (markdownContent: string): Promise<Buffer> => {
  // Parse markdown to AST
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const ast = processor.parse(markdownContent) as Root;

  // Convert AST nodes to DOCX elements
  const docxElements = convertNodes(ast.children);

  // Create DOCX document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      children: docxElements,
    }],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
};
