import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import crypto from 'crypto';
import { rehypeSectionWrap } from './rehypeSectionWrap';

export const convertMarkdownToHTML = async (markdown: string): Promise<string> => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeSectionWrap)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
};

export const getPDFStyles = (): string => {
  return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #333333;
      background: #ffffff;
      padding: 20px;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      break-after: avoid;
      page-break-after: avoid;
    }
    h1 + *, h2 + *, h3 + *, h4 + *, h5 + *, h6 + * {
      break-before: avoid;
      page-break-before: avoid;
    }
    .pdf-section {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    h1 {
      font-size: 2em;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 0.3em;
      margin-top: 0;
      margin-bottom: 0.5em;
    }
    h2 {
      font-size: 1.5em;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 0.3em;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h3 {
      font-size: 1.25em;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h4 {
      font-size: 1.1em;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h5 {
      font-size: 1em;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h6 {
      font-size: 0.9em;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    p {
      margin-bottom: 1em;
      orphans: 3;
      widows: 3;
    }
    ul, ol {
      padding-left: 2em;
      margin-bottom: 1em;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    li {
      margin-bottom: 0.5em;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    blockquote {
      border-left: 4px solid #e0e0e0;
      padding-left: 1em;
      color: #666;
      margin: 1em 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    code {
      background-color: #f5f5f5;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    pre {
      background-color: #f5f5f5;
      padding: 1em;
      border-radius: 5px;
      overflow-x: visible;
      overflow-y: visible;
      white-space: pre-wrap;
      word-wrap: break-word;
      page-break-inside: avoid;
      margin-bottom: 1em;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1em;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #e0e0e0;
      padding: 0.5em;
      text-align: left;
      word-wrap: break-word;
    }
    th {
      background-color: #f5f5f5;
    }
    a {
      color: #268bd2;
      text-decoration: none;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img {
      max-width: 100%;
    }
  `;
};

export const generatePDFHTML = async (markdownContent: string): Promise<string> => {
  const htmlBody = await convertMarkdownToHTML(markdownContent);
  const nonce = crypto.randomBytes(16).toString('base64');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: blob:; style-src 'nonce-${nonce}'; font-src 'self' data:;">
    <style nonce="${nonce}">${getPDFStyles()}</style>
  </head>
  <body>
    ${htmlBody}
  </body>
</html>`;
};
