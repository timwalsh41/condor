import { useState } from "react";
import { useWebCodecsDecoder } from "../hooks/useWebCodecsDecoder";
import { checkWebCodecsSupport } from "../utils/featureDetection";

/**
 * Demo component for WebCodecs frame-accurate video control.
 *
 * Demonstrates:
 * - Frame-by-frame stepping with exact positioning (0 frame error)
 * - Fine stepping (+/-1 frame)
 * - Coarse stepping (+/-5 frames)
 * - Performance metrics (latency, cache hit rate)
 * - Memory management (bounded cache, no leaks)
 *
 * Phase 0, Task 0.3, Phase 3 deliverable.
 */
export function WebCodecsDemo() {
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const {
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
  } = useWebCodecsDecoder(videoFile);

  // Check browser support
  const support = checkWebCodecsSupport();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
    }
  };

  const handleCoarseStepBackward = async () => {
    await seekToFrame(Math.max(0, currentFrame - 5));
  };

  const handleCoarseStepForward = async () => {
    await seekToFrame(Math.min(totalFrames - 1, currentFrame + 5));
  };

  if (!support.isSupported) {
    return (
      <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
        <h1>WebCodecs Frame Control Demo</h1>
        <div
          style={{
            padding: "20px",
            backgroundColor: "#fee",
            border: "1px solid #c00",
            borderRadius: "4px",
            marginTop: "20px",
          }}
        >
          <h2>Browser Not Supported</h2>
          <p>{support.errorMessage}</p>
          <p>Detected browser: {support.browserInfo}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>WebCodecs Frame Control Demo</h1>
      <p>
        Frame-accurate video stepping with WebCodecs API. Demonstrates exact
        frame positioning (0 tolerance) for dual-video synchronization.
      </p>

      {/* File Upload */}
      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <label
          style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}
        >
          Upload Video (MP4, H.264 or H.265):
        </label>
        <input
          type="file"
          accept="video/mp4"
          onChange={handleFileChange}
          style={{ padding: "10px", fontSize: "14px" }}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: "15px",
            backgroundColor: "#fee",
            border: "1px solid #c00",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {videoFile && !isReady && !error && (
        <div
          style={{
            padding: "15px",
            backgroundColor: "#eff",
            border: "1px solid #0cc",
          }}
        >
          Initializing decoder...
        </div>
      )}

      {/* Video Display */}
      {isReady && (
        <div>
          {/* Canvas for frame display */}
          <div
            style={{
              marginBottom: "20px",
              border: "2px solid #333",
              display: "inline-block",
              backgroundColor: "#000",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                display: "block",
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </div>

          {/* Frame Counter */}
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "20px",
              fontFamily: "monospace",
            }}
          >
            Frame {currentFrame} / {totalFrames - 1}
          </div>

          {/* Controls */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "20px",
              maxWidth: "600px",
            }}
          >
            {/* Coarse Step Backward */}
            <button
              onClick={handleCoarseStepBackward}
              disabled={currentFrame === 0}
              style={{
                padding: "15px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: currentFrame === 0 ? "not-allowed" : "pointer",
                backgroundColor: currentFrame === 0 ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              ← Back 5 Frames
            </button>

            {/* Coarse Step Forward */}
            <button
              onClick={handleCoarseStepForward}
              disabled={currentFrame >= totalFrames - 1}
              style={{
                padding: "15px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor:
                  currentFrame >= totalFrames - 1 ? "not-allowed" : "pointer",
                backgroundColor:
                  currentFrame >= totalFrames - 1 ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Forward 5 Frames →
            </button>

            {/* Fine Step Backward */}
            <button
              onClick={stepBackward}
              disabled={currentFrame === 0}
              style={{
                padding: "15px",
                fontSize: "16px",
                cursor: currentFrame === 0 ? "not-allowed" : "pointer",
                backgroundColor: currentFrame === 0 ? "#ccc" : "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              ← Back 1 Frame
            </button>

            {/* Fine Step Forward */}
            <button
              onClick={stepForward}
              disabled={currentFrame >= totalFrames - 1}
              style={{
                padding: "15px",
                fontSize: "16px",
                cursor:
                  currentFrame >= totalFrames - 1 ? "not-allowed" : "pointer",
                backgroundColor:
                  currentFrame >= totalFrames - 1 ? "#ccc" : "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Forward 1 Frame →
            </button>
          </div>

          {/* Seek Slider */}
          <div style={{ marginBottom: "20px", maxWidth: "600px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Seek to Frame:
            </label>
            <input
              type="range"
              min="0"
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => seekToFrame(Number(e.target.value))}
              style={{ width: "100%", height: "30px" }}
            />
          </div>

          {/* Performance Metrics */}
          <div
            style={{
              padding: "15px",
              backgroundColor: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: "4px",
              maxWidth: "600px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Performance Metrics</h3>
            <div style={{ fontFamily: "monospace", fontSize: "14px" }}>
              <div>
                <strong>Last Operation:</strong> {lastLatencyMs.toFixed(1)} ms
                {lastLatencyMs < 10 && " (cache hit ✓)"}
                {lastLatencyMs >= 10 &&
                  lastLatencyMs < 300 &&
                  " (cache miss, acceptable)"}
                {lastLatencyMs >= 300 && " (slow - check GOP structure)"}
              </div>
              <div style={{ marginTop: "5px" }}>
                <strong>Cache Size:</strong> {cacheStats.size} /{" "}
                {cacheStats.maxSize} frames (
                {cacheStats.utilizationPercent.toFixed(1)}%)
              </div>
              <div style={{ marginTop: "5px" }}>
                <strong>Cache Hit Rate:</strong>{" "}
                {cacheStats.hitRatePercent.toFixed(1)}% ({cacheStats.hits} hits,{" "}
                {cacheStats.misses} misses)
              </div>
            </div>
          </div>

          {/* Technical Info */}
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              backgroundColor: "#fffff0",
              border: "1px solid #ddd",
              borderRadius: "4px",
              maxWidth: "600px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Technical Details</h3>
            <ul style={{ fontSize: "14px", marginBottom: 0 }}>
              <li>
                <strong>Frame Accuracy:</strong> Exact (0 frame error) using
                WebCodecs API
              </li>
              <li>
                <strong>Keyframe Detection:</strong> Actual is_sync flags from
                MP4 (not assumed GOP=30)
              </li>
              <li>
                <strong>Cache Strategy:</strong> LRU (Least Recently Used) with{" "}
                {cacheStats.maxSize} frame capacity
              </li>
              <li>
                <strong>Memory Management:</strong> VideoFrame.close() called on
                eviction (no leaks)
              </li>
              <li>
                <strong>Expected Performance:</strong> Cache hit &lt;10ms, Cache
                miss &lt;300ms (GOP=30)
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!videoFile && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            backgroundColor: "#f0f8ff",
            border: "1px solid #0066cc",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Getting Started</h3>
          <ol>
            <li>Upload an MP4 video file (H.264 or H.265 codec)</li>
            <li>Set the correct framerate for your video</li>
            <li>
              Use the controls to step through frames with exact positioning
            </li>
            <li>Monitor performance metrics to verify cache efficiency</li>
          </ol>
          <p>
            <strong>Test Videos:</strong> Sample videos are available in{" "}
            <code>tests/fixtures/videos/</code>
          </p>
          <ul>
            <li>
              <code>test_30fps_10s.mp4</code> - H.264, 30fps, 300 frames
            </li>
            <li>
              <code>test_30fps_10s_hevc.mp4</code> - H.265, 30fps, 300 frames
            </li>
            <li>
              <code>test_gop30_h264.mp4</code> - H.264 with GOP=30 (optimized)
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
