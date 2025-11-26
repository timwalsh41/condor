import { describe, it, expect, beforeEach } from "vitest";
import { CoordinateMapping } from "../CoordinateMapping";
import type { MP4BoxSDK } from "../../types/mp4box";

/**
 * Unit tests for CoordinateMapping.
 *
 * Tests the 3-way isomorphism between Frame Number, CTS (composition timestamp),
 * and Sample Index. Validates O(1) lookups in all 6 directions and edge cases.
 */

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
    number: 0, // Not used by CoordinateMapping
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

describe("CoordinateMapping", () => {
  let samples: MP4BoxSDK.Sample[];
  let mapping: CoordinateMapping;

  beforeEach(() => {
    // Create sample video with 5 frames in presentation order
    // Frame 0: CTS=0,    Sample[0]
    // Frame 1: CTS=3000, Sample[1]
    // Frame 2: CTS=6000, Sample[2]
    // Frame 3: CTS=9000, Sample[3]
    // Frame 4: CTS=12000, Sample[4]
    samples = [
      createMockSample(0, 1, true),    // I-frame
      createMockSample(3000, 1, false), // P-frame
      createMockSample(6000, 1, false), // P-frame
      createMockSample(9000, 1, false), // P-frame
      createMockSample(12000, 1, false), // P-frame
    ];

    mapping = new CoordinateMapping(samples);

    // Set up mappings (simulating initialization in useWebCodecsDecoder)
    for (let frameNum = 0; frameNum < samples.length; frameNum++) {
      mapping.set(frameNum, samples[frameNum].cts, frameNum);
    }
  });

  describe("Initialization", () => {
    it("should initialize with samples array", () => {
      const newMapping = new CoordinateMapping(samples);
      expect(newMapping).toBeDefined();
      expect(newMapping.size).toBe(0); // No mappings until .set() is called
    });

    it("should track mapping count correctly", () => {
      const newMapping = new CoordinateMapping(samples);
      expect(newMapping.size).toBe(0);

      newMapping.set(0, 0, 0);
      expect(newMapping.size).toBe(1);

      newMapping.set(1, 3000, 1);
      expect(newMapping.size).toBe(2);
    });
  });

  describe("Frame ↔ CTS Mappings (O(1))", () => {
    it("should get CTS from frame number", () => {
      expect(mapping.getCts(0)).toBe(0);
      expect(mapping.getCts(1)).toBe(3000);
      expect(mapping.getCts(2)).toBe(6000);
      expect(mapping.getCts(3)).toBe(9000);
      expect(mapping.getCts(4)).toBe(12000);
    });

    it("should get frame number from CTS", () => {
      expect(mapping.getFrame(0)).toBe(0);
      expect(mapping.getFrame(3000)).toBe(1);
      expect(mapping.getFrame(6000)).toBe(2);
      expect(mapping.getFrame(9000)).toBe(3);
      expect(mapping.getFrame(12000)).toBe(4);
    });

    it("should return undefined for non-existent frame number", () => {
      expect(mapping.getCts(99)).toBeUndefined();
      expect(mapping.getCts(-1)).toBeUndefined();
    });

    it("should return undefined for non-existent CTS", () => {
      expect(mapping.getFrame(1500)).toBeUndefined();
      expect(mapping.getFrame(99999)).toBeUndefined();
    });
  });

  describe("CTS ↔ Sample Index Mappings (O(1))", () => {
    it("should get sample index from CTS", () => {
      expect(mapping.getSample(0)).toBe(0);
      expect(mapping.getSample(3000)).toBe(1);
      expect(mapping.getSample(6000)).toBe(2);
      expect(mapping.getSample(9000)).toBe(3);
      expect(mapping.getSample(12000)).toBe(4);
    });

    it("should get CTS from sample index", () => {
      expect(mapping.getCtsFromSample(0)).toBe(0);
      expect(mapping.getCtsFromSample(1)).toBe(3000);
      expect(mapping.getCtsFromSample(2)).toBe(6000);
      expect(mapping.getCtsFromSample(3)).toBe(9000);
      expect(mapping.getCtsFromSample(4)).toBe(12000);
    });

    it("should return undefined for non-existent CTS", () => {
      expect(mapping.getSample(1500)).toBeUndefined();
      expect(mapping.getSample(99999)).toBeUndefined();
    });
  });

  describe("Frame ↔ Sample Index Mappings (O(1) composed)", () => {
    it("should get sample index from frame number", () => {
      expect(mapping.getSampleFromFrame(0)).toBe(0);
      expect(mapping.getSampleFromFrame(1)).toBe(1);
      expect(mapping.getSampleFromFrame(2)).toBe(2);
      expect(mapping.getSampleFromFrame(3)).toBe(3);
      expect(mapping.getSampleFromFrame(4)).toBe(4);
    });

    it("should get frame number from sample index", () => {
      expect(mapping.getFrameFromSample(0)).toBe(0);
      expect(mapping.getFrameFromSample(1)).toBe(1);
      expect(mapping.getFrameFromSample(2)).toBe(2);
      expect(mapping.getFrameFromSample(3)).toBe(3);
      expect(mapping.getFrameFromSample(4)).toBe(4);
    });

    it("should return undefined for non-existent frame number", () => {
      expect(mapping.getSampleFromFrame(99)).toBeUndefined();
      expect(mapping.getSampleFromFrame(-1)).toBeUndefined();
    });

    it("should return undefined for non-mapped sample index", () => {
      // Note: getSample returns undefined for unmapped CTS,
      // but getCtsFromSample always returns a value (samples[i].cts)
      const unmappedMapping = new CoordinateMapping(samples);
      expect(unmappedMapping.getFrameFromSample(0)).toBeUndefined();
    });
  });

  describe("B-Frame Handling (Decode Order ≠ Presentation Order)", () => {
    it("should handle video with B-frames correctly", () => {
      // Simulate video with B-frames where decode order differs from presentation
      // Decode order (sample index): I, P, B, P
      // Presentation order (CTS):   0, 6000, 3000, 9000
      // Presentation order (frame):  0, 1,    2,    3
      const bFrameSamples: MP4BoxSDK.Sample[] = [
        createMockSample(0, 1, true),    // Sample[0]: I-frame, Frame 0, CTS=0
        createMockSample(6000, 1, false), // Sample[1]: P-frame, Frame 2, CTS=6000
        createMockSample(3000, 1, false), // Sample[2]: B-frame, Frame 1, CTS=3000
        createMockSample(9000, 1, false), // Sample[3]: P-frame, Frame 3, CTS=9000
      ];

      const bMapping = new CoordinateMapping(bFrameSamples);

      // Set up mappings in presentation order (sorted by CTS)
      bMapping.set(0, 0, 0);      // Frame 0 → CTS 0 → Sample 0
      bMapping.set(1, 3000, 2);   // Frame 1 → CTS 3000 → Sample 2 (B-frame)
      bMapping.set(2, 6000, 1);   // Frame 2 → CTS 6000 → Sample 1
      bMapping.set(3, 9000, 3);   // Frame 3 → CTS 9000 → Sample 3

      // Verify Frame → Sample mappings (presentation → decode order)
      expect(bMapping.getSampleFromFrame(0)).toBe(0);
      expect(bMapping.getSampleFromFrame(1)).toBe(2); // Frame 1 is Sample 2
      expect(bMapping.getSampleFromFrame(2)).toBe(1); // Frame 2 is Sample 1
      expect(bMapping.getSampleFromFrame(3)).toBe(3);

      // Verify Sample → Frame mappings (decode → presentation order)
      expect(bMapping.getFrameFromSample(0)).toBe(0);
      expect(bMapping.getFrameFromSample(1)).toBe(2); // Sample 1 is Frame 2
      expect(bMapping.getFrameFromSample(2)).toBe(1); // Sample 2 is Frame 1
      expect(bMapping.getFrameFromSample(3)).toBe(3);

      // Verify CTS lookups work correctly
      expect(bMapping.getCts(1)).toBe(3000);
      expect(bMapping.getFrame(3000)).toBe(1);
    });
  });

  describe("Utility Methods", () => {
    it("should check if frame exists", () => {
      expect(mapping.hasFrame(0)).toBe(true);
      expect(mapping.hasFrame(4)).toBe(true);
      expect(mapping.hasFrame(5)).toBe(false);
      expect(mapping.hasFrame(99)).toBe(false);
    });

    it("should check if CTS exists", () => {
      expect(mapping.hasCts(0)).toBe(true);
      expect(mapping.hasCts(12000)).toBe(true);
      expect(mapping.hasCts(1500)).toBe(false);
      expect(mapping.hasCts(99999)).toBe(false);
    });

    it("should check if sample index exists", () => {
      expect(mapping.hasSample(0)).toBe(true);
      expect(mapping.hasSample(4)).toBe(true);
      expect(mapping.hasSample(5)).toBe(false);
      expect(mapping.hasSample(-1)).toBe(false);
    });

    it("should clear all mappings", () => {
      expect(mapping.size).toBe(5);

      mapping.clear();

      expect(mapping.size).toBe(0);
      expect(mapping.getCts(0)).toBeUndefined();
      expect(mapping.getFrame(0)).toBeUndefined();
      expect(mapping.getSample(0)).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty mapping", () => {
      const emptyMapping = new CoordinateMapping(samples);

      expect(emptyMapping.size).toBe(0);
      expect(emptyMapping.getCts(0)).toBeUndefined();
      expect(emptyMapping.getFrame(0)).toBeUndefined();
      expect(emptyMapping.getSample(0)).toBeUndefined();
      expect(emptyMapping.getSampleFromFrame(0)).toBeUndefined();
      expect(emptyMapping.getFrameFromSample(0)).toBeUndefined();
    });

    it("should handle single frame video", () => {
      const singleSample = [createMockSample(0, 1, true)];
      const singleMapping = new CoordinateMapping(singleSample);

      singleMapping.set(0, 0, 0);

      expect(singleMapping.size).toBe(1);
      expect(singleMapping.getCts(0)).toBe(0);
      expect(singleMapping.getFrame(0)).toBe(0);
      expect(singleMapping.getSample(0)).toBe(0);
      expect(singleMapping.getSampleFromFrame(0)).toBe(0);
      expect(singleMapping.getFrameFromSample(0)).toBe(0);
    });

    it("should handle large videos (1000 frames)", () => {
      const largeSamples: MP4BoxSDK.Sample[] = [];
      for (let i = 0; i < 1000; i++) {
        largeSamples.push(createMockSample(i * 3000));
      }

      const largeMapping = new CoordinateMapping(largeSamples);

      for (let i = 0; i < 1000; i++) {
        largeMapping.set(i, i * 3000, i);
      }

      expect(largeMapping.size).toBe(1000);

      // Spot check some frames
      expect(largeMapping.getCts(0)).toBe(0);
      expect(largeMapping.getCts(500)).toBe(1500000);
      expect(largeMapping.getCts(999)).toBe(2997000);

      expect(largeMapping.getSampleFromFrame(0)).toBe(0);
      expect(largeMapping.getSampleFromFrame(500)).toBe(500);
      expect(largeMapping.getSampleFromFrame(999)).toBe(999);
    });

    it("should handle non-contiguous CTS values", () => {
      // Video with dropped frames or variable frame rate
      const vfrSamples = [
        createMockSample(0),
        createMockSample(3000),
        createMockSample(10000), // Gap: skipped 6000
        createMockSample(15000), // Gap: skipped 12000
      ];

      const vfrMapping = new CoordinateMapping(vfrSamples);

      vfrMapping.set(0, 0, 0);
      vfrMapping.set(1, 3000, 1);
      vfrMapping.set(2, 10000, 2);
      vfrMapping.set(3, 15000, 3);

      expect(vfrMapping.getCts(2)).toBe(10000);
      expect(vfrMapping.getFrame(10000)).toBe(2);
      expect(vfrMapping.getSampleFromFrame(2)).toBe(2);
    });

    it("should handle updating existing mapping", () => {
      // Update frame 2's mapping
      mapping.set(2, 7000, 2); // Changed CTS from 6000 to 7000

      expect(mapping.getCts(2)).toBe(7000);
      expect(mapping.getFrame(7000)).toBe(2);
      expect(mapping.getFrame(6000)).toBeUndefined(); // Old CTS is gone
    });
  });

  describe("Performance Characteristics", () => {
    it("should maintain O(1) lookups for large videos", () => {
      const largeSamples: MP4BoxSDK.Sample[] = [];
      for (let i = 0; i < 10000; i++) {
        largeSamples.push(createMockSample(i * 3000));
      }

      const largeMapping = new CoordinateMapping(largeSamples);

      for (let i = 0; i < 10000; i++) {
        largeMapping.set(i, i * 3000, i);
      }

      // Test Frame → CTS lookups
      const start1 = performance.now();
      for (let i = 0; i < 1000; i++) {
        largeMapping.getCts(Math.floor(Math.random() * 10000));
      }
      const elapsed1 = performance.now() - start1;

      // Test CTS → Frame lookups
      const start2 = performance.now();
      for (let i = 0; i < 1000; i++) {
        largeMapping.getFrame(Math.floor(Math.random() * 10000) * 3000);
      }
      const elapsed2 = performance.now() - start2;

      // Test Frame → Sample lookups (composed)
      const start3 = performance.now();
      for (let i = 0; i < 1000; i++) {
        largeMapping.getSampleFromFrame(Math.floor(Math.random() * 10000));
      }
      const elapsed3 = performance.now() - start3;

      // All should be fast (<50ms for 1000 lookups)
      expect(elapsed1).toBeLessThan(50);
      expect(elapsed2).toBeLessThan(50);
      expect(elapsed3).toBeLessThan(50);
    });
  });

  describe("Real-World Use Cases", () => {
    it("should support typical decoder workflow", () => {
      // Simulates useWebCodecsDecoder usage:
      // 1. User seeks to frame 2
      const targetFrame = 2;

      // 2. Find CTS for target frame
      const targetCts = mapping.getCts(targetFrame);
      expect(targetCts).toBe(6000);

      // 3. Find sample index to decode
      const targetSample = mapping.getSampleFromFrame(targetFrame);
      expect(targetSample).toBe(2);

      // 4. Decoder output callback receives frame with CTS
      const decodedCts = 6000;
      const frameToRender = mapping.getFrame(decodedCts);
      expect(frameToRender).toBe(2);
    });

    it("should support buffer fill workflow", () => {
      // Simulates playback buffer fill:
      // Current frame: 1, need frames 2-4

      const currentFrame = 1;
      const lookahead = 3;

      // Get sample indices for buffer window
      const sampleIndices: number[] = [];
      for (let f = currentFrame + 1; f <= currentFrame + lookahead; f++) {
        const sampleIdx = mapping.getSampleFromFrame(f);
        if (sampleIdx !== undefined) {
          sampleIndices.push(sampleIdx);
        }
      }

      expect(sampleIndices).toEqual([2, 3, 4]);
    });
  });
});
