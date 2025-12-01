import React, { memo, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import type { ThemeMode } from '../constants/index.js';
import CodeBlock from './CodeBlock';
import { replaceTextContent } from '../utils/textEditing';

export interface MarkdownPreviewProps {
  content: string;
  theme?: ThemeMode;
  searchTerm?: string;
  caseSensitive?: boolean;
  currentMatchIndex?: number;
  filePath?: string;
  onContentChange?: (content: string) => void;
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

const MarkdownPreview = memo(({ content, theme: _theme = 'dark', searchTerm = '', caseSensitive = false, currentMatchIndex = 0, filePath, onContentChange }: MarkdownPreviewProps) => {
  const previewRef = useRef<HTMLDivElement>(null);

  // Image cache to avoid reloading the same images
  const imageCache = useRef<Map<string, string>>(new Map());

  // Clear cache when filePath changes
  useEffect(() => {
    imageCache.current.clear();
  }, [filePath]);

  // Handler for inline text editing - syncs on blur to avoid re-render focus loss
  const handleTextEdit = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!onContentChange || !content) return;

    const element = e.currentTarget;
    const start = parseInt(element.dataset.sourceStart || '0');
    const end = parseInt(element.dataset.sourceEnd || '0');
    const newText = element.textContent || '';

    const originalMarkdown = content.slice(start, end);
    const updatedMarkdown = replaceTextContent(originalMarkdown, newText);

    // Only update if content actually changed
    if (updatedMarkdown !== originalMarkdown) {
      const newContent = content.slice(0, start) + updatedMarkdown + content.slice(end);
      onContentChange(newContent);
    }
  }, [onContentChange, content]);

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
      // Custom img component to handle relative paths
      img(props) {
        const { src, alt, ...rest } = props;
        const [dataUri, setDataUri] = React.useState<string | null>(null);
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState(false);

        React.useEffect(() => {
          if (!src || !filePath) {
            return;
          }

          // Skip if it's already a data URI or absolute URL
          if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
            return;
          }

          // Check cache first
          const cached = imageCache.current.get(src);
          if (cached) {
            setDataUri(cached);
            return;
          }

          // Load image via IPC
          setLoading(true);
          setError(false);

          window.electronAPI?.readImageFile(src, filePath)
            .then((result) => {
              if (result.dataUri) {
                imageCache.current.set(src, result.dataUri);
                setDataUri(result.dataUri);
              } else if (result.error) {
                console.error('Failed to load image:', result.error);
                setError(true);
              }
            })
            .catch((err) => {
              console.error('Failed to load image:', err);
              setError(true);
            })
            .finally(() => {
              setLoading(false);
            });
        }, [src]);

        if (loading) {
          return <span style={{ color: '#888', fontStyle: 'italic' }}>Loading image...</span>;
        }

        if (error) {
          return <span style={{ color: '#f00' }} title={src || 'Unknown image'}>⚠ Image not found: {alt || src}</span>;
        }

        return <img src={dataUri || src} alt={alt} {...rest} />;
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
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        // Make editable if onContentChange is provided
        if (onContentChange && node?.position) {
          return (
            <p
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </p>
          );
        }

        return <p {...rest}>{processedChildren}</p>;
      },
      // Process text in list items
      li(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        // Make editable if onContentChange is provided
        if (onContentChange && node?.position) {
          return (
            <li
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </li>
          );
        }

        return <li {...rest}>{processedChildren}</li>;
      },
      // Process headings
      h1(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <h1
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </h1>
          );
        }

        return <h1 {...rest}>{processedChildren}</h1>;
      },
      h2(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <h2
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </h2>
          );
        }

        return <h2 {...rest}>{processedChildren}</h2>;
      },
      h3(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <h3
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </h3>
          );
        }

        return <h3 {...rest}>{processedChildren}</h3>;
      },
      h4(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <h4
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </h4>
          );
        }

        return <h4 {...rest}>{processedChildren}</h4>;
      },
      h5(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <h5
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </h5>
          );
        }

        return <h5 {...rest}>{processedChildren}</h5>;
      },
      h6(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <h6
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </h6>
          );
        }

        return <h6 {...rest}>{processedChildren}</h6>;
      },
      // Process table cells
      td(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <td
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </td>
          );
        }

        return <td {...rest}>{processedChildren}</td>;
      },
      th(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <th
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </th>
          );
        }

        return <th {...rest}>{processedChildren}</th>;
      },
      // Process blockquotes
      blockquote(props) {
        const { children, node, ...rest } = props;
        const processedChildren = processChildren(children, searchTerm, caseSensitive, globalIndexRef, currentMatchIndex);

        if (onContentChange && node?.position) {
          return (
            <blockquote
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
            >
              {processedChildren}
            </blockquote>
          );
        }

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
  }, [searchTerm, caseSensitive, currentMatchIndex, extractTextContent, filePath, onContentChange, content, handleTextEdit]);

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
