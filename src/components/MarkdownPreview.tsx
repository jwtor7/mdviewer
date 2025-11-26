import React, { memo, useEffect, useRef, useMemo, useCallback } from 'react';
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
  searchTerm?: string;
  caseSensitive?: boolean;
  currentMatchIndex?: number;
}

// Helper to highlight text content with search term
const highlightText = (text: string, searchTerm: string, caseSensitive: boolean, globalIndexRef: { current: number }, currentMatchIndex: number): React.ReactNode => {
  if (!searchTerm) return text;

  const searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  const compareText = caseSensitive ? text : text.toLowerCase();

  const matches: { start: number; end: number }[] = [];
  let index = 0;
  while (index < compareText.length) {
    const foundIndex = compareText.indexOf(searchText, index);
    if (foundIndex === -1) break;
    matches.push({ start: foundIndex, end: foundIndex + searchTerm.length });
    index = foundIndex + 1;
  }

  if (matches.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match) => {
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }

    const isCurrent = globalIndexRef.current === currentMatchIndex;
    parts.push(
      <mark
        key={`match-${globalIndexRef.current}`}
        className={isCurrent ? 'search-highlight-current' : 'search-highlight'}
        data-match-index={globalIndexRef.current}
      >
        {text.substring(match.start, match.end)}
      </mark>
    );
    globalIndexRef.current++;
    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
};

// Recursively process children to add highlights
const processChildren = (children: React.ReactNode, searchTerm: string, caseSensitive: boolean, globalIndexRef: { current: number }, currentMatchIndex: number, skipHighlight: boolean = false): React.ReactNode => {
  if (!children) return children;

  if (typeof children === 'string') {
    if (skipHighlight) return children;
    return highlightText(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
  }

  if (typeof children === 'number') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map((child, idx) => {
      const processed = processChildren(child, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex, skipHighlight);
      // If it's a string that was converted to an array of elements, wrap in fragment with key
      if (React.isValidElement(processed)) {
        return React.cloneElement(processed, { key: processed.key || `child-${idx}` });
      }
      if (Array.isArray(processed)) {
        return <React.Fragment key={`frag-${idx}`}>{processed}</React.Fragment>;
      }
      return processed;
    });
  }

  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{ children?: React.ReactNode }>;
    // Skip highlighting inside code elements
    const isCode = element.type === 'code' || (typeof element.type === 'string' && element.type === 'code');
    const newSkipHighlight = skipHighlight || isCode;

    if (element.props.children) {
      return React.cloneElement(element, {
        ...element.props,
        children: processChildren(element.props.children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex, newSkipHighlight)
      } as React.Attributes & { children?: React.ReactNode });
    }
  }

  return children;
};

const MarkdownPreview = memo(({ content, theme: _theme = 'dark', searchTerm = '', caseSensitive = false, currentMatchIndex = 0 }: MarkdownPreviewProps) => {
  const previewRef = useRef<HTMLDivElement>(null);

  // Helper to extract text content from React children (for copy button)
  const extractTextContent = useCallback((children: React.ReactNode): string => {
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
  }, []);

  // Create components with search highlighting
  const components: Components = useMemo(() => {
    // Create a ref object to track global match index across all text processing
    const globalIndexRef = { current: 0 };

    return {
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

        // Process children for highlighting
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        return (
          <a
            href={href}
            onClick={handleClick}
            title={href ? `Open link: ${href}` : undefined}
            className="markdown-link"
            {...rest}
          >
            {processedChildren}
          </a>
        );
      },
      // Process text in paragraph elements
      p(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <p {...rest}>{processedChildren}</p>;
      },
      // Process text in list items
      li(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <li {...rest}>{processedChildren}</li>;
      },
      // Process headings
      h1(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <h1 {...rest}>{processedChildren}</h1>;
      },
      h2(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <h2 {...rest}>{processedChildren}</h2>;
      },
      h3(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <h3 {...rest}>{processedChildren}</h3>;
      },
      h4(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <h4 {...rest}>{processedChildren}</h4>;
      },
      h5(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <h5 {...rest}>{processedChildren}</h5>;
      },
      h6(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <h6 {...rest}>{processedChildren}</h6>;
      },
      // Process table cells
      td(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <td {...rest}>{processedChildren}</td>;
      },
      th(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <th {...rest}>{processedChildren}</th>;
      },
      // Process blockquotes
      blockquote(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <blockquote {...rest}>{processedChildren}</blockquote>;
      },
      // Process strong/em/del
      strong(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <strong {...rest}>{processedChildren}</strong>;
      },
      em(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <em {...rest}>{processedChildren}</em>;
      },
      del(props) {
        const { children, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);
        return <del {...rest}>{processedChildren}</del>;
      },
    };
  }, [searchTerm, caseSensitive, currentMatchIndex, extractTextContent]);

  // Scroll to current match after render
  useEffect(() => {
    if (!previewRef.current || !searchTerm) return;

    const currentMark = previewRef.current.querySelector('mark.search-highlight-current');
    if (currentMark) {
      currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchTerm, currentMatchIndex]);

  return (
    <div ref={previewRef} className="markdown-preview" role="document" aria-label="Rendered markdown preview">
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
