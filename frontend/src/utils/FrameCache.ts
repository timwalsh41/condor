/**
 * LRU (Least Recently Used) cache for decoded VideoFrames.
 *
 * Manages memory-efficient storage of decoded video frames with automatic
 * eviction when capacity is reached. Critical for WebCodecs performance:
 * - Cache hits: <10ms (instant frame display)
 * - Cache misses: <300ms (decode from nearest keyframe with GOP=30)
 *
 * MEMORY MANAGEMENT CRITICAL:
 * VideoFrame objects consume GPU/RAM and MUST be explicitly released via
 * .close() to prevent memory leaks. This cache ensures .close() is called
 * during eviction and cleanup.
 */
export class FrameCache {
  private cache = new Map<number, VideoFrame>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  /**
   * Create a new frame cache.
   *
   * @param maxSize - Maximum number of frames to cache (default: 120)
   *                  120 frames @ 30fps = 4 seconds of video
   *                  ~120MB memory @ 1080p (~1MB per frame)
   */
  constructor(maxSize: number = 120) {
    this.maxSize = maxSize;
  }

  /**
   * Retrieve a frame from cache.
   *
   * @param frameIndex - Frame index to retrieve
   * @returns The cached VideoFrame, or undefined if not in cache
   *
   * Note: Moves frame to end of cache (most recently used) to prevent eviction.
   * Updates hit/miss statistics.
   */
  get(frameIndex: number): VideoFrame | undefined {
    const frame = this.cache.get(frameIndex);

    if (frame) {
      this.hits++;

      // Move to end (most recently used) - JavaScript Map maintains insertion order
      this.cache.delete(frameIndex);
      this.cache.set(frameIndex, frame);

      return frame;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Add a frame to the cache.
   *
   * If cache is at capacity, evicts the least recently used frame.
   * CRITICAL: Calls .close() on evicted frame to release memory.
   *
   * @param frameIndex - Frame index to cache
   * @param frame - Decoded VideoFrame to cache
   */
  set(frameIndex: number, frame: VideoFrame): void {
    // Remove if already exists (to re-insert at end)
    if (this.cache.has(frameIndex)) {
      this.cache.delete(frameIndex);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKeyResult = this.cache.keys().next();
      if (!oldestKeyResult.done) {
        const oldestKey = oldestKeyResult.value;
        const oldestFrame = this.cache.get(oldestKey);

        if (oldestFrame) {
          // CRITICAL: Release VideoFrame memory to prevent leak
          oldestFrame.close();
          this.cache.delete(oldestKey);
        }
      }
    }

    // Add to end (most recently used)
    this.cache.set(frameIndex, frame);
  }

  /**
   * Check if a frame is in the cache.
   *
   * @param frameIndex - Frame index to check
   * @returns true if frame is cached, false otherwise
   */
  has(frameIndex: number): boolean {
    return this.cache.has(frameIndex);
  }

  /**
   * Clear all cached frames.
   *
   * CRITICAL: Releases all VideoFrame memory to prevent leaks.
   * Call this when:
   * - Switching videos
   * - Component unmount
   * - Error recovery
   */
  clear(): void {
    // Release all VideoFrame memory
    for (const frame of this.cache.values()) {
      frame.close();
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get current cache size.
   *
   * @returns Number of frames currently cached
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache metrics including size, utilization, and hit rate
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilizationPercent: number;
    hits: number;
    misses: number;
    hitRatePercent: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: (this.cache.size / this.maxSize) * 100,
      hits: this.hits,
      misses: this.misses,
      hitRatePercent: hitRate,
    };
  }

  /**
   * Reset hit/miss statistics without clearing cache.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
