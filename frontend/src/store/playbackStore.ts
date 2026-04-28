/**
 * Zustand store for video playback runtime state.
 *
 * Manages playback control, playhead position, and UI scrubber state
 * for dual-video synchronized playback.
 *
 * Separation from syncStore:
 * - syncStore = Configuration (how videos are aligned)
 * - playbackStore = Runtime (where playhead is, what's playing now)
 *
 * Phase: Phase 1 Task 1.3 (DualVideoSyncDemo Backend Integration)
 */

import { create } from 'zustand';
import type { PlayheadState } from '../utils/dualVideoPlayback';

/**
 * Scrubber/slider positions for UI responsiveness.
 */
export interface SliderPositions {
  /** Video A scrubber position (frame number) */
  videoA: number;
  /** Video B scrubber position (frame number) */
  videoB: number;
  /** Unified scrubber position in PLAYBACK mode (Video A frame number) */
  unified: number;
}

/**
 * Playback store state and actions.
 */
interface PlaybackStoreState {
  // Playback control
  isPlaying: boolean;
  playbackRate: number;
  isLooping: boolean;

  // Playhead management (PLAYBACK mode only)
  playheadState: PlayheadState | null;

  // UI scrubber positions
  sliderPositions: SliderPositions;

  // Actions
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setIsLooping: (isLooping: boolean) => void;
  setPlayheadState: (state: PlayheadState | null) => void;
  /**
   * Update the playhead position while preserving syncOffset and maxPosition.
   */
  setPlayheadPosition: (frame: number) => void;
  /**
   * Update the sync offset while preserving position and maxPosition.
   */
  setSyncOffset: (offset: number) => void;
  setSliderPositions: (positions: SliderPositions) => void;
  reset: () => void;
}

/**
 * Initial store state.
 */
const initialState = {
  isPlaying: false,
  playbackRate: 1.0,
  isLooping: false,
  playheadState: null,
  sliderPositions: {
    videoA: 0,
    videoB: 0,
    unified: 0,
  },
};

/**
 * Playback store for managing video playback runtime state.
 */
export const usePlaybackStore = create<PlaybackStoreState>((set) => ({
  ...initialState,

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  setPlaybackRate: (rate) => set({ playbackRate: rate }),

  setIsLooping: (isLooping) => set({ isLooping }),

  setPlayheadState: (state) => set({ playheadState: state }),

  setPlayheadPosition: (frame) =>
    set((state) => ({
      playheadState: state.playheadState
        ? { ...state.playheadState, position: frame }
        : { position: frame, syncOffset: 0, maxPosition: frame },
    })),

  setSyncOffset: (offset) =>
    set((state) => ({
      playheadState: state.playheadState
        ? { ...state.playheadState, syncOffset: offset }
        : { position: 0, syncOffset: offset, maxPosition: 0 },
    })),

  setSliderPositions: (positions) => set({ sliderPositions: positions }),

  /**
   * Reset store to initial state.
   *
   * **Use Case**: Called when exiting PLAYBACK mode or loading new videos.
   *
   * **Side Effects**:
   * - Stops playback
   * - Resets playback rate to 1.0x
   * - Clears playhead state
   * - Resets all scrubber positions to 0
   *
   * **Integration**: Should be called when switching from PLAYBACK to SYNC mode
   * or when loading new videos.
   */
  reset: () => set(initialState),
}));
