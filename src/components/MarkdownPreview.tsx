import React, { memo, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import { ThemeMode, IMAGE_CONFIG } from '../constants/index.js';
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

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  children?: HastNode[];
  properties?: Record<string, unknown>;
};

type HighlightOptions = {
  searchTerm: string;
  caseSensitive: boolean;
  currentMatchIndex: number;
};

const createRehypeSearchHighlight = ({ searchTerm, caseSensitive, currentMatchIndex }: HighlightOptions) => {
  if (!searchTerm) {
    return () => undefined;
  }

  const needle = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  return (tree: HastNode): void => {
    let globalIndex = 0;

    const processNodes = (nodes: HastNode[], inCode: boolean): void => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (node.type === 'element') {
          const tagName = node.tagName ? node.tagName.toLowerCase() : '';
          const nextInCode = inCode || tagName === 'code' || tagName === 'pre';
          if (node.children && node.children.length > 0) {
            processNodes(node.children, nextInCode);
          }
          continue;
        }

        if (node.type !== 'text' || inCode || typeof node.value !== 'string') {
          continue;
        }

        const rawText = node.value;
        const compareText = caseSensitive ? rawText : rawText.toLowerCase();
        let index = compareText.indexOf(needle);

        if (index === -1) {
          continue;
        }

        const parts: HastNode[] = [];
        let lastIndex = 0;

        while (index !== -1) {
          if (index > lastIndex) {
            parts.push({ type: 'text', value: rawText.slice(lastIndex, index) });
          }

          const matchText = rawText.slice(index, index + searchTerm.length);
          const isCurrent = globalIndex === currentMatchIndex;

          parts.push({
            type: 'element',
            tagName: 'mark',
            properties: {
              className: isCurrent ? 'search-highlight-current' : 'search-highlight'
            },
            children: [{ type: 'text', value: matchText }],
          });

          globalIndex++;
          lastIndex = index + searchTerm.length;
          index = compareText.indexOf(needle, lastIndex);
        }

        if (lastIndex < rawText.length) {
          parts.push({ type: 'text', value: rawText.slice(lastIndex) });
        }

        nodes.splice(i, 1, ...parts);
        i += parts.length - 1;
      }
    };

    if (tree.children) {
      processNodes(tree.children, false);
    }
  };
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

  // Handler for pasting images
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLElement>) => {
    if (!onContentChange || !content) return;

    if (!filePath) {
      // Check if there are files to be pasted
      if (e.clipboardData.files.length > 0) {
        alert('Please save the document before pasting images.');
      }
      return;
    }

    const files = Array.from(e.clipboardData.files);
    let imageFiles: File[] = [];

    try {
      imageFiles = files.filter(file => {
        // Check MIME type first (most reliable for clipboard)
        if (file.type.startsWith('image/')) {
          return true;
        }

        // Fallback to extension check
        const ext = file.name.includes('.')
          ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
          : '';

        // Only allow defined image types
        return (IMAGE_CONFIG.ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
      });
    } catch (err) {
      console.error('[MarkdownPreview] Error filtering images:', err);
    }

    // If no images, let default paste happen (text)
    if (imageFiles.length === 0) {
      return;
    }

    // Prevent default to stop browser from inserting <img src="blob:..."> which we can't save easily
    e.preventDefault();

    const element = e.currentTarget;
    const start = parseInt(element.dataset.sourceStart || '0');
    const end = parseInt(element.dataset.sourceEnd || '0');

    // We will append images to the end of the current block for simplicity
    // A better approach would be to insert at caret, but that requires complex Selection API handling
    // and mapping to markdown offsets.

    let addedMarkdown = '';

    for (const imageFile of imageFiles) {
      try {
        let sourcePath: string | null = null;
        if (window.electronAPI?.getPathForFile) {
          sourcePath = window.electronAPI.getPathForFile(imageFile);
        }

        let relativePath: string | undefined;

        if (sourcePath && window.electronAPI?.copyImageToDocument) {
          const result = await window.electronAPI.copyImageToDocument(sourcePath, filePath);
          if (result.success) {
            relativePath = result.data.relativePath;
          } else {
            throw new Error(result.error || 'Failed to copy image');
          }
        } else if (window.electronAPI?.saveImageFromData) {
          // Fallback: Read file as data URI and save
          const reader = new FileReader();
          const dataUri = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          });

          const result = await window.electronAPI.saveImageFromData(dataUri, filePath);
          if (result.success) {
            relativePath = result.data.relativePath;
          } else {
            throw new Error(result.error || 'Failed to save image');
          }
        }

        if (relativePath) {
          // Use encoded path for spaces
          addedMarkdown += `![${imageFile.name}](${encodeURI(relativePath)})`;
        }
      } catch (err) {
        console.error('Failed to handle pasted image', err);
      }
    }

    if (addedMarkdown) {
      // Insert the markdown.
      // We replace the current block's content with: current_text + added_markdown
      // This ensures we don't lose the text being edited + the new image.
      // NOTE: We must be careful. handlePaste happens BEFORE the text might be updated in the DOM if we prevented default?
      // We prevented default, so the text currently in 'element' is what was there before paste.
      // But wait, if they were typing, element.textContent is current.

      const currentText = element.textContent || '';
      const originalMarkdown = content.slice(start, end);
      const updatedBlockText = replaceTextContent(originalMarkdown, currentText);

      // Add the image markdown
      const newBlockContent = updatedBlockText + (updatedBlockText.endsWith('\n') ? '' : '\n') + addedMarkdown;

      const newContent = content.slice(0, start) + newBlockContent + content.slice(end);
      onContentChange(newContent);
    }

  }, [onContentChange, content, filePath]);

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

          // Decode URL to get actual filename (e.g. "my%20image.png" -> "my image.png")
          const decodedSrc = decodeURIComponent(src);

          // Check cache first (using the decoded source or original? usually original source string is the key)
          const cached = imageCache.current.get(src);
          if (cached) {
            setDataUri(cached);
            return;
          }

          // Load image via IPC
          setLoading(true);
          setError(false);

          // Use decoded path for file system access
          window.electronAPI?.readImageFile(decodedSrc, filePath)
            .then((result) => {
              if (result.success) {
                imageCache.current.set(src, result.data.dataUri);
                setDataUri(result.data.dataUri);
              } else {
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
        }, [src, filePath]);

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
            window.electronAPI.openExternalUrl(href).then((result) => {
              if (!result.success) {
                console.error('Failed to open external URL:', result.error);
              }
            }).catch((err) => {
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
      // Process text in paragraph elements
      p(props) {
        const { children, node, ...rest } = props;

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
              onPaste={handlePaste}
            >
              {children}
            </p>
          );
        }

        return <p {...rest}>{children}</p>;
      },
      // Process text in list items
      li(props) {
        const { children, node, ...rest } = props;

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
              onPaste={handlePaste}
            >
              {children}
            </li>
          );
        }

        return <li {...rest}>{children}</li>;
      },
      // Process headings
      h1(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <h1
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </h1>
          );
        }

        return <h1 {...rest}>{children}</h1>;
      },
      h2(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <h2
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </h2>
          );
        }

        return <h2 {...rest}>{children}</h2>;
      },
      h3(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <h3
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </h3>
          );
        }

        return <h3 {...rest}>{children}</h3>;
      },
      h4(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <h4
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </h4>
          );
        }

        return <h4 {...rest}>{children}</h4>;
      },
      h5(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <h5
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </h5>
          );
        }

        return <h5 {...rest}>{children}</h5>;
      },
      h6(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <h6
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </h6>
          );
        }

        return <h6 {...rest}>{children}</h6>;
      },
      // Process table cells
      td(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <td
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </td>
          );
        }

        return <td {...rest}>{children}</td>;
      },
      th(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <th
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </th>
          );
        }

        return <th {...rest}>{children}</th>;
      },
      // Process blockquotes
      blockquote(props) {
        const { children, node, ...rest } = props;

        if (onContentChange && node?.position) {
          return (
            <blockquote
              {...rest}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-source-start={node.position.start.offset}
              data-source-end={node.position.end.offset}
              onBlur={handleTextEdit}
              onPaste={handlePaste}
            >
              {children}
            </blockquote>
          );
        }

        return <blockquote {...rest}>{children}</blockquote>;
      },
      // Process strong/em/del
      strong(props) {
        const { children, ...rest } = props;
        return <strong {...rest}>{children}</strong>;
      },
      em(props) {
        const { children, ...rest } = props;
        return <em {...rest}>{children}</em>;
      },
      del(props) {
        const { children, ...rest } = props;
        return <del {...rest}>{children}</del>;
      },
    };
  }, [extractTextContent, filePath, onContentChange, content, handleTextEdit, handlePaste]);

  // Scroll to current match after render
  useEffect(() => {
    if (!previewRef.current || !searchTerm) return;

    const currentMark = previewRef.current.querySelector('mark.search-highlight-current');
    if (currentMark) {
      currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchTerm, currentMatchIndex]);

  // Allow safe protocols for images while still permitting relative paths
  const customSchema = useMemo(() => ({
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      src: ['http', 'https', 'data']
    }
  }), []);

  const rehypeSearchHighlight = useMemo(() => (
    createRehypeSearchHighlight({ searchTerm, caseSensitive, currentMatchIndex })
  ), [searchTerm, caseSensitive, currentMatchIndex]);

  return (
    <div
      ref={previewRef}
      className="markdown-preview"
      role="document"
      aria-label="Rendered markdown preview"
      onPaste={handlePaste}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, customSchema], rehypeHighlight, rehypeSearchHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview;
