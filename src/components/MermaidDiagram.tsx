import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import mermaid from 'mermaid';
import type { ThemeMode } from '../constants/index.js';

interface MermaidDiagramProps {
  chart: string;
  theme: ThemeMode;
}

let instanceCounter = 0;

type MermaidTheme = 'default' | 'dark' | 'neutral' | 'base' | 'forest';

function getMermaidTheme(theme: ThemeMode): MermaidTheme {
  switch (theme) {
    case 'dark':
    case 'solarized-dark':
      return 'dark';
    case 'light':
      return 'default';
    case 'solarized-light':
      return 'neutral';
    case 'system':
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
    default:
      return 'default';
  }
}

/**
 * Quote unquoted node labels that contain characters mermaid's lexer
 * can't handle (hyphens, colons, plus signs, etc.).
 * Transforms: I7[Pre-push: text] -> I7["Pre-push: text"]
 * Leaves already-quoted labels like ["text"] and style/class lines untouched.
 */
function sanitizeChart(raw: string): string {
  return raw.replace(
    /\[([^\]"]+)\]/g,
    (_match, content: string) => {
      // Only quote if the label contains problematic characters
      if (/[-:+/\\]/.test(content)) {
        return `["${content}"]`;
      }
      return `[${content}]`;
    }
  );
}

const MermaidDiagram = memo(({ chart, theme }: MermaidDiagramProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const idRef = useRef<string>(`mermaid-${++instanceCounter}`);

  useEffect(() => {
    if (!containerRef.current || !chart.trim()) return;

    const mermaidTheme = getMermaidTheme(theme);

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: mermaidTheme,
      flowchart: {
        nodeSpacing: 30,
        rankSpacing: 50,
        padding: 15,
        useMaxWidth: false,
      },
      fontSize: 16,
    });

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const renderId = `${idRef.current}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, sanitizeChart(chart));
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setSvgContent(svg);
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
