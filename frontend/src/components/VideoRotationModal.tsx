/**
 * Video rotation modal overlay component.
 *
 * Displays rotation controls in a modal overlay that dims the background.
 * User can preview rotation and confirm upload or cancel.
 *
 * Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)
 * Phase: Phase 1 Task 1.3.2 (Upload Workflow UX Improvements)
 */

import React, { useState, useEffect } from 'react';
import { VideoRotationControls } from './VideoRotationControls';
import type { RotationAngle } from '../types/rotation';

interface VideoRotationModalProps {
  /** Video file to preview and rotate */
  videoFile: File;

  /** Callback when user confirms upload with selected rotation */
  onConfirm: (rotation: RotationAngle) => void;

  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Modal overlay for video rotation preview and confirmation.
 */
export const VideoRotationModal: React.FC<VideoRotationModalProps> = ({
  videoFile,
  onConfirm,
  onCancel,
}) => {
  const [rotation, setRotation] = useState<RotationAngle>(0);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="video-rotation-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel} // Click backdrop to close
      data-testid="rotation-modal-backdrop"
    >
      <div
        className="video-rotation-modal-content"
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
        data-testid="rotation-modal-content"
      >
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
          Select Video Rotation
        </h3>

        <VideoRotationControls
          videoFile={videoFile}
          rotation={rotation}
          onRotationChange={setRotation}
        />

        <div
          className="modal-actions"
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            marginTop: '30px',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            data-testid="rotation-cancel-button"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(rotation)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
            }}
            data-testid="rotation-confirm-button"
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
};
