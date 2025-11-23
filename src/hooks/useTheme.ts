import { useState, useEffect } from 'react';
import { THEME_MODES, type ThemeMode } from '../constants/index.js';

export interface UseThemeReturn {
  theme: ThemeMode;
  handleThemeToggle: () => void;
  getThemeIcon: () => string;
}

export const useTheme = (): UseThemeReturn => {
  const [theme, setTheme] = useState<ThemeMode>(THEME_MODES.SYSTEM);

  useEffect(() => {
    const applyTheme = (newTheme: ThemeMode): void => {
      const root = document.documentElement;

      if (newTheme === THEME_MODES.SOLARIZED_LIGHT) {
        root.setAttribute('data-theme', 'solarized-light');
      } else if (newTheme === THEME_MODES.SOLARIZED_DARK) {
        root.setAttribute('data-theme', 'solarized-dark');
      } else {
        const isDark = newTheme === THEME_MODES.DARK ||
          (newTheme === THEME_MODES.SYSTEM && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      }
    };

    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => {
      if (theme === THEME_MODES.SYSTEM) {
        applyTheme(THEME_MODES.SYSTEM);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const handleThemeToggle = (): void => {
    setTheme(prev => {
      if (prev === THEME_MODES.SYSTEM) return THEME_MODES.LIGHT;
      if (prev === THEME_MODES.LIGHT) return THEME_MODES.DARK;
      if (prev === THEME_MODES.DARK) return THEME_MODES.SOLARIZED_LIGHT;
      if (prev === THEME_MODES.SOLARIZED_LIGHT) return THEME_MODES.SOLARIZED_DARK;
      return THEME_MODES.SYSTEM;
    });
  };

  const getThemeIcon = (): string => {
    if (theme === THEME_MODES.SYSTEM) return '⚙️';
    if (theme === THEME_MODES.LIGHT) return '☀️';
    if (theme === THEME_MODES.DARK) return '🌙';
    if (theme === THEME_MODES.SOLARIZED_LIGHT) return '🌅';
    if (theme === THEME_MODES.SOLARIZED_DARK) return '🌃';
    return '⚙️';
  };

  return {
    theme,
    handleThemeToggle,
    getThemeIcon,
  };
};
