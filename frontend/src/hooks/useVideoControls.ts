/**
 * Custom hook for video playback control operations.
 *
 * Extracts play/pause, step, scrub, speed, and seek logic from the
 * DualVideoSynchronizer monolith into a reusable, testable hook.
 *
 * Each instance is tied to a single video decoder via a ref. The hook
 * manages internal slider state and uses refs throughout to avoid stale
 * closure bugs that plagued the original handler functions.
 *
 * @module useVideoControls
 */

import { useRef, useState, useCallback } from "react";
import type { UseWebCodecsDecoderResult } from "./useWebCodecsDecoder";

/**
 * Return type of the useVideoControls hook.
 *
 * All handlers are memoized with useCallback to provide stable
 * references across re-renders, enabling React.memo optimization
 * in consuming components.
 */
export interface VideoControlsHandle {
  /** Current slider value (responsive UI position, not yet committed) */
  sliderValue: number;
  /** Toggle play/pause state */
  playPause: () => void;
  /** Step forward by 1 frame, or 5 when coarse=true */
  stepForward: (coarse: boolean) => Promise<void>;
  /** Step backward by 1 frame, or 5 when coarse=true */
  stepBackward: (coarse: boolean) => Promise<void>;
  /** Update slider position without seeking (responsive UI only) */
  onSliderChange: (value: number) => void;
  /** Commit slider position — pause and seek to slider value */
  onSliderRelease: () => Promise<void>;
  /** Change playback rate */
  onSpeedChange: (rate: number) => void;
  /** Pause playback and seek to a specific frame */
  seekToFrame: (frame: number) => Promise<void>;
}

/**
 * Custom hook for video playback control operations.
 *
 * Encapsulates all handler logic for a single video decoder:
 * play/pause, frame stepping, scrubbing, speed changes, and seeking.
 *
 * The hook uses refs to access the latest decoder state on every
 * handler invocation, avoiding the stale closure bugs that occurred
 * when handlers captured decoder values at render time.
 *
 * @example
 * ```tsx
 * const videoRef = useRef<UseWebCodecsDecoderResult>(videoA);
 * const controls = useVideoControls(videoRef);
 *
 * return (
 *   <>
 *     <button onClick={controls.playPause}>Play/Pause</button>
 *     <input
 *       type="range"
 *       value={controls.sliderValue}
 *       onChange={(e) => controls.onSliderChange(Number(e.target.value))}
 *       onMouseUp={controls.onSliderRelease}
 *     />
 *   </>
 * );
 * ```
 *
 * @param videoRef - Ref to the video decoder result (UseWebCodecsDecoderResult)
 * @returns VideoControlsHandle with all playback control methods
 */
export function useVideoControls(
  videoRef: React.RefObject<UseWebCodecsDecoderResult>
): VideoControlsHandle {
  // Internal slider state for responsive UI updates during drag
  const [sliderValue, setSliderValue] = useState<number>(0);

  // Refs to always access the latest decoder state
  const videoRefSafe = useRef(videoRef.current);

  // Update the safe ref whenever the incoming ref changes
  if (videoRef.current !== videoRefSafe.current) {
    videoRefSafe.current = videoRef.current;
  }

  /**
   * Toggle play/pause state.
   *
   * Reads current isPlaying from the decoder via ref to avoid stale closures.
   * Pauses if currently playing, plays if paused.
   */
  const playPause = useCallback(() => {
    const video = videoRefSafe.current;
    if (!video) return;

    if (video.isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, []);

  /**
   * Step forward by 1 frame, or 5 frames when coarse=true.
   *
   * Always pauses playback before seeking to prevent race conditions.
   * Respects frame boundaries (0 to totalFrames-1).
   *
   * @param coarse - If true, step 5 frames; if false, step 1 frame.
   */
  const stepForward = useCallback(
    async (coarse: boolean) => {
      const video = videoRefSafe.current;
      if (!video) return;

      if (video.isPlaying) video.pause();

      const step = coarse ? 5 : 1;
      const targetFrame = Math.min(
        video.totalFrames - 1,
        video.currentFrame + step
      );

      await video.seekToFrame(targetFrame);
    },
    []
  );

  /**
   * Step backward by 1 frame, or 5 frames when coarse=true.
   *
   * Always pauses playback before seeking to prevent race conditions.
   * Respects frame boundaries (0 to totalFrames-1).
   *
   * @param coarse - If true, step 5 frames; if false, step 1 frame.
   */
  const stepBackward = useCallback(
    async (coarse: boolean) => {
      const video = videoRefSafe.current;
      if (!video) return;

      if (video.isPlaying) video.pause();

      const step = coarse ? 5 : 1;
      const targetFrame = Math.max(0, video.currentFrame - step);

      await video.seekToFrame(targetFrame);
    },
    []
  );

  /**
   * Update slider position for responsive UI during scrubbing.
   *
   * This is called on every mouse move while the user drags the scrub bar.
   * It does NOT trigger a seek — the actual seek happens on release.
   *
   * @param value - The new slider position (frame number).
   */
  const onSliderChange = useCallback((value: number) => {
    setSliderValue(value);
  }, []);

  /**
   * Commit the current slider position — pause playback and seek.
   *
   * Called when the user releases the scrub bar (onMouseUp/onTouchEnd).
   * Pauses playback before seeking to avoid position drift.
   */
  const onSliderRelease = useCallback(async () => {
    const video = videoRefSafe.current;
    if (!video) return;

    if (video.isPlaying) video.pause();
    await video.seekToFrame(sliderValue);
  }, [sliderValue]);

  /**
   * Change playback rate.
   *
   * @param rate - New playback rate (e.g., 0.5, 1.0, 1.5, 2.0).
   */
  const onSpeedChange = useCallback((rate: number) => {
    const video = videoRefSafe.current;
    if (!video) return;

    video.setPlaybackRate(rate);
  }, []);

  /**
   * Pause playback and seek to a specific frame.
   *
   * Used by the scrub bar's release handler and any programmatic seeks.
   *
   * @param frame - Target frame number (0-indexed).
   */
  const seekToFrame = useCallback(
    async (frame: number) => {
      const video = videoRefSafe.current;
      if (!video) return;

      if (video.isPlaying) video.pause();
      await video.seekToFrame(frame);
    },
    []
  );

  return {
    sliderValue,
    playPause,
    stepForward,
    stepBackward,
    onSliderChange,
    onSliderRelease,
    onSpeedChange,
    seekToFrame,
  };
}
