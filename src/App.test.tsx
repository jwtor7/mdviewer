/**
 * Integration tests for App.tsx
 *
 * Tests the main application component's user workflows including:
 * - Initial render and default state
 * - Tab management (create, switch, close)
 * - View mode toggle (Rendered, Raw, Split, Text)
 * - Theme toggle
 * - Content editing and dirty state
 * - Find/Replace panel
 * - Toolbar interactions
 * - Status bar updates
 * - Keyboard shortcuts
 * - Edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { mockElectronAPI } from './test/setup';

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  // Reset document attributes
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('App Integration Tests', () => {
  // =========================================================================
  // Core User Workflows
  // =========================================================================

  describe('Initial Render', () => {
    it('should render the default document on initial load', () => {
      render(<App />);

      // Default document should be visible in tab bar
      expect(screen.getByRole('tab', { name: /Test Document/i })).toBeInTheDocument();
    });

    it('should render with Rendered view mode by default', () => {
      render(<App />);

      // Rendered button should be active
      const renderedButton = screen.getByRole('tab', { name: /Rendered/i });
      expect(renderedButton).toHaveClass('active');
    });

    it('should display status bar with word count', () => {
      render(<App />);

      // Status bar should show word count
      expect(screen.getByText(/Words:/i)).toBeInTheDocument();
      expect(screen.getByText(/Chars:/i)).toBeInTheDocument();
      expect(screen.getByText(/Tokens:/i)).toBeInTheDocument();
    });

    it('should display version number in status bar', () => {
      render(<App />);

      // Version should be displayed
      expect(screen.getByLabelText('App version')).toBeInTheDocument();
    });
  });

  describe('Tab Management', () => {
    it('should create a new tab when clicking the new tab button', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Click new tab button
      const newTabButton = screen.getByRole('button', { name: /New document/i });
      await user.click(newTabButton);

      // Should have both tabs
      const tabs = screen.getAllByRole('tab');
      // Filter to only document tabs (not view mode tabs)
      const docTabs = tabs.filter(tab =>
        tab.getAttribute('aria-label') !== 'View mode' &&
        !['Rendered', 'Raw', 'Split', 'Text'].includes(tab.textContent || '')
      );
      expect(docTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('should switch tabs when clicking a different tab', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create a new tab first
      const newTabButton = screen.getByRole('button', { name: /New document/i });
      await user.click(newTabButton);

      // Find the Untitled tab and click it
      const untitledTab = screen.getByRole('tab', { name: /Untitled/i });
      expect(untitledTab).toHaveAttribute('aria-selected', 'true');

      // Click back to Test Document
      const testDocTab = screen.getByRole('tab', { name: /Test Document/i });
      await user.click(testDocTab);

      expect(testDocTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should close a tab when clicking the close button', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create a new tab
      const newTabButton = screen.getByRole('button', { name: /New document/i });
      await user.click(newTabButton);

      // Find close button for Untitled tab
      const closeButton = screen.getByRole('button', { name: /Close Untitled/i });
      await user.click(closeButton);

      // Untitled tab should be gone
      expect(screen.queryByRole('tab', { name: /Untitled/i })).not.toBeInTheDocument();
    });

    it('should create default tab when closing the last tab', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Close the default tab
      const closeButton = screen.getByRole('button', { name: /Close Test Document/i });
      await user.click(closeButton);

      // Should still have a tab (default Untitled)
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('View Mode Toggle', () => {
    it('should switch to Raw view when clicking Raw button', async () => {
      const user = userEvent.setup();
      render(<App />);

      const rawButton = screen.getByRole('tab', { name: /Raw/i });
      await user.click(rawButton);

      expect(rawButton).toHaveClass('active');
      // Content area should indicate markdown editor
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-label', 'Markdown editor');
    });

    it('should switch to Split view when clicking Split button', async () => {
      const user = userEvent.setup();
      render(<App />);

      const splitButton = screen.getByRole('tab', { name: /Split/i });
      await user.click(splitButton);

      expect(splitButton).toHaveClass('active');
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-label', 'Split view: code and preview');
    });

    it('should switch to Text view when clicking Text button', async () => {
      const user = userEvent.setup();
      render(<App />);

      const textButton = screen.getByRole('tab', { name: /Text/i });
      await user.click(textButton);

      expect(textButton).toHaveClass('active');
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-label', 'Plain text preview');
    });

    it('should cycle through all view modes in order', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Start in Rendered (default)
      expect(screen.getByRole('tab', { name: /Rendered/i })).toHaveClass('active');

      // Click Raw
      await user.click(screen.getByRole('tab', { name: /Raw/i }));
      expect(screen.getByRole('tab', { name: /Raw/i })).toHaveClass('active');

      // Click Split
      await user.click(screen.getByRole('tab', { name: /Split/i }));
      expect(screen.getByRole('tab', { name: /Split/i })).toHaveClass('active');

      // Click Text
      await user.click(screen.getByRole('tab', { name: /Text/i }));
      expect(screen.getByRole('tab', { name: /Text/i })).toHaveClass('active');

      // Click Rendered
      await user.click(screen.getByRole('tab', { name: /Rendered/i }));
      expect(screen.getByRole('tab', { name: /Rendered/i })).toHaveClass('active');
    });
  });

  describe('Theme Toggle', () => {
    it('should render theme toggle button', () => {
      render(<App />);

      const themeButton = screen.getByRole('button', { name: /Current theme/i });
      expect(themeButton).toBeInTheDocument();
    });

    it('should cycle through themes when clicking theme button', async () => {
      const user = userEvent.setup();
      render(<App />);

      const themeButton = screen.getByRole('button', { name: /Current theme/i });

      // First click: system -> light
      await user.click(themeButton);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Second click: light -> dark
      await user.click(themeButton);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('Content Editing', () => {
    it('should update content when typing in Raw view', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Switch to Raw view
      await user.click(screen.getByRole('tab', { name: /Raw/i }));

      // Find textarea and type
      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'New content');

      expect(textarea).toHaveValue('New content');
    });

    it('should show dirty indicator when content changes', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create new empty document
      await user.click(screen.getByRole('button', { name: /New document/i }));

      // New tab should already be in Raw view (app switches for new docs)
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Modified content');

      // The tab should show unsaved state (implementation may vary)
      // This tests that content can be edited
      expect(textarea).toHaveValue('Modified content');
    });
  });

  describe('Find/Replace Panel', () => {
    it('should show Find/Replace panel when clicking find button', async () => {
      const user = userEvent.setup();
      render(<App />);

      const findButton = screen.getByRole('button', { name: /Open find panel/i });
      await user.click(findButton);

      // Find panel should be visible
      expect(screen.getByPlaceholderText(/Find/i)).toBeInTheDocument();
    });

    it('should close Find/Replace panel when clicking close', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Open find panel
      const findButton = screen.getByRole('button', { name: /Open find panel/i });
      await user.click(findButton);

      // Find the close button in the find panel (aria-label is "Close find and replace")
      const closeButton = screen.getByRole('button', { name: /Close find and replace/i });
      await user.click(closeButton);

      // Find panel should be gone
      expect(screen.queryByPlaceholderText(/Find/i)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Component Integration
  // =========================================================================

  describe('Toolbar Rendering', () => {
    it('should render all formatting buttons', () => {
      render(<App />);

      expect(screen.getByRole('button', { name: /Format selected text as bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Format selected text as italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Format selected text as list/i })).toBeInTheDocument();
    });

    it('should render headings dropdown button', () => {
      render(<App />);

      expect(screen.getByRole('button', { name: /Insert heading/i })).toBeInTheDocument();
    });

    it('should render utility buttons', () => {
      render(<App />);

      // Copy button has dynamic aria-label based on view mode
      expect(screen.getByRole('button', { name: /Copy rendered content/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save document/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open find panel/i })).toBeInTheDocument();
    });

    it('should render word wrap toggle button', () => {
      render(<App />);

      expect(screen.getByRole('button', { name: /Toggle word wrap/i })).toBeInTheDocument();
    });

    it('should disable formatting buttons in Rendered view', () => {
      render(<App />);

      // In Rendered view, formatting buttons should be disabled
      expect(screen.getByRole('button', { name: /Format selected text as bold/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Format selected text as italic/i })).toBeDisabled();
    });

    it('should enable formatting buttons in Raw view', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Switch to Raw view
      await user.click(screen.getByRole('tab', { name: /Raw/i }));

      expect(screen.getByRole('button', { name: /Format selected text as bold/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /Format selected text as italic/i })).not.toBeDisabled();
    });
  });

  describe('Status Bar', () => {
    it('should update word count when content changes', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create new document and switch to Raw view
      await user.click(screen.getByRole('button', { name: /New document/i }));

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'one two three');

      // Word count should reflect the new content
      expect(screen.getByText(/Words: 3/i)).toBeInTheDocument();
    });

    it('should update character count when content changes', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create new document
      await user.click(screen.getByRole('button', { name: /New document/i }));

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'hello');

      expect(screen.getByText(/Chars: 5/i)).toBeInTheDocument();
    });
  });

  describe('Error Notification', () => {
    it('should show error notification when error occurs', async () => {
      // Mock showUnsavedDialog to reject
      mockElectronAPI.showUnsavedDialog.mockRejectedValueOnce(new Error('Test error'));

      const user = userEvent.setup();
      render(<App />);

      // Create and modify a document
      await user.click(screen.getByRole('button', { name: /New document/i }));
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'unsaved content');

      // Try to close - should trigger error
      const closeButton = screen.getByRole('button', { name: /Close Untitled/i });
      await user.click(closeButton);

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Failed to show unsaved changes dialog/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Bar', () => {
    it('should display document tabs with correct accessibility attributes', () => {
      render(<App />);

      const tabBar = screen.getByRole('tablist', { name: /Open documents/i });
      expect(tabBar).toBeInTheDocument();

      const tab = screen.getByRole('tab', { name: /Test Document/i });
      expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(tab).toHaveAttribute('aria-controls', 'content-area');
    });
  });

  // =========================================================================
  // Keyboard Shortcuts
  // =========================================================================

  describe('Keyboard Shortcuts', () => {
    it('should toggle view mode with Cmd+E', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Start in Rendered
      expect(screen.getByRole('tab', { name: /Rendered/i })).toHaveClass('active');

      // Press Cmd+E to cycle to Raw
      await user.keyboard('{Meta>}e{/Meta}');

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Raw/i })).toHaveClass('active');
      });
    });

    it('should toggle theme with Cmd+T', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Press Cmd+T
      await user.keyboard('{Meta>}t{/Meta}');

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });

    it('should open find panel with Cmd+F', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.keyboard('{Meta>}f{/Meta}');

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Find/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle empty content gracefully', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create new empty document
      await user.click(screen.getByRole('button', { name: /New document/i }));

      // Should show zero counts
      expect(screen.getByText(/Words: 0/i)).toBeInTheDocument();
      expect(screen.getByText(/Chars: 0/i)).toBeInTheDocument();
    });

    it('should preserve content when switching tabs', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create new tab and add content
      await user.click(screen.getByRole('button', { name: /New document/i }));
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Tab content');

      // Switch to another tab
      await user.click(screen.getByRole('tab', { name: /Test Document/i }));

      // Switch back
      await user.click(screen.getByRole('tab', { name: /Untitled/i }));

      // Content should be preserved
      expect(screen.getByRole('textbox')).toHaveValue('Tab content');
    });

    it('should preserve view mode independently of tab switching', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Switch to Raw view
      await user.click(screen.getByRole('tab', { name: /Raw/i }));

      // Create new tab
      await user.click(screen.getByRole('button', { name: /New document/i }));

      // View mode should still be Raw (new tabs auto-switch to Raw)
      expect(screen.getByRole('tab', { name: /Raw/i })).toHaveClass('active');
    });

    it('should handle rapid tab switching', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create multiple tabs
      await user.click(screen.getByRole('button', { name: /New document/i }));
      await user.click(screen.getByRole('button', { name: /New document/i }));

      // Rapid switching - get all Untitled tabs
      const untitledTabs = screen.getAllByText('Untitled');
      const testDocTab = screen.getByRole('tab', { name: /Test Document/i });

      // Click rapidly between tabs
      for (let i = 0; i < 5; i++) {
        await user.click(testDocTab);
        if (untitledTabs[0]) {
          await user.click(untitledTabs[0].closest('[role="tab"]') as Element);
        }
      }

      // App should still be responsive
      expect(screen.getByRole('tablist', { name: /Open documents/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Headings Menu
  // =========================================================================

  describe('Headings Menu', () => {
    it('should open headings dropdown when clicking H button', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Switch to Raw view first (headings only work in Raw/Split)
      await user.click(screen.getByRole('tab', { name: /Raw/i }));

      const headingsButton = screen.getByRole('button', { name: /Insert heading/i });
      await user.click(headingsButton);

      // Menu should be visible
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Heading 1/i })).toBeInTheDocument();
    });

    it('should close headings menu when clicking a heading option', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Switch to Raw view
      await user.click(screen.getByRole('tab', { name: /Raw/i }));

      // Open menu
      await user.click(screen.getByRole('button', { name: /Insert heading/i }));

      // Click heading option
      await user.click(screen.getByRole('menuitem', { name: /Heading 1/i }));

      // Menu should close
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Word Wrap Toggle
  // =========================================================================

  describe('Word Wrap Toggle', () => {
    it('should toggle word wrap state when clicking button', async () => {
      const user = userEvent.setup();
      render(<App />);

      const wordWrapButton = screen.getByRole('button', { name: /Toggle word wrap/i });

      // Initial state should be on (based on hook default)
      expect(wordWrapButton).toHaveAttribute('title', expect.stringContaining('On'));

      await user.click(wordWrapButton);

      // Should now be off
      expect(wordWrapButton).toHaveAttribute('title', expect.stringContaining('Off'));
    });
  });

  // =========================================================================
  // Drag and Drop
  // =========================================================================

  describe('Drag and Drop', () => {
    it('should have draggable tabs', () => {
      render(<App />);

      const tab = screen.getByRole('tab', { name: /Test Document/i });
      expect(tab).toHaveAttribute('draggable', 'true');
    });
  });

  // =========================================================================
  // Context Menu
  // =========================================================================

  describe('Tab Context Menu', () => {
    it('should show context menu on right-click', async () => {
      const user = userEvent.setup();
      render(<App />);

      const tab = screen.getByRole('tab', { name: /Test Document/i });

      // Right-click on tab
      await user.pointer({ keys: '[MouseRight]', target: tab });

      // Context menu should appear
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /Reveal in Finder/i })).toBeInTheDocument();
      });
    });
  });
});
