import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import mermaid from 'mermaid';
import type { ThemeMode } from '../constants/index.js';

interface MermaidDiagramProps {
  chart: string;
  theme: ThemeMode;
}

let instanceCounter = 0;

function isDarkMode(theme: ThemeMode): boolean {
  switch (theme) {
    case 'dark':
    case 'solarized-dark':
      return true;
    case 'light':
    case 'solarized-light':
      return false;
    case 'system':
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    default:
      return false;
  }
}

/**
 * Parse a CSS color string to RGB values.
 * Handles hex (#rgb, #rrggbb), rgb(), and named colors via a canvas.
 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color || color === 'none' || color === 'transparent') return null;

  // Hex
  const hex = color.replace('#', '');
  if (/^[0-9a-fA-F]{3,8}$/.test(hex)) {
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // rgb(r, g, b)
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }

  return null;
}

/**
 * Relative luminance per WCAG 2.0.
 * Returns 0 (black) to 1 (white).
 */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Pick high-contrast text color for a given background.
 * Uses WCAG luminance threshold.
 */
function contrastTextColor(bgColor: string): string {
  const rgb = parseColor(bgColor);
  if (!rgb) return '#1a1a1a'; // default to dark text if unparseable
  const lum = luminance(rgb.r, rgb.g, rgb.b);
  // Threshold: luminance > 0.35 means light background -> dark text
  return lum > 0.35 ? '#1a1a1a' : '#f0f0f0';
}

/**
 * Quote unquoted node labels that contain characters mermaid's lexer
 * can't handle (hyphens, colons, plus signs, etc.).
 */
function sanitizeChart(raw: string): string {
  return raw.replace(
    /\[([^\]"]+)\]/g,
    (_match, content: string) => {
      if (/[-:+/\\]/.test(content)) {
        return `["${content}"]`;
      }
      return `[${content}]`;
    }
  );
}

/**
 * Walk up from a text element to find the nearest ancestor with a fill color,
 * which represents the node's background.
 */
function findNodeFill(el: Element): string | null {
  let current: Element | null = el;
  while (current) {
    // Check for rect, polygon, circle, path with fill
    if (current.tagName === 'g') {
      const shapes = current.querySelectorAll(':scope > rect, :scope > polygon, :scope > circle, :scope > path');
      for (const shape of shapes) {
        const fill = shape.getAttribute('fill') || (shape as SVGElement).style?.fill;
        if (fill && fill !== 'none' && fill !== 'transparent') {
          return fill;
        }
      }
    }
    current = current.parentElement;
  }
  return null;
}

const MermaidDiagram = memo(({ chart, theme }: MermaidDiagramProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const idRef = useRef<string>(`mermaid-${++instanceCounter}`);

  useEffect(() => {
    if (!containerRef.current || !chart.trim()) return;

    const dark = isDarkMode(theme);

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        // Light default node fills so text is readable even without style overrides
        primaryColor: dark ? '#4c566a' : '#e2e8f0',
        primaryTextColor: dark ? '#eceff4' : '#1a1a1a',
        primaryBorderColor: dark ? '#7b88a1' : '#94a3b8',
        secondaryColor: dark ? '#5e6a82' : '#f0f0f0',
        tertiaryColor: dark ? '#6b7894' : '#fafafa',
        lineColor: dark ? '#9aa5b4' : '#64748b',
        textColor: dark ? '#eceff4' : '#1e293b',
        nodeTextColor: dark ? '#eceff4' : '#1a1a1a',
        // Larger readable fonts
        fontSize: '18px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        // Edge labels
        edgeLabelBackground: dark ? '#2e3440' : '#ffffff',
      },
      flowchart: {
        nodeSpacing: 40,
        rankSpacing: 60,
        padding: 20,
        useMaxWidth: false,
        htmlLabels: true,
      },
    });

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const renderId = `${idRef.current}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, sanitizeChart(chart));
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;

          // Adaptive contrast: pick text color based on each node's actual fill
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.querySelectorAll('.nodeLabel, .label').forEach((el) => {
              const fill = findNodeFill(el);
              const textCol = fill ? contrastTextColor(fill) : (dark ? '#eceff4' : '#1a1a1a');
              (el as HTMLElement).style.color = textCol;
              (el as HTMLElement).style.fill = textCol;
            });
            // Edge labels: use theme-appropriate color
            svgEl.querySelectorAll('.edgeLabel').forEach((el) => {
              const col = dark ? '#d8dee9' : '#334155';
              (el as HTMLElement).style.color = col;
              (el as HTMLElement).style.fill = col;
            });
          }

          const finalSvg = containerRef.current.innerHTML;
          setSvgContent(finalSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvgContent(null);
          const errorEl = document.getElementById(`d${idRef.current}-${Date.now()}`);
          errorEl?.remove();
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, theme]);

  const handleExpand = useCallback(() => {
    if (!svgContent || !window.electronAPI?.openMermaidWindow) return;
    window.electronAPI.openMermaidWindow({ svg: svgContent, theme });
  }, [svgContent, theme]);

  if (error) {
    return (
      <div className="mermaid-diagram-error">
        <div className="mermaid-diagram-error-message">Mermaid diagram error: {error}</div>
        <pre><code>{chart}</code></pre>
      </div>
    );
  }

  return (
    <div className="mermaid-diagram-wrapper">
      <div
        ref={containerRef}
        className="mermaid-diagram-container"
      />
      {svgContent && (
        <button
          className="mermaid-expand-btn"
          onClick={handleExpand}
          title="Open in new window (zoom & pan)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="8,1 13,1 13,6" />
            <line x1="13" y1="1" x2="7.5" y2="6.5" />
            <polyline points="6,13 1,13 1,8" />
            <line x1="1" y1="13" x2="6.5" y2="7.5" />
          </svg>
        </button>
      )}
    </div>
  );
});

MermaidDiagram.displayName = 'MermaidDiagram';

export default MermaidDiagram;
