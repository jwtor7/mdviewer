import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { solarizedlight, solarizedDarkAtom } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import type { ThemeMode } from '../constants/index.js';

export interface MarkdownPreviewProps {
  content: string;
  theme?: ThemeMode;
}

const MarkdownPreview = memo(({ content, theme = 'dark' }: MarkdownPreviewProps) => {
  // Map theme to syntax highlighting style
  const getSyntaxStyle = () => {
    switch (theme) {
      case 'light':
        return vs;
      case 'solarized-light':
        return solarizedlight;
      case 'solarized-dark':
        return solarizedDarkAtom;
      case 'dark':
      case 'system': // Default system to dark theme
      default:
        return vscDarkPlus;
    }
  };

  const components: Components = {
    code(props) {
      const { className, children, ...rest } = props;
      const match = /language-(\w+)/.exec(className || '');

      // Check if this is an inline code element
      const isInline = !match;

      return !isInline && match ? (
        <SyntaxHighlighter
          language={match[1]}
          style={getSyntaxStyle()}
          PreTag="div"
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...rest}>
          {children}
        </code>
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
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
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
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview;
