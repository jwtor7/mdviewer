import { useState, useEffect, useRef } from 'react';
import { ERROR_DISPLAY_DURATION } from '../constants/index.js';

export const useErrorHandler = () => {
  const [errors, setErrors] = useState([]);
  const timeoutIdsRef = useRef(new Map());

  const showError = (message, type = 'error') => {
    const id = Date.now();
    setErrors(prev => [...prev, { id, message, type }]);
    const timeoutId = setTimeout(() => dismissError(id), ERROR_DISPLAY_DURATION);
    timeoutIdsRef.current.set(id, timeoutId);
  };

  const dismissError = (id) => {
    // Clear the timeout if it exists
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setErrors(prev => prev.filter(e => e.id !== id));
  };

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutIdsRef.current.clear();
    };
  }, []);

  return { errors, showError, dismissError };
};
