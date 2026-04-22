import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_DISPLAY_DURATION } from '../constants/index.js';
import type { ErrorItem } from '../types/error.js';

export interface UseErrorHandlerReturn {
  errors: ErrorItem[];
  showError: (message: string, type?: string) => void;
  dismissError: (id: number) => void;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const timeoutIdsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissError = useCallback((id: number): void => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const showError = useCallback((message: string, type: string = 'error'): void => {
    const id = Date.now();
    setErrors(prev => [...prev, { id, message, type }]);
    const timeoutId = setTimeout(() => dismissError(id), ERROR_DISPLAY_DURATION);
    timeoutIdsRef.current.set(id, timeoutId);
  }, [dismissError]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutIdsRef.current.clear();
    };
  }, []);

  return { errors, showError, dismissError };
};
