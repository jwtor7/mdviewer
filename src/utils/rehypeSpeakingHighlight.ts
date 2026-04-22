/**
 * Rehype plugin that tags the block element containing the currently-spoken
 * source range with a `tts-speaking` class. Relies on `data-source-start` /
 * `data-source-end` attributes added by MarkdownPreview's custom component
 * overrides.
 */

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export interface SpeakingHighlightOptions {
  start: number | null;
  end: number | null;
  className?: string;
}

const appendClassName = (node: HastNode, className: string): void => {
  if (!node.properties) node.properties = {};
  const existing = node.properties.className;
  if (Array.isArray(existing)) {
    if (!existing.includes(className)) {
      node.properties.className = [...existing, className];
    }
  } else if (typeof existing === 'string') {
    const parts = existing.split(/\s+/).filter(Boolean);
    if (!parts.includes(className)) parts.push(className);
    node.properties.className = parts.join(' ');
  } else {
    node.properties.className = [className];
  }
};

const readOffset = (value: unknown): number | null => {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
};

export const createRehypeSpeakingHighlight = ({ start, end, className = 'tts-speaking' }: SpeakingHighlightOptions) => {
  return () => {
    if (start == null || end == null || end <= start) return undefined;

    return (tree: HastNode): void => {
      const visit = (node: HastNode): void => {
        if (!node.children) return;
        for (const child of node.children) {
          if (child.type === 'element') {
            const nodeStart = readOffset(child.properties?.dataSourceStart ?? child.properties?.['data-source-start']);
            const nodeEnd = readOffset(child.properties?.dataSourceEnd ?? child.properties?.['data-source-end']);
            if (nodeStart != null && nodeEnd != null) {
              // Element overlaps the speaking range → highlight.
              if (nodeStart < end && nodeEnd > start) {
                appendClassName(child, className);
              }
            }
            visit(child);
          }
        }
      };
      visit(tree);
    };
  };
};
