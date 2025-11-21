import React from 'react';
import { ErrorItem } from '../types/error';

export interface ErrorNotificationProps {
  errors: ErrorItem[];
  onDismiss: (id: number) => void;
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ errors, onDismiss }) => {
  if (errors.length === 0) return null;

  return (
    <div className="error-container">
      {errors.map(error => (
        <div key={error.id} className={`error-notification ${error.type}`}>
          <span className="error-message">{error.message}</span>
          <button
            className="error-dismiss"
            onClick={() => onDismiss(error.id)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ErrorNotification;
