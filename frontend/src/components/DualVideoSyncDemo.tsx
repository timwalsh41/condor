import { useState, useCallback, useRef, useEffect } from "react";
import { Stage, Layer, Line } from "react-konva";
import type Konva from "konva";
import { useWebCodecsDecoder } from "../hooks/useWebCodecsDecoder";
import { AnnotationManager } from "../utils/AnnotationManager";
import type { Annotation, AnnotationType } from "../types/annotations";
import { checkWebCodecsSupport } from "../utils/featureDetection";
import {
  initializePlayhead,
  advancePlayhead,
  calculateTargetFrames,
  calculatePlayheadRange,
  type PlayheadState
} from "../utils/dualVideoPlayback";

/**
 * Dual Video Synchronization Demo Component
 *
 * Demonstrates synchronized dual-video playback with WebCodecs.
 * Two modes:
 * - SYNC: Independent controls for setting synchronization points
 * - PLAYBACK: Unified controls maintaining frame offset
 *
 * Phase 0, Task 0.4 deliverable.
 */
export function DualVideoSyncDemo() {
  // File state
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  // Mode state
  const [mode, setMode] = useState<'SYNC' | 'PLAYBACK'>('SYNC');
  const [syncOffset, setSyncOffset] = useState<number | null>(null);
  const [syncPoints, setSyncPoints] = useState<{ frameA: number; frameB: number } | null>(null);

  // Scrub bar state (for responsive UI updates)
  const [sliderValueA, setSliderValueA] = useState<number>(0);
  const [sliderValueB, setSliderValueB] = useState<number>(0);
  const [sliderValueBoth, setSliderValueBoth] = useState<number>(0);

  // PLAYBACK mode state
  const [isPlayingBoth, setIsPlayingBoth] = useState(false);
  const [playbackRateBoth, setPlaybackRateBoth] = useState(1.0);
  const [playheadState, setPlayheadState] = useState<PlayheadState | null>(null);
  const playheadStateRef = useRef<PlayheadState | null>(null);
  const playbackLoopRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  // Keep playhead ref in sync with state
  useEffect(() => {
    playheadStateRef.current = playheadState;
  }, [playheadState]);

  // Video decoders
  const videoA = useWebCodecsDecoder(fileA);
  const videoB = useWebCodecsDecoder(fileB);

  // Refs to always access latest decoder state (avoid stale closures in playback loop)
  const videoARef = useRef(videoA);
  const videoBRef = useRef(videoB);

  // Annotation canvas scale state (for CSS scaling to match video display size)
  const [annotationScaleA, setAnnotationScaleA] = useState(1);

  // Annotation state for Video A
  const [annotationManager] = useState(() => new AnnotationManager());
  const [selectedTool, setSelectedTool] = useState<AnnotationType>('freehand');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Tool selection will be used in future subtasks (0.5.3-0.5.5)
  void setSelectedTool;

  // Update refs on every render to capture latest state
  useEffect(() => {
    videoARef.current = videoA;
    videoBRef.current = videoB;
  });

  // Calculate annotation canvas scale to match video display size
  useEffect(() => {
    if (!videoA.canvasRef.current || !videoA.metadata) return;

    const updateScale = () => {
      const canvas = videoA.canvasRef.current;
      if (!canvas) return;

      const displayWidth = canvas.clientWidth;
      const videoWidth = videoA.metadata!.width;
      const scale = displayWidth / videoWidth;

      setAnnotationScaleA(scale);
    };

    // Initial calculation
    updateScale();

    // Update on window resize
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [videoA.canvasRef, videoA.metadata, videoA.isReady]);

  // Annotation drawing handlers for Video A
  const handleMouseDownA = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!videoA.isReady || selectedTool !== 'freehand') return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    console.log('Drawing started at:', pos);
    // Start new freehand line
    setIsDrawing(true);
    setCurrentPoints([pos.x, pos.y]);
  };

  const handleMouseMoveA = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || selectedTool !== 'freehand') return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    // Append new point to current line
    setCurrentPoints([...currentPoints, pos.x, pos.y]);
  };

  const handleMouseUpA = () => {
    if (!isDrawing || selectedTool !== 'freehand') return;

    // Finalize the annotation using AnnotationManager
    const newAnnotation = annotationManager.createAndAddAnnotation(selectedTool, currentPoints);
    
    if (newAnnotation) {
      console.log('Annotation created:', newAnnotation);
      // Update React state to trigger re-render
      setAnnotations(annotationManager.getAnnotations());
    } else {
      console.warn('Invalid annotation: points validation failed', { type: selectedTool, points: currentPoints });
    }

    // Reset drawing state
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  // Check browser support
  const support = checkWebCodecsSupport();

  // File upload handlers
  const handleFileAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileA(file);
    }
  };

  const handleFileBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileB(file);
    }
  };

  // SYNC mode handlers - Video A
  const handlePlayPauseA = () => {
    if (videoA.isPlaying) {
      videoA.pause();
    } else {
      videoA.play();
    }
  };

  const handleCoarseStepBackwardA = async () => {
    if (videoA.isPlaying) videoA.pause();
    await videoA.seekToFrame(Math.max(0, videoA.currentFrame - 5));
  };

  const handleCoarseStepForwardA = async () => {
    if (videoA.isPlaying) videoA.pause();
    await videoA.seekToFrame(Math.min(videoA.totalFrames - 1, videoA.currentFrame + 5));
  };

  const handleFineStepBackwardA = async () => {
    if (videoA.isPlaying) videoA.pause();
    await videoA.stepBackward();
  };

  const handleFineStepForwardA = async () => {
    if (videoA.isPlaying) videoA.pause();
    await videoA.stepForward();
  };

  const handlePlaybackRateChangeA = (e: React.ChangeEvent<HTMLSelectElement>) => {
    videoA.setPlaybackRate(Number(e.target.value));
  };

  // SYNC mode handlers - Video B
  const handlePlayPauseB = () => {
    if (videoB.isPlaying) {
      videoB.pause();
    } else {
      videoB.play();
    }
  };

  const handleCoarseStepBackwardB = async () => {
    if (videoB.isPlaying) videoB.pause();
    await videoB.seekToFrame(Math.max(0, videoB.currentFrame - 5));
  };

  const handleCoarseStepForwardB = async () => {
    if (videoB.isPlaying) videoB.pause();
    await videoB.seekToFrame(Math.min(videoB.totalFrames - 1, videoB.currentFrame + 5));
  };

  const handleFineStepBackwardB = async () => {
    if (videoB.isPlaying) videoB.pause();
    await videoB.stepBackward();
  };

  const handleFineStepForwardB = async () => {
    if (videoB.isPlaying) videoB.pause();
    await videoB.stepForward();
  };

  const handlePlaybackRateChangeB = (e: React.ChangeEvent<HTMLSelectElement>) => {
    videoB.setPlaybackRate(Number(e.target.value));
  };

  // SYNC mode - Video A scrub bar handlers
  const handleSliderChangeA = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update slider visual position immediately (responsive UI)
    setSliderValueA(Number(e.target.value));
  };

  const handleSliderReleaseA = async () => {
    // Pause and seek when user releases the slider
    if (videoA.isPlaying) videoA.pause();
    await videoA.seekToFrame(sliderValueA);
  };

  // SYNC mode - Video B scrub bar handlers
  const handleSliderChangeB = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update slider visual position immediately (responsive UI)
    setSliderValueB(Number(e.target.value));
  };

  const handleSliderReleaseB = async () => {
    // Pause and seek when user releases the slider
    if (videoB.isPlaying) videoB.pause();
    await videoB.seekToFrame(sliderValueB);
  };

  // Mode switching handlers
  const switchToPlaybackMode = () => {
    // Stop any playing videos
    if (videoA.isPlaying) videoA.pause();
    if (videoB.isPlaying) videoB.pause();

    // Initialize playhead state from current decoder positions
    const playhead = initializePlayhead(
      videoA.currentFrame,
      videoB.currentFrame,
      videoA.totalFrames,
      videoB.totalFrames
    );
    setPlayheadState(playhead);

    // Store sync offset and sync points
    setSyncOffset(playhead.syncOffset);
    setSyncPoints({
      frameA: videoA.currentFrame,
      frameB: videoB.currentFrame
    });

    console.log(`[PLAYBACK MODE] Initialized playhead:`, playhead);

    setMode('PLAYBACK');
  };

  const switchToSyncMode = async () => {
    // Stop playback
    stopPlayback();

    // Restore to original sync points (user likely wants to adjust)
    if (syncPoints) {
      await Promise.all([
        videoA.seekToFrame(syncPoints.frameA),
        videoB.seekToFrame(syncPoints.frameB)
      ]);
    }

    setMode('SYNC');
  };

  // PLAYBACK mode - Synchronized stepping
  const handleStepForwardFine = async () => {
    if (!syncOffset) return;

    const nextFrameA = videoA.currentFrame + 1;
    const nextFrameB = nextFrameA + syncOffset;

    // Boundary check
    if (nextFrameA >= videoA.totalFrames ||
        nextFrameB >= videoB.totalFrames ||
        nextFrameB < 0) {
      return; // Can't step further
    }

    // Step both (seekToFrame checks cache first - instant if cached)
    await Promise.all([
      videoA.seekToFrame(nextFrameA),
      videoB.seekToFrame(nextFrameB)
    ]);
  };

  const handleStepBackwardFine = async () => {
    if (syncOffset === null) return;

    const nextFrameA = videoA.currentFrame - 1;
    const nextFrameB = nextFrameA + syncOffset;

    // Boundary check
    if (nextFrameA < 0 || nextFrameB >= videoB.totalFrames || nextFrameB < 0) {
      return;
    }

    await Promise.all([
      videoA.seekToFrame(nextFrameA),
      videoB.seekToFrame(nextFrameB)
    ]);
  };

  const handleStepForwardCoarse = async () => {
    if (syncOffset === null) return;

    const nextFrameA = videoA.currentFrame + 5;
    const nextFrameB = nextFrameA + syncOffset;

    // Boundary check
    if (nextFrameA >= videoA.totalFrames ||
        nextFrameB >= videoB.totalFrames ||
        nextFrameB < 0) {
      return;
    }

    await Promise.all([
      videoA.seekToFrame(nextFrameA),
      videoB.seekToFrame(nextFrameB)
    ]);
  };

  const handleStepBackwardCoarse = async () => {
    if (syncOffset === null) return;

    const nextFrameA = videoA.currentFrame - 5;
    const nextFrameB = nextFrameA + syncOffset;

    // Boundary check
    if (nextFrameA < 0 || nextFrameB >= videoB.totalFrames || nextFrameB < 0) {
      return;
    }

    await Promise.all([
      videoA.seekToFrame(nextFrameA),
      videoB.seekToFrame(nextFrameB)
    ]);
  };

  // PLAYBACK mode - Synchronized playback loop (using top-level playhead state)
  const playbackLoopBoth = useCallback(async (timestamp: number) => {
    // Read current playhead state from ref (not closure) to avoid stale data
    const currentPlayhead = playheadStateRef.current;

    // Early exit check
    if (!isPlayingRef.current || !currentPlayhead) {
      return;
    }

    // Calculate next playhead position
    const nextPosition = advancePlayhead(currentPlayhead, 1);

    // Check if we've reached the boundary
    if (nextPosition === null) {
      console.log(`[PLAYBACK] ⛔ STOPPING PLAYBACK - boundary reached at position ${currentPlayhead.position}`);
      stopPlayback();
      return;
    }

    // Calculate target frames for both videos
    const targets = calculateTargetFrames(nextPosition, currentPlayhead.syncOffset);

    console.log(`[PLAYBACK] Advancing playhead ${currentPlayhead.position} → ${nextPosition}, ` +
                `targets: A=${targets.frameA}, B=${targets.frameB}, offset=${currentPlayhead.syncOffset}`);

    // Initialize timing on first frame
    if (lastFrameTimeRef.current === 0) {
      lastFrameTimeRef.current = timestamp;
    }

    const elapsed = timestamp - lastFrameTimeRef.current;
    const frameInterval = 1000 / (videoA.metadata?.framerate || 30) / playbackRateBoth;

    if (elapsed >= frameInterval) {
      // Seek both videos to target frames
      try {
        await Promise.all([
          videoA.seekToFrame(targets.frameA),
          videoB.seekToFrame(targets.frameB)
        ]);

        // Update playhead state (THIS is our source of truth)
        const newPlayheadState = {
          ...currentPlayhead,
          position: nextPosition
        };
        setPlayheadState(newPlayheadState);
        playheadStateRef.current = newPlayheadState; // Update ref immediately

        // Update timestamp only after both steps complete
        lastFrameTimeRef.current = timestamp;
      } catch (error) {
        console.error('[PLAYBACK] Error during seek:', error);
        stopPlayback();
        return;
      }
    }

    // Schedule next frame only if still playing
    if (isPlayingRef.current) {
      playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
    }
  }, [playbackRateBoth, videoA, videoB]);

  const startPlayback = () => {
    isPlayingRef.current = true;
    setIsPlayingBoth(true);
    lastFrameTimeRef.current = 0;
    playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
  };

  const stopPlayback = () => {
    isPlayingRef.current = false;
    setIsPlayingBoth(false);
    if (playbackLoopRef.current) {
      cancelAnimationFrame(playbackLoopRef.current);
      playbackLoopRef.current = null;
    }
    lastFrameTimeRef.current = 0;
  };

  const handlePlayPauseBoth = () => {
    if (isPlayingBoth) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = Number(e.target.value);
    setPlaybackRateBoth(rate);
    // Note: Don't call videoA.setPlaybackRate() - we control timing in our loop
  };

  // PLAYBACK mode - Joint scrub bar handlers
  const handleSliderChangeBoth = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update slider visual position immediately (responsive UI)
    setSliderValueBoth(Number(e.target.value));
  };

  const handleSliderReleaseBoth = async () => {
    if (!playheadState) return;

    // Stop playback
    if (isPlayingBoth) stopPlayback();

    let newPosition = sliderValueBoth;

    // Calculate valid range based on sync offset
    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      playheadState.syncOffset
    );

    // Clamp position to valid range
    newPosition = Math.max(range.min, Math.min(range.max, newPosition));

    if (newPosition !== sliderValueBoth) {
      console.log(`[SCRUB] Clamped position ${sliderValueBoth} → ${newPosition} (range: ${range.min}-${range.max})`);
      setSliderValueBoth(newPosition); // Update slider to show clamped value
    }

    // Calculate target frames
    const targets = calculateTargetFrames(newPosition, playheadState.syncOffset);

    // Seek both videos to target frames
    await Promise.all([
      videoA.seekToFrame(targets.frameA),
      videoB.seekToFrame(targets.frameB)
    ]);

    // Update playhead state
    setPlayheadState({
      ...playheadState,
      position: newPosition
    });

    console.log(`[SCRUB] Moved playhead to ${newPosition}, targets: A=${targets.frameA}, B=${targets.frameB}`);
  };

  // Sync slider values with current frame positions
  useEffect(() => {
    setSliderValueA(videoA.currentFrame);
  }, [videoA.currentFrame]);

  useEffect(() => {
    setSliderValueB(videoB.currentFrame);
  }, [videoB.currentFrame]);

  useEffect(() => {
    // In PLAYBACK mode, the joint slider tracks the playhead position
    if (playheadState) {
      setSliderValueBoth(playheadState.position);
    }
  }, [playheadState]);

  // Cleanup effect - only cancel on unmount
  useEffect(() => {
    return () => {
      if (playbackLoopRef.current) {
        cancelAnimationFrame(playbackLoopRef.current);
        playbackLoopRef.current = null;
      }
    };
  }, []);

  if (!support.isSupported) {
    return (
      <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
        <h1>Dual Video Sync Demo</h1>
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

  const bothVideosReady = videoA.isReady && videoB.isReady;

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>Dual Video Synchronization Demo</h1>
      <p>
        Synchronized dual-video playback with WebCodecs. Set sync points in SYNC mode,
        then analyze with unified controls in PLAYBACK mode.
      </p>

      {/* Mode Indicator */}
      <div
        data-testid="mode-indicator"
        style={{
          padding: "15px",
          marginTop: "20px",
          marginBottom: "20px",
          backgroundColor: mode === 'SYNC' ? '#e3f2fd' : '#e8f5e9',
          border: mode === 'SYNC' ? '2px solid #2196F3' : '2px solid #4CAF50',
          borderRadius: "4px",
          textAlign: "center",
        }}
      >
        <h2 style={{ margin: 0, color: mode === 'SYNC' ? '#1976D2' : '#388E3C' }}>
          {mode === 'SYNC' ? '🔵 SYNC MODE' : '🟢 PLAYBACK MODE'}
        </h2>
        <p style={{ margin: "10px 0 0 0" }}>
          {mode === 'SYNC'
            ? 'Use independent controls to set synchronization points for each video'
            : 'Videos synchronized - use unified controls to analyze together'}
        </p>
      </div>

      {/* Mode Toggle Button */}
      {bothVideosReady && (
        <div style={{ marginBottom: "20px", textAlign: "center" }}>
          <button
            data-testid="mode-toggle"
            onClick={mode === 'SYNC' ? switchToPlaybackMode : switchToSyncMode}
            style={{
              padding: "15px 30px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              backgroundColor: mode === 'SYNC' ? '#4CAF50' : '#2196F3',
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            {mode === 'SYNC' ? 'Switch to PLAYBACK Mode →' : '← Switch to SYNC Mode'}
          </button>
        </div>
      )}

      {/* File Upload */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
            Upload Video A (MP4):
          </label>
          <input
            data-testid="file-input-a"
            type="file"
            accept="video/mp4"
            onChange={handleFileAChange}
            style={{ padding: "10px", fontSize: "14px", width: "100%" }}
          />
          {fileA && !videoA.isReady && !videoA.error && (
            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#eff", border: "1px solid #0cc" }}>
              Initializing decoder A...
            </div>
          )}
          {videoA.error && (
            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#fee", border: "1px solid #c00" }}>
              <strong>Error:</strong> {videoA.error}
            </div>
          )}
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
            Upload Video B (MP4):
          </label>
          <input
            data-testid="file-input-b"
            type="file"
            accept="video/mp4"
            onChange={handleFileBChange}
            style={{ padding: "10px", fontSize: "14px", width: "100%" }}
          />
          {fileB && !videoB.isReady && !videoB.error && (
            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#eff", border: "1px solid #0cc" }}>
              Initializing decoder B...
            </div>
          )}
          {videoB.error && (
            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#fee", border: "1px solid #c00" }}>
              <strong>Error:</strong> {videoB.error}
            </div>
          )}
        </div>
      </div>

      {/* Video Display - Side by Side */}
      {(videoA.isReady || videoB.isReady) && (
        <div>
          {/* Canvases */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            {/* Video A Canvas */}
            <div>
              <h3 style={{ marginTop: 0 }}>Video A</h3>
              {videoA.isReady ? (
                <>
                  <div style={{ border: "2px solid #333", backgroundColor: "#000", position: "relative" }}>
                    <canvas
                      ref={videoA.canvasRef}
                      data-testid="video-canvas-a"
                      style={{ display: "block", maxWidth: "100%", height: "auto" }}
                    />
                    {/* Annotation overlay canvas */}
                    {videoA.metadata && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "auto", // Enable mouse events
                          overflow: "hidden",
                        }}
                      >
                        <div style={{
                          transform: `scale(${annotationScaleA})`,
                          transformOrigin: "top left",
                        }}>
                          <Stage
                            width={videoA.metadata.width}
                            height={videoA.metadata.height}
                            onMouseDown={handleMouseDownA}
                            onMouseMove={handleMouseMoveA}
                            onMouseUp={handleMouseUpA}
                            onMouseLeave={handleMouseUpA} // Finish drawing if mouse leaves canvas
                          >
                            <Layer>
                              {/* Render completed annotations */}
                              {annotations.map((annotation) => (
                                <Line
                                  key={annotation.id}
                                  points={annotation.points}
                                  stroke={annotation.color}
                                  strokeWidth={annotation.strokeWidth}
                                  lineCap="round"
                                  lineJoin="round"
                                  tension={0.5} // Smooth curves for freehand
                                />
                              ))}
                              {/* Render current drawing in progress */}
                              {isDrawing && currentPoints.length >= 2 && (
                                <Line
                                  points={currentPoints}
                                  stroke="#FF0000"
                                  strokeWidth={3}
                                  lineCap="round"
                                  lineJoin="round"
                                  tension={0.5}
                                  dash={[10, 5]} // Dashed line for preview
                                />
                              )}
                            </Layer>
                          </Stage>
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    data-testid="frame-counter-a"
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      marginTop: "10px",
                      fontFamily: "monospace",
                    }}
                  >
                    Frame {videoA.currentFrame} of {videoA.totalFrames}
                  </div>
                </>
              ) : (
                <div style={{
                  padding: "100px 20px",
                  backgroundColor: "#f5f5f5",
                  border: "2px dashed #ccc",
                  textAlign: "center",
                  color: "#999"
                }}>
                  {fileA ? "Loading..." : "No video loaded"}
                </div>
              )}
            </div>

            {/* Video B Canvas */}
            <div>
              <h3 style={{ marginTop: 0 }}>Video B</h3>
              {videoB.isReady ? (
                <>
                  <div style={{ border: "2px solid #333", backgroundColor: "#000" }}>
                    <canvas
                      ref={videoB.canvasRef}
                      style={{ display: "block", maxWidth: "100%", height: "auto" }}
                    />
                  </div>
                  <div
                    data-testid="frame-counter-b"
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      marginTop: "10px",
                      fontFamily: "monospace",
                    }}
                  >
                    Frame {videoB.currentFrame} of {videoB.totalFrames}
                  </div>
                </>
              ) : (
                <div style={{
                  padding: "100px 20px",
                  backgroundColor: "#f5f5f5",
                  border: "2px dashed #ccc",
                  textAlign: "center",
                  color: "#999"
                }}>
                  {fileB ? "Loading..." : "No video loaded"}
                </div>
              )}
            </div>
          </div>

          {/* SYNC Mode Controls */}
          {mode === 'SYNC' && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              {/* Video A Controls */}
              <div data-testid="video-a-controls" style={{ padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                <h3 style={{ marginTop: 0 }}>Video A Controls</h3>

                {/* Play/Pause */}
                <button
                  data-testid="play-pause-a"
                  onClick={handlePlayPauseA}
                  style={{
                    padding: "15px 30px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    backgroundColor: videoA.isPlaying ? "#FF5722" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    width: "100%",
                    marginBottom: "10px",
                  }}
                >
                  {videoA.isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                {/* Stepping Controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <button
                    data-testid="step-backward-coarse-a"
                    onClick={handleCoarseStepBackwardA}
                    disabled={videoA.currentFrame === 0}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: videoA.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor: videoA.currentFrame === 0 ? "#ccc" : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    ← Back 5
                  </button>
                  <button
                    data-testid="step-forward-coarse-a"
                    onClick={handleCoarseStepForwardA}
                    disabled={videoA.currentFrame >= videoA.totalFrames - 1}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: videoA.currentFrame >= videoA.totalFrames - 1 ? "not-allowed" : "pointer",
                      backgroundColor: videoA.currentFrame >= videoA.totalFrames - 1 ? "#ccc" : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Forward 5 →
                  </button>
                  <button
                    data-testid="step-backward-fine-a"
                    onClick={handleFineStepBackwardA}
                    disabled={videoA.currentFrame === 0}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      cursor: videoA.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor: videoA.currentFrame === 0 ? "#ccc" : "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    ← Back 1
                  </button>
                  <button
                    data-testid="step-forward-fine-a"
                    onClick={handleFineStepForwardA}
                    disabled={videoA.currentFrame >= videoA.totalFrames - 1}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      cursor: videoA.currentFrame >= videoA.totalFrames - 1 ? "not-allowed" : "pointer",
                      backgroundColor: videoA.currentFrame >= videoA.totalFrames - 1 ? "#ccc" : "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Forward 1 →
                  </button>
                </div>

                {/* Speed Control */}
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold" }}>
                  Speed:
                  <select
                    data-testid="speed-select-a"
                    value={videoA.playbackRate}
                    onChange={handlePlaybackRateChangeA}
                    style={{
                      padding: "8px",
                      fontSize: "14px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      flex: 1,
                    }}
                  >
                    <option value="0.1">0.1x</option>
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="1">1.0x</option>
                    <option value="2">2.0x</option>
                  </select>
                </label>

                {/* Scrub Bar */}
                <div style={{ marginTop: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Seek to Frame:
                  </label>
                  <input
                    data-testid="scrub-bar-a"
                    type="range"
                    min="0"
                    max={videoA.totalFrames - 1}
                    value={sliderValueA}
                    onChange={handleSliderChangeA}
                    onMouseUp={handleSliderReleaseA}
                    onTouchEnd={handleSliderReleaseA}
                    style={{ width: "100%", height: "30px" }}
                  />
                </div>
              </div>

              {/* Video B Controls */}
              <div data-testid="video-b-controls" style={{ padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                <h3 style={{ marginTop: 0 }}>Video B Controls</h3>

                {/* Play/Pause */}
                <button
                  data-testid="play-pause-b"
                  onClick={handlePlayPauseB}
                  style={{
                    padding: "15px 30px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    backgroundColor: videoB.isPlaying ? "#FF5722" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    width: "100%",
                    marginBottom: "10px",
                  }}
                >
                  {videoB.isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                {/* Stepping Controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <button
                    data-testid="step-backward-coarse-b"
                    onClick={handleCoarseStepBackwardB}
                    disabled={videoB.currentFrame === 0}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: videoB.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor: videoB.currentFrame === 0 ? "#ccc" : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    ← Back 5
                  </button>
                  <button
                    data-testid="step-forward-coarse-b"
                    onClick={handleCoarseStepForwardB}
                    disabled={videoB.currentFrame >= videoB.totalFrames - 1}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: videoB.currentFrame >= videoB.totalFrames - 1 ? "not-allowed" : "pointer",
                      backgroundColor: videoB.currentFrame >= videoB.totalFrames - 1 ? "#ccc" : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Forward 5 →
                  </button>
                  <button
                    data-testid="step-backward-fine-b"
                    onClick={handleFineStepBackwardB}
                    disabled={videoB.currentFrame === 0}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      cursor: videoB.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor: videoB.currentFrame === 0 ? "#ccc" : "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    ← Back 1
                  </button>
                  <button
                    data-testid="step-forward-fine-b"
                    onClick={handleFineStepForwardB}
                    disabled={videoB.currentFrame >= videoB.totalFrames - 1}
                    style={{
                      padding: "10px",
                      fontSize: "14px",
                      cursor: videoB.currentFrame >= videoB.totalFrames - 1 ? "not-allowed" : "pointer",
                      backgroundColor: videoB.currentFrame >= videoB.totalFrames - 1 ? "#ccc" : "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Forward 1 →
                  </button>
                </div>

                {/* Speed Control */}
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold" }}>
                  Speed:
                  <select
                    data-testid="speed-select-b"
                    value={videoB.playbackRate}
                    onChange={handlePlaybackRateChangeB}
                    style={{
                      padding: "8px",
                      fontSize: "14px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      flex: 1,
                    }}
                  >
                    <option value="0.1">0.1x</option>
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="1">1.0x</option>
                    <option value="2">2.0x</option>
                  </select>
                </label>

                {/* Scrub Bar */}
                <div style={{ marginTop: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                    Seek to Frame:
                  </label>
                  <input
                    data-testid="scrub-bar-b"
                    type="range"
                    min="0"
                    max={videoB.totalFrames - 1}
                    value={sliderValueB}
                    onChange={handleSliderChangeB}
                    onMouseUp={handleSliderReleaseB}
                    onTouchEnd={handleSliderReleaseB}
                    style={{ width: "100%", height: "30px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PLAYBACK Mode Controls */}
          {mode === 'PLAYBACK' && (
            <div data-testid="playback-controls" style={{ padding: "20px", backgroundColor: "#f5f5f5", borderRadius: "4px", marginBottom: "20px" }}>
              <h3 style={{ marginTop: 0 }}>Unified Playback Controls</h3>

              {/* Sync Offset Display */}
              <div
                data-testid="sync-offset-display"
                style={{
                  padding: "10px",
                  marginBottom: "15px",
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "16px",
                }}
              >
                <strong>Sync Offset:</strong> {syncOffset !== null ? (syncOffset > 0 ? '+' : '') + syncOffset : 'N/A'} frames
                <div style={{ fontSize: "14px", marginTop: "5px", color: "#666" }}>
                  Video B is {Math.abs(syncOffset || 0)} frame{Math.abs(syncOffset || 0) !== 1 ? 's' : ''} {(syncOffset || 0) > 0 ? 'ahead' : (syncOffset || 0) < 0 ? 'behind' : 'aligned with'} Video A
                </div>
              </div>

              {/* Play/Pause */}
              <button
                data-testid="play-pause-both"
                onClick={handlePlayPauseBoth}
                style={{
                  padding: "15px 30px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  backgroundColor: isPlayingBoth ? "#FF5722" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  width: "100%",
                  marginBottom: "15px",
                }}
              >
                {isPlayingBoth ? '⏸ Pause' : '▶ Play'}
              </button>

              {/* Stepping Controls */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                <button
                  data-testid="step-backward-coarse-both"
                  onClick={handleStepBackwardCoarse}
                  style={{
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  ← Back 5 Frames
                </button>
                <button
                  data-testid="step-backward-fine-both"
                  onClick={handleStepBackwardFine}
                  style={{
                    padding: "12px",
                    fontSize: "14px",
                    cursor: "pointer",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  ← Back 1 Frame
                </button>
                <button
                  data-testid="step-forward-fine-both"
                  onClick={handleStepForwardFine}
                  style={{
                    padding: "12px",
                    fontSize: "14px",
                    cursor: "pointer",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Forward 1 Frame →
                </button>
                <button
                  data-testid="step-forward-coarse-both"
                  onClick={handleStepForwardCoarse}
                  style={{
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Forward 5 Frames →
                </button>
              </div>

              {/* Speed Control */}
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold" }}>
                Playback Speed:
                <select
                  data-testid="speed-select-both"
                  value={playbackRateBoth}
                  onChange={handleSpeedChange}
                  style={{
                    padding: "10px",
                    fontSize: "14px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    flex: 1,
                  }}
                >
                  <option value="0.1">0.1x</option>
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="1">1.0x</option>
                  <option value="2">2.0x</option>
                </select>
              </label>

              {/* Joint Scrub Bar */}
              {playheadState && (() => {
                const range = calculatePlayheadRange(
                  videoA.totalFrames,
                  videoB.totalFrames,
                  playheadState.syncOffset
                );
                return (
                  <div style={{ marginTop: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                      Seek to Frame (Video A position, Video B maintains offset):
                    </label>
                    <input
                      data-testid="scrub-bar-both"
                      type="range"
                      min={range.min}
                      max={range.max}
                      value={sliderValueBoth}
                      onChange={handleSliderChangeBoth}
                      onMouseUp={handleSliderReleaseBoth}
                      onTouchEnd={handleSliderReleaseBoth}
                      style={{ width: "100%", height: "30px" }}
                    />
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                      Video A: Frame {sliderValueBoth} / {range.max} |
                      Video B: Frame {sliderValueBoth + playheadState.syncOffset} / {videoB.totalFrames - 1}
                      {range.min > 0 && ` (min: ${range.min})`}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {(!fileA || !fileB) && (
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
            <li>Upload two MP4 video files (Video A and Video B)</li>
            <li>
              <strong>SYNC Mode:</strong> Use independent controls to navigate each video to the desired synchronization point
              <ul>
                <li>Play/pause each video independently</li>
                <li>Step frame-by-frame (±1 frame) or coarse step (±5 frames)</li>
                <li>Adjust playback speed independently</li>
              </ul>
            </li>
            <li>
              <strong>Switch to PLAYBACK Mode:</strong> Click the mode toggle button
              <ul>
                <li>Sync offset is calculated: offset = frameB - frameA</li>
                <li>Original positions are saved as sync points</li>
              </ul>
            </li>
            <li>
              <strong>PLAYBACK Mode:</strong> Use unified controls to analyze synchronized videos
              <ul>
                <li>Play/pause both videos together</li>
                <li>Step both videos maintaining exact offset</li>
                <li>Adjust speed for both videos simultaneously</li>
              </ul>
            </li>
            <li>
              <strong>Return to SYNC Mode:</strong> Videos restore to original sync points for easy adjustment
            </li>
          </ol>
          <p>
            <strong>Test Videos:</strong> Sample videos are available in{" "}
            <code>frontend/tests/fixtures/videos/</code>
          </p>
        </div>
      )}
    </div>
  );
}
