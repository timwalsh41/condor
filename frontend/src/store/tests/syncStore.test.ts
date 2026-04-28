/**
 * Unit tests for syncStore (Zustand store for video synchronization state).
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSyncStore } from '../syncStore';

describe('syncStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSyncStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should start in SYNC mode', () => {
      const { mode } = useSyncStore.getState();
      expect(mode).toBe('SYNC');
    });

    it('should have empty sync points initially', () => {
      const { syncPoints } = useSyncStore.getState();
      expect(syncPoints).toEqual([]);
    });
  });

  describe('Mode Management', () => {
    it('should switch to PLAYBACK mode', () => {
      useSyncStore.getState().setMode('PLAYBACK');

      const { mode } = useSyncStore.getState();
      expect(mode).toBe('PLAYBACK');
    });

    it('should switch back to SYNC mode', () => {
      useSyncStore.getState().setMode('PLAYBACK');
      useSyncStore.getState().setMode('SYNC');

      const { mode } = useSyncStore.getState();
      expect(mode).toBe('SYNC');
    });
  });

  describe('Sync Points Management', () => {
    it('should add a sync point', () => {
      const syncPoint = { frameA: 10, frameB: 20 };
      useSyncStore.getState().addSyncPoint(syncPoint);

      const { syncPoints } = useSyncStore.getState();
      expect(syncPoints).toHaveLength(1);
      expect(syncPoints[0]).toEqual(syncPoint);
    });

    it('should add multiple sync points', () => {
      const syncPoint1 = { frameA: 10, frameB: 20 };
      const syncPoint2 = { frameA: 50, frameB: 60 };

      useSyncStore.getState().addSyncPoint(syncPoint1);
      useSyncStore.getState().addSyncPoint(syncPoint2);

      const { syncPoints } = useSyncStore.getState();
      expect(syncPoints).toHaveLength(2);
      expect(syncPoints[0]).toEqual(syncPoint1);
      expect(syncPoints[1]).toEqual(syncPoint2);
    });

    it('should remove sync point by index', () => {
      const syncPoint1 = { frameA: 10, frameB: 20 };
      const syncPoint2 = { frameA: 50, frameB: 60 };

      useSyncStore.getState().addSyncPoint(syncPoint1);
      useSyncStore.getState().addSyncPoint(syncPoint2);
      useSyncStore.getState().removeSyncPoint(0);

      const { syncPoints } = useSyncStore.getState();
      expect(syncPoints).toHaveLength(1);
      expect(syncPoints[0]).toEqual(syncPoint2);
    });

    it('should clear all sync points', () => {
      useSyncStore.getState().addSyncPoint({ frameA: 10, frameB: 20 });
      useSyncStore.getState().addSyncPoint({ frameA: 50, frameB: 60 });

      useSyncStore.getState().clearSyncPoints();

      const { syncPoints } = useSyncStore.getState();
      expect(syncPoints).toEqual([]);
    });
  });

  describe('Reset', () => {
    it('should reset store to initial state', () => {
      // Set some state
      useSyncStore.getState().setMode('PLAYBACK');
      useSyncStore.getState().addSyncPoint({ frameA: 10, frameB: 20 });

      // Reset
      useSyncStore.getState().reset();

      // Verify reset
      const state = useSyncStore.getState();
      expect(state.mode).toBe('SYNC');
      expect(state.syncPoints).toEqual([]);
    });

    it('should reset store to initial state using resetSyncState alias', () => {
      // Set some state
      useSyncStore.getState().setMode('PLAYBACK');
      useSyncStore.getState().addSyncPoint({ frameA: 30, frameB: 40 });

      // Reset using alias
      useSyncStore.getState().resetSyncState();

      // Verify reset
      const state = useSyncStore.getState();
      expect(state.mode).toBe('SYNC');
      expect(state.syncPoints).toEqual([]);
    });

    it('reset and resetSyncState should have identical behavior', () => {
      // Set state and reset with reset()
      useSyncStore.getState().setMode('PLAYBACK');
      useSyncStore.getState().addSyncPoint({ frameA: 10, frameB: 20 });
      useSyncStore.getState().reset();
      const stateAfterReset = useSyncStore.getState();

      // Set state again and reset with resetSyncState()
      useSyncStore.getState().setMode('PLAYBACK');
      useSyncStore.getState().addSyncPoint({ frameA: 10, frameB: 20 });
      useSyncStore.getState().resetSyncState();
      const stateAfterResetSyncState = useSyncStore.getState();

      // Both should produce identical states
      expect(stateAfterReset.mode).toBe(stateAfterResetSyncState.mode);
      expect(stateAfterReset.syncPoints).toEqual(stateAfterResetSyncState.syncPoints);
    });
  });
});
