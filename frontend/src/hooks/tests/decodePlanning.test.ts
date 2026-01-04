/**
 * Decode Planning Logic Unit Tests
 *
 * Tests the critical lookahead and decode range calculation logic.
 * These tests validate the fix for the B-frame edge case where presentation
 * order differs from decode order.
 *
 * Background:
 * - In videos with B-frames, presentation order ≠ decode order
 * - Frame 148 (presentation) might be Sample 149 (decode order)
 * - Frame 149 (presentation) might be Sample 148 (decode order)
 * - The decoder must ensure it decodes at least to the target sample index
 *
 * Validates: REQ-F-DECODE-001 (Frame-accurate seeking with B-frame support)
 */

import { describe, it, expect } from 'vitest';
import { CoordinateMapping } from '../../utils/CoordinateMapping';
import { calculateLookaheadRange } from '../../utils/decodePlanning';
import type { MP4BoxSDK } from '../../types/mp4box';

/**
 * Create mock MP4 sample for testing.
 */
function createMockSample(
  cts: number,
  track_id: number = 1,
  is_sync: boolean = false
): MP4BoxSDK.Sample {
  return {
    track_id,
    number: 0,
    cts,
    dts: cts,
    duration: 3000,
    size: 1024,
    data: new Uint8Array(1024),
    is_sync,
    description: undefined,
    timescale: 90000,
  };
}

