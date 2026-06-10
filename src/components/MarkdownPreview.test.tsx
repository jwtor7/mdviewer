import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownPreview from './MarkdownPreview';

const CONTENT = '# Title\n\nFirst paragraph here.\n\nSecond paragraph here.\n';

describe('MarkdownPreview reading anchor', () => {
  it('reports the clicked block source offset via onBlockAnchor', async () => {
    const onBlockAnchor = vi.fn();
    render(
      <MarkdownPreview
        content={CONTENT}
        onContentChange={vi.fn()}
        onBlockAnchor={onBlockAnchor}
      />
    );

    const second = await screen.findByText('Second paragraph here.');
    fireEvent.click(second);

    expect(onBlockAnchor).toHaveBeenCalledWith(CONTENT.indexOf('Second paragraph here.'));
  });

  it('does not report clicks outside source-positioned blocks', async () => {
    const onBlockAnchor = vi.fn();
    const { container } = render(
      <MarkdownPreview
        content={CONTENT}
        onContentChange={vi.fn()}
        onBlockAnchor={onBlockAnchor}
      />
    );

    await screen.findByText('First paragraph here.');
    // Click the preview container itself (whitespace, no enclosing block).
    fireEvent.click(container.querySelector('.markdown-preview') as HTMLElement);

    expect(onBlockAnchor).not.toHaveBeenCalled();
  });

  it('renders without onBlockAnchor (prop optional)', async () => {
    render(<MarkdownPreview content={CONTENT} onContentChange={vi.fn()} />);
    const first = await screen.findByText('First paragraph here.');
    fireEvent.click(first); // must not throw
    expect(first).toBeInTheDocument();
  });
});
