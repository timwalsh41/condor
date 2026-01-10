/**
 * Video upload workflow component with rotation controls and progress tracking.
 *
 * Validates:
 *   - REQ-F-UPLOAD-001: Local file upload with validation
 *   - REQ-F-UPLOAD-004: Video rotation during upload
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import React, { useState, useRef } from 'react';
import { uploadVideo, getUploadStatus, fetchVideoBlob } from '../services/api';
import type { VideoMetadata } from '../types/api';
import type { RotationAngle } from '../types/rotation';
import { VideoRotationControls } from './VideoRotationControls';
import { UploadProgressIndicator } from './UploadProgressIndicator';
import { ErrorNotification } from './ErrorNotification';

interface VideoUploadWorkflowProps {
  /** Video slot identifier ('A' or 'B') */
  videoSlot: 'A' | 'B';

  /** Session ID (optional, auto-generated if not provided) */
  sessionId?: string;

  /** Callback when upload completes successfully */
  onUploadComplete: (metadata: VideoMetadata, blob: Blob) => void;

  /** Callback when upload is cancelled */
  onCancel?: () => void;
}

/**
 * Upload workflow states.
 */
type UploadState =
  | 'idle'           // No file selected
  | 'file-selected'  // File selected, awaiting rotation confirmation
  | 'uploading'      // Upload in progress (file transfer)
  | 'processing'     // Video processing (optimization)
  | 'fetching'       // Fetching video blob from backend
  | 'complete'       // Upload complete
  | 'error';         // Error occurred

const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Video upload workflow with file selection, rotation preview, and progress tracking.
 */
