import { useState, useRef, useEffect } from 'react';
import {
  useFrameCallback,
  calculateFrameNumber,
  type VideoFrameMetadata,
} from '../hooks/useFrameCallback';
import './FrameStepper.css';

interface FrameStepperProps {
  videoSrc: string;
  framerate?: number;
}

/**
 * FrameStepper component for spike validation of frame-accurate video control
 *
 * Implements:
 * - REQ-F-FRAME-001: Frame stepping (coarse: ~5 frames, fine: 1 frame)
 * - REQ-F-FRAME-002: Frame counter display
 * - REQ-F-FRAME-003: Seeking precision (within 1 frame)
 *
 * CRITICAL IMPLEMENTATION NOTES (from PRP):
 * - Force frame rendering: currentTime += 0.001; currentTime -= 0.001 (Safari requirement)
 * - Safari requires currentTime change to trigger callback even for same value
 * - Frame stepping: increment/decrement currentTime until next/prev frame detected
 */
export function FrameStepper({ videoSrc, framerate = 30 }: FrameStepperProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Frame callback handler
   * CRITICAL: Use metadata.mediaTime for frame calculation
   */
  const handleFrameUpdate = (_currentTime: number, metadata: VideoFrameMetadata) => {
    const frameNum = calculateFrameNumber(metadata.mediaTime, framerate);
    setCurrentFrame(frameNum);
  };

  const { startFrameCallback, stopFrameCallback, requestFrame } = useFrameCallback(
    videoRef,
    handleFrameUpdate,
    framerate
  );

  /**
   * Initialize total frames when video metadata loads
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const duration = video.duration;
      const frames = Math.floor(duration * framerate);
      setTotalFrames(frames);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [framerate]);

  /**
   * Handle play/pause events
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      startFrameCallback();
    };

    const handlePause = () => {
      setIsPlaying(false);
      stopFrameCallback();
      // Request single frame to update display
      requestFrame();
    };

    const handleSeeked = () => {
      // Only force frame rendering if video is paused (not needed during playback)
      if (video.paused) {
        video.currentTime += 0.001;
        video.currentTime -= 0.001;
      }
      // Request frame callback to update display
      requestFrame();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [startFrameCallback, stopFrameCallback, requestFrame]);

  /**
   * Toggle play/pause
   */
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  /**
   * Step to a specific target frame with iterative retry for 1-frame accuracy
   * CRITICAL: Implements "increment/decrement until target detected" pattern from PRP
   * This achieves 1-frame accuracy regardless of keyframe distribution in source video
   *
   * @param targetFrame - The exact frame to seek to
   */
  const stepToFrame = (targetFrame: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();

    // Bounds check
    const clampedTarget = Math.max(0, Math.min(totalFrames, targetFrame));

    let attempts = 0;
    const MAX_ATTEMPTS = 10; // Safety limit to prevent infinite loops

    const handleSeeked = () => {
      video.removeEventListener('seeked', handleSeeked);

      if (attempts++ >= MAX_ATTEMPTS) {
        console.warn(`Max seek attempts (${MAX_ATTEMPTS}) reached, accepting closest frame`);
        // Force frame rendering so callback fires
        video.currentTime += 0.001;
        video.currentTime -= 0.001;
        // Accept whatever frame we're at
        video.requestVideoFrameCallback((_now, metadata) => {
          setCurrentFrame(calculateFrameNumber(metadata.mediaTime, framerate));
        });
        return;
      }

      // Force frame rendering (required for paused video to trigger callback)
      video.currentTime += 0.001;
      video.currentTime -= 0.001;

      // Request frame callback to see what we got
      video.requestVideoFrameCallback((_now, metadata) => {
        const actualFrame = calculateFrameNumber(metadata.mediaTime, framerate);

        if (actualFrame === clampedTarget) {
          // Success! Update state
          setCurrentFrame(actualFrame);
        } else {
          // Calculate delta and adjust position
          const frameDelta = clampedTarget - actualFrame;
          video.currentTime += (frameDelta / framerate);
          // Re-register handler for next seek (don't reset position!)
          video.addEventListener('seeked', handleSeeked, { once: true });
        }
      });
    };

    // Initial seek to target
    video.addEventListener('seeked', handleSeeked, { once: true });
    video.currentTime = clampedTarget / framerate;
  };

  /**
   * Step forward by one frame
   */
  const stepForwardFine = () => stepToFrame(currentFrame + 1);

  /**
   * Step backward by one frame
   */
  const stepBackwardFine = () => stepToFrame(currentFrame - 1);

  /**
   * Step forward by ~5 frames (coarse stepping)
   */
  const stepForwardCoarse = () => stepToFrame(currentFrame + 5);

  /**
   * Step backward by ~5 frames (coarse stepping)
   */
  const stepBackwardCoarse = () => stepToFrame(currentFrame - 5);

  return (
    <div className="frame-stepper">
      <div className="video-container">
        <video
          ref={videoRef}
          src={videoSrc}
          data-testid="video-element"
          crossOrigin="anonymous"
        />
      </div>

      <div className="controls">
        <div className="frame-counter" data-testid="frame-counter">
          Frame {currentFrame} of {totalFrames}
        </div>

        <div className="control-buttons">
          <button
            onClick={stepBackwardCoarse}
            data-testid="step-backward-coarse"
            title="Step backward ~5 frames"
          >
            ⏪ -5
          </button>

          <button
            onClick={stepBackwardFine}
            data-testid="step-backward-fine"
            title="Step backward 1 frame"
          >
            ⬅️ -1
          </button>

          <button
            onClick={togglePlayPause}
            data-testid="play-pause"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>

          <button
            onClick={stepForwardFine}
            data-testid="step-forward-fine"
            title="Step forward 1 frame"
          >
            +1 ➡️
          </button>

          <button
            onClick={stepForwardCoarse}
            data-testid="step-forward-coarse"
            title="Step forward ~5 frames"
          >
            +5 ⏩
          </button>
        </div>
      </div>
    </div>
  );
}