describe('Decode Planning - Lookahead Calculation', () => {
  describe('calculateLookaheadRange', () => {
    describe('B-frame Edge Cases (Critical Bug Fix)', () => {
      it('should include target sample when lookahead sample < target sample due to B-frames', () => {
        // Simulate the exact bug scenario we fixed:
        // Video with B-frames where decode order differs from presentation
        // This is Frame 148 at the end of a 150-frame video
        const samples: MP4BoxSDK.Sample[] = [];

        // Create a simplified scenario:
        // Frame 148 → Sample 149 (in decode order)
        // Frame 149 → Sample 148 (in decode order)
        // Last frame (149) is a B-frame that references frame 148

        // Build samples array (simplified - only last few frames matter)
        for (let i = 0; i < 147; i++) {
          samples.push(createMockSample(i * 3000, 1, i % 30 === 0)); // I-frame every 30
        }

        // The critical frames:
        samples.push(createMockSample(147 * 3000, 1, false)); // Sample 147, Frame 147
        samples.push(createMockSample(149 * 3000, 1, false)); // Sample 148, Frame 149 (B-frame)
        samples.push(createMockSample(148 * 3000, 1, false)); // Sample 149, Frame 148 (P-frame)

        const coordinateMap = new CoordinateMapping(samples);

        // Set up coordinate mapping
        for (let i = 0; i < 147; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Critical mappings for B-frame scenario
        coordinateMap.set(147, 147 * 3000, 147); // Frame 147 → Sample 147
        coordinateMap.set(148, 148 * 3000, 149); // Frame 148 → Sample 149 ⚠️
        coordinateMap.set(149, 149 * 3000, 148); // Frame 149 → Sample 148 ⚠️

        // Seek to frame 148 with 60 frames lookahead
        const result = calculateLookaheadRange(
          148, // targetFrame
          149, // targetSampleIndex (Sample 149 for Frame 148)
          coordinateMap,
          samples,
          60   // lookaheadFrames
        );

        // Verify:
        // - Lookahead frame is 149 (clamped to last frame)
        expect(result.lookaheadFrame).toBe(149);

        // - Lookahead sample is 148 (Frame 149's sample)
        expect(result.lookaheadSample).toBe(148);

        // - readAheadEnd MUST be 149, not 148
        // This ensures Sample 149 (Frame 148) gets decoded
        expect(result.readAheadEnd).toBe(149);

        // Without the fix, readAheadEnd would be 148, and Frame 148 would never appear
      });

      it('should handle multiple B-frames with complex reordering', () => {
        // Simulate video with multiple B-frames
        // Presentation: I P B B P B B
        // Decode order: I P P B B P B B (different!)

        const samples: MP4BoxSDK.Sample[] = [
          createMockSample(0, 1, true),     // Sample 0, Frame 0 (I)
          createMockSample(3000, 1, false), // Sample 1, Frame 1 (P)
          createMockSample(9000, 1, false), // Sample 2, Frame 4 (P) - out of order
          createMockSample(6000, 1, false), // Sample 3, Frame 2 (B)
          createMockSample(12000, 1, false),// Sample 4, Frame 3 (B)
          createMockSample(15000, 1, false),// Sample 5, Frame 5 (P)
          createMockSample(18000, 1, false),// Sample 6, Frame 6 (B)
          createMockSample(21000, 1, false),// Sample 7, Frame 7 (B)
        ];

        const coordinateMap = new CoordinateMapping(samples);

        // Presentation order mapping
        coordinateMap.set(0, 0, 0);      // Frame 0 → Sample 0
        coordinateMap.set(1, 3000, 1);   // Frame 1 → Sample 1
        coordinateMap.set(2, 6000, 3);   // Frame 2 → Sample 3
        coordinateMap.set(3, 12000, 4);  // Frame 3 → Sample 4
        coordinateMap.set(4, 9000, 2);   // Frame 4 → Sample 2 ⚠️
        coordinateMap.set(5, 15000, 5);  // Frame 5 → Sample 5
        coordinateMap.set(6, 18000, 6);  // Frame 6 → Sample 6
        coordinateMap.set(7, 21000, 7);  // Frame 7 → Sample 7

        // Seek to Frame 4, lookahead to Frame 5
        const result = calculateLookaheadRange(
          4,   // targetFrame (Frame 4 → Sample 2)
          2,   // targetSampleIndex
          coordinateMap,
          samples,
          1    // lookahead 1 frame
        );

        expect(result.lookaheadFrame).toBe(5);
        expect(result.lookaheadSample).toBe(5);

        // readAheadEnd must be max(2, 5) = 5
        // This ensures we decode samples 2,3,4,5 to get frames 4,2,3,5
        expect(result.readAheadEnd).toBe(5);
      });
    });

    describe('Normal P-frame Sequences', () => {
      it('should use lookahead sample when lookahead sample > target sample', () => {
        // Standard case: no B-frames, presentation order = decode order
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 200; i++) {
          samples.push(createMockSample(i * 3000, 1, i % 30 === 0));
        }

        const coordinateMap = new CoordinateMapping(samples);

        for (let i = 0; i < 200; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Seek to frame 100 with 60 frames lookahead
        const result = calculateLookaheadRange(
          100, // targetFrame
          100, // targetSampleIndex (same as frame in P-frame sequence)
          coordinateMap,
          samples,
          60   // lookaheadFrames
        );

        expect(result.lookaheadFrame).toBe(160);
        expect(result.lookaheadSample).toBe(160);

        // readAheadEnd = max(100, 160) = 160
        expect(result.readAheadEnd).toBe(160);
      });

      it('should handle small lookahead values', () => {
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 100; i++) {
          samples.push(createMockSample(i * 3000));
        }

        const coordinateMap = new CoordinateMapping(samples);

        for (let i = 0; i < 100; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Seek to frame 50 with 5 frames lookahead
        const result = calculateLookaheadRange(
          50,
          50,
          coordinateMap,
          samples,
          5
        );

        expect(result.lookaheadFrame).toBe(55);
        expect(result.lookaheadSample).toBe(55);
        expect(result.readAheadEnd).toBe(55);
      });
    });

    describe('Boundary Conditions', () => {
      it('should clamp lookahead frame to last frame when exceeding video length', () => {
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 150; i++) {
          samples.push(createMockSample(i * 3000));
        }

        const coordinateMap = new CoordinateMapping(samples);

        for (let i = 0; i < 150; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Seek to frame 145 with 60 frames lookahead
        // 145 + 60 = 205, but should clamp to 149 (last frame)
        const result = calculateLookaheadRange(
          145,
          145,
          coordinateMap,
          samples,
          60
        );

        expect(result.lookaheadFrame).toBe(149); // Clamped to last frame
        expect(result.lookaheadSample).toBe(149);
        expect(result.readAheadEnd).toBe(149);
      });

      it('should handle seeking to last frame', () => {
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 100; i++) {
          samples.push(createMockSample(i * 3000));
        }

        const coordinateMap = new CoordinateMapping(samples);

        for (let i = 0; i < 100; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Seek to last frame (99)
        const result = calculateLookaheadRange(
          99,
          99,
          coordinateMap,
          samples,
          60
        );

        expect(result.lookaheadFrame).toBe(99); // Can't go beyond last frame
        expect(result.lookaheadSample).toBe(99);
        expect(result.readAheadEnd).toBe(99);
      });

      it('should handle seeking to first frame', () => {
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 100; i++) {
          samples.push(createMockSample(i * 3000, 1, i === 0));
        }

        const coordinateMap = new CoordinateMapping(samples);

        for (let i = 0; i < 100; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Seek to first frame
        const result = calculateLookaheadRange(
          0,
          0,
          coordinateMap,
          samples,
          60
        );

        expect(result.lookaheadFrame).toBe(60);
        expect(result.lookaheadSample).toBe(60);
        expect(result.readAheadEnd).toBe(60);
      });

      it('should use fallback when lookahead frame not in coordinate map', () => {
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 100; i++) {
          samples.push(createMockSample(i * 3000));
        }

        // Create a sparse coordinate map with gaps to trigger fallback
        const coordinateMap = new CoordinateMapping(samples);

        // Map frames 0-40 and 60-80, leaving gap at 41-59
        for (let i = 0; i <= 40; i++) {
          coordinateMap.set(i, i * 3000, i);
        }
        for (let i = 60; i <= 80; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Seek to frame 30 with 20 frames lookahead
        // Lookahead frame 50 is in the gap (not in map)
        const result = calculateLookaheadRange(
          30,
          30,
          coordinateMap,
          samples,
          20
        );

        expect(result.lookaheadFrame).toBe(50);
        expect(result.lookaheadSample).toBeUndefined(); // Not in map (gap)

        // Should fall back to targetSampleIndex + lookaheadFrames
        // = 30 + 20 = 50, not clamped
        expect(result.readAheadEnd).toBe(50);
      });

      it('should handle fallback clamped to samples.length - 1', () => {
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 100; i++) {
          samples.push(createMockSample(i * 3000));
        }

        // Create a sparse coordinate map
        const coordinateMap = new CoordinateMapping(samples);

        // Only map frames 0-50, leaving gap at 51-99
        for (let i = 0; i <= 50; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        // Seek to frame 10 with 120 frames lookahead
        // Lookahead would be frame 130, clamped to 50 (map size - 1)
        // But frame 50 IS in map
        const result = calculateLookaheadRange(
          10,
          10,
          coordinateMap,
          samples,
          120
        );

        expect(result.lookaheadFrame).toBe(50); // Clamped to map size - 1
        expect(result.lookaheadSample).toBe(50); // IS in map

        // readAheadEnd = max(10, 50) = 50
        expect(result.readAheadEnd).toBe(50);
      });
    });

    describe('Edge Cases', () => {
      it('should handle single-frame video', () => {
        const samples = [createMockSample(0, 1, true)];
        const coordinateMap = new CoordinateMapping(samples);
        coordinateMap.set(0, 0, 0);

        const result = calculateLookaheadRange(0, 0, coordinateMap, samples, 60);

        expect(result.lookaheadFrame).toBe(0);
        expect(result.lookaheadSample).toBe(0);
        expect(result.readAheadEnd).toBe(0);
      });

      it('should handle zero lookahead', () => {
        const samples: MP4BoxSDK.Sample[] = [];

        for (let i = 0; i < 100; i++) {
          samples.push(createMockSample(i * 3000));
        }

        const coordinateMap = new CoordinateMapping(samples);

        for (let i = 0; i < 100; i++) {
          coordinateMap.set(i, i * 3000, i);
        }

        const result = calculateLookaheadRange(50, 50, coordinateMap, samples, 0);

        expect(result.lookaheadFrame).toBe(50);
        expect(result.lookaheadSample).toBe(50);
        expect(result.readAheadEnd).toBe(50);
      });
    });
  });
});
