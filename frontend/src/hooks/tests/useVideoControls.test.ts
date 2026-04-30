/**
 * Unit Tests for useVideoControls Hook
 *
 * Tests all playback control operations extracted from the
 * DualVideoSynchronizer monolith into a reusable hook.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVideoControls } from "../useVideoControls";
import type { UseWebCodecsDecoderResult } from "../useWebCodecsDecoder";

// ---- Mock helpers ----

/**
 * Create a mock video decoder result with configurable behavior.
 */
const createMockDecoder = (overrides: Partial<UseWebCodecsDecoderResult> = {}): UseWebCodecsDecoderResult => ({
  canvasRef: { current: null },
  currentFrame: 0,
  totalFrames: 100,
  isReady: true,
  error: null,
  seekToFrame: vi.fn().mockResolvedValue(undefined),
  stepForward: vi.fn().mockResolvedValue(undefined),
  stepBackward: vi.fn().mockResolvedValue(undefined),
  cacheStats: {
    size: 0,
    maxSize: 100,
    utilizationPercent: 0,
    hits: 0,
    misses: 0,
    hitRatePercent: 0,
    evictions: 0,
  },
  lastLatencyMs: 0,
  isPlaying: false,
  playbackRate: 1.0,
  play: vi.fn(),
  pause: vi.fn(),
  setPlaybackRate: vi.fn(),
  framerate: 30,
  metadata: null,
  earlyMetadata: null,
  ...overrides,
});

/**
 * Create a React ref from a mock decoder.
 */
const createRef = (decoder: UseWebCodecsDecoderResult): React.RefObject<UseWebCodecsDecoderResult> => ({
  current: decoder,
});

// ---- Tests ----

