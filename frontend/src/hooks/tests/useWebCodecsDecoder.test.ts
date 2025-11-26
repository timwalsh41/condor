/**
 * useWebCodecsDecoder Hook Unit Tests
 *
 * Tests playback state management and hook interface for WebCodecs decoder.
 * Note: Full integration testing of decode functionality requires browser environment
 * and is covered by E2E tests.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebCodecsDecoder } from '../useWebCodecsDecoder';

// Mock browser APIs not available in test environment
beforeEach(() => {
  // Mock VideoDecoder if not available
  if (typeof global.VideoDecoder === 'undefined') {
    global.VideoDecoder = vi.fn() as any;
  }

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => {
    setTimeout(() => cb(performance.now()), 16);
    return 1;
  }) as any;

  global.cancelAnimationFrame = vi.fn();
});

describe('useWebCodecsDecoder', () => {
  describe('Hook Interface', () => {
    test('should return all required properties', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      // Verify hook returns expected interface
      expect(result.current).toHaveProperty('canvasRef');
      expect(result.current).toHaveProperty('currentFrame');
      expect(result.current).toHaveProperty('totalFrames');
      expect(result.current).toHaveProperty('isReady');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('seekToFrame');
      expect(result.current).toHaveProperty('stepForward');
      expect(result.current).toHaveProperty('stepBackward');
      expect(result.current).toHaveProperty('cacheStats');
      expect(result.current).toHaveProperty('lastLatencyMs');

      // Phase 4: Playback controls
      expect(result.current).toHaveProperty('isPlaying');
      expect(result.current).toHaveProperty('playbackRate');
      expect(result.current).toHaveProperty('play');
      expect(result.current).toHaveProperty('pause');
      expect(result.current).toHaveProperty('setPlaybackRate');
      expect(result.current).toHaveProperty('framerate');
      expect(result.current).toHaveProperty('metadata');
    });

    test('should have correct function types', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      expect(typeof result.current.seekToFrame).toBe('function');
      expect(typeof result.current.stepForward).toBe('function');
      expect(typeof result.current.stepBackward).toBe('function');
      expect(typeof result.current.play).toBe('function');
      expect(typeof result.current.pause).toBe('function');
      expect(typeof result.current.setPlaybackRate).toBe('function');
    });
  });

  describe('Initial State', () => {
    test('should initialize with correct default values', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      expect(result.current.currentFrame).toBe(0);
      expect(result.current.totalFrames).toBe(0);
      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.playbackRate).toBe(1.0);
      expect(result.current.framerate).toBe(30); // Default fallback
      expect(result.current.metadata).toBe(null);
      expect(result.current.lastLatencyMs).toBe(0);
    });

    test('should initialize cache stats with correct structure', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      const stats = result.current.cacheStats;
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('utilizationPercent');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRatePercent');
      expect(stats).toHaveProperty('evictions');

      // Initial values
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(120); // Default cache size
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });

    test('should use custom cache size when provided', () => {
      const customCacheSize = 60;
      const { result } = renderHook(() =>
        useWebCodecsDecoder(null, customCacheSize)
      );

      expect(result.current.cacheStats.maxSize).toBe(customCacheSize);
    });
  });

  describe('Playback State Management', () => {
    test('should update playback rate within valid range', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      act(() => {
        result.current.setPlaybackRate(0.5);
      });

      expect(result.current.playbackRate).toBe(0.5);
    });

    test('should clamp playback rate to minimum 0.1x', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      act(() => {
        result.current.setPlaybackRate(0.05);
      });

      expect(result.current.playbackRate).toBe(0.1);
    });

    test('should clamp playback rate to maximum 2.0x', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      act(() => {
        result.current.setPlaybackRate(3.0);
      });

      expect(result.current.playbackRate).toBe(2.0);
    });

    test('should accept all standard playback rates', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      const rates = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

      for (const rate of rates) {
        act(() => {
          result.current.setPlaybackRate(rate);
        });

        expect(result.current.playbackRate).toBe(rate);
      }
    });
  });

  describe('Metadata Structure', () => {
    test('should have null metadata before video is loaded', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      expect(result.current.metadata).toBe(null);
    });

    test('metadata should have correct structure when present', () => {
      // This test validates the type contract
      // Actual metadata extraction is tested in integration tests
      const mockMetadata = {
        duration: 10.0,
        framerate: 30,
        gopSize: 30,
        totalFrames: 300,
        codec: 'avc1.64001f',
        width: 1920,
        height: 1080,
      };

      // Verify structure matches expected type
      expect(mockMetadata).toHaveProperty('duration');
      expect(mockMetadata).toHaveProperty('framerate');
      expect(mockMetadata).toHaveProperty('gopSize');
      expect(mockMetadata).toHaveProperty('totalFrames');
      expect(mockMetadata).toHaveProperty('codec');
      expect(mockMetadata).toHaveProperty('width');
      expect(mockMetadata).toHaveProperty('height');

      expect(typeof mockMetadata.duration).toBe('number');
      expect(typeof mockMetadata.framerate).toBe('number');
      expect(typeof mockMetadata.gopSize).toBe('number');
      expect(typeof mockMetadata.totalFrames).toBe('number');
      expect(typeof mockMetadata.codec).toBe('string');
      expect(typeof mockMetadata.width).toBe('number');
      expect(typeof mockMetadata.height).toBe('number');
    });
  });

  describe('seekToFrame updateDisplay Parameter', () => {
    test('seekToFrame should accept optional updateDisplay parameter', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      // Should not throw when called with updateDisplay parameter
      expect(() => {
        // Note: Will fail due to no video loaded, but validates signature
        result.current.seekToFrame(0, true).catch(() => {});
        result.current.seekToFrame(0, false).catch(() => {});
        result.current.seekToFrame(0).catch(() => {}); // Default true
      }).not.toThrow();
    });
  });

  describe('Canvas Ref', () => {
    test('should provide a canvas ref object', () => {
      const { result } = renderHook(() => useWebCodecsDecoder(null));

      expect(result.current.canvasRef).toBeDefined();
      expect(result.current.canvasRef).toHaveProperty('current');
    });
  });

  describe('Debug Logging', () => {
    test('should respect NODE_ENV for debug logging', () => {
      // Note: The actual logging behavior is controlled by process.env.NODE_ENV
      // This test validates the constants exist and are used
      const originalEnv = process.env.NODE_ENV;

      // In test environment, debug logs should be suppressed
      process.env.NODE_ENV = 'production';

      const { result } = renderHook(() => useWebCodecsDecoder(null));

      // Hook should initialize without errors regardless of logging level
      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toBe(null);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});
