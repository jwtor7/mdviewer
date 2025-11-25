import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import type { ThemeMode } from '../constants/index.js';
import CodeBlock from './CodeBlock';

export interface MarkdownPreviewProps {
  content: string;
  theme?: ThemeMode;
}

const MarkdownPreview = memo(({ content, theme: _theme = 'dark' }: MarkdownPreviewProps) => {
  // Helper to extract text content from React children (for copy button)
  const extractTextContent = (children: React.ReactNode): string => {
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) return children.map(extractTextContent).join('');
    if (React.isValidElement(children)) {
      const props = children.props as { children?: React.ReactNode };
      if (props.children) {
        return extractTextContent(props.children);
      }
    }
    return '';
  };

  const components: Components = {
    // Use pre component to wrap code blocks with copy button
    pre(props) {
      const { children, ...rest } = props;
      // Extract raw text from the code element for copying
      const rawText = extractTextContent(children).replace(/\n$/, '');

      return (
        <CodeBlock raw={rawText}>
          <pre {...rest}>{children}</pre>
        </CodeBlock>
      );
    },
    a(props) {
      const { href, children, ...rest } = props;

      const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (href && window.electronAPI?.openExternalUrl) {
          window.electronAPI.openExternalUrl(href).catch((err) => {
            console.error('Failed to open external URL:', err);
          });
        }
      };

      return (
        <a
          href={href}
          onClick={handleClick}
          title={href ? `Open link: ${href}` : undefined}
          className="markdown-link"
          {...rest}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="markdown-preview" role="document" aria-label="Rendered markdown preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview;