describe("useVideoControls", () => {
  let mockDecoder: UseWebCodecsDecoderResult;
  let mockRef: React.RefObject<UseWebCodecsDecoderResult>;

  beforeEach(() => {
    mockDecoder = createMockDecoder();
    mockRef = createRef(mockDecoder);
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("2.2.2 initializes with default slider value of 0", () => {
      const { result } = renderHook(() => useVideoControls(mockRef));
      expect(result.current.sliderValue).toBe(0);
    });
  });

  describe("playPause", () => {
    it("2.2.3 toggles isPlaying state — plays if paused", () => {
      // decoder is paused by default (isPlaying: false)
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.playPause();
      });

      expect(mockDecoder.play).toHaveBeenCalledTimes(1);
      expect(mockDecoder.pause).not.toHaveBeenCalled();
    });

    it("2.2.4 playPause pauses if playing, plays if paused", () => {
      // Start with playing
      const playingDecoder = createMockDecoder({
        isPlaying: true,
      });
      const playingRef = createRef(playingDecoder);

      const { result } = renderHook(() => useVideoControls(playingRef));

      act(() => {
        result.current.playPause();
      });

      // Should pause since it was playing
      expect(playingDecoder.pause).toHaveBeenCalledTimes(1);
      expect(playingDecoder.play).not.toHaveBeenCalled();

      // Now pause it
      playingDecoder.isPlaying = false;

      act(() => {
        result.current.playPause();
      });

      // Should play since it was paused
      expect(playingDecoder.play).toHaveBeenCalledTimes(1);
    });

    it("2.2.3 does nothing when decoder ref is null", () => {
      const nullRef = createRef(null as unknown as UseWebCodecsDecoderResult);
      const { result } = renderHook(() => useVideoControls(nullRef));

      act(() => {
        result.current.playPause();
      });

      expect(mockDecoder.play).not.toHaveBeenCalled();
      expect(mockDecoder.pause).not.toHaveBeenCalled();
    });
  });

  describe("stepForward", () => {
    it("2.2.5 increments current frame by 1 when coarse=false", async () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepForward(false);
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(1);
    });

    it("2.2.6 increments current frame by 5 when coarse=true", async () => {
      mockDecoder.currentFrame = 10;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepForward(true);
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(15);
    });

    it("2.2.9 step handlers pause video before seeking", async () => {
      const playingDecoder = createMockDecoder({
        isPlaying: true,
      });
      const playingRef = createRef(playingDecoder);
      const { result } = renderHook(() => useVideoControls(playingRef));

      await act(async () => {
        await result.current.stepForward(false);
      });

      expect(playingDecoder.pause).toHaveBeenCalledTimes(1);
      expect(playingDecoder.seekToFrame).toHaveBeenCalled();
    });

    it("2.2.14 step forward respects upper frame boundary", async () => {
      mockDecoder.currentFrame = 98;
      mockDecoder.totalFrames = 100;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepForward(false);
      });

      // Should clamp to totalFrames - 1
      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(99);
    });

    it("2.2.14 step forward with coarse clamps to max frame", async () => {
      mockDecoder.currentFrame = 97;
      mockDecoder.totalFrames = 100;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepForward(true);
      });

      // 97 + 5 = 102, but max is 99
      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(99);
    });

    it("2.2.9 does nothing when decoder ref is null", async () => {
      const nullRef = createRef(null as unknown as UseWebCodecsDecoderResult);
      const { result } = renderHook(() => useVideoControls(nullRef));

      await act(async () => {
        await result.current.stepForward(false);
      });

      expect(mockDecoder.seekToFrame).not.toHaveBeenCalled();
    });
  });

  describe("stepBackward", () => {
    it("2.2.7 decrements current frame by 1 when coarse=false", async () => {
      mockDecoder.currentFrame = 50;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepBackward(false);
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(49);
    });

    it("2.2.8 decrements current frame by 5 when coarse=true", async () => {
      mockDecoder.currentFrame = 20;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepBackward(true);
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(15);
    });

    it("2.2.9 step handlers pause video before seeking", async () => {
      const playingDecoder = createMockDecoder({
        isPlaying: true,
      });
      const playingRef = createRef(playingDecoder);
      const { result } = renderHook(() => useVideoControls(playingRef));

      await act(async () => {
        await result.current.stepBackward(false);
      });

      expect(playingDecoder.pause).toHaveBeenCalledTimes(1);
    });

    it("2.2.14 step backward respects lower frame boundary (0)", async () => {
      mockDecoder.currentFrame = 2;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepBackward(false);
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(1);
    });

    it("2.2.14 step backward with coarse clamps to 0", async () => {
      mockDecoder.currentFrame = 3;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepBackward(true);
      });

      // 3 - 5 = -2, clamped to 0
      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(0);
    });

    it("2.2.9 does nothing when at frame 0", async () => {
      mockDecoder.currentFrame = 0;
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.stepBackward(false);
      });

      // Should still call seekToFrame with 0
      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(0);
    });

    it("2.2.9 does nothing when decoder ref is null", async () => {
      const nullRef = createRef(null as unknown as UseWebCodecsDecoderResult);
      const { result } = renderHook(() => useVideoControls(nullRef));

      await act(async () => {
        await result.current.stepBackward(false);
      });

      expect(mockDecoder.seekToFrame).not.toHaveBeenCalled();
    });
  });

  describe("onSliderChange", () => {
    it("2.2.11 updates slider value without seeking", () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.onSliderChange(42);
      });

      expect(result.current.sliderValue).toBe(42);
      expect(mockDecoder.seekToFrame).not.toHaveBeenCalled();
    });

    it("2.2.11 updates slider value multiple times during drag", () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.onSliderChange(10);
      });
      expect(result.current.sliderValue).toBe(10);

      act(() => {
        result.current.onSliderChange(25);
      });
      expect(result.current.sliderValue).toBe(25);

      act(() => {
        result.current.onSliderChange(75);
      });
      expect(result.current.sliderValue).toBe(75);
    });
  });

  describe("onSliderRelease", () => {
    it("2.2.12 seeks to slider value", async () => {
      mockDecoder.currentFrame = 0;
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.onSliderChange(50);
      });

      await act(async () => {
        await result.current.onSliderRelease();
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(50);
    });

    it("2.2.12 pauses video before seeking", async () => {
      const playingDecoder = createMockDecoder({
        isPlaying: true,
        currentFrame: 0,
      });
      const playingRef = createRef(playingDecoder);
      const { result } = renderHook(() => useVideoControls(playingRef));

      act(() => {
        result.current.onSliderChange(30);
      });

      await act(async () => {
        await result.current.onSliderRelease();
      });

      expect(playingDecoder.pause).toHaveBeenCalledTimes(1);
      expect(playingDecoder.seekToFrame).toHaveBeenCalledWith(30);
    });

    it("2.2.12 uses the latest slider value", async () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.onSliderChange(10);
      });
      act(() => {
        result.current.onSliderChange(80);
      });

      await act(async () => {
        await result.current.onSliderRelease();
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(80);
    });

    it("2.2.12 does nothing when decoder ref is null", async () => {
      const nullRef = createRef(null as unknown as UseWebCodecsDecoderResult);
      const { result } = renderHook(() => useVideoControls(nullRef));

      act(() => {
        result.current.onSliderChange(50);
      });

      await act(async () => {
        await result.current.onSliderRelease();
      });

      expect(mockDecoder.seekToFrame).not.toHaveBeenCalled();
    });
  });

  describe("onSpeedChange", () => {
    it("2.2.13 updates playback rate", () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.onSpeedChange(1.5);
      });

      expect(mockDecoder.setPlaybackRate).toHaveBeenCalledWith(1.5);
    });

    it("2.2.13 updates playback rate to 0.5x", () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.onSpeedChange(0.5);
      });

      expect(mockDecoder.setPlaybackRate).toHaveBeenCalledWith(0.5);
    });

    it("2.2.13 updates playback rate to 2.0x", () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      act(() => {
        result.current.onSpeedChange(2.0);
      });

      expect(mockDecoder.setPlaybackRate).toHaveBeenCalledWith(2.0);
    });

    it("2.2.13 does nothing when decoder ref is null", () => {
      const nullRef = createRef(null as unknown as UseWebCodecsDecoderResult);
      const { result } = renderHook(() => useVideoControls(nullRef));

      act(() => {
        result.current.onSpeedChange(1.5);
      });

      expect(mockDecoder.setPlaybackRate).not.toHaveBeenCalled();
    });
  });

  describe("seekToFrame", () => {
    it("2.2.10 pauses video before seeking", async () => {
      const playingDecoder = createMockDecoder({
        isPlaying: true,
      });
      const playingRef = createRef(playingDecoder);
      const { result } = renderHook(() => useVideoControls(playingRef));

      await act(async () => {
        await result.current.seekToFrame(25);
      });

      expect(playingDecoder.pause).toHaveBeenCalledTimes(1);
      expect(playingDecoder.seekToFrame).toHaveBeenCalledWith(25);
    });

    it("2.2.10 seeks to exact frame", async () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.seekToFrame(42);
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(42);
    });

    it("2.2.10 seeks to frame 0", async () => {
      const { result } = renderHook(() => useVideoControls(mockRef));

      await act(async () => {
        await result.current.seekToFrame(0);
      });

      expect(mockDecoder.seekToFrame).toHaveBeenCalledWith(0);
    });

    it("2.2.10 does nothing when decoder ref is null", async () => {
      const nullRef = createRef(null as unknown as UseWebCodecsDecoderResult);
      const { result } = renderHook(() => useVideoControls(nullRef));

      await act(async () => {
        await result.current.seekToFrame(50);
      });

      expect(mockDecoder.seekToFrame).not.toHaveBeenCalled();
    });
  });

  describe("stable references (useCallback)", () => {
    it("2.2.15 hook returns consistent references across re-renders", () => {
      const { result, rerender } = renderHook(() => useVideoControls(mockRef));

      const firstPlayPause = result.current.playPause;
      const firstStepForward = result.current.stepForward;
      const firstStepBackward = result.current.stepBackward;
      const firstOnSliderChange = result.current.onSliderChange;
      const firstOnSliderRelease = result.current.onSliderRelease;
      const firstOnSpeedChange = result.current.onSpeedChange;
      const firstSeekToFrame = result.current.seekToFrame;

      // Rerender with same ref
      rerender();

      expect(result.current.playPause).toBe(firstPlayPause);
      expect(result.current.stepForward).toBe(firstStepForward);
      expect(result.current.stepBackward).toBe(firstStepBackward);
      expect(result.current.onSliderChange).toBe(firstOnSliderChange);
      expect(result.current.onSliderRelease).toBe(firstOnSliderRelease);
      expect(result.current.onSpeedChange).toBe(firstOnSpeedChange);
      expect(result.current.seekToFrame).toBe(firstSeekToFrame);
    });

    it("2.2.15 sliderValue changes trigger re-render but handlers stay stable", () => {
      const { result, rerender } = renderHook(() => useVideoControls(mockRef));

      const playPauseBefore = result.current.playPause;

      act(() => {
        result.current.onSliderChange(50);
      });

      rerender();

      expect(result.current.sliderValue).toBe(50);
      expect(result.current.playPause).toBe(playPauseBefore);
    });
  });
});
