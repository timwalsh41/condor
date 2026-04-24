import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { MP4Parser, type VideoMetadata } from "../utils/MP4Parser";
import { FrameCache } from "../utils/FrameCache";
import { CoordinateMapping } from "../utils/CoordinateMapping";
import { calculateLookaheadRange } from "../utils/decodePlanning";
import type { Sample } from "mp4box";

/**
 * Number of frames to decode ahead of current position for smooth playback.
 * Used consistently in both seekToFrame (read-ahead) and playback loop (buffer maintenance).
 * 60 frames @ 30fps = 2 seconds of buffered video
 */
const LOOKAHEAD_FRAMES = 60;

/**
 * Maximum decoder queue size before warning about potential overflow.
 */
const MAX_DECODER_QUEUE_SIZE = 100;

/**
 * Maximum number of retries when canvas is not immediately available.
 */
const MAX_CANVAS_RENDER_RETRIES = 5;

/**
 * Base delay in milliseconds between canvas render retries (multiplied by retry count).
 */
const CANVAS_RETRY_DELAY_MS = 10;

/**
 * Debug logging control - only log in development mode.
 */
const DEBUG = process.env.NODE_ENV === "development";
const debugLog = (...args: unknown[]) => DEBUG && console.log(...args);
const debugWarn = (...args: unknown[]) => DEBUG && console.warn(...args);
const debugError = (...args: unknown[]) => console.error(...args); // Always log errors

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
  seekToFrame: (frameIndex: number, updateDisplay?: boolean) => Promise<void>;
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
    evictions: number;
  };
  /** Last operation latency in milliseconds */
  lastLatencyMs: number;
  /** True when video is playing (continuous playback) */
  isPlaying: boolean;
  /** Current playback rate (0.1x - 2.0x, default 1.0) */
  playbackRate: number;
  /** Start continuous playback at current playbackRate */
  play: () => void;
  /** Stop continuous playback */
  pause: () => void;
  /** Change playback speed (0.1x - 2.0x) */
  setPlaybackRate: (rate: number) => void;
  /** Video framerate (fps) */
  framerate: number;
  /** Video metadata (null until ready) */
  metadata: {
    duration: number; // Duration in seconds
    framerate: number; // Frames per second
    gopSize: number; // GOP size (avg keyframe interval)
    totalFrames: number; // Total frame count
    codec: string; // Codec string (e.g., "avc1.64001f")
    width: number; // Video width in pixels (encoded dimensions)
    height: number; // Video height in pixels (encoded dimensions)
    rotation: number; // Video rotation in degrees (0, 90, 180, 270)
    fileSizeMB: number; // File size in megabytes
  } | null;
  /** Early metadata from partial file read (available before full load) */
  earlyMetadata: VideoMetadata | null;
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
 * **File vs Blob Input**:
 * - `File`: For local file uploads from `<input type="file">`
 * - `Blob`: For videos fetched from backend streaming endpoints
 * - Blob inputs are internally wrapped as File objects for MP4Parser compatibility
 * - Default filename for Blob: 'video.mp4'
 *
 * @param videoFile - MP4 video file or blob to decode
 * @param cacheSize - Maximum frames to cache (default: 120)
 * @returns Hook interface with decoder controls and state
 */
