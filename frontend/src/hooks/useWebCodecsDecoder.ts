import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { MP4Parser } from "../utils/MP4Parser";
import { FrameCache } from "../utils/FrameCache";
import type { Sample } from "mp4box";

/**
 * Hook interface for WebCodecs video decoder with frame-accurate control.
 */
export interface UseWebCodecsDecoderResult {
  /** Canvas ref to render decoded frames */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Current frame index (0-based) */
  currentFrame: number;
  /** Total number of frames in video */
  totalFrames: number;
  /** True when decoder is ready for use */
  isReady: boolean;
  /** Error message if initialization or decode fails */
  error: string | null;
  /** Seek to specific frame index (0-based) */
  seekToFrame: (frameIndex: number) => Promise<void>;
  /** Step forward one frame */
  stepForward: () => Promise<void>;
  /** Step backward one frame */
  stepBackward: () => Promise<void>;
  /** Cache statistics */
  cacheStats: {
    size: number;
    maxSize: number;
    utilizationPercent: number;
    hits: number;
    misses: number;
    hitRatePercent: number;
  };
  /** Last operation latency in milliseconds */
  lastLatencyMs: number;
}

/**
 * React hook for WebCodecs-based frame-accurate video decoding.
 *
 * Provides deterministic frame positioning (0 frame error) for dual-video
 * synchronization. Uses LRU cache for decoded frames with GOP=30 optimization.
 *
 * Performance targets:
 * - Cache hit: <10ms (instant)
 * - Cache miss: <300ms (max 30 frames from keyframe with GOP=30)
 * - Memory: 60-120MB (bounded by cache size)
 *
 * @param videoFile - MP4 video file to decode
 * @param cacheSize - Maximum frames to cache (default: 120)
 * @returns Hook interface with decoder controls and state
 */
