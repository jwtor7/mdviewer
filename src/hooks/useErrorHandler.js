import { useState } from 'react';
import { ERROR_DISPLAY_DURATION } from '../constants/index.js';

export const useErrorHandler = () => {
  const [errors, setErrors] = useState([]);

  const showError = (message, type = 'error') => {
    const id = Date.now();
    setErrors(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismissError(id), ERROR_DISPLAY_DURATION);
  };

  const dismissError = (id) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  };

  return { errors, showError, dismissError };
};