export const VideoUploadWorkflow: React.FC<VideoUploadWorkflowProps> = ({
  videoSlot,
  sessionId,
  onUploadComplete,
  onCancel,
}) => {
  const [state, setState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<RotationAngle>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [estimatedTimeSeconds, setEstimatedTimeSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedMetadata, setUploadedMetadata] = useState<VideoMetadata | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  /**
   * Handle file selection with validation.
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setError(null);
    setUploadProgress(0);
    setProcessingProgress(0);
    setEstimatedTimeSeconds(null);

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE_MB}MB. ` +
        `Selected file: ${(file.size / 1024 / 1024).toFixed(1)}MB`
      );
      setState('error');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError(`Invalid file type: ${file.type}. Please select a video file.`);
      setState('error');
      return;
    }

    setSelectedFile(file);
    setRotation(0);
    setState('file-selected');
  };

  /**
   * Handle rotation change.
   */
  const handleRotationChange = (newRotation: RotationAngle) => {
    setRotation(newRotation);
  };

  /**
   * Poll processing status until complete or error.
   */
  const pollProcessingStatus = async (videoId: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const pollInterval = 500; // 500ms polling interval
      const maxPollAttempts = 600; // 5 minutes max (600 * 500ms)
      let attempts = 0;

      const poll = async () => {
        try {
          const status = await getUploadStatus(videoId);

          if (status.status === 'complete' && status.metadata) {
            // Processing complete - stop polling
            if (pollingIntervalRef.current !== null) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            setUploadedMetadata(status.metadata);
            setProcessingProgress(1.0);
            setState('fetching');

            // Fetch video blob from backend
            const blob = await fetchVideoBlob(status.metadata.session_id, status.metadata.video_id);
            setState('complete');
            onUploadComplete(status.metadata, blob);
            resolve(); // Polling complete

          } else if (status.status === 'error') {
            // Processing failed - stop polling
            if (pollingIntervalRef.current !== null) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            setError(status.error_message || 'Video processing failed');
            setState('error');
            reject(new Error(status.error_message || 'Video processing failed'));

          } else if (status.status === 'processing') {
            // Still processing - update progress and estimated time
            if (status.progress !== null && status.progress !== undefined) {
              setProcessingProgress(status.progress);
            }
            if (status.estimated_duration_seconds) {
              setEstimatedTimeSeconds(status.estimated_duration_seconds);
            }
          }

          attempts++;
          if (attempts >= maxPollAttempts) {
            // Timeout - stop polling
            if (pollingIntervalRef.current !== null) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            setError('Processing timeout - took too long');
            setState('error');
            reject(new Error('Processing timeout - took too long'));
          }
        } catch (err) {
          // Polling error - stop polling
          if (pollingIntervalRef.current !== null) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          const errorMessage = err instanceof Error ? err.message : 'Failed to poll processing status';
          setError(errorMessage);
          setState('error');
          reject(err);
        }
      };

      // Start polling
      pollingIntervalRef.current = window.setInterval(poll, pollInterval);
      poll(); // Initial poll (don't await here, let interval continue)
    });
  };

  /**
   * Handle upload confirmation with two-phase progress tracking.
   */
  const handleUpload = async () => {
    if (!selectedFile) return;

    setError(null);
    setUploadProgress(0);
    setProcessingProgress(0);
    setEstimatedTimeSeconds(null);

    try {
      // Phase 1: Upload file with progress tracking
      setState('uploading');

      const metadata = await uploadVideo(
        selectedFile,
        sessionId,
        rotation,
        (progress) => setUploadProgress(progress)
      );

      // Phase 2: Poll for processing status
      setState('processing');
      await pollProcessingStatus(metadata.video_id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  };

  /**
   * Handle cancel.
   */
  const handleCancel = () => {
    // Stop polling if active
    if (pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Reset state
    setSelectedFile(null);
    setRotation(0);
    setUploadProgress(0);
    setProcessingProgress(0);
    setEstimatedTimeSeconds(null);
    setError(null);
    setState('idle');

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    onCancel?.();
  };

  /**
   * Handle retry after error.
   */
  const handleRetry = () => {
    setError(null);
    setState('idle');
    setSelectedFile(null);
    setRotation(0);
    setUploadProgress(0);
    setProcessingProgress(0);
    setEstimatedTimeSeconds(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="video-upload-workflow">
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <h3>Upload Video {videoSlot}</h3>

      {/* File selection */}
      {state === 'idle' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            onChange={handleFileSelect}
            aria-label={`Select video file for slot ${videoSlot}`}
          />
          <p className="help-text">
            Max file size: {MAX_FILE_SIZE_MB}MB. MP4 format with H.264 or H.265/HEVC codec.
          </p>
        </div>
      )}

      {/* Rotation controls */}
      {state === 'file-selected' && selectedFile && (
        <div>
          <VideoRotationControls
            videoFile={selectedFile}
            rotation={rotation}
            onRotationChange={handleRotationChange}
          />
          <div className="workflow-actions">
            <button onClick={handleUpload}>Upload</button>
            <button onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {state === 'uploading' && (
        <div className="progress-container">
          <p>
            {uploadProgress < 1.0 ? '📤 Uploading file: ' : '🔍 Analyzing video metadata... '}
            {Math.round(uploadProgress * 100)}%
            {uploadProgress >= 1.0 && (
              <span className="spinner" style={{
                display: 'inline-block',
                marginLeft: '10px',
                width: '16px',
                height: '16px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                verticalAlign: 'middle'
              }}></span>
            )}
          </p>
          <progress value={uploadProgress} max={1.0} />
          {uploadProgress >= 1.0 && (
            <p style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
              Extracting codec, framerate, and duration (typically 1-5 seconds)
            </p>
          )}
          <p className="filename">{selectedFile?.name}</p>
        </div>
      )}

      {/* Processing progress */}
      {state === 'processing' && (
        <div className="progress-container">
          <p>Processing video: {Math.round(processingProgress * 100)}%</p>
          {estimatedTimeSeconds && (
            <p className="estimated-time">
              Estimated time: ~{Math.round(estimatedTimeSeconds)}s
            </p>
          )}
          <progress value={processingProgress} max={1.0} />
          <p className="filename">{selectedFile?.name}</p>
        </div>
      )}

      {/* Fetching progress */}
      {state === 'fetching' && (
        <div className="progress-container">
          <p>Fetching video...</p>
          <p className="filename">{selectedFile?.name}</p>
        </div>
      )}

      {/* Error notification */}
      {state === 'error' && error && (
        <ErrorNotification
          error={error}
          onRetry={handleRetry}
          onDismiss={handleCancel}
        />
      )}

      {/* Complete notification */}
      {state === 'complete' && uploadedMetadata && (
        <div className="upload-complete">
          <p>✓ Video uploaded successfully</p>
          <p className="metadata">
            {uploadedMetadata.filename} ({uploadedMetadata.width}×{uploadedMetadata.height},
            {uploadedMetadata.framerate.toFixed(2)}fps, {uploadedMetadata.duration.toFixed(1)}s)
          </p>
        </div>
      )}
    </div>
  );
};
