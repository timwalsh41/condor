/**
 * Video rotation controls with canvas thumbnail preview.
 *
 * Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import React, { useEffect, useRef, useState } from "react";
import type { RotationAngle } from "../types/rotation";
import { MP4Parser } from "../utils/MP4Parser";
import { isCodecSupported } from "../utils/featureDetection";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [codecWarning, setCodecWarning] = useState<string | null>(null);

  // Setup video source and check codec support
  useEffect(() => {
    let objectUrl: string | null = null;
    let computedSrc: string | null = null;

    const setupVideo = async () => {
      try {
        // Create Object URL for preview
        computedSrc = URL.createObjectURL(videoFile);
        objectUrl = computedSrc;
        setVideoSrc(computedSrc);

        // Check codec support for warning message
        const metadata = await MP4Parser.readPartialMetadata(videoFile);
        if (metadata) {
          const supported = await isCodecSupported(metadata.codec);
          if (!supported) {
            setCodecWarning(
              `Preview unavailable - ${metadata.codec} codec not supported by browser. ` +
                `You can still select rotation and upload. Video will be transcoded to H.264.`,
            );
          }
        }
      } catch (err) {
        console.warn("Failed to check codec support:", err);
      }
    };

    setupVideo();

    // Cleanup
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setVideoSrc(null);
    };
  }, [videoFile]);

  /**
   * Handle rotation button click.
   */
  const handleRotationClick = (newRotation: RotationAngle) => {
    onRotationChange(newRotation);
  };

  /**
   * Handle video load error
   */
  const handleVideoError = () => {
    // If codec check didn't catch it, this is the fallback
    if (!codecWarning) {
       setCodecWarning("Video format not supported by browser for preview. You can still upload.");
    }
  };

  return (
    <div className="video-rotation-controls">
      <h4>Rotation Preview</h4>

      {/* Video preview with rotation */}
      <div className="preview-container">
        {codecWarning && (
          <div
            className="codec-warning"
            style={{
              padding: "15px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: "4px",
              color: "#856404",
              marginBottom: "10px"
            }}
            data-testid="codec-warning"
          >
            <p style={{ margin: 0, fontWeight: "bold" }}>
              ⚠️ Preview Warning
            </p>
            <p style={{ margin: "10px 0 0 0", fontSize: "14px" }}>
              {codecWarning}
            </p>
          </div>
        )}
        
        {videoSrc && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '200px',
            backgroundColor: '#000',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <video
              ref={videoRef}
              src={videoSrc}
              className="rotation-preview"
              muted
              playsInline
              controls={false}
              disablePictureInPicture
              onError={handleVideoError}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: "transform 0.3s ease",
                maxWidth: "640px",
                maxHeight: "480px",
                width: "auto",
                height: "auto",
                display: "block"
              }}
              aria-label="Video rotation preview"
            />
          </div>
        )}
      </div>

      {/* Rotation buttons */}
      <div className="rotation-buttons">
        <button
          onClick={() => handleRotationClick(0)}
          className={rotation === 0 ? "active" : ""}
          aria-label="No rotation (0 degrees)"
        >
          0°
        </button>
        <button
          onClick={() => handleRotationClick(90)}
          className={rotation === 90 ? "active" : ""}
          aria-label="Rotate 90 degrees"
        >
          90°
        </button>
        <button
          onClick={() => handleRotationClick(180)}
          className={rotation === 180 ? "active" : ""}
          aria-label="Rotate 180 degrees"
        >
          180°
        </button>
        <button
          onClick={() => handleRotationClick(270)}
          className={rotation === 270 ? "active" : ""}
          aria-label="Rotate 270 degrees"
        >
          270°
        </button>
      </div>

      <p className="rotation-info">Current rotation: {rotation}°</p>
    </div>
  );
};
