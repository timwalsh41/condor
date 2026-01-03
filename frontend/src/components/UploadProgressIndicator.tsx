/**
 * Upload progress indicator with polling status display.
 *
 * Validates: REQ-F-UPLOAD-001 (Upload progress feedback)
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import React from 'react';

interface UploadProgressIndicatorProps {
  /** Upload progress (0.0 - 1.0) */
  progress: number;

  /** Current upload state */
  state: 'uploading' | 'polling' | 'fetching';

  /** Filename being uploaded */
  filename: string;
}

/**
 * Upload progress indicator with status messages.
 */
export const UploadProgressIndicator: React.FC<UploadProgressIndicatorProps> = ({
  progress,
  state,
  filename,
}) => {
  /**
   * Get status message based on state.
   */
  const getStatusMessage = (): string => {
    switch (state) {
      case 'uploading':
        return 'Uploading video...';
      case 'polling':
        return 'Processing video...';
      case 'fetching':
        return 'Fetching optimized video...';
      default:
        return 'Processing...';
    }
  };

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="upload-progress-indicator" aria-live="polite" aria-atomic="true">
      <p className="status-message">{getStatusMessage()}</p>
      <p className="filename">{filename}</p>

      {/* Progress bar */}
      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <p className="progress-percent">{progressPercent}%</p>
    </div>
  );
};