export function useWebCodecsDecoder(
  videoFile: File | null,
  cacheSize: number = 120
): UseWebCodecsDecoderResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const cacheRef = useRef<FrameCache>(new FrameCache(cacheSize));
  const samplesRef = useRef<Sample[]>([]);
  const parserRef = useRef<MP4Parser | null>(null);

  // Track which frame we're seeking to (for output callback)
  const seekTargetRef = useRef<number | null>(null);

  // Map timestamp to sample index (for frame identification in output callback)
  const timestampToIndexRef = useRef<Map<number, number>>(new Map());

  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState(cacheRef.current.getStats());
  const [lastLatencyMs, setLastLatencyMs] = useState(0);

  // Promise chain for sequential operation processing
  // Reason: Queue all seek operations to process them sequentially,
  // preventing dropped requests when user rapidly presses step buttons
  const pendingOperationRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Find nearest keyframe at or before target frame number.
   *
   * Strategy: Find the sample with the target frame number (via timestamp),
   * then walk backward through samples (in decode order) until we find a keyframe.
   * This ensures we decode all dependencies.
   *
   * @param targetFrameNumber - Presentation frame number to seek to (0-based)
   * @returns Sample index of nearest keyframe in decode order
   */
  const findNearestKeyframe = useCallback(
    (targetFrameNumber: number): number => {
      const samples = samplesRef.current;
      if (samples.length === 0) return 0;

      // Find timestamp for this frame number
      let targetCts = -1;
      for (const [cts, frameNum] of timestampToIndexRef.current.entries()) {
        if (frameNum === targetFrameNumber) {
          targetCts = cts;
          break;
        }
      }

      if (targetCts === -1) {
        console.warn(
          `[findNearestKeyframe] Frame ${targetFrameNumber} not found, using frame 0`
        );
        return 0;
      }

      // Find sample index with this timestamp
      let targetSampleIndex = -1;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].cts === targetCts) {
          targetSampleIndex = i;
          break;
        }
      }

      if (targetSampleIndex === -1) {
        console.warn(
          `[findNearestKeyframe] Sample with cts ${targetCts} not found, using frame 0`
        );
        return 0;
      }

      // Walk backward in decode order to find keyframe
      for (let i = targetSampleIndex; i >= 0; i--) {
        if (samples[i].is_sync) {
          return i;
        }
      }

      return 0;
    },
    []
  );

  /**
   * Render a VideoFrame to canvas.
   *
   * @param frame - VideoFrame to render
   */
  const renderFrameToCanvas = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      console.warn("[RENDER] Canvas not available!");
      return;
    }

    // Set canvas dimensions to match video on first render
    if (
      canvas.width !== frame.displayWidth ||
      canvas.height !== frame.displayHeight
    ) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[RENDER] Could not get 2d context!");
      return;
    }

    // Render frame to canvas
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
  }, []);

  /**
   * Create EncodedVideoChunk from MP4 sample.
   *
   * @param sample - MP4 sample containing frame data
   * @returns EncodedVideoChunk for VideoDecoder
   */
  const createEncodedChunk = useCallback(
    (sample: Sample): EncodedVideoChunk => {
      return new EncodedVideoChunk({
        type: sample.is_sync ? "key" : "delta",
        timestamp: sample.cts,
        duration: sample.duration,
        data: sample.data,
      });
    },
    []
  );

  /**
   * Seek to specific frame with keyframe-aware decoding.
   *
   * Optimizations:
   * - Cache hit: Instant (<10ms) - render cached frame immediately
   * - Cache miss: <300ms worst case (decode from keyframe with GOP=30)
   * - Read-ahead: Decode target + 5 frames to warm cache for forward stepping
   *
   * Operations are queued and processed sequentially to handle rapid
   * button presses (e.g., user presses step forward 3 times quickly).
   *
   * Async decode pipeline:
   * - Issue decode commands for keyframe → target + 5
   * - Output callback fires as each frame decodes
   * - Only target frame is rendered (read-ahead frames cached only)
   * - No flush() needed - rendering happens in output callback
   *
   * @param targetFrame - Frame index to seek to (0-based)
   */
  const seekToFrame = useCallback(
    async (targetFrame: number) => {
      // Chain this operation after previous one completes
      // Reason: Prevents dropped requests from rapid button presses
      pendingOperationRef.current = pendingOperationRef.current.then(
        async () => {
          const decoder = decoderRef.current;
          const samples = samplesRef.current;
          const cache = cacheRef.current;

          if (!decoder || samples.length === 0) {
            console.warn("Decoder not ready");
            return;
          }

          const startTime = performance.now();

          try {
            // Clamp to valid range
            const clampedTarget = Math.max(
              0,
              Math.min(targetFrame, samples.length - 1)
            );

            // Check cache first (FAST PATH: <10ms)
            if (cache.has(clampedTarget)) {
              const cachedFrame = cache.get(clampedTarget)!;
              renderFrameToCanvas(cachedFrame);
              setCurrentFrame(clampedTarget);
              setCacheStats(cache.getStats());

              const latency = performance.now() - startTime;
              setLastLatencyMs(latency);
              return;
            }

            // Cache miss - decode from keyframe
            // Set target for output callback
            seekTargetRef.current = clampedTarget;

            // Find which timestamp corresponds to this frame number
            // We need to reverse lookup: frameNumber → cts
            let targetCts = -1;
            for (const [
              cts,
              frameNum,
            ] of timestampToIndexRef.current.entries()) {
              if (frameNum === clampedTarget) {
                targetCts = cts;
                break;
              }
            }

            if (targetCts === -1) {
              console.error(
                `[SEEK] Could not find timestamp for frame ${clampedTarget}`
              );
              return;
            }

            // Find target frame's sample index (in decode order)
            let targetSampleIndex = -1;
            for (let i = 0; i < samples.length; i++) {
              if (samples[i].cts === targetCts) {
                targetSampleIndex = i;
                break;
              }
            }

            if (targetSampleIndex === -1) {
              console.error(
                `Could not find sample with cts ${targetCts} for frame ${clampedTarget}`
              );
              return;
            }

            // Find keyframe sample index (in decode order, at or before target)
            const keyframeSampleIndex = findNearestKeyframe(clampedTarget);

            // Read-ahead: decode a few more samples after target for cache warming
            // Add 10 samples (not frames) to account for potential B-frame reordering
            const readAheadEnd = Math.min(
              targetSampleIndex + 10,
              samples.length - 1
            );

            // Issue decode commands from keyframe to target + read-ahead
            // Important: Decode in sample array order (decode order), not frame number order
            // Note: timestamp mapping already established during init
            for (let i = keyframeSampleIndex; i <= readAheadEnd; i++) {
              const chunk = createEncodedChunk(samples[i]);
              decoder.decode(chunk);
            }

            // NOTE: No flush() - output callback renders target frame immediately
            // Reason: flush() resets decoder state requiring next frame to be keyframe
            // Instead, output callback checks seekTargetRef and renders when target arrives

            // Latency will be measured when output callback renders
            // For now just track that decode was issued
            const latency = performance.now() - startTime;
            setLastLatencyMs(latency);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Decode error";
            setError(`Seek failed: ${message}`);
            console.error("Seek error:", err);
          }
        }
      );

      return pendingOperationRef.current;
    },
    [findNearestKeyframe, createEncodedChunk, renderFrameToCanvas]
  );

  /**
   * Step forward one frame.
   */
  const stepForward = useCallback(async () => {
    if (currentFrame < totalFrames - 1) {
      await seekToFrame(currentFrame + 1);
    }
  }, [currentFrame, totalFrames, seekToFrame]);

  /**
   * Step backward one frame.
   */
  const stepBackward = useCallback(async () => {
    if (currentFrame > 0) {
      await seekToFrame(currentFrame - 1);
    }
  }, [currentFrame, seekToFrame]);

  /**
   * Initialize decoder when video file changes.
   */
  useEffect(() => {
    if (!videoFile) {
      setIsReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    // Capture refs for cleanup
    const cache = cacheRef.current;
    const timestampMap = timestampToIndexRef.current;

    (async () => {
      try {
        setIsReady(false);
        setError(null);

        // Parse MP4 container
        const parser = new MP4Parser();
        await parser.initialize(videoFile);

        if (cancelled) return;

        parserRef.current = parser;

        // Get codec configuration and samples
        const codecConfig = parser.getCodecConfig();
        const samples = parser.getSamples();
        samplesRef.current = samples;
        setTotalFrames(samples.length);

        // Build timestamp to frame number mapping
        // Reason: sample.number is NOT presentation frame number
        // We must sort by cts (composition timestamp) to get presentation order
        const sortedByPts = [...samples]
          .map((s, idx) => ({ cts: s.cts, sampleIndex: idx }))
          .sort((a, b) => a.cts - b.cts);

        // Map ALL frames (not just first 10!)
        for (let frameNum = 0; frameNum < sortedByPts.length; frameNum++) {
          const { cts } = sortedByPts[frameNum];
          timestampToIndexRef.current.set(cts, frameNum);
        }

        // Initialize VideoDecoder
        const decoder = new VideoDecoder({
          output: (frame: VideoFrame) => {
            if (cancelled) {
              frame.close();
              return;
            }

            // Get frame index from timestamp map
            // Reason: MP4 timestamps are in track timescale, not microseconds
            const frameIndex = timestampToIndexRef.current.get(frame.timestamp);

            if (frameIndex === undefined) {
              console.warn(
                `Unknown timestamp ${frame.timestamp}, skipping frame`
              );
              frame.close();
              return;
            }

            // Clone frame for cache (original will be closed below)
            const cached = frame.clone();
            cacheRef.current.set(frameIndex, cached);

            // CRITICAL: Close original frame to release memory
            frame.close();

            // Render immediately if this is the target frame
            // Reason: Async decode pipeline - output callback fires when frame ready
            // Read-ahead frames are cached but not rendered
            if (frameIndex === seekTargetRef.current) {
              renderFrameToCanvas(cached);
              setCurrentFrame(frameIndex);
              setCacheStats(cacheRef.current.getStats());
            }
          },
          error: (err) => {
            console.error("Decoder error:", err);
            setError(`Decoder error: ${err.message}`);
          },
        });

        // Check codec support
        const support = await VideoDecoder.isConfigSupported(codecConfig);
        if (!support.supported) {
          throw new Error(`Codec not supported: ${codecConfig.codec}`);
        }

        decoder.configure(codecConfig);
        decoderRef.current = decoder;

        if (cancelled) {
          decoder.close();
          return;
        }

        // Decode first frame to initialize
        seekTargetRef.current = 0;
        // Note: timestamp mapping already set above during sorting
        const firstChunk = new EncodedVideoChunk({
          type: samples[0].is_sync ? "key" : "delta",
          timestamp: samples[0].cts,
          duration: samples[0].duration,
          data: samples[0].data,
        });
        decoder.decode(firstChunk);
        await decoder.flush();

        // Set ready state - separate effect will render frame 0 when canvas is available
        if (!cancelled) {
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setError(`Initialization failed: ${message}`);
          console.error("Decoder initialization error:", err);
        }
      }
    })();

    // Cleanup on unmount or video change
    return () => {
      cancelled = true;

      // Close decoder
      if (decoderRef.current) {
        decoderRef.current.close();
        decoderRef.current = null;
      }

      // CRITICAL: Clear cache and release all VideoFrame memory
      cache.clear();

      // Clear timestamp map
      timestampMap.clear();

      // Reset state
      setIsReady(false);
      setCurrentFrame(0);
      setTotalFrames(0);
      samplesRef.current = [];
      parserRef.current = null;
    };
  }, [videoFile, renderFrameToCanvas]);

  // Effect to render frame 0 after canvas is mounted
  useEffect(() => {
    if (isReady && currentFrame === 0 && cacheRef.current.has(0)) {
      const canvas = canvasRef.current;
      if (canvas) {
        const frame0 = cacheRef.current.get(0)!;
        renderFrameToCanvas(frame0);
      }
    }
  }, [isReady, currentFrame, renderFrameToCanvas]);

  return {
    canvasRef,
    currentFrame,
    totalFrames,
    isReady,
    error,
    seekToFrame,
    stepForward,
    stepBackward,
    cacheStats,
    lastLatencyMs,
  };
}
