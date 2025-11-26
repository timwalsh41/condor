import { BiDirectionalMap } from './BiDirectionalMap';
import type { MP4BoxSDK } from '../types/mp4box';

/**
 * CoordinateMapping - Encapsulates the 3-way isomorphism between video coordinate systems.
 *
 * Video frames exist in three coordinate systems:
 * 1. Frame Number (presentation order): 0, 1, 2, 3... - sequential integers shown to user
 * 2. CTS (composition timestamp): 0, 3000, 6000, 9000... - MP4 timescale units for presentation
 * 3. Sample Index (decode order): 0, 1, 2, 3... - position in samples[] array
 *
 * These form a 3-way isomorphism where each value in one system maps to exactly one value
 * in the others. This class provides O(1) lookups in all 6 directions.
 *
 * Benefits:
 * - All conversions are O(1) (direct lookups: 1 hop, composed lookups: 2 hops)
 * - Makes the 3-way relationship explicit in the architecture
 * - Impossible for mappings to get out of sync
 * - Clear, readable API vs manual map operations
 * - Single source of truth for coordinate conversions
 */
export class CoordinateMapping {
  // Frame Number ↔ CTS (bidirectional, O(1) both ways)
  private frameCts = new BiDirectionalMap<number, number>();

  // CTS → Sample Index (O(1) forward)
  private ctsToSample = new Map<number, number>();

  // Reference to samples array for Sample Index → CTS (O(1) via array access)
  private samples: MP4BoxSDK.Sample[];

  /**
   * Initialize the coordinate mapping with the samples array.
   *
   * @param samples - The MP4 samples array (decode order)
   */
  constructor(samples: MP4BoxSDK.Sample[]) {
    this.samples = samples;
  }

  /**
   * Establish a complete 3-way mapping between all coordinate systems.
   *
   * @param frameNum - Frame number (presentation order)
   * @param cts - Composition timestamp (MP4 timescale units)
   * @param sampleIdx - Sample index (decode order, position in samples array)
   */
  set(frameNum: number, cts: number, sampleIdx: number): void {
    this.frameCts.set(frameNum, cts);
    this.ctsToSample.set(cts, sampleIdx);
  }

  // ============================================================================
  // Frame Number ↔ CTS (O(1) bidirectional)
  // ============================================================================

  /**
   * Get CTS from frame number (presentation → timestamp).
   *
   * @param frameNum - Frame number (presentation order)
   * @returns CTS (composition timestamp), or undefined if not found
   */
  getCts(frameNum: number): number | undefined {
    return this.frameCts.get(frameNum);
  }

  /**
   * Get frame number from CTS (timestamp → presentation).
   *
   * @param cts - CTS (composition timestamp)
   * @returns Frame number (presentation order), or undefined if not found
   */
  getFrame(cts: number): number | undefined {
    return this.frameCts.getReverse(cts);
  }

  // ============================================================================
  // CTS ↔ Sample Index (O(1) bidirectional)
  // ============================================================================

  /**
   * Get sample index from CTS (timestamp → decode order).
   *
   * @param cts - CTS (composition timestamp)
   * @returns Sample index (decode order), or undefined if not found
   */
  getSample(cts: number): number | undefined {
    return this.ctsToSample.get(cts);
  }

  /**
   * Get CTS from sample index (decode order → timestamp).
   *
   * @param sampleIdx - Sample index (decode order)
   * @returns CTS (composition timestamp)
   */
  getCtsFromSample(sampleIdx: number): number {
    return this.samples[sampleIdx].cts;
  }

  // ============================================================================
  // Frame Number ↔ Sample Index (O(1) composed - 2 hops)
  // ============================================================================

  /**
   * Get sample index from frame number (presentation → decode order).
   * Composed lookup: frameNum → CTS → sampleIdx (2 hops, still O(1)).
   *
   * @param frameNum - Frame number (presentation order)
   * @returns Sample index (decode order), or undefined if not found
   */
  getSampleFromFrame(frameNum: number): number | undefined {
    const cts = this.getCts(frameNum);
    return cts !== undefined ? this.getSample(cts) : undefined;
  }

  /**
   * Get frame number from sample index (decode order → presentation).
   * Composed lookup: sampleIdx → CTS → frameNum (2 hops, still O(1)).
   *
   * @param sampleIdx - Sample index (decode order)
   * @returns Frame number (presentation order), or undefined if not found
   */
  getFrameFromSample(sampleIdx: number): number | undefined {
    const cts = this.getCtsFromSample(sampleIdx);
    return this.getFrame(cts);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Clear all mappings.
   */
  clear(): void {
    this.frameCts.clear();
    this.ctsToSample.clear();
  }

  /**
   * Get the total number of mapped frames.
   */
  get size(): number {
    return this.frameCts.size;
  }

  /**
   * Check if a frame number exists in the mapping.
   *
   * @param frameNum - Frame number to check
   * @returns true if the frame is mapped
   */
  hasFrame(frameNum: number): boolean {
    return this.frameCts.has(frameNum);
  }

  /**
   * Check if a CTS exists in the mapping.
   *
   * @param cts - CTS to check
   * @returns true if the CTS is mapped
   */
  hasCts(cts: number): boolean {
    return this.frameCts.hasReverse(cts);
  }

  /**
   * Check if a sample index exists in the mapping.
   *
   * @param sampleIdx - Sample index to check
   * @returns true if the sample is mapped
   */
  hasSample(sampleIdx: number): boolean {
    return sampleIdx >= 0 && sampleIdx < this.samples.length;
  }
}
