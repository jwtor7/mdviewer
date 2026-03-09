import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MermaidDiagram from './MermaidDiagram';

// Mock mermaid module
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mock diagram</svg>' }),
  },
}));

import mermaid from 'mermaid';

describe('MermaidDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders container for valid chart', async () => {
    const { container } = render(
      <MermaidDiagram chart="graph TD; A-->B;" theme="dark" />
    );

    await waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
        })
      );
    });

    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalled();
    });

    const diagramContainer = container.querySelector('.mermaid-diagram-container');
    expect(diagramContainer).toBeInTheDocument();
  });

  it('shows error state when mermaid.render throws', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Invalid syntax'));

    render(
      <MermaidDiagram chart="invalid mermaid" theme="dark" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Mermaid diagram error/)).toBeInTheDocument();
      expect(screen.getByText(/Invalid syntax/)).toBeInTheDocument();
    });
  });

  it('re-renders on theme change with different theme variables', async () => {
    const { rerender } = render(
      <MermaidDiagram chart="graph TD; A-->B;" theme="dark" />
    );

    await waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          themeVariables: expect.objectContaining({
            lineColor: '#8899aa',
          }),
        })
      );
    });

    rerender(<MermaidDiagram chart="graph TD; A-->B;" theme="light" />);

    await waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          themeVariables: expect.objectContaining({
            lineColor: '#666666',
          }),
        })
      );
    });
  });

  it('sanitizes labels with hyphens and colons before rendering', async () => {
    const chart = 'flowchart TD\n    P7 --> I7[Pre-push: CHANGELOG + README mandatory]';

    render(<MermaidDiagram chart={chart} theme="dark" />);

    await waitFor(() => {
      const renderCall = vi.mocked(mermaid.render).mock.calls[0];
      expect(renderCall[1]).toContain('["Pre-push: CHANGELOG + README mandatory"]');
    });
  });

  it('does not quote labels without special characters', async () => {
    const chart = 'flowchart TD\n    A1[Single location]';

    render(<MermaidDiagram chart={chart} theme="dark" />);

    await waitFor(() => {
      const renderCall = vi.mocked(mermaid.render).mock.calls[0];
      expect(renderCall[1]).toContain('[Single location]');
      expect(renderCall[1]).not.toContain('["Single location"]');
    });
  });

  it('shows expand button after successful render', async () => {
    const { container } = render(
      <MermaidDiagram chart="graph TD; A-->B;" theme="dark" />
    );

    await waitFor(() => {
      const expandBtn = container.querySelector('.mermaid-expand-btn');
      expect(expandBtn).toBeInTheDocument();
    });
  });

  it('always uses dark node text for contrast on colored fills', async () => {
    render(
      <MermaidDiagram chart="graph TD; A-->B;" theme="dark" />
    );

    await waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          themeVariables: expect.objectContaining({
            nodeTextColor: '#1a1a1a',
          }),
        })
      );
    });
  });
});
