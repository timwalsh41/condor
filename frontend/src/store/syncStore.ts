/**
 * Zustand store for video synchronization state.
 *
 * Manages sync mode, playback mode, sync points, and temporal offset
 * for dual-video synchronization.
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { create } from 'zustand';

/**
 * Playback mode: SYNC (independent controls) or PLAYBACK (unified controls).
 */
export type PlaybackMode = 'SYNC' | 'PLAYBACK';

/**
 * Sync point representing temporal alignment between two videos.
 */
export interface SyncPoint {
  frameA: number;
  frameB: number;
}

/**
 * Sync store state and actions.
 */
interface SyncStoreState {
  // Current playback mode
  mode: PlaybackMode;

  // Sync points (up to 2 for MVP)
  syncPoints: SyncPoint[];

  // Calculated temporal offset (frameB = frameA + offset)
  // Null until sync points are established
  temporalOffset: number | null;

  // Target sync frames for seeking after session load
  targetSyncFrameA: number | null;
  targetSyncFrameB: number | null;

  // Actions
  setMode: (mode: PlaybackMode) => void;
  addSyncPoint: (syncPoint: SyncPoint) => void;
  removeSyncPoint: (index: number) => void;
  clearSyncPoints: () => void;
  setTemporalOffset: (offset: number | null) => void;
  setTargetSyncFrames: (frameA: number | null, frameB: number | null) => void;
  clearTargetSyncFrames: () => void;
  reset: () => void;
  resetSyncState: () => void;
}

/**
 * Initial store state.
 */
const initialState = {
  mode: 'SYNC' as PlaybackMode,
  syncPoints: [],
  temporalOffset: null,
  targetSyncFrameA: null,
  targetSyncFrameB: null,
};

/**
 * Sync store for managing video synchronization state.
 */
export const useSyncStore = create<SyncStoreState>((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),

  addSyncPoint: (syncPoint) =>
    set((state) => ({
      syncPoints: [...state.syncPoints, syncPoint],
    })),

  removeSyncPoint: (index) =>
    set((state) => ({
      syncPoints: state.syncPoints.filter((_, i) => i !== index),
    })),

  clearSyncPoints: () => set({ syncPoints: [], temporalOffset: null }),

  setTemporalOffset: (offset) => set({ temporalOffset: offset }),

  /**
   * Set target sync frames for seeking after session load.
   *
   * **Use Case**: Called by restoreSessionState() to store the sync frames
   * that videos should seek to after loading.
   *
   * **Side Effects**:
   * - Stores target frames for both videos
   *
   * **Integration**: DualVideoSynchronizer reads these and seeks after videos load.
   */
  setTargetSyncFrames: (frameA, frameB) =>
    set({ targetSyncFrameA: frameA, targetSyncFrameB: frameB }),

  /**
   * Clear target sync frames after successful seek.
   *
   * **Use Case**: Called after videos have seeked to target positions.
   *
   * **Side Effects**:
   * - Resets target frames to null
   */
  clearTargetSyncFrames: () =>
    set({ targetSyncFrameA: null, targetSyncFrameB: null }),

  /**
   * Reset store to initial state.
   *
   * **Use Case**: Called when user starts new session or clears sync configuration.
   *
   * **Side Effects**:
   * - Resets mode to SYNC
   * - Clears all sync points
   * - Resets temporal offset to null
   *
   * **Integration**: Should be called when loading new videos or resetting sync state.
   */
  reset: () => set(initialState),

  /**
   * Alias for reset() - resets sync state to initial values.
   *
   * **Use Case**: Called when loading new videos to clear previous sync configuration.
   *
   * **Side Effects**:
   * - Same as reset(): clears sync points and resets to SYNC mode
   *
   * **Integration**: Used by video change detection in DualVideoSynchronizer.
   */
  resetSyncState: () => set(initialState),
}));
