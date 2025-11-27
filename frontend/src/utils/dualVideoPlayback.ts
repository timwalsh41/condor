/**
 * Dual Video Synchronized Playback Logic
 *
 * Pure functions for managing synchronized dual-video playback.
 * Extracted for testability and maintainability.
 *
 * Phase 0, Task 0.4 - Refactored to use top-level playhead state.
 */

/**
 * Playhead state for synchronized dual-video playback
 */
export interface PlayheadState {
  /** Current playhead position (Video A frame number) */
  position: number;
  /** Sync offset (frameB - frameA) */
  syncOffset: number;
  /** Maximum valid position for Video A */
  maxPosition: number;
}

/**
 * Initialize playhead state when entering PLAYBACK mode
 *
 * @param currentFrameA - Current position of Video A
 * @param currentFrameB - Current position of Video B
 * @param totalFramesA - Total frames in Video A
 * @param totalFramesB - Total frames in Video B
 * @returns Initial playhead state
 */
export function initializePlayhead(
  currentFrameA: number,
  currentFrameB: number,
  totalFramesA: number,
  totalFramesB: number
): PlayheadState {
  // Calculate sync offset from current positions
  const syncOffset = currentFrameB - currentFrameA;

  // Calculate maximum playhead position
  // Video A can advance until either:
  // 1. Video A reaches its last frame (totalFramesA - 1)
  // 2. Video B reaches its last frame (when A = totalFramesB - 1 - syncOffset)
  const maxFromA = totalFramesA - 1;
  const maxFromB = totalFramesB - 1 - syncOffset;
  const maxPosition = Math.min(maxFromA, maxFromB);

  return {
    position: currentFrameA,
    syncOffset,
    maxPosition
  };
}

/**
 * Calculate next playhead position
 *
 * @param state - Current playhead state
 * @param step - Number of frames to advance (default 1)
 * @returns New playhead position, or null if at boundary
 */
export function advancePlayhead(
  state: PlayheadState,
  step: number = 1
): number | null {
  const nextPosition = state.position + step;

  // Check boundary
  if (nextPosition > state.maxPosition || nextPosition < 0) {
    return null;
  }

  return nextPosition;
}

/**
 * Calculate target frames for both videos from playhead position
 *
 * @param playheadPosition - Current playhead position (Video A frame)
 * @param syncOffset - Sync offset (frameB - frameA)
 * @returns Target frames for both videos
 */
export function calculateTargetFrames(
  playheadPosition: number,
  syncOffset: number
): { frameA: number; frameB: number } {
  return {
    frameA: playheadPosition,
    frameB: playheadPosition + syncOffset
  };
}

/**
 * Validate playhead state
 * Checks invariants:
 * - position >= 0
 * - position <= maxPosition
 * - frameB (position + offset) is within valid range
 *
 * @param state - Playhead state to validate
 * @param totalFramesB - Total frames in Video B
 * @returns true if valid, false otherwise
 */
export function validatePlayheadState(
  state: PlayheadState,
  totalFramesB: number
): boolean {
  // Check position in valid range
  if (state.position < 0 || state.position > state.maxPosition) {
    return false;
  }

  // Check frameB in valid range
  const frameB = state.position + state.syncOffset;
  if (frameB < 0 || frameB >= totalFramesB) {
    return false;
  }

  return true;
}

/**
 * Calculate valid playhead range from scrub bar position
 * Accounts for sync offset to ensure both videos stay in bounds
 *
 * @param totalFramesA - Total frames in Video A
 * @param totalFramesB - Total frames in Video B
 * @param syncOffset - Sync offset (frameB - frameA)
 * @returns Min and max valid playhead positions
 */
export function calculatePlayheadRange(
  totalFramesA: number,
  totalFramesB: number,
  syncOffset: number
): { min: number; max: number } {
  // Minimum position: when frameB reaches 0
  // frameB = position + offset
  // 0 = position + offset
  // position = -offset
  const minFromB = -syncOffset;
  const min = Math.max(0, minFromB);

  // Maximum position: when either video reaches its end
  const maxFromA = totalFramesA - 1;
  const maxFromB = totalFramesB - 1 - syncOffset;
  const max = Math.min(maxFromA, maxFromB);

  return { min, max };
}
