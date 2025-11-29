import { useEffect } from 'react';

export interface UseKeyboardShortcutsProps {
  onBold: () => void;
  onItalic: () => void;
  onToggleView: () => void;
  onToggleTheme: () => void;
  onToggleWordWrap?: () => void;
  onSave?: () => void;
  onFind?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onNew?: () => void;
}

export const useKeyboardShortcuts = ({
  onBold,
  onItalic,
  onToggleView,
  onToggleTheme,
  onToggleWordWrap,
  onSave,
  onFind,
  onUndo,
  onRedo,
  onNew,
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
      // Cmd/Ctrl + Alt + W: Toggle word wrap
      if (isMod && e.altKey && e.key === 'w' && onToggleWordWrap) {
        e.preventDefault();
        onToggleWordWrap();
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
      // Cmd/Ctrl + Z: Undo
      if (isMod && e.key === 'z' && !e.shiftKey && onUndo) {
        e.preventDefault();
        onUndo();
      }
      // Cmd/Ctrl + Shift + Z: Redo
      if (isMod && e.key === 'z' && e.shiftKey && onRedo) {
        e.preventDefault();
        onRedo();
      }
      // Cmd/Ctrl + Y: Redo (Windows convention)
      if (isMod && e.key === 'y' && onRedo) {
        e.preventDefault();
        onRedo();
      }
      // Cmd/Ctrl + N: New document
      if (isMod && e.key === 'n' && onNew) {
        e.preventDefault();
        onNew();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBold, onItalic, onToggleView, onToggleTheme, onToggleWordWrap, onSave, onFind, onUndo, onRedo, onNew]);
};
