import { useState, useEffect } from "react";
import { useWebCodecsDecoder } from "../hooks/useWebCodecsDecoder";
import { checkWebCodecsSupport } from "../utils/featureDetection";

/**
 * Demo component for WebCodecs frame-accurate video control.
 *
 * Demonstrates:
 * - Frame-by-frame stepping with exact positioning (0 frame error)
 * - Fine stepping (+/-1 frame)
 * - Coarse stepping (+/-5 frames)
 * - Continuous playback with variable speed (0.1x - 2.0x)
 * - Video metadata display (resolution, codec, GOP size, etc.)
 * - Performance metrics (latency, cache hit rate)
 * - Memory management (bounded cache, no leaks)
 *
 * Phase 0, Task 0.3, Phase 4 deliverable.
 */
export function WebCodecsDemo() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sliderValue, setSliderValue] = useState<number>(0);

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
    isPlaying,
    playbackRate,
    play,
    pause,
    setPlaybackRate,
    metadata,
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
    if (isPlaying) pause();
    await seekToFrame(Math.max(0, currentFrame - 5));
  };

  const handleCoarseStepForward = async () => {
    if (isPlaying) pause();
    await seekToFrame(Math.min(totalFrames - 1, currentFrame + 5));
  };

  const handleFineStepBackward = async () => {
    if (isPlaying) pause();
    await stepBackward();
  };

  const handleFineStepForward = async () => {
    if (isPlaying) pause();
    await stepForward();
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update slider visual position immediately (responsive UI)
    setSliderValue(Number(e.target.value));
  };

  const handleSliderRelease = async () => {
    // Pause and seek when user releases the slider
    if (isPlaying) pause();
    await seekToFrame(sliderValue);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handlePlaybackRateChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setPlaybackRate(Number(e.target.value));
  };

  // Sync slider with currentFrame when stepping or when seek completes
  useEffect(() => {
    setSliderValue(currentFrame);
  }, [currentFrame]);

  // Expose test API on window object for Playwright tests
  useEffect(() => {
    if (isReady) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__webCodecsTestAPI = {
        seekToFrame,
        getCurrentFrame: () => currentFrame,
        getTotalFrames: () => totalFrames,
        getFramerate: () => metadata?.framerate || 30,
        isReady: () => isReady,
      };
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__webCodecsTestAPI;
    };
  }, [isReady, seekToFrame, currentFrame, totalFrames, metadata]);

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
            data-testid="frame-counter"
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "20px",
              fontFamily: "monospace",
            }}
          >
            Frame {currentFrame} of {totalFrames}
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
              data-testid="step-backward-coarse"
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
              data-testid="step-forward-coarse"
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
              data-testid="step-backward-fine"
              onClick={handleFineStepBackward}
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
              data-testid="step-forward-fine"
              onClick={handleFineStepForward}
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

          {/* Playback Controls */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              marginBottom: "20px",
              maxWidth: "600px",
            }}
          >
            <button
              data-testid="play-pause"
              onClick={handlePlayPause}
              disabled={currentFrame >= totalFrames - 1 && !isPlaying}
              style={{
                padding: "15px 30px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor:
                  currentFrame >= totalFrames - 1 && !isPlaying
                    ? "not-allowed"
                    : "pointer",
                backgroundColor: isPlaying ? "#FF5722" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                minWidth: "120px",
              }}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontWeight: "bold",
              }}
            >
              Speed:
              <select
                value={playbackRate.toString()}
                onChange={handlePlaybackRateChange}
                style={{
                  padding: "10px",
                  fontSize: "14px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="0.1">0.1x</option>
                <option value="0.25">0.25x</option>
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1.0x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
            </label>
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
              value={sliderValue}
              onChange={handleSliderChange}
              onMouseUp={handleSliderRelease}
              onTouchEnd={handleSliderRelease}
              style={{ width: "100%", height: "30px" }}
            />
          </div>

          {/* Performance Metrics */}
          <div
            data-testid="cache-stats"
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
              <div style={{ marginTop: "5px" }}>
                <strong>Evictions:</strong> {cacheStats.evictions}
              </div>
            </div>
          </div>

          {/* Video Metadata */}
          {metadata && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: "#f0f8ff",
                border: "1px solid #0066cc",
                borderRadius: "4px",
                maxWidth: "600px",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Video Metadata</h3>
              <table
                style={{
                  width: "100%",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  borderCollapse: "collapse",
                }}
              >
                <tbody>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                        width: "40%",
                      }}
                    >
                      Resolution
                    </td>
                    <td style={{ padding: "8px" }}>
                      {metadata.width} x {metadata.height}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      Codec
                    </td>
                    <td style={{ padding: "8px" }}>{metadata.codec}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      Total Frames
                    </td>
                    <td style={{ padding: "8px" }}>{metadata.totalFrames}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      Framerate
                    </td>
                    <td style={{ padding: "8px" }}>
                      {metadata.framerate.toFixed(2)} fps
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      Duration
                    </td>
                    <td style={{ padding: "8px" }}>
                      {metadata.duration.toFixed(2)} seconds
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      GOP Size
                    </td>
                    <td style={{ padding: "8px" }}>
                      {metadata.gopSize} frames
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      File Size
                    </td>
                    <td style={{ padding: "8px" }}>
                      {metadata.fileSizeMB.toFixed(2)} MB
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      Read-Ahead Buffer
                    </td>
                    <td style={{ padding: "8px" }}>
                      60 frames (2s @ {metadata.framerate.toFixed(0)} fps)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
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
