import { useEffect } from 'react';

export interface UseKeyboardShortcutsProps {
  onBold: () => void;
  onItalic: () => void;
  onToggleView: () => void;
  onToggleTheme: () => void;
  onSave?: () => void;
  onFind?: () => void;
}

export const useKeyboardShortcuts = ({
  onBold,
  onItalic,
  onToggleView,
  onToggleTheme,
  onSave,
  onFind,
}: UseKeyboardShortcutsProps): void => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
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
      // Cmd/Ctrl + S: Save
      if (isMod && e.key === 's' && onSave) {
        e.preventDefault();
        onSave();
      }
      // Cmd/Ctrl + F: Find
      if (isMod && e.key === 'f' && onFind) {
        e.preventDefault();
        onFind();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBold, onItalic, onToggleView, onToggleTheme, onSave, onFind]);
};
