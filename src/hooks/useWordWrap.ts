import { useState, useEffect } from 'react';

export interface UseWordWrapReturn {
  wordWrap: boolean;
  toggleWordWrap: () => void;
}

const STORAGE_KEY = 'mdviewer-word-wrap';

export const useWordWrap = (): UseWordWrapReturn => {
  const [wordWrap, setWordWrap] = useState<boolean>(() => {
    // Load from localStorage on initial mount
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : true; // Default to true (wrapped)
  });

  // Persist to localStorage whenever wordWrap changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wordWrap));
  }, [wordWrap]);

  const toggleWordWrap = (): void => {
    setWordWrap(prev => !prev);
  };

  return {
    wordWrap,
    toggleWordWrap,
  };
};
