// @ts-nocheck
/**
 * MP4Parser Unit Tests
 *
 * Tests MP4 container parsing functionality with H.264 and H.265 test videos.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { MP4Parser, MP4ParseError } from '../MP4Parser';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Test video paths
const TEST_VIDEOS_DIR = resolve(__dirname, '../../../../tests/fixtures/videos');
const H264_VIDEO_PATH = resolve(TEST_VIDEOS_DIR, 'test_30fps_10s.mp4');
const H265_VIDEO_PATH = resolve(TEST_VIDEOS_DIR, 'test_30fps_10s_hevc.mp4');

/**
 * Helper function to load test video file
 */
async function loadTestVideo(path: string): Promise<File> {
  const buffer = readFileSync(path);
  const blob = new Blob([buffer], { type: 'video/mp4' });
  return new File([blob], path.split('/').pop() || 'test.mp4', {
    type: 'video/mp4'
  });
}

describe('MP4Parser', () => {
  let h264File: File;
  let h265File: File;

  beforeAll(async () => {
    // Load test videos once for all tests
    h264File = await loadTestVideo(H264_VIDEO_PATH);
    h265File = await loadTestVideo(H265_VIDEO_PATH);
  });

  describe('H.264 (AVC) Parsing', () => {
    test('should parse H.264 MP4 file successfully', async () => {
      const parser = new MP4Parser();
      await expect(parser.initialize(h264File)).resolves.toBeUndefined();
    });

    test('should extract valid codec configuration for H.264', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const config = parser.getCodecConfig();

      expect(config).toBeDefined();
      expect(config.codec).toBeDefined();
      expect(config.codec).toMatch(/^avc1\./); // H.264 codec starts with "avc1."
      expect(config.codedWidth).toBeGreaterThan(0);
      expect(config.codedHeight).toBeGreaterThan(0);
      expect(config.description).toBeInstanceOf(Uint8Array);
      expect(config.description.length).toBeGreaterThan(0);
    });

    test('should extract samples for H.264', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const samples = parser.getSamples();

      expect(samples).toBeDefined();
      expect(samples.length).toBeGreaterThan(0);

      // Validate sample structure
      const firstSample = samples[0];
      expect(firstSample).toHaveProperty('number');
      expect(firstSample).toHaveProperty('cts');
      expect(firstSample).toHaveProperty('dts');
      expect(firstSample).toHaveProperty('size');
      expect(firstSample).toHaveProperty('data');
      expect(firstSample).toHaveProperty('is_sync'); // keyframe flag
    });

    test('should return accurate frame count for H.264', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const frameCount = parser.getFrameCount();
      const samples = parser.getSamples();

      expect(frameCount).toBe(samples.length);
      expect(frameCount).toBeGreaterThan(0);

      // 30fps * 10s = 300 frames expected
      expect(frameCount).toBe(300);
    });

    test('should have at least one keyframe in H.264 samples', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const samples = parser.getSamples();
      const keyframes = samples.filter((s) => s.is_sync);

      expect(keyframes.length).toBeGreaterThan(0);
    });
  });

  describe('H.265 (HEVC) Parsing', () => {
    test('should parse H.265 MP4 file successfully', async () => {
      const parser = new MP4Parser();
      await expect(parser.initialize(h265File)).resolves.toBeUndefined();
    });

    test('should extract valid codec configuration for H.265', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h265File);

      const config = parser.getCodecConfig();

      expect(config).toBeDefined();
      expect(config.codec).toBeDefined();
      // H.265 codec starts with "hvc1." or "hev1."
      expect(config.codec).toMatch(/^(hvc1\.|hev1\.)/);
      expect(config.codedWidth).toBeGreaterThan(0);
      expect(config.codedHeight).toBeGreaterThan(0);
      expect(config.description).toBeInstanceOf(Uint8Array);
      expect(config.description.length).toBeGreaterThan(0);
    });

    test('should extract samples for H.265', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h265File);

      const samples = parser.getSamples();

      expect(samples).toBeDefined();
      expect(samples.length).toBeGreaterThan(0);
    });

    test('should return accurate frame count for H.265', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h265File);

      const frameCount = parser.getFrameCount();
      const samples = parser.getSamples();

      expect(frameCount).toBe(samples.length);
      expect(frameCount).toBeGreaterThan(0);

      // 30fps * 10s = 300 frames expected
      expect(frameCount).toBe(300);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when calling getCodecConfig() before initialize()', () => {
      const parser = new MP4Parser();

      expect(() => parser.getCodecConfig()).toThrow(MP4ParseError);
      expect(() => parser.getCodecConfig()).toThrow('not initialized');
    });

    test('should throw error when calling getSamples() before initialize()', () => {
      const parser = new MP4Parser();

      expect(() => parser.getSamples()).toThrow(MP4ParseError);
    });

    test('should throw error when calling getFrameCount() before initialize()', () => {
      const parser = new MP4Parser();

      expect(() => parser.getFrameCount()).toThrow(MP4ParseError);
      expect(() => parser.getFrameCount()).toThrow('not initialized');
    });

    test('should reject with error for invalid file', { timeout: 10000 }, async () => {
      const parser = new MP4Parser();

      // Create invalid file (not an MP4)
      const invalidBlob = new Blob(['not an mp4 file'], { type: 'video/mp4' });
      const invalidFile = new File([invalidBlob], 'invalid.mp4', {
        type: 'video/mp4'
      });

      await expect(parser.initialize(invalidFile)).rejects.toThrow(MP4ParseError);
    });

    test('should reject with error for empty file', { timeout: 10000 }, async () => {
      const parser = new MP4Parser();

      const emptyBlob = new Blob([], { type: 'video/mp4' });
      const emptyFile = new File([emptyBlob], 'empty.mp4', { type: 'video/mp4' });

      await expect(parser.initialize(emptyFile)).rejects.toThrow(MP4ParseError);
    });
  });

  describe('Track Information', () => {
    test('should provide video track information', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const trackInfo = parser.getVideoTrackInfo();

      expect(trackInfo).toBeDefined();
      expect(trackInfo.id).toBeDefined();
      expect(trackInfo.video).toBeDefined();
      expect(trackInfo.video.width).toBeGreaterThan(0);
      expect(trackInfo.video.height).toBeGreaterThan(0);
      expect(trackInfo.nb_samples).toBeGreaterThan(0);
    });

    test('should provide MP4 file information', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const fileInfo = parser.getFileInfo();

      expect(fileInfo).toBeDefined();
      expect(fileInfo.videoTracks).toBeDefined();
      expect(fileInfo.videoTracks.length).toBeGreaterThan(0);
      expect(fileInfo.duration).toBeGreaterThan(0);
    });
  });

  describe('Video Metadata', () => {
    test('should extract correct framerate from H.264 video', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const framerate = parser.getFramerate();

      // Test video is 30fps
      expect(framerate).toBeCloseTo(30, 1);
    });

    test('should extract correct framerate from H.265 video', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h265File);

      const framerate = parser.getFramerate();

      // Test video is 30fps
      expect(framerate).toBeCloseTo(30, 1);
    });

    test('should calculate GOP size from keyframe intervals', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const gopSize = parser.getGopSize();

      // GOP size should be reasonable (typically 15-60 for 30fps video)
      expect(gopSize).toBeGreaterThan(0);
      expect(gopSize).toBeLessThanOrEqual(300); // Should not exceed total frames
    });

    test('should throw error when calling getFramerate() before initialize()', () => {
      const parser = new MP4Parser();

      expect(() => parser.getFramerate()).toThrow(MP4ParseError);
      expect(() => parser.getFramerate()).toThrow('not initialized');
    });

    test('should throw error when calling getGopSize() before initialize()', () => {
      const parser = new MP4Parser();

      expect(() => parser.getGopSize()).toThrow(MP4ParseError);
      expect(() => parser.getGopSize()).toThrow('No samples available');
    });

    test('should handle videos with single keyframe', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const gopSize = parser.getGopSize();
      const samples = parser.getSamples();

      // If only one keyframe, GOP size equals total frames
      const keyframes = samples.filter((s) => s.is_sync);
      if (keyframes.length === 1) {
        expect(gopSize).toBe(samples.length);
      } else {
        expect(gopSize).toBeGreaterThan(0);
        expect(gopSize).toBeLessThan(samples.length);
      }
    });
  });

  describe('Sample Properties', () => {
    test('samples should be in decode order', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const samples = parser.getSamples();

      // Samples should be numbered sequentially starting from 0
      for (let i = 0; i < samples.length; i++) {
        expect(samples[i].number).toBe(i);
      }
    });

    test('samples should have valid timestamps', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const samples = parser.getSamples();

      // All samples should have valid CTS and DTS
      for (const sample of samples) {
        expect(sample.cts).toBeGreaterThanOrEqual(0);
        expect(sample.dts).toBeGreaterThanOrEqual(0);
        expect(sample.duration).toBeGreaterThan(0);
      }

      // DTS should be non-decreasing (decode order)
      // Note: CTS can go backwards due to B-frames, so we check DTS instead
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i].dts).toBeGreaterThanOrEqual(samples[i - 1].dts);
      }
    });

    test('samples should have valid data', async () => {
      const parser = new MP4Parser();
      await parser.initialize(h264File);

      const samples = parser.getSamples();

      // All samples should have data matching their size
      for (const sample of samples) {
        // Sample data is Uint8Array
        expect(sample.data).toBeInstanceOf(Uint8Array);
        expect(sample.data.byteLength).toBe(sample.size);
        expect(sample.size).toBeGreaterThan(0);
      }
    });
  });
});
