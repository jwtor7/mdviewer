import React from 'react';
import PropTypes from 'prop-types';

const ErrorNotification = ({ errors, onDismiss }) => {
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

ErrorNotification.propTypes = {
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
    })
  ).isRequired,
  onDismiss: PropTypes.func.isRequired,
};

export default ErrorNotification;
