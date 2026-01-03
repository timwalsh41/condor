/**
 * Error notification component with retry and dismiss actions.
 *
 * Validates: REQ-F-ERROR-001 (User-facing error messages)
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import React from 'react';

interface ErrorNotificationProps {
  /** Error message to display */
  error: string;

  /** Callback when retry is clicked */
  onRetry?: () => void;

  /** Callback when dismiss is clicked */
  onDismiss?: () => void;
}

/**
 * Error notification with user-friendly message and actions.
 */
export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  onRetry,
  onDismiss,
}) => {
  return (
    <div className="error-notification" role="alert" aria-live="assertive">
      <div className="error-header">
        <span className="error-icon">⚠</span>
        <h4>Upload Error</h4>
      </div>

      <p className="error-message">{error}</p>

      <div className="error-actions">
        {onRetry && (
          <button onClick={onRetry} className="retry-button">
            Retry
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="dismiss-button">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
