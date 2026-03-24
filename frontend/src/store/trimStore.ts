/**
 * Zustand store for video trim state.
 *
 * Manages non-destructive trim bounds for PLAYBACK mode — the unified
 * playhead is constrained to [trimStart, trimEnd] (in Video A frame units).
 * Null values mean "no trim" (start/end of full valid range).
 *
 * Phase 2, Task 2.10 (Trim Functionality)
 * Validates: REQ-F-TRIM-001, REQ-F-TRIM-002
 */

import { create } from 'zustand';

interface TrimStoreState {
  /** Trim start position (Video A frame number). null = start from beginning. */
  trimStart: number | null;
  /** Trim end position (Video A frame number, inclusive). null = play to end. */
  trimEnd: number | null;

  setTrimStart: (frame: number | null) => void;
  setTrimEnd: (frame: number | null) => void;
  /** Reset both bounds to null (full playback range). */
  resetTrim: () => void;
  /** Alias for resetTrim() - resets trim bounds to null. */
  resetTrimState: () => void;
}

export const useTrimStore = create<TrimStoreState>((set) => ({
  trimStart: null,
  trimEnd: null,

  setTrimStart: (frame) => set({ trimStart: frame }),
  setTrimEnd: (frame) => set({ trimEnd: frame }),
  resetTrim: () => set({ trimStart: null, trimEnd: null }),
  resetTrimState: () => set({ trimStart: null, trimEnd: null }),
}));
