/**
 * Video rotation controls with canvas thumbnail preview.
 *
 * Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import React, { useEffect, useRef, useState } from 'react';
import type { RotationAngle } from '../types/rotation';

interface VideoRotationControlsProps {
  /** Video file to extract first frame from */
  videoFile: File;

  /** Current rotation angle (0°, 90°, 180°, or 270°) */
  rotation: RotationAngle;

  /** Callback when rotation changes */
  onRotationChange: (rotation: RotationAngle) => void;
}

/**
 * Rotation controls with first-frame preview.
 */
export const VideoRotationControls: React.FC<VideoRotationControlsProps> = ({
  videoFile,
  rotation,
  onRotationChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [isLoadingFrame, setIsLoadingFrame] = useState(true);
  const [frameError, setFrameError] = useState<string | null>(null);

  /**
   * Extract and render first frame to canvas.
   */
  useEffect(() => {
    const extractFirstFrame = async () => {
      setIsLoadingFrame(true);
      setFrameError(null);

      try {
        // Create video element
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;

        // Create object URL for video file
        const videoUrl = URL.createObjectURL(videoFile);
        video.src = videoUrl;

        // Wait for metadata to load
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Failed to load video metadata'));
        });

        // Seek to first frame
        video.currentTime = 0;

        // Wait for seeked event
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error('Failed to seek to first frame'));
        });

        // Draw first frame to canvas
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error('Canvas ref not available');
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get 2d context');
        }

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Store video element ref for cleanup
        videoElementRef.current = video;

        setIsLoadingFrame(false);

        // Clean up object URL
        URL.revokeObjectURL(videoUrl);

      } catch (err) {
        setFrameError(err instanceof Error ? err.message : 'Failed to extract first frame');
        setIsLoadingFrame(false);
      }
    };

    extractFirstFrame();

    // Cleanup
    return () => {
      if (videoElementRef.current) {
        const video = videoElementRef.current;
        if (video.src) {
          URL.revokeObjectURL(video.src);
        }
        videoElementRef.current = null;
      }
    };
  }, [videoFile]);

  /**
   * Handle rotation button click.
   */
  const handleRotationClick = (newRotation: RotationAngle) => {
    onRotationChange(newRotation);
  };

  return (
    <div className="video-rotation-controls">
      <h4>Rotation Preview</h4>

      {/* Canvas preview with rotation */}
      <div className="preview-container">
        {isLoadingFrame && <p>Loading preview...</p>}
        {frameError && <p className="error">Error: {frameError}</p>}
        <canvas
          ref={canvasRef}
          className="rotation-preview"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.3s ease',
            display: isLoadingFrame || frameError ? 'none' : 'block',
            maxWidth: '640px',
            maxHeight: '480px',
            width: 'auto',
            height: 'auto',
          }}
          aria-label="Video rotation preview"
        />
      </div>

      {/* Rotation buttons */}
      <div className="rotation-buttons">
        <button
          onClick={() => handleRotationClick(0)}
          className={rotation === 0 ? 'active' : ''}
          aria-label="No rotation (0 degrees)"
        >
          0°
        </button>
        <button
          onClick={() => handleRotationClick(90)}
          className={rotation === 90 ? 'active' : ''}
          aria-label="Rotate 90 degrees"
        >
          90°
        </button>
        <button
          onClick={() => handleRotationClick(180)}
          className={rotation === 180 ? 'active' : ''}
          aria-label="Rotate 180 degrees"
        >
          180°
        </button>
        <button
          onClick={() => handleRotationClick(270)}
          className={rotation === 270 ? 'active' : ''}
          aria-label="Rotate 270 degrees"
        >
          270°
        </button>
      </div>

      <p className="rotation-info">Current rotation: {rotation}°</p>
    </div>
  );
};
