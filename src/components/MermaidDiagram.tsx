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

    const dark = isDarkMode(theme);

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        // Use dark text on nodes so colored fills stay readable
        primaryColor: dark ? '#3b4252' : '#e8e8e8',
        primaryTextColor: '#1a1a1a',
        primaryBorderColor: dark ? '#5a6270' : '#999999',
        secondaryColor: dark ? '#434c5e' : '#f0f0f0',
        tertiaryColor: dark ? '#4c566a' : '#fafafa',
        lineColor: dark ? '#8899aa' : '#666666',
        textColor: dark ? '#d8dee9' : '#2e3440',
        // Node label text is always dark for contrast on colored fills
        nodeTextColor: '#1a1a1a',
        // Large, readable fonts
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
          // Force dark text on all node labels for contrast on colored fills
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.querySelectorAll('.nodeLabel, .label').forEach((el) => {
              (el as HTMLElement).style.color = '#1a1a1a';
              (el as HTMLElement).style.fill = '#1a1a1a';
            });
            // Also fix edge labels for readability
            svgEl.querySelectorAll('.edgeLabel').forEach((el) => {
              (el as HTMLElement).style.color = dark ? '#d8dee9' : '#2e3440';
              (el as HTMLElement).style.fill = dark ? '#d8dee9' : '#2e3440';
            });
          }
          // Re-read the SVG after DOM modifications so expand window gets fixed version
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
