import { useEffect, useRef, useCallback } from 'react';

/**
 * Frame metadata from requestVideoFrameCallback
 * Reference: https://wicg.github.io/video-rvfc/
 */
export interface VideoFrameMetadata {
  presentationTime: number;
  expectedDisplayTime: number;
  width: number;
  height: number;
  mediaTime: number; // CRITICAL: Use this for frame calculations, NOT presentationTime
  presentedFrames: number;
  processingDuration?: number;
}

/**
 * Callback function signature for frame updates
 */
export type FrameCallback = (
  currentTime: number,
  metadata: VideoFrameMetadata
) => void;

/**
 * Custom hook for frame-accurate video control using requestVideoFrameCallback
 *
 * CRITICAL IMPLEMENTATION NOTES (from PRP):
 * - Use metadata.mediaTime (NOT metadata.presentationTime) for frame calculations
 * - Frame number = Math.round(metadata.mediaTime * framerate)
 * - Safari requires currentTime change to trigger callback even if same value
 * - Must cancel callback on unmount to prevent memory leaks
 *
 * @param videoRef - Reference to the HTML video element
 * @param callback - Function to call on each video frame
 * @param framerate - Video framerate (fps) for frame number calculation
 * @returns Object with requestFrame function to manually trigger frame callback
 */
export function useFrameCallback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  callback: FrameCallback,
  _framerate: number = 30
) {
  const callbackIdRef = useRef<number | null>(null);
  const callbackRef = useRef<FrameCallback>(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  /**
   * Internal handler for requestVideoFrameCallback
   */
  const handleFrame = useCallback(
    (_now: number, metadata: VideoFrameMetadata) => {
      const video = videoRef.current;
      if (!video) return;

      // CRITICAL: Use metadata.mediaTime for accurate frame positioning
      callbackRef.current(video.currentTime, metadata);

      // Re-register callback for next frame if video is playing
      if (!video.paused && !video.ended) {
        callbackIdRef.current = video.requestVideoFrameCallback(handleFrame);
      }
    },
    [videoRef]
  );

  /**
   * Start frame callbacks (call when video plays)
   */
  const startFrameCallback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cancel existing callback if any
    if (callbackIdRef.current !== null) {
      video.cancelVideoFrameCallback(callbackIdRef.current);
    }

    // Register new callback
    callbackIdRef.current = video.requestVideoFrameCallback(handleFrame);
  }, [videoRef, handleFrame]);

  /**
   * Stop frame callbacks (call when video pauses)
   */
  const stopFrameCallback = useCallback(() => {
    const video = videoRef.current;
    if (!video || callbackIdRef.current === null) return;

    video.cancelVideoFrameCallback(callbackIdRef.current);
    callbackIdRef.current = null;
  }, [videoRef]);

  /**
   * Request a single frame callback (useful for seeking/stepping)
   */
  const requestFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cancel existing callback
    if (callbackIdRef.current !== null) {
      video.cancelVideoFrameCallback(callbackIdRef.current);
      callbackIdRef.current = null;
    }

    // Request single frame
    callbackIdRef.current = video.requestVideoFrameCallback((_now, metadata) => {
      callbackRef.current(video.currentTime, metadata);
      callbackIdRef.current = null; // Clear after single execution
    });
  }, [videoRef]);

  // Cleanup on unmount - CRITICAL to prevent memory leaks
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video && callbackIdRef.current !== null) {
        video.cancelVideoFrameCallback(callbackIdRef.current);
      }
    };
  }, [videoRef]);

  return {
    startFrameCallback,
    stopFrameCallback,
    requestFrame,
  };
}

/**
 * Calculate frame number from mediaTime and framerate
 *
 * @param mediaTime - From VideoFrameMetadata.mediaTime
 * @param framerate - Video framerate (fps)
 * @returns Frame number (0-indexed)
 */
export function calculateFrameNumber(mediaTime: number, framerate: number): number {
  // CRITICAL: Use Math.round for proper frame number calculation
  return Math.round(mediaTime * framerate);
}
