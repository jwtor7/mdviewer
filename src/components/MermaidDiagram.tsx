import React, { useEffect, useRef, useState, memo } from 'react';
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

const MermaidDiagram = memo(({ chart, theme }: MermaidDiagramProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string>(`mermaid-${++instanceCounter}`);

  useEffect(() => {
    if (!containerRef.current || !chart.trim()) return;

    const mermaidTheme = getMermaidTheme(theme);

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: mermaidTheme,
    });

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        // Use a unique ID for each render to avoid conflicts
        const renderId = `${idRef.current}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          // Clean up any error elements mermaid may have inserted into the DOM
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

  if (error) {
    return (
      <div className="mermaid-diagram-error">
        <div className="mermaid-diagram-error-message">Mermaid diagram error: {error}</div>
        <pre><code>{chart}</code></pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram-container"
    />
  );
});

MermaidDiagram.displayName = 'MermaidDiagram';

export default MermaidDiagram;
