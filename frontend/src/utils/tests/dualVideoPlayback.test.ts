import { describe, it, expect } from 'vitest';
import {
  initializePlayhead,
  advancePlayhead,
  calculateTargetFrames,
  validatePlayheadState,
  calculatePlayheadRange,
  type PlayheadState
} from '../dualVideoPlayback';

describe('Dual Video Playback Logic', () => {
  describe('initializePlayhead', () => {
    it('should initialize playhead from current decoder positions', () => {
      const state = initializePlayhead(
        10,   // Video A at frame 10
        15,   // Video B at frame 15
        150,  // Video A has 150 frames
        150   // Video B has 150 frames
      );

      expect(state.position).toBe(10);
      expect(state.syncOffset).toBe(5); // B - A = 15 - 10
      expect(state.maxPosition).toBe(144); // min(149, 149 - 5)
    });

    it('should calculate correct max position when Video B constrains', () => {
      const state = initializePlayhead(
        0,    // Video A at frame 0
        145,  // Video B at frame 145 (near end)
        200,  // Video A has 200 frames
        150   // Video B has 150 frames (shorter)
      );

      expect(state.syncOffset).toBe(145);
      expect(state.maxPosition).toBe(4); // Video B reaches 149 when A reaches 4
    });

    it('should calculate correct max position when Video A constrains', () => {
      const state = initializePlayhead(
        0,   // Video A at frame 0
        0,   // Video B at frame 0
        100, // Video A has 100 frames (shorter)
        200  // Video B has 200 frames
      );

      expect(state.syncOffset).toBe(0);
      expect(state.maxPosition).toBe(99); // Video A ends at 99
    });

    it('should handle negative offset (Video B behind Video A)', () => {
      const state = initializePlayhead(
        50,  // Video A at frame 50
        45,  // Video B at frame 45
        150,
        150
      );

      expect(state.syncOffset).toBe(-5);
      expect(state.maxPosition).toBe(149); // min(149, 149 - (-5)) = min(149, 154)
    });
  });

  describe('advancePlayhead', () => {
    const state: PlayheadState = {
      position: 100,
      syncOffset: 5,
      maxPosition: 144
    };

    it('should advance playhead by 1 frame (default)', () => {
      const next = advancePlayhead(state);
      expect(next).toBe(101);
    });

    it('should advance playhead by specified step', () => {
      const next = advancePlayhead(state, 5);
      expect(next).toBe(105);
    });

    it('should allow advancing to max position', () => {
      const nearEnd: PlayheadState = { ...state, position: 143 };
      const next = advancePlayhead(nearEnd);
      expect(next).toBe(144);
    });

    it('should return null when advancing beyond max position', () => {
      const atEnd: PlayheadState = { ...state, position: 144 };
      const next = advancePlayhead(atEnd);
      expect(next).toBeNull();
    });

    it('should return null when advancing beyond max with large step', () => {
      const next = advancePlayhead(state, 50);
      expect(next).toBeNull();
    });

    it('should handle negative step (backward)', () => {
      const next = advancePlayhead(state, -5);
      expect(next).toBe(95);
    });

    it('should return null when stepping backward beyond 0', () => {
      const nearStart: PlayheadState = { ...state, position: 2 };
      const next = advancePlayhead(nearStart, -5);
      expect(next).toBeNull();
    });
  });

  describe('calculateTargetFrames', () => {
    it('should calculate correct target frames with positive offset', () => {
      const targets = calculateTargetFrames(100, 5);
      expect(targets.frameA).toBe(100);
      expect(targets.frameB).toBe(105);
    });

    it('should calculate correct target frames with negative offset', () => {
      const targets = calculateTargetFrames(100, -5);
      expect(targets.frameA).toBe(100);
      expect(targets.frameB).toBe(95);
    });

    it('should calculate correct target frames with zero offset', () => {
      const targets = calculateTargetFrames(50, 0);
      expect(targets.frameA).toBe(50);
      expect(targets.frameB).toBe(50);
    });

    it('should maintain offset relationship', () => {
      const offset = 7;
      const targets = calculateTargetFrames(42, offset);
      expect(targets.frameB - targets.frameA).toBe(offset);
    });
  });

  describe('validatePlayheadState', () => {
    it('should validate correct state', () => {
      const state: PlayheadState = {
        position: 100,
        syncOffset: 5,
        maxPosition: 144
      };
      expect(validatePlayheadState(state, 150)).toBe(true);
    });

    it('should reject negative position', () => {
      const state: PlayheadState = {
        position: -1,
        syncOffset: 5,
        maxPosition: 144
      };
      expect(validatePlayheadState(state, 150)).toBe(false);
    });

    it('should reject position beyond max', () => {
      const state: PlayheadState = {
        position: 145,
        syncOffset: 5,
        maxPosition: 144
      };
      expect(validatePlayheadState(state, 150)).toBe(false);
    });

    it('should reject when frameB would be negative', () => {
      const state: PlayheadState = {
        position: 2,
        syncOffset: -5,
        maxPosition: 100
      };
      expect(validatePlayheadState(state, 150)).toBe(false);
    });

    it('should reject when frameB would exceed total frames', () => {
      const state: PlayheadState = {
        position: 146,
        syncOffset: 5,
        maxPosition: 150
      };
      expect(validatePlayheadState(state, 150)).toBe(false); // frameB = 151, invalid
    });

    it('should validate state at boundary', () => {
      const state: PlayheadState = {
        position: 144,
        syncOffset: 5,
        maxPosition: 144
      };
      expect(validatePlayheadState(state, 150)).toBe(true); // frameB = 149, valid
    });
  });

  describe('calculatePlayheadRange', () => {
    it('should calculate range with positive offset', () => {
      const range = calculatePlayheadRange(150, 150, 5);
      expect(range.min).toBe(0);
      expect(range.max).toBe(144); // Video B reaches 149 when A is at 144
    });

    it('should calculate range with negative offset', () => {
      const range = calculatePlayheadRange(150, 150, -5);
      // When offset is -5, frameB = position - 5
      // For frameB >= 0: position >= 5
      expect(range.min).toBe(5); // Video B at 0 when A is at 5
      expect(range.max).toBe(149); // min(149, 149 - (-5)) = min(149, 154) = 149
    });

    it('should handle when Video B constrains minimum', () => {
      const range = calculatePlayheadRange(200, 150, 10);
      expect(range.min).toBe(0); // Video B at 0 when A at 0 + offset
      expect(range.max).toBe(139); // Video B reaches 149 when A is at 139
    });

    it('should handle when both videos have same length and zero offset', () => {
      const range = calculatePlayheadRange(150, 150, 0);
      expect(range.min).toBe(0);
      expect(range.max).toBe(149);
    });

    it('should handle when Video A is shorter', () => {
      const range = calculatePlayheadRange(100, 200, 5);
      expect(range.min).toBe(0);
      expect(range.max).toBe(99); // Video A ends at 99
    });

    it('should handle large positive offset', () => {
      const range = calculatePlayheadRange(150, 150, 100);
      expect(range.min).toBe(0);
      expect(range.max).toBe(49); // Video B reaches 149 when A is at 49
    });
  });

  describe('Sync Offset Maintenance (Integration Tests)', () => {
    it('should maintain sync offset through playback sequence', () => {
      // Initialize at start
      const state = initializePlayhead(0, 5, 150, 150);
      expect(state.syncOffset).toBe(5);

      // Advance through several frames
      let position = state.position;
      for (let i = 0; i < 10; i++) {
        const next = advancePlayhead({ ...state, position }, 1);
        expect(next).not.toBeNull();
        position = next!;

        // Verify offset is maintained
        const targets = calculateTargetFrames(position, state.syncOffset);
        expect(targets.frameB - targets.frameA).toBe(5);
      }
    });

    it('should stop at correct boundary maintaining offset', () => {
      // Video A: 150 frames (0-149), Video B: 150 frames (0-149), offset: +5
      // Expected end: A=144, B=149
      const state = initializePlayhead(0, 5, 150, 150);
      expect(state.maxPosition).toBe(144);

      // Advance to max
      const atMax = advancePlayhead({ ...state, position: 143 }, 1);
      expect(atMax).toBe(144);

      // Verify we can't advance further
      const beyondMax = advancePlayhead({ ...state, position: 144 }, 1);
      expect(beyondMax).toBeNull();

      // Verify frames at boundary
      const targets = calculateTargetFrames(144, state.syncOffset);
      expect(targets.frameA).toBe(144);
      expect(targets.frameB).toBe(149); // Exactly at Video B's last frame
    });

    it('should handle negative offset correctly', () => {
      // Video A ahead of Video B
      const state = initializePlayhead(50, 45, 150, 150);
      expect(state.syncOffset).toBe(-5);

      const targets = calculateTargetFrames(state.position, state.syncOffset);
      expect(targets.frameA).toBe(50);
      expect(targets.frameB).toBe(45);
      expect(targets.frameB - targets.frameA).toBe(-5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-frame videos', () => {
      const state = initializePlayhead(0, 0, 1, 1);
      expect(state.maxPosition).toBe(0);

      const next = advancePlayhead(state);
      expect(next).toBeNull(); // Can't advance from frame 0
    });

    it('should handle videos starting at non-zero frames', () => {
      const state = initializePlayhead(100, 105, 150, 150);
      expect(state.position).toBe(100);
      expect(state.syncOffset).toBe(5);
      expect(state.maxPosition).toBe(144);
    });

    it('should handle large offset relative to video length', () => {
      // Video B starts near its end
      const state = initializePlayhead(0, 148, 150, 150);
      expect(state.syncOffset).toBe(148);
      expect(state.maxPosition).toBe(1); // Can only advance to frame 1 (B would be at 149)
    });
  });
});
