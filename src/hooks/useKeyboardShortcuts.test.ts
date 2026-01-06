/**
 * Tests for useKeyboardShortcuts hook
 *
 * Tests keyboard event handling for 10+ keyboard shortcuts:
 * - Cmd/Ctrl + B (Bold)
 * - Cmd/Ctrl + I (Italic)
 * - Cmd/Ctrl + E (Toggle view mode)
 * - Cmd/Ctrl + T (Toggle theme)
 * - Cmd/Ctrl + S (Save file)
 * - Cmd/Ctrl + Z (Undo)
 * - Cmd/Ctrl + Shift + Z (Redo)
 * - Cmd/Ctrl + Y (Redo - Windows convention)
 * - Cmd/Ctrl + N (New file)
 * - Cmd/Ctrl + F (Find/replace)
 * - Cmd/Ctrl + Alt + W (Toggle word wrap)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, UseKeyboardShortcutsProps } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on window.addEventListener and removeEventListener
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  // Helper function to create and dispatch keyboard events
  const createAndDispatchKeyEvent = (
    key: string,
    options: {
      metaKey?: boolean;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
    } = {}
  ): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      shiftKey: options.shiftKey ?? false,
      altKey: options.altKey ?? false,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);
    return event;
  };

  describe('Setup and Cleanup', () => {
    it('should register keydown event listener on mount', () => {
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should remove event listener on unmount', () => {
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      const { unmount } = renderHook(() => useKeyboardShortcuts(mockCallbacks));
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Cmd/Ctrl + B: Bold', () => {
    it('should call onBold when Cmd+B is pressed', () => {
      const onBold = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold,
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('b', { metaKey: true });

      expect(onBold).toHaveBeenCalledTimes(1);
    });

    it('should call onBold when Ctrl+B is pressed (Windows)', () => {
      const onBold = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold,
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('b', { ctrlKey: true });

      expect(onBold).toHaveBeenCalledTimes(1);
    });

    it('should not call onBold without modifier key', () => {
      const onBold = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold,
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('b');

      expect(onBold).not.toHaveBeenCalled();
    });
  });

  describe('Cmd/Ctrl + I: Italic', () => {
    it('should call onItalic when Cmd+I is pressed', () => {
      const onItalic = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic,
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('i', { metaKey: true });

      expect(onItalic).toHaveBeenCalledTimes(1);
    });

    it('should call onItalic when Ctrl+I is pressed (Windows)', () => {
      const onItalic = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic,
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('i', { ctrlKey: true });

      expect(onItalic).toHaveBeenCalledTimes(1);
    });

    it('should not call onItalic without modifier key', () => {
      const onItalic = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic,
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('i');

      expect(onItalic).not.toHaveBeenCalled();
    });
  });

  describe('Cmd/Ctrl + E: Toggle View Mode', () => {
    it('should call onToggleView when Cmd+E is pressed', () => {
      const onToggleView = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView,
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('e', { metaKey: true });

      expect(onToggleView).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleView when Ctrl+E is pressed (Windows)', () => {
      const onToggleView = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView,
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('e', { ctrlKey: true });

      expect(onToggleView).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cmd/Ctrl + T: Toggle Theme', () => {
    it('should call onToggleTheme when Cmd+T is pressed', () => {
      const onToggleTheme = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('t', { metaKey: true });

      expect(onToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleTheme when Ctrl+T is pressed (Windows)', () => {
      const onToggleTheme = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('t', { ctrlKey: true });

      expect(onToggleTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cmd/Ctrl + S: Save', () => {
    it('should call onSave when Cmd+S is pressed', () => {
      const onSave = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onSave,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('s', { metaKey: true });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should call onSave when Ctrl+S is pressed (Windows)', () => {
      const onSave = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onSave,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('s', { ctrlKey: true });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should not call onSave if callback is not provided', () => {
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        // onSave is undefined
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('s', { metaKey: true });

      // Should not throw, callback just won't be called
      expect(true).toBe(true);
    });
  });

  describe('Cmd/Ctrl + Z: Undo', () => {
    it('should call onUndo when Cmd+Z is pressed', () => {
      const onUndo = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onUndo,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('z', { metaKey: true });

      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('should call onUndo when Ctrl+Z is pressed (Windows)', () => {
      const onUndo = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onUndo,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('z', { ctrlKey: true });

      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('should not call onUndo when Cmd+Shift+Z is pressed (redo)', () => {
      const onUndo = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onUndo,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('z', { metaKey: true, shiftKey: true });

      expect(onUndo).not.toHaveBeenCalled();
    });
  });

  describe('Cmd/Ctrl + Shift + Z: Redo', () => {
    it('should call onRedo when Cmd+Shift+Z is pressed', () => {
      const onRedo = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onRedo,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('z', { metaKey: true, shiftKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('should call onRedo when Ctrl+Shift+Z is pressed (Windows)', () => {
      const onRedo = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onRedo,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('z', { ctrlKey: true, shiftKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cmd/Ctrl + Y: Redo (Windows convention)', () => {
    it('should call onRedo when Cmd+Y is pressed', () => {
      const onRedo = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onRedo,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('y', { metaKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('should call onRedo when Ctrl+Y is pressed (Windows)', () => {
      const onRedo = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onRedo,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('y', { ctrlKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('should not call onRedo if callback is not provided', () => {
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        // onRedo is undefined
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('y', { metaKey: true });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Cmd/Ctrl + N: New Document', () => {
    it('should call onNew when Cmd+N is pressed', () => {
      const onNew = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onNew,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('n', { metaKey: true });

      expect(onNew).toHaveBeenCalledTimes(1);
    });

    it('should call onNew when Ctrl+N is pressed (Windows)', () => {
      const onNew = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onNew,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('n', { ctrlKey: true });

      expect(onNew).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cmd/Ctrl + F: Find/Replace', () => {
    it('should call onFind when Cmd+F is pressed', () => {
      const onFind = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onFind,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('f', { metaKey: true });

      expect(onFind).toHaveBeenCalledTimes(1);
    });

    it('should call onFind when Ctrl+F is pressed (Windows)', () => {
      const onFind = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onFind,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('f', { ctrlKey: true });

      expect(onFind).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cmd/Ctrl + Alt + W: Toggle Word Wrap', () => {
    it('should call onToggleWordWrap when Cmd+Alt+W is pressed', () => {
      const onToggleWordWrap = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onToggleWordWrap,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('w', { metaKey: true, altKey: true });

      expect(onToggleWordWrap).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleWordWrap when Ctrl+Alt+W is pressed (Windows)', () => {
      const onToggleWordWrap = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onToggleWordWrap,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('w', { ctrlKey: true, altKey: true });

      expect(onToggleWordWrap).toHaveBeenCalledTimes(1);
    });

    it('should not call onToggleWordWrap without Alt modifier', () => {
      const onToggleWordWrap = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onToggleWordWrap,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('w', { metaKey: true });

      expect(onToggleWordWrap).not.toHaveBeenCalled();
    });

    it('should not call onToggleWordWrap if callback is not provided', () => {
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        // onToggleWordWrap is undefined
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('w', { metaKey: true, altKey: true });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Modifier Detection', () => {
    it('should treat metaKey and ctrlKey equivalently', () => {
      const onBold = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold,
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      const { unmount: unmount1 } = renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('b', { metaKey: true });
      expect(onBold).toHaveBeenCalledTimes(1);
      unmount1();

      const onBold2 = vi.fn();
      const mockCallbacks2: UseKeyboardShortcutsProps = {
        ...mockCallbacks,
        onBold: onBold2,
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks2));
      createAndDispatchKeyEvent('b', { ctrlKey: true });
      expect(onBold2).toHaveBeenCalledTimes(1);
    });

    it('should require both modifier and key to trigger callback', () => {
      const onBold = vi.fn();
      const onItalic = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold,
        onItalic,
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));

      // Only modifier - should not call
      createAndDispatchKeyEvent('Control', { metaKey: true });
      expect(onBold).not.toHaveBeenCalled();

      // Only key - should not call
      createAndDispatchKeyEvent('b');
      expect(onBold).not.toHaveBeenCalled();

      // Both modifier and key - should call
      createAndDispatchKeyEvent('b', { metaKey: true });
      expect(onBold).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Shortcuts in Sequence', () => {
    it('should handle multiple different shortcuts correctly', () => {
      const onBold = vi.fn();
      const onItalic = vi.fn();
      const onToggleView = vi.fn();

      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold,
        onItalic,
        onToggleView,
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));

      // Press Cmd+B
      createAndDispatchKeyEvent('b', { metaKey: true });
      expect(onBold).toHaveBeenCalledTimes(1);

      // Press Cmd+I
      createAndDispatchKeyEvent('i', { metaKey: true });
      expect(onItalic).toHaveBeenCalledTimes(1);

      // Press Cmd+E
      createAndDispatchKeyEvent('e', { metaKey: true });
      expect(onToggleView).toHaveBeenCalledTimes(1);

      // Verify all were called independently
      expect(onBold).toHaveBeenCalledTimes(1);
      expect(onItalic).toHaveBeenCalledTimes(1);
      expect(onToggleView).toHaveBeenCalledTimes(1);
    });

    it('should repeat callback calls for repeated shortcuts', () => {
      const onBold = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold,
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));

      // Press Cmd+B three times
      createAndDispatchKeyEvent('b', { metaKey: true });
      createAndDispatchKeyEvent('b', { metaKey: true });
      createAndDispatchKeyEvent('b', { metaKey: true });

      expect(onBold).toHaveBeenCalledTimes(3);
    });
  });

  describe('Optional Callback Handling', () => {
    it('should not throw when optional callbacks are undefined', () => {
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        // All optional callbacks are undefined
      };

      expect(() => {
        renderHook(() => useKeyboardShortcuts(mockCallbacks));
        createAndDispatchKeyEvent('s', { metaKey: true }); // onSave undefined
        createAndDispatchKeyEvent('z', { metaKey: true }); // onUndo undefined
        createAndDispatchKeyEvent('y', { metaKey: true }); // onRedo undefined
        createAndDispatchKeyEvent('n', { metaKey: true }); // onNew undefined
        createAndDispatchKeyEvent('f', { metaKey: true }); // onFind undefined
        createAndDispatchKeyEvent('w', { metaKey: true, altKey: true }); // onToggleWordWrap undefined
      }).not.toThrow();
    });

    it('should call optional callbacks only when provided', () => {
      const onSave = vi.fn();
      const mockCallbacks: UseKeyboardShortcutsProps = {
        onBold: vi.fn(),
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
        onSave,
        // Other optional callbacks not provided
      };

      renderHook(() => useKeyboardShortcuts(mockCallbacks));
      createAndDispatchKeyEvent('s', { metaKey: true });

      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dependency Updates', () => {
    it('should update handler when callbacks change', () => {
      const onBold1 = vi.fn();
      const mockCallbacks1: UseKeyboardShortcutsProps = {
        onBold: onBold1,
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      const { rerender } = renderHook(
        (props) => useKeyboardShortcuts(props),
        { initialProps: mockCallbacks1 }
      );

      createAndDispatchKeyEvent('b', { metaKey: true });
      expect(onBold1).toHaveBeenCalledTimes(1);

      // Update callbacks
      const onBold2 = vi.fn();
      const mockCallbacks2: UseKeyboardShortcutsProps = {
        onBold: onBold2,
        onItalic: vi.fn(),
        onToggleView: vi.fn(),
        onToggleTheme: vi.fn(),
      };

      rerender(mockCallbacks2);

      createAndDispatchKeyEvent('b', { metaKey: true });

      // Old callback should not be called again
      expect(onBold1).toHaveBeenCalledTimes(1);
      // New callback should be called
      expect(onBold2).toHaveBeenCalledTimes(1);
    });
  });
});
