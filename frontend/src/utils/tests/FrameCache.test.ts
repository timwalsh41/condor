import { describe, it, expect, beforeEach } from "vitest";
import { FrameCache } from "../FrameCache";

/**
 * Unit tests for FrameCache (LRU cache for VideoFrames).
 *
 * Tests memory management, LRU eviction, and cache statistics.
 * Uses mock VideoFrame since WebCodecs API is not available in Node.js.
 */

/**
 * Mock VideoFrame for testing.
 *
 * Simulates the VideoFrame API enough to test cache behavior.
 * Tracks whether .close() was called to verify memory management.
 */
class MockVideoFrame {
  closed: boolean;
  timestamp: number;
  displayWidth: number;
  displayHeight: number;

  constructor(timestamp: number, displayWidth: number = 1920, displayHeight: number = 1080) {
    this.closed = false;
    this.timestamp = timestamp;
    this.displayWidth = displayWidth;
    this.displayHeight = displayHeight;
  }

  close() {
    if (this.closed) {
      throw new Error("VideoFrame already closed");
    }
    this.closed = true;
  }

  clone(): MockVideoFrame {
    if (this.closed) {
      throw new Error("Cannot clone closed VideoFrame");
    }
    return new MockVideoFrame(this.timestamp, this.displayWidth, this.displayHeight);
  }
}

// Augment global type to allow MockVideoFrame as VideoFrame
declare global {
  interface VideoFrame {
    closed?: boolean;
  }
}

