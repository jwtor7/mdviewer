/**
 * Clipboard Sanitizer Utility
 *
 * Sanitizes HTML content before copying to clipboard to prevent
 * potential XSS attacks when pasting into other applications.
 *
 * Security: HIGH-4 fix - Ensures clipboard content is safe even if
 * DOM manipulation occurs or edge cases bypass rendering sanitization.
 */

/**
 * Allowlist of safe HTML elements for clipboard content.
 * These are formatting-related elements that preserve document structure
 * without introducing security risks.
 */
const ALLOWED_ELEMENTS = new Set([
  // Document structure
  'div', 'span', 'p', 'br', 'hr',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Text formatting
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
  'sub', 'sup', 'small', 'big',
  // Code
  'code', 'pre', 'kbd', 'samp', 'var',
  // Lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Links and references
  'a', 'abbr', 'cite', 'dfn', 'q', 'blockquote',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Media (safe representations)
  'img', 'figure', 'figcaption',
  // Semantic
  'article', 'section', 'aside', 'header', 'footer', 'nav', 'main',
  'address', 'time', 'details', 'summary',
  // Text direction
  'bdo', 'bdi', 'wbr',
]);

/**
 * Allowlist of safe attributes for clipboard content.
 * Event handlers (onclick, onerror, etc.) are explicitly NOT included.
 */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  // Global attributes allowed on any element
  '*': new Set([
    'class', 'id', 'title', 'lang', 'dir', 'translate',
    // Data attributes are stripped for security (could contain malicious data)
    // 'data-*' patterns are handled separately
  ]),
  // Element-specific attributes
  'a': new Set(['href', 'target', 'rel', 'download', 'hreflang', 'type']),
  'img': new Set(['src', 'alt', 'width', 'height', 'loading']),
  'td': new Set(['colspan', 'rowspan', 'headers']),
  'th': new Set(['colspan', 'rowspan', 'headers', 'scope']),
  'col': new Set(['span']),
  'colgroup': new Set(['span']),
  'ol': new Set(['start', 'reversed', 'type']),
  'li': new Set(['value']),
  'blockquote': new Set(['cite']),
  'q': new Set(['cite']),
  'time': new Set(['datetime']),
  'abbr': new Set(['title']),
  'dfn': new Set(['title']),
  'bdo': new Set(['dir']),
  'table': new Set(['border']),
};

/**
 * Dangerous protocols that must be blocked in href/src attributes.
 * These could execute code or access local resources.
 */
const BLOCKED_PROTOCOLS = new Set([
  'javascript:',
  'vbscript:',
  'data:',  // Could contain executable content
  'file:',
  'blob:',
  'about:',
]);

/**
 * Check if a URL protocol is safe.
 */
const isUrlSafe = (url: string): boolean => {
  if (!url) return true;

  const trimmedUrl = url.trim().toLowerCase();

  // Check against blocked protocols
  for (const protocol of BLOCKED_PROTOCOLS) {
    if (trimmedUrl.startsWith(protocol)) {
      return false;
    }
  }

  // Allow http, https, mailto, tel, and relative URLs
  return true;
};

/**
 * Sanitize a single HTML element by removing dangerous attributes
 * and checking element safety.
 */
const sanitizeElement = (element: Element): void => {
  const tagName = element.tagName.toLowerCase();

  // Check if element is allowed
  if (!ALLOWED_ELEMENTS.has(tagName)) {
    // Replace disallowed element with its text content
    const textNode = document.createTextNode(element.textContent || '');
    element.parentNode?.replaceChild(textNode, element);
    return;
  }

  // Get allowed attributes for this element
  const globalAllowed = ALLOWED_ATTRIBUTES['*'] || new Set();
  const elementAllowed = ALLOWED_ATTRIBUTES[tagName] || new Set();
  const allAllowed = new Set([...globalAllowed, ...elementAllowed]);

  // Remove disallowed attributes
  const attributesToRemove: string[] = [];
  for (const attr of Array.from(element.attributes)) {
    const attrName = attr.name.toLowerCase();

    // Always block event handlers
    if (attrName.startsWith('on')) {
      attributesToRemove.push(attr.name);
      continue;
    }

    // Block style attribute (could be used for CSS-based attacks)
    if (attrName === 'style') {
      attributesToRemove.push(attr.name);
      continue;
    }

    // Block data-* attributes (could contain malicious payloads)
    if (attrName.startsWith('data-')) {
      attributesToRemove.push(attr.name);
      continue;
    }

    // Check if attribute is in allowlist
    if (!allAllowed.has(attrName)) {
      attributesToRemove.push(attr.name);
      continue;
    }

    // Special handling for href and src - validate protocols
    if (attrName === 'href' || attrName === 'src') {
      if (!isUrlSafe(attr.value)) {
        attributesToRemove.push(attr.name);
        continue;
      }
    }
  }

  // Remove the disallowed attributes
  for (const attrName of attributesToRemove) {
    element.removeAttribute(attrName);
  }

  // Add security attributes to links
  if (tagName === 'a') {
    element.setAttribute('rel', 'noopener noreferrer');
  }

  // Recursively sanitize child elements
  const children = Array.from(element.children);
  for (const child of children) {
    sanitizeElement(child);
  }
};

/**
 * Sanitize HTML content for safe clipboard copying.
 *
 * This function:
 * 1. Parses HTML safely using DOMParser
 * 2. Removes dangerous elements (script, iframe, etc.)
 * 3. Removes dangerous attributes (onclick, onerror, etc.)
 * 4. Validates URL protocols in href/src attributes
 * 5. Preserves formatting for rich text pasting
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for clipboard
 */
export const sanitizeHtmlForClipboard = (html: string): string => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    // Parse HTML using DOMParser (safe - doesn't execute scripts)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove dangerous elements entirely (they shouldn't exist due to
    // rehype-sanitize, but defense-in-depth)
    const dangerousSelectors = [
      'script',
      'style',
      'iframe',
      'frame',
      'frameset',
      'object',
      'embed',
      'applet',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'meta',
      'link',
      'base',
      'noscript',
      'template',
      'slot',
      'portal',
    ];

    for (const selector of dangerousSelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of Array.from(elements)) {
        element.remove();
      }
    }

    // Remove HTML comments (could contain conditional comments for IE)
    const removeComments = (node: Node): void => {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.COMMENT_NODE) {
          node.removeChild(child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          removeComments(child);
        }
      }
    };
    removeComments(doc.body);

    // Sanitize all remaining elements
    const elements = Array.from(doc.body.children);
    for (const element of elements) {
      sanitizeElement(element);
    }

    // Return the sanitized HTML
    return doc.body.innerHTML;
  } catch (error) {
    // If parsing fails, return empty string for safety
    console.error('[SECURITY] Failed to sanitize HTML for clipboard:', error);
    return '';
  }
};

/**
 * Sanitize plain text for clipboard.
 * Ensures no HTML injection is possible when text is pasted.
 *
 * @param text - The text to sanitize
 * @returns Sanitized plain text
 */
export const sanitizeTextForClipboard = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Plain text is inherently safe for clipboard operations
  // The text will be interpreted as text, not HTML, when pasted
  // However, we ensure there are no null bytes or other control characters
  // that could cause issues in some applications

  return text
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove other problematic control characters (except newlines and tabs)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
};

export default sanitizeHtmlForClipboard;