export function useWebCodecsDecoder(
  videoFile: File | Blob | null,
  cacheSize: number = 120
): UseWebCodecsDecoderResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const cacheRef = useRef<FrameCache>(new FrameCache(cacheSize));
  const samplesRef = useRef<Sample[]>([]);
  const parserRef = useRef<MP4Parser | null>(null);
  const codecConfigRef = useRef<VideoDecoderConfig | null>(null);

  // Track which frame we're seeking to (for output callback)
  // Store target and updateDisplay together to avoid race conditions
  const seekTargetRef = useRef<{
    frame: number;
    updateDisplay: boolean;
  } | null>(null);

  // Coordinate mapping between Frame Number, CTS, and Sample Index (3-way isomorphism)
  // Replaces timestampToIndexRef and frameToTimestampRef with a single source of truth
  // Provides O(1) lookups in all 6 directions (Frame↔CTS, CTS↔Sample, Frame↔Sample)
  const coordinateMapRef = useRef<CoordinateMapping | null>(null);

  // Track frames that have been queued for decode (to prevent duplicate decode operations)
  const pendingDecodesRef = useRef<Set<number>>(new Set());

  // Playback state and refs
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const [framerate, setFramerate] = useState(30); // Default, will be updated from video
  const playbackLoopRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  // Refs for values accessed in rAF loop (avoid stale closures)
  const isPlayingRef = useRef(false);
  const playbackRateRef = useRef(1.0);
  const currentFrameRef = useRef(0);
  const totalFramesRef = useRef(0);

  // Coordination between seek and playback to prevent race conditions
  const isSeekingRef = useRef(false);

  // Track last decoded sample index to maintain decode order
  const lastDecodedSampleRef = useRef(-1);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState(cacheRef.current.getStats());
  const [lastLatencyMs, setLastLatencyMs] = useState(0);
  const [metadata, setMetadata] =
    useState<UseWebCodecsDecoderResult["metadata"]>(null);
  const [earlyMetadata, setEarlyMetadata] = useState<VideoMetadata | null>(null);

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
      const coordinateMap = coordinateMapRef.current;

      if (samples.length === 0 || !coordinateMap) return 0;

      // Find sample index for this frame number (O(1) via coordinate mapping)
      const targetSampleIndex =
        coordinateMap.getSampleFromFrame(targetFrameNumber);

      if (targetSampleIndex === undefined) {
        debugWarn(
          `[findNearestKeyframe] Frame ${targetFrameNumber} not found, using frame 0`
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
      debugWarn("[RENDER] Canvas not available!");
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
      debugWarn("[RENDER] Could not get 2d context!");
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
      if (!sample.data) {
        throw new Error('Sample data is missing');
      }
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
    async (targetFrame: number, updateDisplay: boolean = true) => {
      debugLog(
        `[SEEK] seekToFrame called: target=${targetFrame}, updateDisplay=${updateDisplay}`
      );

      // Chain this operation after previous one completes
      // Reason: Prevents dropped requests from rapid button presses
      pendingOperationRef.current = pendingOperationRef.current.then(
        async () => {
          // Set seeking flag to coordinate with playback loop
          isSeekingRef.current = true;

          // Declare refs at function scope so they're accessible in catch block
          const decoder = decoderRef.current;
          const samples = samplesRef.current;
          const cache = cacheRef.current;

          try {
            /*
            debugLog(
              `[SEEK] Queue executing: decoder=${!!decoder}, samples=${
                samples.length
              }, state=${decoder?.state}`
            );
            */

            if (!decoder || samples.length === 0) {
              debugWarn("[SEEK] Decoder not ready");
              return;
            }

            // Attempt recovery if decoder is closed (Firefox error handling)
            if (decoder.state === "closed") {
              debugWarn("[SEEK] Decoder closed, attempting reconfiguration...");
              const config = codecConfigRef.current;
              if (config) {
                try {
                  decoder.configure(config);
                  // Clear pending decodes - decoder discarded all queued frames
                  pendingDecodesRef.current.clear();
                  debugLog("[SEEK] Decoder reconfigured successfully");
                } catch (reconfigErr) {
                  debugError("[SEEK] Reconfiguration failed:", reconfigErr);
                  const errorMsg =
                    "Decoder closed and cannot be recovered. Please reload the video.";
                  setError(errorMsg);
                  throw new Error(errorMsg); // Throw to reject promise chain
                }
              } else {
                debugError("[SEEK] No codec config available for recovery");
                const errorMsg = "Decoder closed. Please reload the video.";
                setError(errorMsg);
                throw new Error(errorMsg); // Throw to reject promise chain
              }
            }

            const startTime = performance.now();
            // Clamp to valid range
            const clampedTarget = Math.max(
              0,
              Math.min(targetFrame, samples.length - 1)
            );

            /*
            debugLog(
              `[SEEK] Clamped target: ${clampedTarget}, cached=${cache.has(
                clampedTarget
              )}`
            );
            */

            // Check cache first (FAST PATH: <10ms)
            if (cache.has(clampedTarget)) {
              // debugLog(`[SEEK] Cache hit for frame ${clampedTarget}`);
              const cachedFrame = cache.get(clampedTarget)!;

              if (updateDisplay) {
                renderFrameToCanvas(cachedFrame);
                setCurrentFrame(clampedTarget);
              }

              setCacheStats(cache.getStats());

              const latency = performance.now() - startTime;
              setLastLatencyMs(latency);
              return;
            }

            debugLog(
              `[SEEK] Cache miss for frame ${clampedTarget}, decoding from keyframe`
            );

            // Cache miss - decode from keyframe
            // Set target for output callback (store both frame and updateDisplay together)
            seekTargetRef.current = {
              frame: clampedTarget,
              updateDisplay: updateDisplay,
            };

            const coordinateMap = coordinateMapRef.current;
            if (!coordinateMap) {
              debugError("[SEEK] Coordinate map not initialized");
              return;
            }

            // Find CTS and sample index for this frame number (O(1) via coordinate mapping)
            const targetCts = coordinateMap.getCts(clampedTarget);
            const targetSampleIndex =
              coordinateMap.getSampleFromFrame(clampedTarget);

            debugLog(
              `[SEEK] Found target CTS: ${targetCts} for frame ${clampedTarget}`
            );

            if (targetCts === undefined || targetSampleIndex === undefined) {
              debugError(
                `[SEEK] Could not find timestamp or sample index for frame ${clampedTarget}`
              );
              return;
            }

            // Find keyframe sample index (in decode order, at or before target)
            const keyframeSampleIndex = findNearestKeyframe(clampedTarget);

            debugLog(
              `[SEEK] Keyframe at sample index ${keyframeSampleIndex}, target at ${targetSampleIndex}`
            );

            // Calculate lookahead decode range
            // This handles B-frame reordering where presentation order ≠ decode order
            // See decodePlanning.ts for detailed explanation of the B-frame fix
            const lookahead = calculateLookaheadRange(
              clampedTarget,
              targetSampleIndex,
              coordinateMap,
              samples,
              LOOKAHEAD_FRAMES
            );

            if (lookahead.lookaheadSample === undefined) {
              debugWarn(
                `[SEEK] Could not find sample for lookahead frame ${lookahead.lookaheadFrame}, using fallback`
              );
            }

            const readAheadEnd = lookahead.readAheadEnd;

            debugLog(
              `[SEEK] Decode plan: target frame ${clampedTarget}, lookahead to frame ${lookahead.lookaheadFrame}`
            );
            debugLog(
              `[SEEK] Sample indices: keyframe=${keyframeSampleIndex}, target=${targetSampleIndex}, readAhead=${readAheadEnd}`
            );
            debugLog(
              `[SEEK] Will decode ${
                readAheadEnd - keyframeSampleIndex + 1
              } samples`
            );
            debugLog(
              `[SEEK] Decoder state before decode loop: ${decoder.state}, queue size: ${decoder.decodeQueueSize}`
            );

            // Final state check before decode
            if (decoder.state !== "configured") {
              debugError(
                `[SEEK] Decoder not in configured state (${decoder.state}), cannot decode`
              );
              setError(
                `Decoder in ${decoder.state} state. Please reload the video.`
              );
              return;
            }

            // Issue decode commands from keyframe to target + read-ahead
            // Important: Decode in sample array order (decode order), not frame number order
            // Note: timestamp mapping already established during init
            for (let i = keyframeSampleIndex; i <= readAheadEnd; i++) {
              const sample = samples[i];
              const chunk = createEncodedChunk(sample);

              // Track this frame as pending to prevent duplicate decodes (O(1) via coordinate mapping)
              const frameIndex = coordinateMap.getFrame(sample.cts);
              if (frameIndex !== undefined) {
                pendingDecodesRef.current.add(frameIndex);
                // debugLog(
                //  `[SEEK] Added frame ${frameIndex} to pending (${pendingDecodesRef.current.size} total pending)`
                // );
              }

              // Log every 10th sample to avoid spam, plus first/last
              if (
                i === keyframeSampleIndex ||
                i === readAheadEnd ||
                i % 10 === 0
              ) {
                debugLog(
                  `[SEEK] Decoding sample ${i}/${readAheadEnd}, type=${chunk.type}, state=${decoder.state}, queueSize=${decoder.decodeQueueSize}`
                );
              }

              // Capture state before decode for diagnostics
              const stateBeforeDecode: string = decoder.state;

              try {
                decoder.decode(chunk);
              } catch (decodeErr) {
                debugError(
                  `[SEEK] ⚠️ SYNCHRONOUS decode() error at sample ${i}:`,
                  decodeErr
                );
                debugError(
                  `[SEEK] Decoder state: ${stateBeforeDecode} -> ${decoder.state}`
                );
                throw decodeErr; // Re-throw to be caught by outer try-catch
              }

              // Check if state changed after decode (Firefox issue detection)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const currentState = (decoder as any).state as string;
              if (currentState !== stateBeforeDecode) {
                debugError(
                  `[SEEK] ⚠️ Decoder state changed during decode() at sample ${i}: ${stateBeforeDecode} -> ${currentState}`
                );
              }

              // Check if decoder closed mid-loop (Firefox issue detection)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((decoder as any).state === "closed") {
                debugError(
                  `[SEEK] ⚠️ DECODER CLOSED mid-decode at sample ${i}! Queue was at ${decoder.decodeQueueSize}`
                );
                throw new Error(
                  `Decoder closed unexpectedly at sample ${i} during seek to frame ${clampedTarget}`
                );
              }
            }

            // Update last decoded sample to end of read-ahead range
            lastDecodedSampleRef.current = readAheadEnd;

            debugLog(
              `[SEEK] Decode loop complete, decoder state: ${decoder.state}, final queue size: ${decoder.decodeQueueSize}, lastDecodedSample=${lastDecodedSampleRef.current}`
            );

            // NOTE: No flush() - output callback renders target frame immediately
            // Reason: flush() resets decoder state requiring next frame to be keyframe
            // Instead, output callback checks seekTargetRef and renders when target arrives

            // Latency will be measured when output callback renders
            // For now just track that decode was issued
            const latency = performance.now() - startTime;
            setLastLatencyMs(latency);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Decode error";
            debugError(`[SEEK] Error during seek:`, err);
            debugError(`[SEEK] Decoder state at error: ${decoder?.state}`);
            setError(`Seek failed: ${message}`);
          } finally {
            // Clear seeking flag
            isSeekingRef.current = false;
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
   * Start continuous playback at current playbackRate.
   *
   * Uses requestAnimationFrame loop to render frames at precise intervals
   * based on framerate and playbackRate. Renders from cache (instant <10ms)
   * and decodes ahead asynchronously to maintain 60-frame buffer.
   */
  const play = useCallback(() => {
    if (isPlayingRef.current) return; // Already playing

    debugLog(`[PLAY] Starting playback at ${playbackRateRef.current}x speed`);
    setIsPlaying(true);
    isPlayingRef.current = true;

    // Will be initialized on first rAF callback
    lastFrameTimeRef.current = 0;

    function playbackLoop(timestamp: number) {
      if (!isPlayingRef.current) {
        debugLog("[PLAYBACK] Stopped");
        return;
      }

      // Initialize on first frame
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      const frameInterval = 1000 / framerate / playbackRateRef.current;

      // Debug logging (only every 30 frames to avoid spam)
      if (currentFrameRef.current % 30 === 0) {
        debugLog(
          `[PLAYBACK] framerate=${framerate}, playbackRate=${playbackRateRef.current}x, ` +
            `frameInterval=${frameInterval.toFixed(
              2
            )}ms, elapsed=${elapsed.toFixed(2)}ms`
        );
      }

      if (elapsed >= frameInterval) {
        const nextFrame = currentFrameRef.current + 1;

        // End of video
        if (nextFrame >= totalFramesRef.current) {
          debugLog("[PLAYBACK] End of video reached");
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (playbackLoopRef.current) {
            cancelAnimationFrame(playbackLoopRef.current);
            playbackLoopRef.current = null;
          }
          return;
        }

        // Render from cache (fast path)
        const cache = cacheRef.current;
        if (cache.has(nextFrame)) {
          const cachedFrame = cache.get(nextFrame)!;
          renderFrameToCanvas(cachedFrame);
          setCurrentFrame(nextFrame);
          currentFrameRef.current = nextFrame;
          setCacheStats(cache.getStats());

          // Decode ahead to maintain LOOKAHEAD_FRAMES buffer
          // CRITICAL: Only decode MISSING frames in the lookahead window
          // During sequential playback, decoder has dependencies, just queue missing chunks
          const decoder = decoderRef.current;
          const samples = samplesRef.current;
          const pendingDecodes = pendingDecodesRef.current;
          const coordinateMap = coordinateMapRef.current;

          // Skip buffer fill if a seek is in progress (prevents race condition)
          if (
            decoder &&
            decoder.state === "configured" &&
            samples.length > 0 &&
            !isSeekingRef.current &&
            coordinateMap
          ) {
            // Buffer fill: Ensure we have frames ahead of current position
            // Calculate which frames we need (current + LOOKAHEAD_FRAMES)
            const bufferStart = nextFrame + 1;
            const bufferEnd = Math.min(
              nextFrame + LOOKAHEAD_FRAMES,
              totalFramesRef.current - 1
            );

            debugLog(
              `[PLAYBACK-BUFFER] Starting buffer fill: nextFrame=${nextFrame}, window=[${bufferStart}-${bufferEnd}], cacheSize=${cache.getSize()}, pendingCount=${
                pendingDecodes.size
              }`
            );

            // CRITICAL: Must decode samples sequentially from lastDecodedSample
            // Find the highest sample needed for frames in buffer window
            let maxSampleNeeded = lastDecodedSampleRef.current;

            // DEBUG: Log pending state before buffer fill
            debugLog(
              `[PLAYBACK-BUFFER] Before buffer fill - pendingDecodes: [${Array.from(
                pendingDecodes
              )
                .sort((a, b) => a - b)
                .join(", ")}], ` +
                `cacheSize: ${cache.getSize()}, lastDecodedSample: ${
                  lastDecodedSampleRef.current
                }`
            );

            const skippedFrames: Array<{ frame: number; reason: string }> = [];

            for (
              let frameNum = bufferStart;
              frameNum <= bufferEnd;
              frameNum++
            ) {
              const inCache = cache.has(frameNum);
              const isPending = pendingDecodes.has(frameNum);

              if (inCache || isPending) {
                skippedFrames.push({
                  frame: frameNum,
                  reason: inCache ? "cached" : "pending",
                });
              }

              if (!inCache && !isPending) {
                const sampleIdx = coordinateMap.getSampleFromFrame(frameNum);
                if (sampleIdx !== undefined && sampleIdx > maxSampleNeeded) {
                  maxSampleNeeded = sampleIdx;
                }
              }
            }

            if (skippedFrames.length > 0) {
              debugLog(
                `[PLAYBACK-BUFFER] Skipped ${skippedFrames.length} frames: ` +
                  `${skippedFrames
                    .slice(0, 5)
                    .map((f) => `${f.frame}(${f.reason})`)
                    .join(", ")}` +
                  `${skippedFrames.length > 5 ? "..." : ""}`
              );
            }

            // Decode ALL samples from lastDecoded+1 to maxSampleNeeded (sequential decode order)
            const samplesToDecode: number[] = [];
            const startSample = lastDecodedSampleRef.current + 1;

            debugLog(
              `[PLAYBACK-BUFFER] Decode range: startSample=${startSample}, maxSampleNeeded=${maxSampleNeeded}, ` +
                `willDecode=${maxSampleNeeded >= startSample}`
            );

            if (maxSampleNeeded >= startSample) {
              const skippedSamples: Array<{
                sample: number;
                frame: number;
                reason: string;
              }> = [];

              for (
                let sampleIdx = startSample;
                sampleIdx <= maxSampleNeeded;
                sampleIdx++
              ) {
                const sample = samples[sampleIdx];
                const frameIndex = coordinateMap.getFrame(sample.cts);

                if (frameIndex === undefined) {
                  skippedSamples.push({
                    sample: sampleIdx,
                    frame: -1,
                    reason: "no-frame-mapping",
                  });
                  continue;
                }

                const inCache = cache.has(frameIndex);
                const isPending = pendingDecodes.has(frameIndex);

                // Only decode if the frame isn't already cached/pending
                if (!inCache && !isPending) {
                  samplesToDecode.push(sampleIdx);
                } else {
                  skippedSamples.push({
                    sample: sampleIdx,
                    frame: frameIndex,
                    reason: inCache ? "cached" : "pending",
                  });
                }
              }

              debugLog(
                `[PLAYBACK-BUFFER] Sequential decode plan: samples ${startSample}-${maxSampleNeeded}, ` +
                  `will decode ${
                    samplesToDecode.length
                  } samples: [${samplesToDecode.slice(0, 5).join(", ")}${
                    samplesToDecode.length > 5 ? "..." : ""
                  }]`
              );

              if (skippedSamples.length > 0) {
                debugLog(
                  `[PLAYBACK-BUFFER] Skipped ${skippedSamples.length} samples in decode range: ` +
                    `${skippedSamples
                      .slice(0, 5)
                      .map((s) => `s${s.sample}=f${s.frame}(${s.reason})`)
                      .join(", ")}` +
                    `${skippedSamples.length > 5 ? "..." : ""}`
                );
              }
            }

            let decodedCount = 0;

            // Decode in sample order
            for (const sampleIdx of samplesToDecode) {
              const sample = samples[sampleIdx];
              const frameIndex = coordinateMap.getFrame(sample.cts);

              if (frameIndex !== undefined) {
                // Check again right before decoding (race condition protection)
                if (cache.has(frameIndex) || pendingDecodes.has(frameIndex)) {
                  debugWarn(
                    `[PLAYBACK-BUFFER] Skipping sample ${sampleIdx} (frame ${frameIndex}): already cached=${cache.has(
                      frameIndex
                    )} or pending=${pendingDecodes.has(frameIndex)}`
                  );
                  continue;
                }

                const chunk = createEncodedChunk(sample);

                try {
                  debugLog(
                    `[PLAYBACK-BUFFER] Decoding sample ${sampleIdx} → frame ${frameIndex}, decoderQueue=${decoder.decodeQueueSize}`
                  );
                  decoder.decode(chunk);
                  pendingDecodes.add(frameIndex);
                  debugLog(
                    `[PLAYBACK-BUFFER] Added frame ${frameIndex} to pending (${pendingDecodes.size} total pending)`
                  );
                  lastDecodedSampleRef.current = Math.max(
                    lastDecodedSampleRef.current,
                    sampleIdx
                  );
                  decodedCount++;
                } catch (err) {
                  debugError(
                    `[PLAYBACK-BUFFER] Error decoding sample ${sampleIdx} (frame ${frameIndex}):`,
                    err
                  );
                  pendingDecodes.delete(frameIndex);

                  // If decoder closed, stop playback immediately
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  if ((decoder as any).state === "closed") {
                    debugError(
                      "[PLAYBACK-BUFFER] Decoder closed due to error, stopping playback"
                    );
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                    setError(
                      "Decoder error during playback. Please reload the video."
                    );
                    return;
                  }
                }
              }
            }

            // Log buffer fill progress occasionally
            if (decodedCount > 0 && nextFrame % 30 === 0) {
              debugLog(
                `[PLAYBACK] Buffer fill: decoded ${decodedCount} missing frames, queue=${decoder.decodeQueueSize}`
              );

              // Safety check: warn if queue is growing too large
              if (decoder.decodeQueueSize > MAX_DECODER_QUEUE_SIZE) {
                debugWarn(
                  `[PLAYBACK] ⚠️ Decoder queue large (${decoder.decodeQueueSize}), potential overflow risk`
                );
              }
            }
          }
        } else {
          // Cache miss during playback - should be rare if buffer fill is working correctly
          // Need to decode from keyframe to establish proper decoder state
          debugWarn(
            `[PLAYBACK] Cache miss at frame ${nextFrame} - seeking to recover`
          );

          // Pause playback during cache miss recovery (recommendation 1.1)
          // This prevents cascading cache misses and stuttering
          setIsPlaying(false);
          isPlayingRef.current = false;

          // Call seekToFrame to rebuild cache from keyframe
          // This will decode from previous keyframe through nextFrame + LOOKAHEAD_FRAMES
          seekToFrame(nextFrame, true)
            .then(() => {
              // Resume playback after seek completes
              setIsPlaying(true);
              isPlayingRef.current = true;
              lastFrameTimeRef.current = 0; // Reset timing

              // Restart playback loop (critical - otherwise playback never resumes!)
              playbackLoopRef.current = requestAnimationFrame(playbackLoop);
            })
            .catch((err) => {
              debugError(
                `[PLAYBACK] Failed to recover from cache miss at frame ${nextFrame}:`,
                err
              );
              setError(
                "Playback error: Unable to decode frame. Please reload."
              );
            });

          return; // Exit current playback loop iteration, will restart after seek
        }

        lastFrameTimeRef.current = timestamp;
      }

      playbackLoopRef.current = requestAnimationFrame(playbackLoop);
    }

    playbackLoopRef.current = requestAnimationFrame(playbackLoop);
  }, [framerate, renderFrameToCanvas, createEncodedChunk, seekToFrame]);

  /**
   * Stop continuous playback.
   */
  const pause = useCallback(() => {
    debugLog("[PAUSE] Stopping playback");
    setIsPlaying(false);
    isPlayingRef.current = false;

    if (playbackLoopRef.current) {
      cancelAnimationFrame(playbackLoopRef.current);
      playbackLoopRef.current = null;
    }
  }, []);

  /**
   * Change playback speed.
   *
   * @param rate - Playback rate (0.1x - 2.0x)
   */
  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.1, Math.min(2.0, rate));
    debugLog(`[PLAYBACK] Setting playback rate to ${clampedRate}x`);
    setPlaybackRateState(clampedRate);
    playbackRateRef.current = clampedRate;
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  useEffect(() => {
    totalFramesRef.current = totalFrames;
  }, [totalFrames]);

  /**
   * Initialize decoder when video file changes.
   */
  useEffect(() => {
    if (!videoFile) {
      setIsReady(false);
      setError(null);
      setEarlyMetadata(null);
      setMetadata(null);
      return;
    }

    // Normalize Blob to File for MP4Parser compatibility
    // File extends Blob, so File inputs pass through unchanged
    const file = videoFile instanceof File
      ? videoFile
      : new File([videoFile], 'video.mp4', { type: 'video/mp4' });

    let cancelled = false;

    // Capture refs for cleanup
    const cache = cacheRef.current;
    const pendingDecodes = pendingDecodesRef.current;

    (async () => {
      try {
        setIsReady(false);
        setError(null);

        // File size validation - 500MB hard limit
        const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
        const fileSizeMB = file.size / 1024 / 1024;

        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `File size (${fileSizeMB.toFixed(0)}MB) exceeds maximum allowed size (500MB). ` +
            `Please use a smaller video file or reduce quality/duration.`
          );
        }

        // Early codec detection - read partial file (first 200KB) to check codec
        debugLog(`[INIT] File size: ${fileSizeMB.toFixed(1)}MB, attempting early codec detection...`);

        let metadata: Awaited<ReturnType<typeof MP4Parser.readPartialMetadata>> = null;

        try {
          metadata = await MP4Parser.readPartialMetadata(file);
        } catch (err) {
          debugWarn("[INIT] Early codec detection failed, will check after full parse:", err);
        }

        if (metadata) {
          debugLog(`[INIT] Early detection succeeded: codec=${metadata.codec}, ${metadata.width}x${metadata.height}`);

          // Store early metadata for UI display
          setEarlyMetadata(metadata);

          // Block HEVC entirely (unreliable browser support causes crashes)
          const isHEVC = metadata.codec.startsWith('hvc') || metadata.codec.startsWith('hev');
          if (isHEVC) {
            throw new Error(
              `Unsupported video codec: HEVC/H.265\n\n` +
              `This video uses HEVC/H.265 which has unreliable browser support.\n\n` +
              `Please transcode to H.264 using FFmpeg:\n` +
              `  ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a copy output.mp4\n\n` +
              `Technical details:\n` +
              `Codec: ${metadata.codec}\n` +
              `Resolution: ${metadata.width}x${metadata.height}\n` +
              `File size: ${fileSizeMB.toFixed(1)}MB`
            );
          }

          // Check codec support before loading full file
          const codecSupport = await VideoDecoder.isConfigSupported({
            codec: metadata.codec,
            codedWidth: metadata.width,
            codedHeight: metadata.height,
          });

          if (!codecSupport.supported) {
            // Determine codec type for user-friendly message
            const codecName = metadata.codec;

            throw new Error(
              `Unsupported video codec: ${codecName}\n\n` +
              `This video uses the ${codecName} codec which is not supported in your browser.\n\n` +
              `Suggested solutions:\n` +
              `• Use an H.264 encoded video (widely supported)\n` +
              `• Try Safari browser (better HEVC support)\n` +
              `• Transcode video using Handbrake or FFmpeg\n\n` +
              `Technical details:\n` +
              `Codec: ${metadata.codec}\n` +
              `Resolution: ${metadata.width}x${metadata.height}\n` +
              `File size: ${fileSizeMB.toFixed(1)}MB`
            );
          }

          debugLog(`[INIT] Codec ${metadata.codec} is supported, proceeding with full file load`);
        } else {
          debugLog(`[INIT] Early detection returned null (moov likely at end), will check after full parse`);
        }

        // Parse MP4 container
        const parser = new MP4Parser();
        await parser.initialize(file);

        if (cancelled) return;

        parserRef.current = parser;

        // Get codec configuration and samples
        const codecConfig = parser.getCodecConfig();
        const samples = parser.getSamples();
        samplesRef.current = samples;
        setTotalFrames(samples.length);

        // Extract framerate from video
        const videoFramerate = parser.getFramerate();
        setFramerate(videoFramerate);
        debugLog(`[INIT] Video framerate: ${videoFramerate} fps`);

        // Extract video metadata
        const videoTrack = parser.getVideoTrackInfo();
        const gopSize = parser.getGopSize();
        const rotation = parser.getRotation();
        const duration = samples.length / videoFramerate;
        // fileSizeMB already declared above, reuse it

        setMetadata({
          duration,
          framerate: videoFramerate,
          gopSize,
          totalFrames: samples.length,
          codec: videoTrack.codec || "unknown",
          width: videoTrack.video.width,
          height: videoTrack.video.height,
          rotation,
          fileSizeMB,
        });
        debugLog(
          `[INIT] Video metadata: ${videoTrack.video.width}x${videoTrack.video.height}, ${samples.length} frames, GOP=${gopSize}, rotation=${rotation}°`
        );

        // Block HEVC entirely (check after full parse in case early detection failed)
        const codec = videoTrack.codec || "";
        const isHEVC = codec.startsWith('hvc') || codec.startsWith('hev');
        if (isHEVC) {
          throw new Error(
            `Unsupported video codec: HEVC/H.265\n\n` +
            `This video uses HEVC/H.265 which has unreliable browser support.\n\n` +
            `Please transcode to H.264 using FFmpeg:\n` +
            `  ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a copy output.mp4\n\n` +
            `Technical details:\n` +
            `Codec: ${codec}\n` +
            `Resolution: ${videoTrack.video.width}x${videoTrack.video.height}\n` +
            `File size: ${fileSizeMB.toFixed(1)}MB`
          );
        }

        // Build coordinate mapping (3-way isomorphism: Frame ↔ CTS ↔ Sample)
        // Reason: sample.number is NOT presentation frame number
        // We must sort by cts (composition timestamp) to get presentation order
        const sortedByPts = [...samples]
          .map((s, idx) => ({ cts: s.cts, sampleIndex: idx }))
          .sort((a, b) => a.cts - b.cts);

        // Initialize coordinate mapping with samples array
        coordinateMapRef.current = new CoordinateMapping(samples);

        // Map ALL frames in presentation order to their CTS and sample indices
        for (let frameNum = 0; frameNum < sortedByPts.length; frameNum++) {
          const { cts, sampleIndex } = sortedByPts[frameNum];
          coordinateMapRef.current.set(frameNum, cts, sampleIndex);
        }

        // Helper function for async canvas retry (recommendation 4.2)
        const waitForCanvas = async (
          maxRetries = MAX_CANVAS_RENDER_RETRIES
        ): Promise<boolean> => {
          for (let i = 0; i < maxRetries; i++) {
            if (canvasRef.current) return true;
            await new Promise((resolve) =>
              setTimeout(resolve, CANVAS_RETRY_DELAY_MS * (i + 1))
            );
          }
          return false;
        };

        // Initialize VideoDecoder
        const decoder = new VideoDecoder({
          output: (frame: VideoFrame) => {
            if (cancelled) {
              debugLog(`[OUTPUT] Cancelled, closing frame ${frame.timestamp}`);
              frame.close();
              return;
            }

            // Get frame index from coordinate mapping (O(1) lookup)
            const coordinateMap = coordinateMapRef.current;
            if (!coordinateMap) {
              debugWarn("[OUTPUT] Coordinate map not initialized");
              frame.close();
              return;
            }

            const frameIndex = coordinateMap.getFrame(frame.timestamp);

            /*
            debugLog(
              `[OUTPUT] Received frame: timestamp=${
                frame.timestamp
              }, frameIndex=${frameIndex}, seekTarget=${JSON.stringify(
                seekTargetRef.current
              )}, decoderQueue=${
                decoderRef.current?.decodeQueueSize
              }, decoderState=${decoderRef.current?.state}`
            );
            */

            if (frameIndex === undefined) {
              debugWarn(
                `[OUTPUT] Unknown timestamp ${frame.timestamp}, skipping frame`
              );
              frame.close();
              return;
            }

            // Clone frame for cache (original will be closed below)
            const cached = frame.clone();
            cacheRef.current.set(frameIndex, cached);

            // Clear pending decode flag now that frame is cached
            const wasPending = pendingDecodesRef.current.has(frameIndex);
            pendingDecodesRef.current.delete(frameIndex);

            // if (wasPending) {
            //  debugLog(
            //    `[OUTPUT] Frame ${frameIndex} removed from pending (${
            //      pendingDecodesRef.current.size
            //    } still pending), cacheSize=${cacheRef.current.getSize()}`
            //  );
            //}

            // CRITICAL: Close original frame to release memory
            frame.close();

            // If this is frame 0 during initialization, set isReady and render
            if (frameIndex === 0 && seekTargetRef.current?.frame === 0) {
              debugLog(`[OUTPUT] Frame 0 cached, decoder is ready`);

              // Decoder is ready even if canvas isn't mounted yet
              setIsReady(true);
              setCurrentFrame(0);
              setCacheStats(cacheRef.current.getStats());

              if (seekTargetRef.current?.updateDisplay) {
                // Try to render to canvas (may not be mounted yet)
                if (canvasRef.current) {
                  debugLog(`[OUTPUT] Rendering frame 0 to canvas`);
                  renderFrameToCanvas(cached);
                } else {
                  // Canvas not ready yet, use async retry helper (recommendation 4.2)
                  debugWarn(
                    `[OUTPUT] Canvas not mounted yet, will retry render`
                  );

                  waitForCanvas().then((success) => {
                    if (success && cacheRef.current.has(0)) {
                      const frame0 = cacheRef.current.get(0)!;
                      debugLog(
                        `[OUTPUT] Canvas now available, rendering frame 0`
                      );
                      renderFrameToCanvas(frame0);
                    } else {
                      debugError(
                        `[OUTPUT] Canvas still not available after ${MAX_CANVAS_RENDER_RETRIES} retries`
                      );
                    }
                  });
                }
              }
              return;
            }

            // Render immediately if this is the target frame AND updateDisplay is true
            // Reason: Async decode pipeline - output callback fires when frame ready
            // Read-ahead frames are cached but not rendered (updateDisplay=false)
            if (
              frameIndex === seekTargetRef.current?.frame &&
              seekTargetRef.current?.updateDisplay
            ) {
              debugLog(`[OUTPUT] Rendering target frame ${frameIndex}`);
              renderFrameToCanvas(cached);
              setCurrentFrame(frameIndex);
              setCacheStats(cacheRef.current.getStats());
            }
          },
          error: (err) => {
            debugError(
              "[DECODER ERROR] ==================== START ===================="
            );
            debugError("[DECODER ERROR] Full error:", err);
            debugError("[DECODER ERROR] Error message:", err.message);
            debugError("[DECODER ERROR] Error name:", err.name);
            debugError("[DECODER ERROR] Decoder state:", decoder?.state);
            debugError(
              "[DECODER ERROR] Decode queue size:",
              decoder?.decodeQueueSize
            );
            debugError(
              "[DECODER ERROR] Current seek target:",
              seekTargetRef.current
            );
            debugError(
              "[DECODER ERROR] Current frame:",
              currentFrameRef.current
            );
            debugError("[DECODER ERROR] Is playing:", isPlayingRef.current);
            debugError(
              "[DECODER ERROR] Pending decodes:",
              pendingDecodesRef.current.size
            );
            debugError(
              "[DECODER ERROR] Cache size:",
              cacheRef.current.getSize()
            );
            debugError(
              "[DECODER ERROR] Last decoded sample:",
              lastDecodedSampleRef.current
            );
            debugError("[DECODER ERROR] Stack trace:", new Error().stack);

            // Check if Firefox auto-closed the decoder
            if (decoder?.state === "closed") {
              debugError("[DECODER ERROR] ⚠️ Decoder was closed by browser!");
            }

            debugError(
              "[DECODER ERROR] ==================== END ===================="
            );

            // Clear pending decodes - decoder has discarded all queued frames (recommendation 4.1)
            pendingDecodesRef.current.clear();
            debugLog("[DECODER ERROR] Cleared pending decodes after error");

            setError(`Decoder error: ${err.message}`);
          },
        });

        // Check codec support (fallback for cases where early detection didn't work)
        const support = await VideoDecoder.isConfigSupported(codecConfig);
        if (!support.supported) {
          // Determine codec type for user-friendly message
          const isHEVC = codecConfig.codec.startsWith('hvc') || codecConfig.codec.startsWith('hev');
          const codecName = isHEVC ? 'HEVC/H.265' : codecConfig.codec;

          throw new Error(
            `Unsupported video codec: ${codecName}\n\n` +
            `This video uses the ${codecName} codec which is not supported in your browser.\n\n` +
            `Suggested solutions:\n` +
            `• Use an H.264 encoded video (widely supported)\n` +
            `• Try Safari browser (better HEVC support)\n` +
            `• Transcode video using Handbrake or FFmpeg\n\n` +
            `Technical details:\n` +
            `Codec: ${codecConfig.codec}\n` +
            `Resolution: ${codecConfig.codedWidth}x${codecConfig.codedHeight}\n` +
            `File size: ${fileSizeMB.toFixed(1)}MB`
          );
        }

        decoder.configure(codecConfig);
        // Clear pending decodes - fresh decoder state
        pendingDecodesRef.current.clear();
        decoderRef.current = decoder;
        codecConfigRef.current = codecConfig; // Store for potential reconfiguration

        if (cancelled) {
          decoder.close();
          return;
        }

        // Decode first frame + lookahead to initialize playback buffer
        seekTargetRef.current = { frame: 0, updateDisplay: true };

        // Decode from sample 0 through LOOKAHEAD_FRAMES (matching seekToFrame behavior)
        // Note: Samples are in decode order, not presentation order
        const readAheadEnd = Math.min(LOOKAHEAD_FRAMES, samples.length - 1);
        debugLog(
          `[INIT] Decoding initial buffer: samples 0-${readAheadEnd} (${
            readAheadEnd + 1
          } samples, frames will be cached in presentation order)`
        );

        const coordinateMap = coordinateMapRef.current!;

        for (let i = 0; i <= readAheadEnd; i++) {
          const sample = samples[i];
          // Use createEncodedChunk helper to fix DRY violation (recommendation 3.3)
          const chunk = createEncodedChunk(sample);

          // Track this frame as pending to prevent duplicate decodes
          const frameIndex = coordinateMap.getFrame(sample.cts);
          if (frameIndex !== undefined) {
            pendingDecodesRef.current.add(frameIndex);
          } else {
            debugWarn(
              `[INIT] Sample ${i} has CTS ${sample.cts} not found in coordinate mapping`
            );
          }

          decoder.decode(chunk);
          lastDecodedSampleRef.current = i; // Track decode progress
        }

        const pendingFrames = Array.from(pendingDecodesRef.current).sort(
          (a, b) => a - b
        );
        debugLog(
          `[INIT] Queued ${
            readAheadEnd + 1
          } samples (0-${readAheadEnd}), pending frames: ${
            pendingDecodesRef.current.size
          } [${pendingFrames.slice(0, 10).join(", ")}${
            pendingFrames.length > 10 ? "..." : ""
          }], lastDecodedSample=${lastDecodedSampleRef.current}, decoderQueue=${
            decoder.decodeQueueSize
          }`
        );

        // NOTE: Do NOT call flush() here - it resets decoder state requiring next decode to be keyframe
        // Do NOT set isReady here - wait for frame 0 to actually be cached (output callback will set it)
        // Initialization queues decode operations, they complete asynchronously
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setError(`Initialization failed: ${message}`);
          debugError("Decoder initialization error:", err);
        }
      }
    })();

    // Cleanup on unmount or video change
    return () => {
      cancelled = true;

      // Stop playback if active
      if (playbackLoopRef.current) {
        cancelAnimationFrame(playbackLoopRef.current);
        playbackLoopRef.current = null;
      }
      isPlayingRef.current = false;

      // Close decoder
      if (decoderRef.current) {
        decoderRef.current.close();
        decoderRef.current = null;
      }

      // CRITICAL: Clear cache and release all VideoFrame memory
      cache.clear();

      // Clear coordinate mapping and pending decodes
      if (coordinateMapRef.current) {
        coordinateMapRef.current.clear();
        coordinateMapRef.current = null;
      }
      pendingDecodes.clear();

      // Reset decode progress tracking
      lastDecodedSampleRef.current = -1;

      // Reset state
      setIsReady(false);
      setIsPlaying(false);
      setCurrentFrame(0);
      setTotalFrames(0);
      samplesRef.current = [];
      parserRef.current = null;
    };
  }, [videoFile, renderFrameToCanvas, createEncodedChunk]);

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
    isPlaying,
    playbackRate,
    play,
    pause,
    setPlaybackRate,
    framerate,
    metadata,
    earlyMetadata,
  };
}