describe("FrameCache", () => {
  let cache: FrameCache;

  beforeEach(() => {
    cache = new FrameCache(5); // Small cache for testing
  });

  describe("Basic Operations", () => {
    it("should store and retrieve frames", () => {
      const frame = new MockVideoFrame(1000) as unknown as VideoFrame;
      cache.set(0, frame);

      const retrieved = cache.get(0);
      expect(retrieved).toBe(frame);
    });

    it("should return undefined for non-existent frames", () => {
      const retrieved = cache.get(0);
      expect(retrieved).toBeUndefined();
    });

    it("should check frame existence with has()", () => {
      const frame = new MockVideoFrame(1000) as unknown as VideoFrame;
      cache.set(0, frame);

      expect(cache.has(0)).toBe(true);
      expect(cache.has(1)).toBe(false);
    });

    it("should track cache size", () => {
      expect(cache.getSize()).toBe(0);

      cache.set(0, new MockVideoFrame(1000) as unknown as VideoFrame);
      expect(cache.getSize()).toBe(1);

      cache.set(1, new MockVideoFrame(2000) as unknown as VideoFrame);
      expect(cache.getSize()).toBe(2);
    });
  });

  describe("LRU Eviction", () => {
    it("should evict oldest frame when at capacity", () => {
      // Fill cache to capacity (5 frames)
      for (let i = 0; i < 5; i++) {
        cache.set(i, new MockVideoFrame(i * 1000) as unknown as VideoFrame);
      }

      expect(cache.getSize()).toBe(5);
      expect(cache.has(0)).toBe(true);

      // Add 6th frame - should evict frame 0 (oldest)
      cache.set(5, new MockVideoFrame(5000) as unknown as VideoFrame);

      expect(cache.getSize()).toBe(5);
      expect(cache.has(0)).toBe(false);
      expect(cache.has(5)).toBe(true);
    });

    it("should call .close() on evicted frame", () => {
      // Fill cache
      const frames: MockVideoFrame[] = [];
      for (let i = 0; i < 5; i++) {
        const frame = new MockVideoFrame(i * 1000);
        frames.push(frame);
        cache.set(i, frame as unknown as VideoFrame);
      }

      // Frame 0 should not be closed yet
      expect(frames[0].closed).toBe(false);

      // Add 6th frame - should evict and close frame 0
      cache.set(5, new MockVideoFrame(5000) as unknown as VideoFrame);

      // Frame 0 should now be closed
      expect(frames[0].closed).toBe(true);
    });

    it("should update LRU order on get()", () => {
      // Add frames 0-4
      for (let i = 0; i < 5; i++) {
        cache.set(i, new MockVideoFrame(i * 1000) as unknown as VideoFrame);
      }

      // Access frame 0 (moves it to end of LRU)
      cache.get(0);

      // Add frame 5 - should evict frame 1 (now oldest), not frame 0
      cache.set(5, new MockVideoFrame(5000) as unknown as VideoFrame);

      expect(cache.has(0)).toBe(true); // Still in cache (recently accessed)
      expect(cache.has(1)).toBe(false); // Evicted (oldest)
      expect(cache.has(5)).toBe(true); // Newly added
    });

    it("should update position when setting existing frame", () => {
      // Add frames 0-4
      for (let i = 0; i < 5; i++) {
        cache.set(i, new MockVideoFrame(i * 1000) as unknown as VideoFrame);
      }

      // Re-set frame 0 (moves it to end)
      cache.set(0, new MockVideoFrame(0) as unknown as VideoFrame);

      // Add frame 5 - should evict frame 1 (now oldest), not frame 0
      cache.set(5, new MockVideoFrame(5000) as unknown as VideoFrame);

      expect(cache.has(0)).toBe(true); // Still in cache (recently set)
      expect(cache.has(1)).toBe(false); // Evicted (oldest)
    });
  });

  describe("Memory Management", () => {
    it("should call .close() on all frames when clearing", () => {
      const frames: MockVideoFrame[] = [];
      for (let i = 0; i < 3; i++) {
        const frame = new MockVideoFrame(i * 1000);
        frames.push(frame);
        cache.set(i, frame as unknown as VideoFrame);
      }

      // None should be closed yet
      frames.forEach((f) => expect(f.closed).toBe(false));

      // Clear cache
      cache.clear();

      // All should be closed
      frames.forEach((f) => expect(f.closed).toBe(true));
      expect(cache.getSize()).toBe(0);
    });

    it("should not leak frames on eviction", () => {
      const frame0 = new MockVideoFrame(0);

      cache.set(0, frame0 as unknown as VideoFrame);

      // Fill cache to force eviction
      for (let i = 1; i < 6; i++) {
        cache.set(i, new MockVideoFrame(i * 1000) as unknown as VideoFrame);
      }

      // Frame 0 should be closed (evicted)
      expect(frame0.closed).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("should track cache hits and misses", () => {
      cache.set(0, new MockVideoFrame(0) as unknown as VideoFrame);
      cache.set(1, new MockVideoFrame(1000) as unknown as VideoFrame);

      // Initial stats
      let stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // Hit
      cache.get(0);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);

      // Miss
      cache.get(2);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Another hit
      cache.get(1);
      stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it("should calculate hit rate correctly", () => {
      cache.set(0, new MockVideoFrame(0) as unknown as VideoFrame);

      // 2 hits, 1 miss = 66.67% hit rate
      cache.get(0); // hit
      cache.get(0); // hit
      cache.get(1); // miss

      const stats = cache.getStats();
      expect(stats.hitRatePercent).toBeCloseTo(66.67, 1);
    });

    it("should handle zero requests (no division by zero)", () => {
      const stats = cache.getStats();
      expect(stats.hitRatePercent).toBe(0);
    });

    it("should track utilization percentage", () => {
      cache.set(0, new MockVideoFrame(0) as unknown as VideoFrame);
      cache.set(1, new MockVideoFrame(1000) as unknown as VideoFrame);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.utilizationPercent).toBe(40); // 2/5 = 40%
    });

    it("should reset stats without clearing cache", () => {
      cache.set(0, new MockVideoFrame(0) as unknown as VideoFrame);
      cache.get(0); // hit
      cache.get(1); // miss

      let stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(1); // Cache still has frame 0
    });

    it("should reset stats when clearing cache", () => {
      cache.set(0, new MockVideoFrame(0) as unknown as VideoFrame);
      cache.get(0); // hit

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle cache size of 1", () => {
      const smallCache = new FrameCache(1);

      const frame0 = new MockVideoFrame(0);
      smallCache.set(0, frame0 as unknown as VideoFrame);

      expect(smallCache.has(0)).toBe(true);

      // Adding another frame should evict frame 0
      smallCache.set(1, new MockVideoFrame(1000) as unknown as VideoFrame);

      expect(smallCache.has(0)).toBe(false);
      expect(smallCache.has(1)).toBe(true);
      expect(frame0.closed).toBe(true);
    });

    it("should handle large cache size", () => {
      const largeCache = new FrameCache(1000);

      for (let i = 0; i < 500; i++) {
        largeCache.set(i, new MockVideoFrame(i * 1000) as unknown as VideoFrame);
      }

      expect(largeCache.getSize()).toBe(500);
      const stats = largeCache.getStats();
      expect(stats.maxSize).toBe(1000);
      expect(stats.utilizationPercent).toBe(50);
    });

    it("should handle setting same frame index multiple times", () => {
      const frame1 = new MockVideoFrame(1000);
      const frame2 = new MockVideoFrame(2000);

      cache.set(0, frame1 as unknown as VideoFrame);
      cache.set(0, frame2 as unknown as VideoFrame);

      expect(cache.getSize()).toBe(1);
      expect(cache.get(0)).toBe(frame2);
    });
  });
});
