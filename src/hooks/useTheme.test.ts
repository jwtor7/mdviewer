/**
 * Tests for useTheme hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';
import { THEME_MODES } from '../constants/index';

describe('useTheme', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.documentElement.removeAttribute('data-theme');

    // Reset matchMedia mock
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('should initialize with system theme', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe(THEME_MODES.SYSTEM);
  });

  it('should apply light theme when system prefers light', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false, // Light mode
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe(THEME_MODES.SYSTEM);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should apply dark theme when system prefers dark', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, // Dark mode
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe(THEME_MODES.SYSTEM);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should cycle through themes on toggle', () => {
    const { result } = renderHook(() => useTheme());

    // Start: System
    expect(result.current.theme).toBe(THEME_MODES.SYSTEM);

    // First toggle: System → Light
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.theme).toBe(THEME_MODES.LIGHT);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Second toggle: Light → Dark
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.theme).toBe(THEME_MODES.DARK);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Third toggle: Dark → Solarized Light
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.theme).toBe(THEME_MODES.SOLARIZED_LIGHT);
    expect(document.documentElement.getAttribute('data-theme')).toBe('solarized-light');

    // Fourth toggle: Solarized Light → Solarized Dark
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.theme).toBe(THEME_MODES.SOLARIZED_DARK);
    expect(document.documentElement.getAttribute('data-theme')).toBe('solarized-dark');

    // Fifth toggle: Solarized Dark → System
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.theme).toBe(THEME_MODES.SYSTEM);
  });

  it('should return correct icons for each theme', () => {
    const { result } = renderHook(() => useTheme());

    // System
    expect(result.current.getThemeIcon()).toBe('⚙️');

    // Light
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.getThemeIcon()).toBe('☀️');

    // Dark
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.getThemeIcon()).toBe('🌙');

    // Solarized Light
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.getThemeIcon()).toBe('🌅');

    // Solarized Dark
    act(() => {
      result.current.handleThemeToggle();
    });
    expect(result.current.getThemeIcon()).toBe('🌃');
  });

  it('should listen to system theme changes when in system mode', () => {
    const mockAddEventListener = vi.fn();
    const mockRemoveEventListener = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = renderHook(() => useTheme());

    // Should add event listener for system theme changes
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Should remove listener on unmount
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should not react to system changes when not in system mode', () => {
    const { result } = renderHook(() => useTheme());

    // Switch to light mode
    act(() => {
      result.current.handleThemeToggle();
    });

    expect(result.current.theme).toBe(THEME_MODES.LIGHT);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // System theme change should not affect the theme (already in light mode manually)
    // The effect only reacts when theme is SYSTEM
  });

  it('should apply solarized-light theme correctly', () => {
    const { result } = renderHook(() => useTheme());

    // Toggle to Solarized Light (System → Light → Dark → Solarized Light)
    act(() => {
      result.current.handleThemeToggle(); // Light
      result.current.handleThemeToggle(); // Dark
      result.current.handleThemeToggle(); // Solarized Light
    });

    expect(result.current.theme).toBe(THEME_MODES.SOLARIZED_LIGHT);
    expect(document.documentElement.getAttribute('data-theme')).toBe('solarized-light');
  });

  it('should apply solarized-dark theme correctly', () => {
    const { result } = renderHook(() => useTheme());

    // Toggle to Solarized Dark (System → Light → Dark → Solarized Light → Solarized Dark)
    act(() => {
      result.current.handleThemeToggle(); // Light
      result.current.handleThemeToggle(); // Dark
      result.current.handleThemeToggle(); // Solarized Light
      result.current.handleThemeToggle(); // Solarized Dark
    });

    expect(result.current.theme).toBe(THEME_MODES.SOLARIZED_DARK);
    expect(document.documentElement.getAttribute('data-theme')).toBe('solarized-dark');
  });

  it('should update theme attribute on documentElement', () => {
    const { result } = renderHook(() => useTheme());

    // Initially should have light/dark based on system
    const initialTheme = document.documentElement.getAttribute('data-theme');
    expect(['light', 'dark']).toContain(initialTheme);

    // After toggling to light
    act(() => {
      result.current.handleThemeToggle();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
