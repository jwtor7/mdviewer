import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { solarizedDarkAtom } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';
import type { ThemeMode } from '../constants/index.js';

export interface MarkdownPreviewProps {
  content: string;
  theme: ThemeMode;
}

const MarkdownPreview = memo(({ content, theme }: MarkdownPreviewProps) => {
  // Select syntax highlighting style based on theme
  const getSyntaxStyle = (): SyntaxHighlighterProps['style'] => {
    if (theme === 'solarized-light') return solarizedlight as SyntaxHighlighterProps['style'];
    if (theme === 'solarized-dark') return solarizedDarkAtom as SyntaxHighlighterProps['style'];
    return vscDarkPlus as SyntaxHighlighterProps['style'];
  };

  const components: Components = {
    code(props) {
      const { node, className, children, ...rest } = props;
      const match = /language-(\w+)/.exec(className || '');

      // Check if this is an inline code element
      const isInline = !match;

      return !isInline && match ? (
        <SyntaxHighlighter
          style={getSyntaxStyle()}
          language={match[1]}
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
