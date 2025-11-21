import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

export interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview = memo(({ content }: MarkdownPreviewProps) => {
  const components: Components = {
    code(props) {
      const { node, className, children, ...rest } = props;
      const match = /language-(\w+)/.exec(className || '');

      // Check if this is an inline code element
      const isInline = !match;

      return !isInline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus as SyntaxHighlighterProps['style']}
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
