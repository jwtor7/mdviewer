import { useEffect } from 'react';

export const useKeyboardShortcuts = ({
  onBold,
  onItalic,
  onToggleView,
  onToggleTheme,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + B: Bold
      if (isMod && e.key === 'b') {
        e.preventDefault();
        onBold();
      }
      // Cmd/Ctrl + I: Italic
      if (isMod && e.key === 'i') {
        e.preventDefault();
        onItalic();
      }
      // Cmd/Ctrl + E: Toggle view mode
      if (isMod && e.key === 'e') {
        e.preventDefault();
        onToggleView();
      }
      // Cmd/Ctrl + T: Toggle theme
      if (isMod && e.key === 't') {
        e.preventDefault();
        onToggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBold, onItalic, onToggleView, onToggleTheme]);
};
