/**
 * Unit tests for playbackStore (Zustand store for video playback runtime state).
 *
 * Phase: Phase 1 Task 1.3 (DualVideoSyncDemo Backend Integration)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaybackStore } from '../playbackStore';
import type { PlayheadState } from '../../utils/dualVideoPlayback';

describe('playbackStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePlaybackStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should not be playing initially', () => {
      const { isPlaying } = usePlaybackStore.getState();
      expect(isPlaying).toBe(false);
    });

    it('should have playback rate of 1.0 initially', () => {
      const { playbackRate } = usePlaybackStore.getState();
      expect(playbackRate).toBe(1.0);
    });

    it('should have null playhead state initially', () => {
      const { playheadState } = usePlaybackStore.getState();
      expect(playheadState).toBeNull();
    });

    it('should have all slider positions at 0 initially', () => {
      const { sliderPositions } = usePlaybackStore.getState();
      expect(sliderPositions.videoA).toBe(0);
      expect(sliderPositions.videoB).toBe(0);
      expect(sliderPositions.unified).toBe(0);
    });
  });

  describe('Playback Control', () => {
    it('should set isPlaying to true', () => {
      usePlaybackStore.getState().setIsPlaying(true);

      const { isPlaying } = usePlaybackStore.getState();
      expect(isPlaying).toBe(true);
    });

    it('should set isPlaying to false', () => {
      usePlaybackStore.getState().setIsPlaying(true);
      usePlaybackStore.getState().setIsPlaying(false);

      const { isPlaying } = usePlaybackStore.getState();
      expect(isPlaying).toBe(false);
    });

    it('should set playback rate to 0.5x', () => {
      usePlaybackStore.getState().setPlaybackRate(0.5);

      const { playbackRate } = usePlaybackStore.getState();
      expect(playbackRate).toBe(0.5);
    });

    it('should set playback rate to 2.0x', () => {
      usePlaybackStore.getState().setPlaybackRate(2.0);

      const { playbackRate } = usePlaybackStore.getState();
      expect(playbackRate).toBe(2.0);
    });

    it('should update playback rate while playing', () => {
      usePlaybackStore.getState().setIsPlaying(true);
      usePlaybackStore.getState().setPlaybackRate(0.25);

      const state = usePlaybackStore.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.playbackRate).toBe(0.25);
    });
  });

  describe('Playhead State Management', () => {
    it('should set playhead state', () => {
      const playheadState: PlayheadState = {
        position: 10,
        syncOffset: 5,
        maxPosition: 100,
      };

      usePlaybackStore.getState().setPlayheadState(playheadState);

      const { playheadState: state } = usePlaybackStore.getState();
      expect(state).toEqual(playheadState);
    });

    it('should update playhead state position', () => {
      const initialState: PlayheadState = {
        position: 10,
        syncOffset: 5,
        maxPosition: 100,
      };

      const updatedState: PlayheadState = {
        position: 20,
        syncOffset: 5,
        maxPosition: 100,
      };

      usePlaybackStore.getState().setPlayheadState(initialState);
      usePlaybackStore.getState().setPlayheadState(updatedState);

      const { playheadState: state } = usePlaybackStore.getState();
      expect(state?.position).toBe(20);
    });

    it('should clear playhead state', () => {
      const playheadState: PlayheadState = {
        position: 10,
        syncOffset: 5,
        maxPosition: 100,
      };

      usePlaybackStore.getState().setPlayheadState(playheadState);
      usePlaybackStore.getState().setPlayheadState(null);

      const { playheadState: state } = usePlaybackStore.getState();
      expect(state).toBeNull();
    });
  });

  describe('Slider Positions Management', () => {
    it('should set slider positions', () => {
      const positions = {
        videoA: 25,
        videoB: 30,
        unified: 25,
      };

      usePlaybackStore.getState().setSliderPositions(positions);

      const { sliderPositions } = usePlaybackStore.getState();
      expect(sliderPositions).toEqual(positions);
    });

    it('should update individual slider positions', () => {
      usePlaybackStore.getState().setSliderPositions({
        videoA: 10,
        videoB: 15,
        unified: 10,
      });

      usePlaybackStore.getState().setSliderPositions({
        videoA: 20,
        videoB: 25,
        unified: 20,
      });

      const { sliderPositions } = usePlaybackStore.getState();
      expect(sliderPositions.videoA).toBe(20);
      expect(sliderPositions.videoB).toBe(25);
      expect(sliderPositions.unified).toBe(20);
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      // Set some state
      const playheadState: PlayheadState = {
        position: 50,
        syncOffset: 10,
        maxPosition: 200,
      };

      usePlaybackStore.getState().setIsPlaying(true);
      usePlaybackStore.getState().setPlaybackRate(0.5);
      usePlaybackStore.getState().setPlayheadState(playheadState);
      usePlaybackStore.getState().setSliderPositions({
        videoA: 50,
        videoB: 60,
        unified: 50,
      });

      // Reset
      usePlaybackStore.getState().reset();

      // Verify reset
      const state = usePlaybackStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.playbackRate).toBe(1.0);
      expect(state.playheadState).toBeNull();
      expect(state.sliderPositions.videoA).toBe(0);
      expect(state.sliderPositions.videoB).toBe(0);
      expect(state.sliderPositions.unified).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should maintain playback rate when stopping playback', () => {
      usePlaybackStore.getState().setPlaybackRate(0.25);
      usePlaybackStore.getState().setIsPlaying(true);
      usePlaybackStore.getState().setIsPlaying(false);

      const state = usePlaybackStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.playbackRate).toBe(0.25);
    });

    it('should maintain playhead state when changing playback rate', () => {
      const playheadState: PlayheadState = {
        position: 30,
        syncOffset: 5,
        maxPosition: 150,
      };

      usePlaybackStore.getState().setPlayheadState(playheadState);
      usePlaybackStore.getState().setPlaybackRate(0.5);

      const state = usePlaybackStore.getState();
      expect(state.playheadState).toEqual(playheadState);
      expect(state.playbackRate).toBe(0.5);
    });

    it('should maintain slider positions independently of playback state', () => {
      usePlaybackStore.getState().setSliderPositions({
        videoA: 100,
        videoB: 105,
        unified: 100,
      });

      usePlaybackStore.getState().setIsPlaying(true);

      const state = usePlaybackStore.getState();
      expect(state.sliderPositions.videoA).toBe(100);
      expect(state.isPlaying).toBe(true);
    });
  });
});
