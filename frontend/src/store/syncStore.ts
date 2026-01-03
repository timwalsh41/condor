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

  // Actions
  setMode: (mode: PlaybackMode) => void;
  addSyncPoint: (syncPoint: SyncPoint) => void;
  removeSyncPoint: (index: number) => void;
  clearSyncPoints: () => void;
  setTemporalOffset: (offset: number | null) => void;
  reset: () => void;
}

/**
 * Initial store state.
 */
const initialState = {
  mode: 'SYNC' as PlaybackMode,
  syncPoints: [],
  temporalOffset: null,
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
}));
