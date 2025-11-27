/**
 * Decode Planning Utilities
 *
 * Helper functions for calculating decode ranges and lookahead windows
 * for frame-accurate video decoding with WebCodecs.
 *
 * These functions handle the complexity of B-frame reordering where
 * presentation order differs from decode order.
 */

import type { CoordinateMapping } from './CoordinateMapping';
import type { MP4BoxSDK } from '../types/mp4box';

/**
 * Calculate lookahead decode range for frame-accurate seeking.
 *
 * This function determines which samples need to be decoded to:
 * 1. Reach the target frame
 * 2. Decode ahead (lookahead) for smooth playback
 * 3. Handle B-frame reordering correctly
 *
 * Background: B-Frame Reordering
 * ===============================
 * In videos with B-frames, presentation order ≠ decode order.
 *
 * Example scenario that caused a real bug:
 *   Frame 148 (presentation) → Sample 149 (decode order)
 *   Frame 149 (presentation) → Sample 148 (decode order)
 *
 * Without proper handling:
 *   - Seeking to frame 148 with lookahead to 149
 *   - Lookahead sample is 148 (Frame 149's decode position)
 *   - We'd decode up to sample 148, missing sample 149
 *   - Frame 148 never appears in decoder output!
 *
 * The Fix:
 *   readAheadEnd = max(targetSampleIndex, lookaheadSampleIndex)
 *
 * This ensures we ALWAYS decode at least to the target frame's sample,
 * even when B-frame reordering puts the lookahead sample earlier in
 * decode order.
 *
 * @param targetFrame - Frame number to seek to (presentation order)
 * @param targetSampleIndex - Sample index for target frame (decode order)
 * @param coordinateMap - Bidirectional mapping between frames/CTS/samples
 * @param samples - All video samples (in decode order)
 * @param lookaheadFrames - How many frames to decode ahead (typically 60)
 * @returns Lookahead calculation results
 */
export function calculateLookaheadRange(
  targetFrame: number,
  targetSampleIndex: number,
  coordinateMap: CoordinateMapping,
  samples: MP4BoxSDK.Sample[],
  lookaheadFrames: number
): {
  /** Frame number of the lookahead position (presentation order) */
  lookaheadFrame: number;
  /** Sample index of the lookahead frame (decode order), or undefined if not in map */
  lookaheadSample: number | undefined;
  /** Final sample index to decode up to (inclusive) */
  readAheadEnd: number;
} {
  const totalFrames = coordinateMap.size;

  // Calculate lookahead frame, clamped to video bounds
  const targetFramePlusLookahead = Math.min(
    targetFrame + lookaheadFrames,
    totalFrames - 1
  );

  // Find the sample index for lookahead frame (O(1) via coordinate mapping)
  const lookaheadSampleIdx = coordinateMap.getSampleFromFrame(
    targetFramePlusLookahead
  );

  // Determine lookahead end sample
  // If lookahead frame found in map, use its sample index
  // Otherwise, fall back to estimating sample index from target
  const lookaheadEnd =
    lookaheadSampleIdx !== undefined
      ? lookaheadSampleIdx
      : Math.min(
          targetSampleIndex + lookaheadFrames,
          samples.length - 1
        );

  // CRITICAL FIX: Handle B-frame reordering
  //
  // Ensure we decode at least to the target sample index, even if the
  // lookahead sample comes earlier in decode order due to B-frames.
  //
  // Example that would break without this:
  //   targetSampleIndex = 149 (Frame 148)
  //   lookaheadEnd = 148 (Frame 149, a B-frame)
  //   Without fix: decode to sample 148, miss sample 149, Frame 148 never appears
  //   With fix: decode to sample 149, Frame 148 appears correctly
  const readAheadEnd = Math.max(targetSampleIndex, lookaheadEnd);

  return {
    lookaheadFrame: targetFramePlusLookahead,
    lookaheadSample: lookaheadSampleIdx,
    readAheadEnd,
  };
}
