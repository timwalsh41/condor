/**
 * Unit tests for trimStore (Zustand store for video trim state).
 *
 * Phase 2, Task 2.10 (Trim Functionality)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTrimStore } from '../trimStore';

describe('trimStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTrimStore.getState().resetTrim();
  });

  describe('Initial State', () => {
    it('should have null trimStart initially', () => {
      const { trimStart } = useTrimStore.getState();
      expect(trimStart).toBeNull();
    });

    it('should have null trimEnd initially', () => {
      const { trimEnd } = useTrimStore.getState();
      expect(trimEnd).toBeNull();
    });
  });

  describe('Trim Start Management', () => {
    it('should set trim start', () => {
      useTrimStore.getState().setTrimStart(100);

      const { trimStart } = useTrimStore.getState();
      expect(trimStart).toBe(100);
    });

    it('should update trim start', () => {
      useTrimStore.getState().setTrimStart(100);
      useTrimStore.getState().setTrimStart(200);

      const { trimStart } = useTrimStore.getState();
      expect(trimStart).toBe(200);
    });

    it('should set trim start to null', () => {
      useTrimStore.getState().setTrimStart(100);
      useTrimStore.getState().setTrimStart(null);

      const { trimStart } = useTrimStore.getState();
      expect(trimStart).toBeNull();
    });
  });

  describe('Trim End Management', () => {
    it('should set trim end', () => {
      useTrimStore.getState().setTrimEnd(500);

      const { trimEnd } = useTrimStore.getState();
      expect(trimEnd).toBe(500);
    });

    it('should update trim end', () => {
      useTrimStore.getState().setTrimEnd(500);
      useTrimStore.getState().setTrimEnd(1000);

      const { trimEnd } = useTrimStore.getState();
      expect(trimEnd).toBe(1000);
    });

    it('should set trim end to null', () => {
      useTrimStore.getState().setTrimEnd(500);
      useTrimStore.getState().setTrimEnd(null);

      const { trimEnd } = useTrimStore.getState();
      expect(trimEnd).toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset trim bounds using resetTrim', () => {
      useTrimStore.getState().setTrimStart(100);
      useTrimStore.getState().setTrimEnd(500);

      useTrimStore.getState().resetTrim();

      const { trimStart, trimEnd } = useTrimStore.getState();
      expect(trimStart).toBeNull();
      expect(trimEnd).toBeNull();
    });

    it('should reset trim bounds using resetTrimState alias', () => {
      useTrimStore.getState().setTrimStart(200);
      useTrimStore.getState().setTrimEnd(800);

      useTrimStore.getState().resetTrimState();

      const { trimStart, trimEnd } = useTrimStore.getState();
      expect(trimStart).toBeNull();
      expect(trimEnd).toBeNull();
    });

    it('resetTrim and resetTrimState should have identical behavior', () => {
      // Set bounds and reset with resetTrim
      useTrimStore.getState().setTrimStart(100);
      useTrimStore.getState().setTrimEnd(500);
      useTrimStore.getState().resetTrim();
      const stateAfterResetTrim = useTrimStore.getState();

      // Set bounds again and reset with resetTrimState
      useTrimStore.getState().setTrimStart(100);
      useTrimStore.getState().setTrimEnd(500);
      useTrimStore.getState().resetTrimState();
      const stateAfterResetTrimState = useTrimStore.getState();

      // Both should produce identical states
      expect(stateAfterResetTrim.trimStart).toBe(stateAfterResetTrimState.trimStart);
      expect(stateAfterResetTrim.trimEnd).toBe(stateAfterResetTrimState.trimEnd);
    });
  });

  describe('Combined Operations', () => {
    it('should manage both trim bounds independently', () => {
      useTrimStore.getState().setTrimStart(100);
      expect(useTrimStore.getState().trimStart).toBe(100);
      expect(useTrimStore.getState().trimEnd).toBeNull();

      useTrimStore.getState().setTrimEnd(500);
      expect(useTrimStore.getState().trimStart).toBe(100);
      expect(useTrimStore.getState().trimEnd).toBe(500);
    });

    it('should fully reset both bounds at once', () => {
      useTrimStore.getState().setTrimStart(100);
      useTrimStore.getState().setTrimEnd(500);

      useTrimStore.getState().resetTrim();

      const state = useTrimStore.getState();
      expect(state.trimStart).toBeNull();
      expect(state.trimEnd).toBeNull();
    });
  });
});
