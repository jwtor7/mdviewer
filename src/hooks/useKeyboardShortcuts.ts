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
  onReadAloud?: () => void;
  onStopReading?: () => void;
  onNextSentence?: () => void;
  onPrevSentence?: () => void;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  onReadFromCursor?: () => void;
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
  onReadAloud,
  onStopReading,
  onNextSentence,
  onPrevSentence,
  onNextChapter,
  onPrevChapter,
  onReadFromCursor,
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
      // Cmd/Ctrl + Shift + R: Read aloud (but NOT when Alt is held — that's Read from cursor)
      if (isMod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r' && onReadAloud) {
        e.preventDefault();
        onReadAloud();
      }
      // Cmd/Ctrl + Shift + .: Stop reading (macOS cancel convention)
      if (isMod && e.shiftKey && e.key === '.' && onStopReading) {
        e.preventDefault();
        onStopReading();
      }
      // Cmd/Ctrl + Shift + ArrowRight: Next sentence
      if (isMod && e.shiftKey && e.key === 'ArrowRight' && onNextSentence) {
        e.preventDefault();
        onNextSentence();
      }
      // Cmd/Ctrl + Shift + ArrowLeft: Previous sentence
      if (isMod && e.shiftKey && e.key === 'ArrowLeft' && onPrevSentence) {
        e.preventDefault();
        onPrevSentence();
      }
      // Cmd/Ctrl + Shift + ]: Next chapter
      if (isMod && e.shiftKey && e.key === ']' && onNextChapter) {
        e.preventDefault();
        onNextChapter();
      }
      // Cmd/Ctrl + Shift + [: Previous chapter
      if (isMod && e.shiftKey && e.key === '[' && onPrevChapter) {
        e.preventDefault();
        onPrevChapter();
      }
      // Cmd/Ctrl + Alt + Shift + R: Read from cursor
      if (isMod && e.altKey && e.shiftKey && e.key.toLowerCase() === 'r' && onReadFromCursor) {
        e.preventDefault();
        onReadFromCursor();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBold, onItalic, onToggleView, onToggleTheme, onToggleWordWrap, onSave, onFind, onUndo, onRedo, onNew, onReadAloud, onStopReading, onNextSentence, onPrevSentence, onNextChapter, onPrevChapter, onReadFromCursor]);
};
