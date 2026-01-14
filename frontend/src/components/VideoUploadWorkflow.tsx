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
import { VideoRotationModal } from './VideoRotationModal';
import { ErrorNotification } from './ErrorNotification';

interface VideoUploadWorkflowProps {
  /** Video slot identifier ('A' or 'B') */
  videoSlot: 'A' | 'B';

  /** Session ID (optional, auto-generated if not provided) */
  sessionId?: string;

  /** Callback when upload completes successfully */
  onUploadComplete: (metadata: VideoMetadata, blob: Blob) => void;
}

/**
 * Upload workflow states.
 */
type UploadState =
  | 'idle'           // No file selected
  | 'uploading'      // Upload in progress (file transfer)
  | 'analyzing'      // GOP detection in progress
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
}) => {
  const [state, setState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [analyzingProgress, setAnalyzingProgress] = useState<number>(0);
  const [framesAnalyzed, setFramesAnalyzed] = useState<number | null>(null);
  const [totalFrames, setTotalFrames] = useState<number | null>(null);
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
    setAnalyzingProgress(0);
    setFramesAnalyzed(null);
    setTotalFrames(null);
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
    setShowRotationModal(true);
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

          } else if (status.status === 'analyzing') {
            // GOP detection in progress - update analyzing state
            setState('analyzing');
            if (status.progress !== null && status.progress !== undefined) {
              setAnalyzingProgress(status.progress);
            }
            if (status.frames_analyzed !== null && status.frames_analyzed !== undefined) {
              setFramesAnalyzed(status.frames_analyzed);
            }
            if (status.total_frames !== null && status.total_frames !== undefined) {
              setTotalFrames(status.total_frames);
            }

          } else if (status.status === 'processing') {
            // Still processing - update progress and estimated time
            setState('processing');
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
   * Handle rotation confirmation from modal - triggers upload.
   */
  const handleRotationConfirm = async (rotation: RotationAngle) => {
    setShowRotationModal(false);

    if (!selectedFile) return;

    setError(null);
    setUploadProgress(0);
    setAnalyzingProgress(0);
    setFramesAnalyzed(null);
    setTotalFrames(null);
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

      // Phase 2: Poll for analyzing/processing status (starts with GOP detection)
      setState('analyzing');
      await pollProcessingStatus(metadata.video_id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  };

  /**
   * Handle rotation modal cancel.
   */
  const handleRotationCancel = () => {
    setShowRotationModal(false);
    setSelectedFile(null);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle retry after error.
   */
  const handleRetry = () => {
    setError(null);
    setState('idle');
    setSelectedFile(null);
    setUploadProgress(0);
    setAnalyzingProgress(0);
    setFramesAnalyzed(null);
    setTotalFrames(null);
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
        .video-upload-workflow {
          display: flex;
          flex-direction: column;
        }
        .upload-header {
          margin-bottom: 10px;
        }
        .upload-button-container {
          margin-bottom: 10px;
        }
        .status-box {
          min-height: 120px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background-color: #f9f9f9;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .status-box.empty {
          background-color: #fafafa;
          border-style: dashed;
        }
        .status-box.error {
          background-color: #fee;
          border-color: #c00;
        }
        .status-box.complete {
          background-color: #f0f8ff;
          border-color: #9ec9e6;
        }
      `}</style>

      {/* Upload label and button - always visible */}
      <div className="upload-header">
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          Upload Video {videoSlot} (MP4):
        </label>
      </div>

      <div className="upload-button-container">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4"
          onChange={handleFileSelect}
          aria-label={`Select video file for slot ${videoSlot}`}
          style={{ padding: '10px', fontSize: '14px', width: '100%' }}
          data-testid={`file-input-${videoSlot.toLowerCase()}`}
        />
      </div>

      {/* Fixed-height status box */}
      <div
        className={`status-box ${
          state === 'idle' ? 'empty' :
          state === 'error' ? 'error' :
          state === 'complete' ? 'complete' : ''
        }`}
      >
        {/* Idle state - empty */}
        {state === 'idle' && (
          <p style={{ color: '#999', textAlign: 'center', margin: 0 }}>
            No video uploaded
          </p>
        )}

        {/* Upload progress */}
        {state === 'uploading' && (
          <>
            <p style={{ margin: '0 0 10px 0' }}>
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
            <progress value={uploadProgress} max={1.0} style={{ width: '100%' }} />
            {uploadProgress >= 1.0 && (
              <p style={{ fontSize: '0.85em', color: '#666', margin: '5px 0 0 0' }}>
                Extracting codec, framerate, and duration...
              </p>
            )}
            {selectedFile && (
              <p style={{ fontSize: '0.85em', color: '#666', margin: '5px 0 0 0' }}>
                {selectedFile.name}
              </p>
            )}
          </>
        )}

        {/* Analyzing progress (GOP detection) */}
        {state === 'analyzing' && (
          <>
            <p style={{ margin: '0 0 10px 0' }}>
              🔍 Analyzing video structure: {Math.round(analyzingProgress * 100)}%
            </p>
            {framesAnalyzed !== null && totalFrames !== null && (
              <p style={{ fontSize: '0.85em', color: '#666', margin: '0 0 10px 0' }}>
                Frames analyzed: {framesAnalyzed.toLocaleString()} / {totalFrames.toLocaleString()}
              </p>
            )}
            <progress value={analyzingProgress} max={1.0} style={{ width: '100%' }} />
            {selectedFile && (
              <p style={{ fontSize: '0.85em', color: '#666', margin: '5px 0 0 0' }}>
                {selectedFile.name}
              </p>
            )}
          </>
        )}

        {/* Processing progress (optimization) */}
        {state === 'processing' && (
          <>
            <p style={{ margin: '0 0 10px 0' }}>
              ⚙️ Optimizing video: {Math.round(processingProgress * 100)}%
            </p>
            {estimatedTimeSeconds && (
              <p style={{ fontSize: '0.85em', color: '#666', margin: '0 0 10px 0' }}>
                Estimated time: ~{Math.round(estimatedTimeSeconds)}s
              </p>
            )}
            <progress value={processingProgress} max={1.0} style={{ width: '100%' }} />
            {selectedFile && (
              <p style={{ fontSize: '0.85em', color: '#666', margin: '5px 0 0 0' }}>
                {selectedFile.name}
              </p>
            )}
          </>
        )}

        {/* Fetching progress */}
        {state === 'fetching' && (
          <>
            <p style={{ margin: '0 0 10px 0' }}>Fetching video...</p>
            {selectedFile && (
              <p style={{ fontSize: '0.85em', color: '#666', margin: '0' }}>
                {selectedFile.name}
              </p>
            )}
          </>
        )}

        {/* Error state */}
        {state === 'error' && error && (
          <ErrorNotification
            error={error}
            onRetry={handleRetry}
            onDismiss={handleRetry}
          />
        )}

        {/* Complete state - show metadata */}
        {state === 'complete' && uploadedMetadata && (
          <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>
            <div style={{ marginBottom: '5px' }}>
              <strong>✓ {uploadedMetadata.filename}</strong>
            </div>
            <div style={{ color: '#555' }}>
              Codec: {uploadedMetadata.codec}
            </div>
            <div style={{ color: '#555' }}>
              Resolution: {uploadedMetadata.width}×{uploadedMetadata.height}
            </div>
            <div style={{ color: '#555' }}>
              Duration: {uploadedMetadata.duration.toFixed(1)}s
            </div>
            <div style={{ color: '#555' }}>
              Framerate: {uploadedMetadata.framerate.toFixed(2)} fps
            </div>
          </div>
        )}
      </div>

      {/* Rotation modal overlay */}
      {showRotationModal && selectedFile && (
        <VideoRotationModal
          videoFile={selectedFile}
          onConfirm={handleRotationConfirm}
          onCancel={handleRotationCancel}
        />
      )}
    </div>
  );
};
