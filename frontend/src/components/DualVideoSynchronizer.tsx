import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Stage, Layer, Line, Arrow, Ellipse, Rect, Text as KonvaText } from "react-konva";
import { useWebCodecsDecoder } from "../hooks/useWebCodecsDecoder";
import { useVideoAnnotations } from "../hooks/useVideoAnnotations";
import type { Point, AnnotationType } from "../types/annotations";
import {
  checkWebCodecsSupport,
  getBrowserCodecSupport,
} from "../utils/featureDetection";
import {
  initializePlayhead,
  advancePlayhead,
  calculateTargetFrames,
  calculatePlayheadRange,
  type PlayheadState,
} from "../utils/dualVideoPlayback";
import { VideoUploadWorkflow } from "./VideoUploadWorkflow";
import { TrimScrubBar } from "./TrimScrubBar";
import { useVideoStore } from "../store/videoStore";
import { useAnnotationStore } from "../store/annotationStore";
import { useTrimStore } from "../store/trimStore";
import type { VideoMetadata } from "../types/api";

/**
 * Dual Video Synchronizer - Production Application
 *
 * Integrated video upload workflow with synchronized dual-video playback.
 * Two modes:
 * - SYNC: Independent controls for setting synchronization points
 * - PLAYBACK: Unified controls maintaining frame offset
 *
 * Phase 1, Task 1.3.2: Production app with backend integration.
 */

// Control point sizing configuration
const CONTROL_POINT_SIZE = 12; // Visual size of control point square in pixels
const CONTROL_POINT_HIT_SCALE = 1.5; // Hit detection area scale factor (1.5x = 18px)
const CONTROL_POINT_HIT_SIZE = CONTROL_POINT_SIZE * CONTROL_POINT_HIT_SCALE;

export function DualVideoSynchronizer() {
  // Get video state from zustand store
  const { sessionId, videoA: videoAStore, videoB: videoBStore, setSessionId, setVideoA, setVideoB } =
    useVideoStore();

  // Convert blobs to Files for WebCodecs decoder (memoized to prevent unnecessary re-initialization)
  const fileA = useMemo(() =>
    videoAStore?.blob && videoAStore.metadata
      ? new File([videoAStore.blob], videoAStore.metadata.filename, { type: "video/mp4" })
      : null,
    [videoAStore]
  );

  const fileB = useMemo(() =>
    videoBStore?.blob && videoBStore.metadata
      ? new File([videoBStore.blob], videoBStore.metadata.filename, { type: "video/mp4" })
      : null,
    [videoBStore]
  );

  // Mode state
  const [mode, setMode] = useState<"SYNC" | "PLAYBACK">("SYNC");
  const [syncOffset, setSyncOffset] = useState<number | null>(null);
  const [syncPoints, setSyncPoints] = useState<{
    frameA: number;
    frameB: number;
  } | null>(null);

  // Scrub bar state (for responsive UI updates)
  const [sliderValueA, setSliderValueA] = useState<number>(0);
  const [sliderValueB, setSliderValueB] = useState<number>(0);
  const [sliderValueBoth, setSliderValueBoth] = useState<number>(0);

  // PLAYBACK mode state
  const [isPlayingBoth, setIsPlayingBoth] = useState(false);
  const [playbackRateBoth, setPlaybackRateBoth] = useState(1.0);
  const [playheadState, setPlayheadState] = useState<PlayheadState | null>(
    null
  );
  const playheadStateRef = useRef<PlayheadState | null>(null);
  const playbackLoopRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  // Trim state (non-destructive, unified playhead position = Video A frame units)
  const { trimStart, trimEnd, setTrimStart, setTrimEnd } = useTrimStore();
  // Refs for trim bounds — accessed in playback loop to avoid stale closure
  const trimStartRef = useRef<number | null>(trimStart);
  const trimEndRef = useRef<number | null>(trimEnd);
  useEffect(() => { trimStartRef.current = trimStart; }, [trimStart]);
  useEffect(() => { trimEndRef.current = trimEnd; }, [trimEnd]);

  // Loop mode — when on, playback restarts from trimStart upon reaching an end boundary
  const [isLooping, setIsLooping] = useState(false);
  const isLoopingRef = useRef(false);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

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

  // Track which video is active for keyboard shortcuts (used by annotation hooks for keyboard handling)
  const [activeVideo, setActiveVideo] = useState<"A" | "B" | null>(null);

  // Unified annotation tool selection (shared between both videos)
  const [selectedTool, setSelectedTool] = useState<AnnotationType>("select");

  // Annotation state for Video A (using custom hook)
  const videoAAnnotations = useVideoAnnotations(
    videoA,
    "A",
    activeVideo,
    setActiveVideo,
    selectedTool,
    setSelectedTool
  );
  const {
    manager: annotationManagerA,
    drawingState: drawingStateA,
    annotations: annotationsA,
    selectedIds: selectedIdsA,
    polylineMousePos: polylineMousePosA,
    scale: annotationScaleA,
    handlers: handlersA,
    clearAll: clearAllA,
    updateAnnotationText: updateAnnotationTextA,
    isDraggingAnnotation: isDraggingAnnotationA,
    isReshapingAnnotation: isReshapingAnnotationA,
    undo: undoA,
    redo: redoA,
    canUndo: canUndoA,
    canRedo: canRedoA,
  } = videoAAnnotations;

  // Annotation state for Video B (using custom hook)
  const videoBAnnotations = useVideoAnnotations(
    videoB,
    "B",
    activeVideo,
    setActiveVideo,
    selectedTool,
    setSelectedTool
  );
  const {
    manager: annotationManagerB,
    drawingState: drawingStateB,
    annotations: annotationsB,
    selectedIds: selectedIdsB,
    polylineMousePos: polylineMousePosB,
    scale: annotationScaleB,
    handlers: handlersB,
    clearAll: clearAllB,
    updateAnnotationText: updateAnnotationTextB,
    isDraggingAnnotation: isDraggingAnnotationB,
    isReshapingAnnotation: isReshapingAnnotationB,
    undo: undoB,
    redo: redoB,
    canUndo: canUndoB,
    canRedo: canRedoB,
  } = videoBAnnotations;

  // Sync hook annotation state to Zustand store (for session persistence)
  // Use getState() to avoid creating reactive subscriptions that cause render loops.
  useEffect(() => {
    useAnnotationStore.getState().setAnnotationsA(annotationsA);
  }, [annotationsA]);
  useEffect(() => {
    useAnnotationStore.getState().setAnnotationsB(annotationsB);
  }, [annotationsB]);

  // Video height slider configuration
  const videoHeightConfig = useMemo(() => {
    // Calculate max height as minimum of both videos' heights (accounting for rotation)
    const getVideoHeight = (metadata: typeof videoA.metadata) => {
      if (!metadata) return null;
      const rotation = metadata.rotation || 0;
      const isRotated = rotation === 90 || rotation === 270;
      return isRotated ? metadata.width : metadata.height;
    };

    const heightA = videoA.metadata ? getVideoHeight(videoA.metadata) : null;
    const heightB = videoB.metadata ? getVideoHeight(videoB.metadata) : null;

    // Max height is minimum of both videos (or single video if only one loaded)
    let maxHeight: number;
    if (heightA !== null && heightB !== null) {
      maxHeight = Math.min(heightA, heightB);
    } else if (heightA !== null) {
      maxHeight = heightA;
    } else if (heightB !== null) {
      maxHeight = heightB;
    } else {
      maxHeight = 1280; // Fallback if no videos loaded
    }

    // Default height is minimum of 640px and max height
    const defaultHeight = Math.min(640, maxHeight);

    return {
      min: 128,
      max: maxHeight,
      default: defaultHeight,
    };
  }, [videoA, videoB]);

  const [videoHeight, setVideoHeight] = useState(videoHeightConfig.default);

  // Update videoHeight when videos change
  useEffect(() => {
    setVideoHeight(videoHeightConfig.default);
  }, [videoHeightConfig.default]);

  // Update refs on every render to capture latest state
  useEffect(() => {
    videoARef.current = videoA;
    videoBRef.current = videoB;
  });

  // Helper to convert Point[] to flat number[] for Konva rendering
  const pointsToKonva = (points: Point[]): number[] => {
    return points.flatMap((p) => [p.x, p.y]);
  };

  // Helper to get control points for an annotation based on type
  const getControlPoints = (annotation: {
    type: string;
    points: Point[];
  }): Point[] => {
    switch (annotation.type) {
      case "freehand":
        // For freehand, only show start and end points
        if (annotation.points.length >= 2) {
          return [
            annotation.points[0],
            annotation.points[annotation.points.length - 1],
          ];
        }
        return annotation.points;

      case "polyline":
      case "arrow":
        // For polyline and arrow, show all points (vertices)
        return annotation.points;

      case "angle":
        // For angle, control points are all 3 defining points: vertex, arm1-end, arm2-end
        return annotation.points;

      case "oval": {
        const start = annotation.points[0];
        const end = annotation.points[1];
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return [
          { x: minX, y: minY }, // Top-left corner
          { x: centerX, y: minY }, // Top-center
          { x: maxX, y: minY }, // Top-right corner
          { x: maxX, y: centerY }, // Right-center
          { x: maxX, y: maxY }, // Bottom-right corner
          { x: centerX, y: maxY }, // Bottom-center
          { x: minX, y: maxY }, // Bottom-left corner
          { x: minX, y: centerY }, // Left-center
        ];
      }

      default:
        return annotation.points;
    }
  };

  // Check browser support
  const support = checkWebCodecsSupport();
  const [browserCodecSupport, setBrowserCodecSupport] = useState<string>("");

  // Load browser codec support on mount
  useEffect(() => {
    getBrowserCodecSupport().then(setBrowserCodecSupport);
  }, []);

  // Upload completion handlers
  const handleVideoAUploadComplete = (metadata: VideoMetadata, blob: Blob) => {
    // Store session ID from first upload
    if (!sessionId && metadata.session_id) {
      setSessionId(metadata.session_id);
    }

    // Clear annotations for this channel before loading the new video
    clearAllA();

    // Store video A metadata and blob
    setVideoA({ metadata, blob });
  };

  const handleVideoBUploadComplete = (metadata: VideoMetadata, blob: Blob) => {
    // Clear annotations for this channel before loading the new video
    clearAllB();

    // Store video B metadata and blob
    setVideoB({ metadata, blob });
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
    await videoA.seekToFrame(
      Math.min(videoA.totalFrames - 1, videoA.currentFrame + 5)
    );
  };

  const handleFineStepBackwardA = async () => {
    if (videoA.isPlaying) videoA.pause();
    await videoA.stepBackward();
  };

  const handleFineStepForwardA = async () => {
    if (videoA.isPlaying) videoA.pause();
    await videoA.stepForward();
  };

  const handlePlaybackRateChangeA = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
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
    await videoB.seekToFrame(
      Math.min(videoB.totalFrames - 1, videoB.currentFrame + 5)
    );
  };

  const handleFineStepBackwardB = async () => {
    if (videoB.isPlaying) videoB.pause();
    await videoB.stepBackward();
  };

  const handleFineStepForwardB = async () => {
    if (videoB.isPlaying) videoB.pause();
    await videoB.stepForward();
  };

  const handlePlaybackRateChangeB = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
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

    // Initialize trim handles to full range so they are always visible on the bar
    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      playhead.syncOffset
    );
    if (trimStart === null) setTrimStart(range.min);
    if (trimEnd === null) setTrimEnd(range.max);

    // Store sync offset and sync points
    setSyncOffset(playhead.syncOffset);
    setSyncPoints({
      frameA: videoA.currentFrame,
      frameB: videoB.currentFrame,
    });

    console.log(`[PLAYBACK MODE] Initialized playhead:`, playhead);

    setMode("PLAYBACK");
  };

  const switchToSyncMode = async () => {
    // Stop playback
    stopPlayback();

    // Restore to original sync points (user likely wants to adjust)
    if (syncPoints) {
      await Promise.all([
        videoA.seekToFrame(syncPoints.frameA),
        videoB.seekToFrame(syncPoints.frameB),
      ]);
    }

    setMode("SYNC");
  };

  // PLAYBACK mode - Synchronized stepping
  const handleStepForwardFine = async () => {
    if (!syncOffset) return;

    const nextFrameA = videoA.currentFrame + 1;
    const nextFrameB = nextFrameA + syncOffset;

    // Boundary check
    if (
      nextFrameA >= videoA.totalFrames ||
      nextFrameB >= videoB.totalFrames ||
      nextFrameB < 0
    ) {
      return; // Can't step further
    }

    // Step both (seekToFrame checks cache first - instant if cached)
    await Promise.all([
      videoA.seekToFrame(nextFrameA),
      videoB.seekToFrame(nextFrameB),
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
      videoB.seekToFrame(nextFrameB),
    ]);
  };

  const handleStepForwardCoarse = async () => {
    if (syncOffset === null) return;

    const nextFrameA = videoA.currentFrame + 5;
    const nextFrameB = nextFrameA + syncOffset;

    // Boundary check
    if (
      nextFrameA >= videoA.totalFrames ||
      nextFrameB >= videoB.totalFrames ||
      nextFrameB < 0
    ) {
      return;
    }

    await Promise.all([
      videoA.seekToFrame(nextFrameA),
      videoB.seekToFrame(nextFrameB),
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
      videoB.seekToFrame(nextFrameB),
    ]);
  };

  // PLAYBACK mode - Synchronized playback loop (using top-level playhead state)
  const playbackLoopBoth = useCallback(
    async (timestamp: number) => {
      // Read current playhead state from ref (not closure) to avoid stale data
      const currentPlayhead = playheadStateRef.current;

      // Early exit check
      if (!isPlayingRef.current || !currentPlayhead) {
        return;
      }

      // Calculate next playhead position
      const nextPosition = advancePlayhead(currentPlayhead, 1);

      // Seek both videos to trimStart and resume the playback loop (loop mode)
      const restartFromTrimStart = async () => {
        const seekFrame = trimStartRef.current ?? 0;
        const newState = { ...currentPlayhead, position: seekFrame };
        setPlayheadState(newState);
        playheadStateRef.current = newState;
        setSliderValueBoth(seekFrame);
        const loopTargets = calculateTargetFrames(seekFrame, currentPlayhead.syncOffset);
        await Promise.all([
          videoARef.current.seekToFrame(loopTargets.frameA),
          videoBRef.current.seekToFrame(loopTargets.frameB),
        ]);
        lastFrameTimeRef.current = 0;
        playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
      };

      // Check if we've reached the boundary (end of video)
      if (nextPosition === null) {
        console.log(
          `[PLAYBACK] ⛔ STOPPING PLAYBACK - boundary reached at position ${currentPlayhead.position}`
        );
        if (isLoopingRef.current) {
          restartFromTrimStart().catch(stopPlayback);
        } else {
          stopPlayback();
        }
        return;
      }

      // Check trim end — stop (or loop) when playhead would exceed trimEnd
      if (trimEndRef.current !== null && nextPosition > trimEndRef.current) {
        console.log(
          `[PLAYBACK] ⛔ STOPPING PLAYBACK - trim end reached at position ${trimEndRef.current}`
        );
        if (isLoopingRef.current) {
          restartFromTrimStart().catch(stopPlayback);
        } else {
          stopPlayback();
        }
        return;
      }

      // Calculate target frames for both videos
      const targets = calculateTargetFrames(
        nextPosition,
        currentPlayhead.syncOffset
      );

      console.log(
        `[PLAYBACK] Advancing playhead ${currentPlayhead.position} → ${nextPosition}, ` +
          `targets: A=${targets.frameA}, B=${targets.frameB}, offset=${currentPlayhead.syncOffset}`
      );

      // Initialize timing on first frame
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      const frameInterval =
        1000 / (videoA.metadata?.framerate || 30) / playbackRateBoth;

      if (elapsed >= frameInterval) {
        // Seek both videos to target frames
        try {
          await Promise.all([
            videoA.seekToFrame(targets.frameA),
            videoB.seekToFrame(targets.frameB),
          ]);

          // Update playhead state (THIS is our source of truth)
          const newPlayheadState = {
            ...currentPlayhead,
            position: nextPosition,
          };
          setPlayheadState(newPlayheadState);
          playheadStateRef.current = newPlayheadState; // Update ref immediately

          // Update timestamp only after both steps complete
          lastFrameTimeRef.current = timestamp;
        } catch (error) {
          console.error("[PLAYBACK] Error during seek:", error);
          stopPlayback();
          return;
        }
      }

      // Schedule next frame only if still playing
      if (isPlayingRef.current) {
        playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
      }
    },
    [playbackRateBoth, videoA, videoB]
  );

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
      return;
    }
    if (!playheadState) return;

    // Snap playhead to trimStart if it is outside the active trim zone
    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      playheadState.syncOffset
    );
    const effectiveTrimStart = trimStart ?? range.min;
    const effectiveTrimEnd = trimEnd ?? range.max;
    if (playheadState.position < effectiveTrimStart || playheadState.position > effectiveTrimEnd) {
      const newState = { ...playheadState, position: effectiveTrimStart };
      setPlayheadState(newState);
      playheadStateRef.current = newState;
      setSliderValueBoth(effectiveTrimStart);
      const targets = calculateTargetFrames(effectiveTrimStart, playheadState.syncOffset);
      Promise.all([
        videoA.seekToFrame(targets.frameA),
        videoB.seekToFrame(targets.frameB),
      ]).then(startPlayback).catch(console.error);
      return;
    }

    startPlayback();
  };

  const handleReturnToIn = async () => {
    if (!playheadState) return;
    if (isPlayingBoth) stopPlayback();
    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      playheadState.syncOffset
    );
    const seekFrame = trimStart ?? range.min;
    const targets = calculateTargetFrames(seekFrame, playheadState.syncOffset);
    await Promise.all([
      videoA.seekToFrame(targets.frameA),
      videoB.seekToFrame(targets.frameB),
    ]);
    const newState = { ...playheadState, position: seekFrame };
    setPlayheadState(newState);
    playheadStateRef.current = newState;
    setSliderValueBoth(seekFrame);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = Number(e.target.value);
    setPlaybackRateBoth(rate);
    // Note: Don't call videoA.setPlaybackRate() - we control timing in our loop
  };

  // PLAYBACK mode - Joint scrub bar handlers
  const handleSliderChangeBoth = (frame: number) => {
    // Update slider visual position immediately (responsive UI)
    setSliderValueBoth(frame);
  };

  const handleSliderReleaseBoth = async (frameValue: number) => {
    if (!playheadState) return;

    // Stop playback
    if (isPlayingBoth) stopPlayback();

    // Calculate valid range based on sync offset
    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      playheadState.syncOffset
    );

    // Clamp position to valid range
    const newPosition = Math.max(range.min, Math.min(range.max, frameValue));

    if (newPosition !== frameValue) {
      console.log(
        `[SCRUB] Clamped position ${frameValue} → ${newPosition} (range: ${range.min}-${range.max})`
      );
    }
    setSliderValueBoth(newPosition);

    // Calculate target frames
    const targets = calculateTargetFrames(
      newPosition,
      playheadState.syncOffset
    );

    // Seek both videos to target frames
    await Promise.all([
      videoA.seekToFrame(targets.frameA),
      videoB.seekToFrame(targets.frameB),
    ]);

    // Update playhead state
    setPlayheadState({
      ...playheadState,
      position: newPosition,
    });

    console.log(
      `[SCRUB] Moved playhead to ${newPosition}, targets: A=${targets.frameA}, B=${targets.frameB}`
    );
  };

  // Sync slider values with current frame positions
  useEffect(() => {
    setSliderValueA(videoA.currentFrame);
  }, [videoA.currentFrame]);

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────
  // Use a ref to capture latest callbacks without re-registering the listener.
  const keyboardActionsRef = useRef({
    mode,
    handlePlayPauseBoth,
    handleStepForwardFine,
    handleStepBackwardFine,
    handleStepForwardCoarse,
    handleStepBackwardCoarse,
    handlePlayPauseA,
    handlePlayPauseB,
    activeVideo,
    videoA,
    videoB,
    undoA,
    redoA,
    undoB,
    redoB,
  });
  // Update ref on every render so stale closures are never used.
  keyboardActionsRef.current = {
    mode,
    handlePlayPauseBoth,
    handleStepForwardFine,
    handleStepBackwardFine,
    handleStepForwardCoarse,
    handleStepBackwardCoarse,
    handlePlayPauseA,
    handlePlayPauseB,
    activeVideo,
    videoA,
    videoB,
    undoA,
    redoA,
    undoB,
    redoB,
  };

  useEffect(() => {
    /**
     * Returns true when the focused element is an editable input field,
     * meaning keyboard events should not be intercepted.
     */
    function isInputFocused(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el.getAttribute('contenteditable') === 'true'
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      const {
        mode: currentMode,
        handlePlayPauseBoth: playPauseBoth,
        handleStepForwardFine: stepFwdFine,
        handleStepBackwardFine: stepBwdFine,
        handleStepForwardCoarse: stepFwdCoarse,
        handleStepBackwardCoarse: stepBwdCoarse,
        handlePlayPauseA: playPauseA,
        handlePlayPauseB: playPauseB,
        activeVideo: active,
        videoA: va,
        videoB: vb,
        undoA: doUndoA,
        redoA: doRedoA,
        undoB: doUndoB,
        redoB: doRedoB,
      } = keyboardActionsRef.current;

      // Ctrl+Z: undo; Ctrl+Y or Ctrl+Shift+Z: redo (annotation history)
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (active === 'A') doUndoA();
        else if (active === 'B') doUndoB();
        return;
      }
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (active === 'A') doRedoA();
        else if (active === 'B') doRedoB();
        return;
      }

      if (currentMode === 'PLAYBACK') {
        switch (e.key) {
          case ' ':
            e.preventDefault();
            playPauseBoth();
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (e.shiftKey) {
              void stepFwdCoarse();
            } else {
              void stepFwdFine();
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (e.shiftKey) {
              void stepBwdCoarse();
            } else {
              void stepBwdFine();
            }
            break;
        }
      } else {
        // SYNC mode — step the active video if one is focused
        switch (e.key) {
          case ' ':
            e.preventDefault();
            if (active === 'A') playPauseA();
            else if (active === 'B') playPauseB();
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (active === 'A') {
              const next = va.currentFrame + (e.shiftKey ? 5 : 1);
              void va.seekToFrame(Math.min(next, va.totalFrames - 1));
            } else if (active === 'B') {
              const next = vb.currentFrame + (e.shiftKey ? 5 : 1);
              void vb.seekToFrame(Math.min(next, vb.totalFrames - 1));
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (active === 'A') {
              const prev = va.currentFrame - (e.shiftKey ? 5 : 1);
              void va.seekToFrame(Math.max(0, prev));
            } else if (active === 'B') {
              const prev = vb.currentFrame - (e.shiftKey ? 5 : 1);
              void vb.seekToFrame(Math.max(0, prev));
            }
            break;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // Empty deps: listener is registered once; keyboardActionsRef always has latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <h1>The Condor</h1>
      <p>
        Synchronized dual-video playback with WebCodecs. Set sync points in SYNC
        mode, then analyze with unified controls in PLAYBACK mode.
      </p>

      {/* Browser Compatibility Display */}
      {browserCodecSupport && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: "15px",
            backgroundColor: "#e8f4f8",
            border: "1px solid #b3d9e6",
            borderRadius: "4px",
            fontSize: "13px",
            fontFamily: "monospace",
            color: "#333",
          }}
        >
          {browserCodecSupport}
        </div>
      )}

      {/* Mode Indicator */}
      <div
        data-testid="mode-indicator"
        style={{
          padding: "10px",
          marginTop: "15px",
          marginBottom: "15px",
          backgroundColor: mode === "SYNC" ? "#e3f2fd" : "#e8f5e9",
          border: mode === "SYNC" ? "2px solid #2196F3" : "2px solid #4CAF50",
          borderRadius: "4px",
          textAlign: "center",
        }}
      >
        <h2
          style={{ margin: 0, color: mode === "SYNC" ? "#1976D2" : "#388E3C" }}
        >
          {mode === "SYNC" ? "🔵 SYNC MODE" : "🟢 PLAYBACK MODE"}
        </h2>
        <p style={{ margin: "8px 0 0 0" }}>
          {mode === "SYNC"
            ? "Use independent controls to set synchronization points for each video"
            : "Videos synchronized - use unified controls to analyze together"}
        </p>
      </div>

      {/* Mode Toggle Button */}
      {bothVideosReady && (
        <div style={{ marginBottom: "15px", textAlign: "center" }}>
          <button
            data-testid="mode-toggle"
            onClick={mode === "SYNC" ? switchToPlaybackMode : switchToSyncMode}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              backgroundColor: mode === "SYNC" ? "#4CAF50" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            {mode === "SYNC"
              ? "Switch to PLAYBACK Mode →"
              : "← Switch to SYNC Mode"}
          </button>
        </div>
      )}

      {/* Upload Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <VideoUploadWorkflow
          key="video-a"
          videoSlot="A"
          sessionId={sessionId || undefined}
          onUploadComplete={handleVideoAUploadComplete}
        />
        <VideoUploadWorkflow
          key="video-b"
          videoSlot="B"
          sessionId={sessionId || undefined}
          onUploadComplete={handleVideoBUploadComplete}
        />
      </div>

      {/* Video Display - Side by Side */}
      {(videoA.isReady || videoB.isReady) && (
        <div>
          {/* Video Size Slider */}
          <div
            style={{
              marginBottom: "15px",
              padding: "10px",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
            }}
          >
            <label
              htmlFor="video-height-slider"
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Video Display Height: {videoHeight}px
            </label>
            <input
              id="video-height-slider"
              type="range"
              min={videoHeightConfig.min}
              max={videoHeightConfig.max}
              value={videoHeight}
              onChange={(e) => setVideoHeight(Number(e.target.value))}
              style={{
                width: "100%",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "#666",
                marginTop: "4px",
              }}
            >
              <span>{videoHeightConfig.min}px (min)</span>
              <span>{videoHeightConfig.max}px (max)</span>
            </div>
          </div>

          {/* Canvases */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginBottom: "5px",
            }}
          >
            {/* Video A Canvas */}
            <div>
              <h3 style={{ marginTop: 0 }}>Video A</h3>

              {videoA.isReady && videoA.metadata ? (
                <>
                  {(() => {
                    // Calculate display dimensions based on rotation
                    const rotation = videoA.metadata.rotation || 0;
                    const isRotated = rotation === 90 || rotation === 270;
                    const baseDisplayWidth = isRotated
                      ? videoA.metadata.height
                      : videoA.metadata.width;
                    const baseDisplayHeight = isRotated
                      ? videoA.metadata.width
                      : videoA.metadata.height;

                    // Scale down if height exceeds slider value
                    const scale =
                      baseDisplayHeight > videoHeight
                        ? videoHeight / baseDisplayHeight
                        : 1;
                    const displayWidth = baseDisplayWidth * scale;
                    const displayHeight = baseDisplayHeight * scale;

                    const canvasWidth = videoA.metadata.width;
                    const canvasHeight = videoA.metadata.height;

                    return (
                      <div
                        style={{
                          border: "2px solid #333",
                          backgroundColor: "#000",
                          position: "relative",
                          width: `${displayWidth}px`,
                          height: `${displayHeight}px`,
                          maxWidth: "100%",
                        }}
                      >
                        {/* Container with explicit dimensions and scale transform */}
                        <div
                          style={{
                            position: "relative",
                            width: `${baseDisplayWidth}px`,
                            height: `${baseDisplayHeight}px`,
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                            overflow: "hidden",
                          }}
                        >
                          {/* Video canvas with rotation */}
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              width: `${canvasWidth}px`,
                              height: `${canvasHeight}px`,
                              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                              transformOrigin: "center center",
                            }}
                          >
                            <canvas
                              ref={videoA.canvasRef}
                              data-testid="video-canvas-a"
                              style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          </div>
                          {/* Annotation overlay canvas - independent of rotation */}
                          {videoA.metadata && (
                            <div
                              data-testid="annotation-container-a"
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
                              <div
                                style={{
                                  transform: `scale(${annotationScaleA})`,
                                  transformOrigin: "top left",
                                }}
                              >
                                <Stage
                                  width={baseDisplayWidth}
                                  height={baseDisplayHeight}
                                  onMouseDown={handlersA.handleMouseDown}
                                  onMouseMove={
                                    isDraggingAnnotationA ||
                                    isReshapingAnnotationA
                                      ? handlersA.handleStageMouseMove
                                      : handlersA.handleMouseMove
                                  }
                                  onMouseUp={
                                    isDraggingAnnotationA ||
                                    isReshapingAnnotationA
                                      ? handlersA.handleStageMouseUp
                                      : handlersA.handleMouseUp
                                  }
                                  onMouseLeave={
                                    isDraggingAnnotationA ||
                                    isReshapingAnnotationA
                                      ? handlersA.handleStageMouseUp
                                      : handlersA.handleMouseUp
                                  } // Finish drawing/drag/reshape if mouse leaves canvas
                                  onClick={handlersA.handleClick}
                                  onDblClick={handlersA.handleDoubleClick}
                                >
                                  <Layer>
                                    {/* Render completed annotations */}
                                    {annotationsA.map((annotation) => {
                                      const isSelected = selectedIdsA.has(
                                        annotation.id
                                      );
                                      const canDrag =
                                        isSelected &&
                                        drawingStateA.mode === "idle";
                                      const cursorStyle = canDrag
                                        ? "move"
                                        : "pointer";
                                      switch (annotation.type) {
                                        case "freehand":
                                        case "polyline":
                                          return (
                                            <>
                                              <Line
                                                key={annotation.id}
                                                points={pointsToKonva(
                                                  annotation.points
                                                )}
                                                stroke={annotation.color}
                                                strokeWidth={
                                                  annotation.strokeWidth
                                                }
                                                lineCap="round"
                                                lineJoin="round"
                                                tension={
                                                  annotation.type === "freehand"
                                                    ? 0.5
                                                    : 0
                                                }
                                                hitStrokeWidth={20}
                                                cursor={cursorStyle}
                                                onClick={(e) =>
                                                  handlersA.handleAnnotationClick(
                                                    annotation.id,
                                                    e
                                                  )
                                                }
                                                onMouseDown={(e) => {
                                                  if (canDrag) {
                                                    handlersA.handleAnnotationDragStart(
                                                      annotation.id,
                                                      e
                                                    );
                                                  }
                                                }}
                                              />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(
                                                  annotation
                                                ).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={
                                                      point.x -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    y={
                                                      point.y -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={
                                                      CONTROL_POINT_HIT_SIZE
                                                    }
                                                    cursor="pointer"
                                                    onClick={(e) => {
                                                      e.cancelBubble = true;
                                                    }}
                                                    onMouseDown={(e) => {
                                                      handlersA.handleControlPointMouseDown(
                                                        annotation.id,
                                                        idx,
                                                        e
                                                      );
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        case "oval": {
                                          // Points format: [start, end] where each is {x, y}
                                          const start = annotation.points[0];
                                          const end = annotation.points[1];
                                          const centerX = (start.x + end.x) / 2;
                                          const centerY = (start.y + end.y) / 2;
                                          const radiusX =
                                            Math.abs(end.x - start.x) / 2;
                                          const radiusY =
                                            Math.abs(end.y - start.y) / 2;
                                          return (
                                            <>
                                              <Ellipse
                                                key={annotation.id}
                                                x={centerX}
                                                y={centerY}
                                                radiusX={radiusX}
                                                radiusY={radiusY}
                                                stroke={annotation.color}
                                                strokeWidth={
                                                  annotation.strokeWidth
                                                }
                                                cursor={cursorStyle}
                                                onClick={(e) =>
                                                  handlersA.handleAnnotationClick(
                                                    annotation.id,
                                                    e
                                                  )
                                                }
                                                onMouseDown={(e) => {
                                                  if (canDrag) {
                                                    handlersA.handleAnnotationDragStart(
                                                      annotation.id,
                                                      e
                                                    );
                                                  }
                                                }}
                                              />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(
                                                  annotation
                                                ).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={
                                                      point.x -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    y={
                                                      point.y -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={
                                                      CONTROL_POINT_HIT_SIZE
                                                    }
                                                    cursor="pointer"
                                                    onClick={(e) => {
                                                      e.cancelBubble = true;
                                                    }}
                                                    onMouseDown={(e) => {
                                                      handlersA.handleControlPointMouseDown(
                                                        annotation.id,
                                                        idx,
                                                        e
                                                      );
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        }
                                        case "arrow":
                                          return (
                                            <>
                                              <Arrow
                                                key={annotation.id}
                                                points={pointsToKonva(
                                                  annotation.points
                                                )}
                                                stroke={annotation.color}
                                                strokeWidth={
                                                  annotation.strokeWidth
                                                }
                                                fill={annotation.color}
                                                pointerLength={10}
                                                pointerWidth={10}
                                                hitStrokeWidth={20}
                                                cursor={cursorStyle}
                                                onClick={(e) =>
                                                  handlersA.handleAnnotationClick(
                                                    annotation.id,
                                                    e
                                                  )
                                                }
                                                onMouseDown={(e) => {
                                                  if (canDrag) {
                                                    handlersA.handleAnnotationDragStart(
                                                      annotation.id,
                                                      e
                                                    );
                                                  }
                                                }}
                                              />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(
                                                  annotation
                                                ).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={
                                                      point.x -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    y={
                                                      point.y -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={
                                                      CONTROL_POINT_HIT_SIZE
                                                    }
                                                    cursor="pointer"
                                                    onClick={(e) => {
                                                      e.cancelBubble = true;
                                                    }}
                                                    onMouseDown={(e) => {
                                                      handlersA.handleControlPointMouseDown(
                                                        annotation.id,
                                                        idx,
                                                        e
                                                      );
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        case "text":
                                          return annotation.points[0] ? (
                                            <KonvaText
                                              key={annotation.id}
                                              x={annotation.points[0].x}
                                              y={annotation.points[0].y}
                                              text={annotation.text ?? ""}
                                              fontSize={20}
                                              fill={annotation.color}
                                              stroke={isSelected ? "#2196F3" : undefined}
                                              strokeWidth={isSelected ? 1 : 0}
                                              cursor={cursorStyle}
                                              onClick={(e) => handlersA.handleAnnotationClick(annotation.id, e)}
                                              onMouseDown={(e) => {
                                                if (canDrag) handlersA.handleAnnotationDragStart(annotation.id, e);
                                              }}
                                              onDblClick={() => {
                                                const newText = window.prompt("Edit annotation text:", annotation.text ?? "");
                                                if (newText !== null && newText.trim()) {
                                                  updateAnnotationTextA(annotation.id, newText.trim());
                                                }
                                              }}
                                            />
                                          ) : null;
                                        case "angle": {
                                          if (annotation.points.length < 3) return null;
                                          const [vx, arm1, arm2] = annotation.points;
                                          const dx1 = arm1.x - vx.x, dy1 = arm1.y - vx.y;
                                          const dx2 = arm2.x - vx.x, dy2 = arm2.y - vx.y;
                                          const angleDeg = Math.round(
                                            Math.abs(Math.atan2(dx1 * dy2 - dy1 * dx2, dx1 * dx2 + dy1 * dy2) * 180 / Math.PI)
                                          );
                                          const lblText = `${angleDeg}°`;
                                          const lblWidth = lblText.length * 10 + 8;
                                          return (
                                            <>
                                              <Line key={`${annotation.id}-l1`} points={[vx.x, vx.y, arm1.x, arm1.y]} stroke={annotation.color} strokeWidth={annotation.strokeWidth} lineCap="round" hitStrokeWidth={20} cursor={cursorStyle} onClick={(e) => handlersA.handleAnnotationClick(annotation.id, e)} onMouseDown={(e) => { if (canDrag) handlersA.handleAnnotationDragStart(annotation.id, e); }} />
                                              <Line key={`${annotation.id}-l2`} points={[vx.x, vx.y, arm2.x, arm2.y]} stroke={annotation.color} strokeWidth={annotation.strokeWidth} lineCap="round" hitStrokeWidth={20} cursor={cursorStyle} onClick={(e) => handlersA.handleAnnotationClick(annotation.id, e)} onMouseDown={(e) => { if (canDrag) handlersA.handleAnnotationDragStart(annotation.id, e); }} />
                                              <Rect key={`${annotation.id}-lblbg`} x={vx.x + 6} y={vx.y - 26} width={lblWidth} height={22} fill="white" opacity={0.8} listening={false} />
                                              <KonvaText key={`${annotation.id}-lbl`} x={vx.x + 8} y={vx.y - 24} text={lblText} fontSize={16} fill="#111" fontStyle="bold" listening={false} />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(annotation).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={point.x - CONTROL_POINT_SIZE / 2}
                                                    y={point.y - CONTROL_POINT_SIZE / 2}
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={CONTROL_POINT_HIT_SIZE}
                                                    cursor="pointer"
                                                    onClick={(e) => { e.cancelBubble = true; }}
                                                    onMouseDown={(e) => {
                                                      handlersA.handleControlPointMouseDown(annotation.id, idx, e);
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        }
                                        default:
                                          return null;
                                      }
                                    })}

                                    {/* Render live preview during drawing */}
                                    {drawingStateA.mode === "drag-drawing" &&
                                      drawingStateA.points.length >= 2 && (
                                        <>
                                          {drawingStateA.tool ===
                                            "freehand" && (
                                            <Line
                                              points={
                                                annotationManagerA.getPreviewPoints()!
                                              }
                                              stroke="#FF0000"
                                              strokeWidth={6}
                                              lineCap="round"
                                              lineJoin="round"
                                              tension={0.5}
                                              listening={false}
                                            />
                                          )}
                                          {drawingStateA.tool === "oval" &&
                                            drawingStateA.points.length ===
                                              2 && (
                                              <Ellipse
                                                x={
                                                  (drawingStateA.points[0].x +
                                                    drawingStateA.points[1].x) /
                                                  2
                                                }
                                                y={
                                                  (drawingStateA.points[0].y +
                                                    drawingStateA.points[1].y) /
                                                  2
                                                }
                                                radiusX={
                                                  Math.abs(
                                                    drawingStateA.points[1].x -
                                                      drawingStateA.points[0].x
                                                  ) / 2
                                                }
                                                radiusY={
                                                  Math.abs(
                                                    drawingStateA.points[1].y -
                                                      drawingStateA.points[0].y
                                                  ) / 2
                                                }
                                                stroke="#FF0000"
                                                strokeWidth={6}
                                                listening={false}
                                              />
                                            )}
                                          {drawingStateA.tool === "arrow" &&
                                            drawingStateA.points.length ===
                                              2 && (
                                              <Arrow
                                                points={
                                                  annotationManagerA.getPreviewPoints()!
                                                }
                                                stroke="#FF0000"
                                                strokeWidth={6}
                                                fill="#FF0000"
                                                pointerLength={10}
                                                pointerWidth={10}
                                                listening={false}
                                              />
                                            )}
                                        </>
                                      )}

                                    {/* Render polyline in progress */}
                                    {drawingStateA.mode === "polyline-active" &&
                                      drawingStateA.points.length >= 2 && (
                                        <Line
                                          points={
                                            annotationManagerA.getPreviewPoints()!
                                          }
                                          stroke="#FF0000"
                                          strokeWidth={6}
                                          lineCap="round"
                                          lineJoin="round"
                                          listening={false}
                                        />
                                      )}

                                    {/* Render polyline preview segment (last vertex to mouse cursor) */}
                                    {drawingStateA.mode === "polyline-active" &&
                                      polylineMousePosA &&
                                      drawingStateA.points.length >= 1 && (
                                        <Line
                                          points={[
                                            drawingStateA.points[
                                              drawingStateA.points.length - 1
                                            ].x,
                                            drawingStateA.points[
                                              drawingStateA.points.length - 1
                                            ].y,
                                            polylineMousePosA.x,
                                            polylineMousePosA.y,
                                          ]}
                                          stroke="#FF0000"
                                          strokeWidth={6}
                                          lineCap="round"
                                          lineJoin="round"
                                          opacity={0.6}
                                          listening={false}
                                        />
                                      )}

                                    {/* Render angle annotation in progress */}
                                    {drawingStateA.mode === "angle-active" &&
                                      drawingStateA.points.length >= 1 && (
                                        <>
                                          {/* Fixed arm-1 after 2nd click */}
                                          {drawingStateA.points.length >= 2 && (
                                            <Line
                                              points={[
                                                drawingStateA.points[0].x,
                                                drawingStateA.points[0].y,
                                                drawingStateA.points[1].x,
                                                drawingStateA.points[1].y,
                                              ]}
                                              stroke="#FF0000"
                                              strokeWidth={6}
                                              lineCap="round"
                                              listening={false}
                                            />
                                          )}
                                          {/* Rubber-band arm from vertex to cursor */}
                                          {polylineMousePosA && (
                                            <Line
                                              points={[
                                                drawingStateA.points[0].x,
                                                drawingStateA.points[0].y,
                                                polylineMousePosA.x,
                                                polylineMousePosA.y,
                                              ]}
                                              stroke="#FF0000"
                                              strokeWidth={6}
                                              lineCap="round"
                                              opacity={0.6}
                                              listening={false}
                                            />
                                          )}
                                        </>
                                      )}
                                  </Layer>
                                </Stage>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div
                    data-testid="frame-counter-a"
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      marginTop: "10px",
                      fontFamily: "monospace",
                    }}
                  >
                    Frame {videoA.currentFrame} of {videoA.totalFrames}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: "100px 20px",
                    backgroundColor: "#f5f5f5",
                    border: "2px dashed #ccc",
                    textAlign: "center",
                    color: "#999",
                  }}
                >
                  {fileA ? "Loading..." : "No video loaded"}
                </div>
              )}
            </div>

            {/* Video B Canvas */}
            <div>
              <h3 style={{ marginTop: 0 }}>Video B</h3>
              {videoB.isReady && videoB.metadata ? (
                <>
                  {(() => {
                    // Calculate display dimensions based on rotation
                    const rotation = videoB.metadata.rotation || 0;
                    const isRotated = rotation === 90 || rotation === 270;
                    const baseDisplayWidth = isRotated
                      ? videoB.metadata.height
                      : videoB.metadata.width;
                    const baseDisplayHeight = isRotated
                      ? videoB.metadata.width
                      : videoB.metadata.height;

                    // Scale down if height exceeds slider value
                    const scale =
                      baseDisplayHeight > videoHeight
                        ? videoHeight / baseDisplayHeight
                        : 1;
                    const displayWidth = baseDisplayWidth * scale;
                    const displayHeight = baseDisplayHeight * scale;

                    const canvasWidth = videoB.metadata.width;
                    const canvasHeight = videoB.metadata.height;

                    return (
                      <div
                        style={{
                          border: "2px solid #333",
                          backgroundColor: "#000",
                          position: "relative",
                          width: `${displayWidth}px`,
                          height: `${displayHeight}px`,
                          maxWidth: "100%",
                        }}
                      >
                        {/* Container with explicit dimensions and scale transform */}
                        <div
                          style={{
                            position: "relative",
                            width: `${baseDisplayWidth}px`,
                            height: `${baseDisplayHeight}px`,
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                            overflow: "hidden",
                          }}
                        >
                          {/* Video canvas with rotation */}
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              width: `${canvasWidth}px`,
                              height: `${canvasHeight}px`,
                              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                              transformOrigin: "center center",
                            }}
                          >
                            <canvas
                              ref={videoB.canvasRef}
                              data-testid="video-canvas-b"
                              style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          </div>
                          {/* Annotation overlay canvas - independent of rotation */}
                          {videoB.metadata && (
                            <div
                              data-testid="annotation-container-b"
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
                              <div
                                style={{
                                  transform: `scale(${annotationScaleB})`,
                                  transformOrigin: "top left",
                                }}
                              >
                                <Stage
                                  width={baseDisplayWidth}
                                  height={baseDisplayHeight}
                                  onMouseDown={handlersB.handleMouseDown}
                                  onMouseMove={
                                    isDraggingAnnotationB ||
                                    isReshapingAnnotationB
                                      ? handlersB.handleStageMouseMove
                                      : handlersB.handleMouseMove
                                  }
                                  onMouseUp={
                                    isDraggingAnnotationB ||
                                    isReshapingAnnotationB
                                      ? handlersB.handleStageMouseUp
                                      : handlersB.handleMouseUp
                                  }
                                  onMouseLeave={
                                    isDraggingAnnotationB ||
                                    isReshapingAnnotationB
                                      ? handlersB.handleStageMouseUp
                                      : handlersB.handleMouseUp
                                  } // Finish drawing/drag/reshape if mouse leaves canvas
                                  onClick={handlersB.handleClick}
                                  onDblClick={handlersB.handleDoubleClick}
                                >
                                  <Layer>
                                    {/* Render completed annotations */}
                                    {annotationsB.map((annotation) => {
                                      const isSelected = selectedIdsB.has(
                                        annotation.id
                                      );
                                      const canDrag =
                                        isSelected &&
                                        drawingStateB.mode === "idle";
                                      const cursorStyle = canDrag
                                        ? "move"
                                        : "pointer";
                                      switch (annotation.type) {
                                        case "freehand":
                                        case "polyline":
                                          return (
                                            <>
                                              <Line
                                                key={annotation.id}
                                                points={pointsToKonva(
                                                  annotation.points
                                                )}
                                                stroke={annotation.color}
                                                strokeWidth={
                                                  annotation.strokeWidth
                                                }
                                                lineCap="round"
                                                lineJoin="round"
                                                tension={
                                                  annotation.type === "freehand"
                                                    ? 0.5
                                                    : 0
                                                }
                                                hitStrokeWidth={20}
                                                cursor={cursorStyle}
                                                onClick={(e) =>
                                                  handlersB.handleAnnotationClick(
                                                    annotation.id,
                                                    e
                                                  )
                                                }
                                                onMouseDown={(e) => {
                                                  if (canDrag) {
                                                    handlersB.handleAnnotationDragStart(
                                                      annotation.id,
                                                      e
                                                    );
                                                  }
                                                }}
                                              />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(
                                                  annotation
                                                ).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={
                                                      point.x -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    y={
                                                      point.y -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={
                                                      CONTROL_POINT_HIT_SIZE
                                                    }
                                                    cursor="pointer"
                                                    onClick={(e) => {
                                                      e.cancelBubble = true;
                                                    }}
                                                    onMouseDown={(e) => {
                                                      handlersB.handleControlPointMouseDown(
                                                        annotation.id,
                                                        idx,
                                                        e
                                                      );
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        case "oval": {
                                          // Points format: [start, end] where each is {x, y}
                                          const start = annotation.points[0];
                                          const end = annotation.points[1];
                                          const centerX = (start.x + end.x) / 2;
                                          const centerY = (start.y + end.y) / 2;
                                          const radiusX =
                                            Math.abs(end.x - start.x) / 2;
                                          const radiusY =
                                            Math.abs(end.y - start.y) / 2;
                                          return (
                                            <>
                                              <Ellipse
                                                key={annotation.id}
                                                x={centerX}
                                                y={centerY}
                                                radiusX={radiusX}
                                                radiusY={radiusY}
                                                stroke={annotation.color}
                                                strokeWidth={
                                                  annotation.strokeWidth
                                                }
                                                cursor={cursorStyle}
                                                onClick={(e) =>
                                                  handlersB.handleAnnotationClick(
                                                    annotation.id,
                                                    e
                                                  )
                                                }
                                                onMouseDown={(e) => {
                                                  if (canDrag) {
                                                    handlersB.handleAnnotationDragStart(
                                                      annotation.id,
                                                      e
                                                    );
                                                  }
                                                }}
                                              />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(
                                                  annotation
                                                ).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={
                                                      point.x -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    y={
                                                      point.y -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={
                                                      CONTROL_POINT_HIT_SIZE
                                                    }
                                                    cursor="pointer"
                                                    onClick={(e) => {
                                                      e.cancelBubble = true;
                                                    }}
                                                    onMouseDown={(e) => {
                                                      handlersB.handleControlPointMouseDown(
                                                        annotation.id,
                                                        idx,
                                                        e
                                                      );
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        }
                                        case "arrow":
                                          return (
                                            <>
                                              <Arrow
                                                key={annotation.id}
                                                points={pointsToKonva(
                                                  annotation.points
                                                )}
                                                stroke={annotation.color}
                                                strokeWidth={
                                                  annotation.strokeWidth
                                                }
                                                fill={annotation.color}
                                                pointerLength={10}
                                                pointerWidth={10}
                                                hitStrokeWidth={20}
                                                cursor={cursorStyle}
                                                onClick={(e) =>
                                                  handlersB.handleAnnotationClick(
                                                    annotation.id,
                                                    e
                                                  )
                                                }
                                                onMouseDown={(e) => {
                                                  if (canDrag) {
                                                    handlersB.handleAnnotationDragStart(
                                                      annotation.id,
                                                      e
                                                    );
                                                  }
                                                }}
                                              />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(
                                                  annotation
                                                ).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={
                                                      point.x -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    y={
                                                      point.y -
                                                      CONTROL_POINT_SIZE / 2
                                                    }
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={
                                                      CONTROL_POINT_HIT_SIZE
                                                    }
                                                    cursor="pointer"
                                                    onClick={(e) => {
                                                      e.cancelBubble = true;
                                                    }}
                                                    onMouseDown={(e) => {
                                                      handlersB.handleControlPointMouseDown(
                                                        annotation.id,
                                                        idx,
                                                        e
                                                      );
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        case "text":
                                          return annotation.points[0] ? (
                                            <KonvaText
                                              key={annotation.id}
                                              x={annotation.points[0].x}
                                              y={annotation.points[0].y}
                                              text={annotation.text ?? ""}
                                              fontSize={20}
                                              fill={annotation.color}
                                              stroke={isSelected ? "#2196F3" : undefined}
                                              strokeWidth={isSelected ? 1 : 0}
                                              cursor={cursorStyle}
                                              onClick={(e) => handlersB.handleAnnotationClick(annotation.id, e)}
                                              onMouseDown={(e) => {
                                                if (canDrag) handlersB.handleAnnotationDragStart(annotation.id, e);
                                              }}
                                              onDblClick={() => {
                                                const newText = window.prompt("Edit annotation text:", annotation.text ?? "");
                                                if (newText !== null && newText.trim()) {
                                                  updateAnnotationTextB(annotation.id, newText.trim());
                                                }
                                              }}
                                            />
                                          ) : null;
                                        case "angle": {
                                          if (annotation.points.length < 3) return null;
                                          const [vx, arm1, arm2] = annotation.points;
                                          const dx1 = arm1.x - vx.x, dy1 = arm1.y - vx.y;
                                          const dx2 = arm2.x - vx.x, dy2 = arm2.y - vx.y;
                                          const angleDeg = Math.round(
                                            Math.abs(Math.atan2(dx1 * dy2 - dy1 * dx2, dx1 * dx2 + dy1 * dy2) * 180 / Math.PI)
                                          );
                                          const lblText = `${angleDeg}°`;
                                          const lblWidth = lblText.length * 10 + 8;
                                          return (
                                            <>
                                              <Line key={`${annotation.id}-l1`} points={[vx.x, vx.y, arm1.x, arm1.y]} stroke={annotation.color} strokeWidth={annotation.strokeWidth} lineCap="round" hitStrokeWidth={20} cursor={cursorStyle} onClick={(e) => handlersB.handleAnnotationClick(annotation.id, e)} onMouseDown={(e) => { if (canDrag) handlersB.handleAnnotationDragStart(annotation.id, e); }} />
                                              <Line key={`${annotation.id}-l2`} points={[vx.x, vx.y, arm2.x, arm2.y]} stroke={annotation.color} strokeWidth={annotation.strokeWidth} lineCap="round" hitStrokeWidth={20} cursor={cursorStyle} onClick={(e) => handlersB.handleAnnotationClick(annotation.id, e)} onMouseDown={(e) => { if (canDrag) handlersB.handleAnnotationDragStart(annotation.id, e); }} />
                                              <Rect key={`${annotation.id}-lblbg`} x={vx.x + 6} y={vx.y - 26} width={lblWidth} height={22} fill="white" opacity={0.8} listening={false} />
                                              <KonvaText key={`${annotation.id}-lbl`} x={vx.x + 8} y={vx.y - 24} text={lblText} fontSize={16} fill="#111" fontStyle="bold" listening={false} />
                                              {/* Render control points if selected */}
                                              {isSelected &&
                                                getControlPoints(annotation).map((point, idx) => (
                                                  <Rect
                                                    key={`cp-${annotation.id}-${idx}`}
                                                    x={point.x - CONTROL_POINT_SIZE / 2}
                                                    y={point.y - CONTROL_POINT_SIZE / 2}
                                                    width={CONTROL_POINT_SIZE}
                                                    height={CONTROL_POINT_SIZE}
                                                    fill="white"
                                                    stroke="black"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={CONTROL_POINT_HIT_SIZE}
                                                    cursor="pointer"
                                                    onClick={(e) => { e.cancelBubble = true; }}
                                                    onMouseDown={(e) => {
                                                      handlersB.handleControlPointMouseDown(annotation.id, idx, e);
                                                    }}
                                                  />
                                                ))}
                                            </>
                                          );
                                        }
                                        default:
                                          return null;
                                      }
                                    })}

                                    {/* Render live preview during drawing */}
                                    {drawingStateB.mode === "drag-drawing" &&
                                      drawingStateB.points.length >= 2 && (
                                        <>
                                          {drawingStateB.tool ===
                                            "freehand" && (
                                            <Line
                                              points={
                                                annotationManagerB.getPreviewPoints()!
                                              }
                                              stroke="#FF0000"
                                              strokeWidth={6}
                                              lineCap="round"
                                              lineJoin="round"
                                              tension={0.5}
                                              listening={false}
                                            />
                                          )}
                                          {drawingStateB.tool === "oval" &&
                                            drawingStateB.points.length ===
                                              2 && (
                                              <Ellipse
                                                x={
                                                  (drawingStateB.points[0].x +
                                                    drawingStateB.points[1].x) /
                                                  2
                                                }
                                                y={
                                                  (drawingStateB.points[0].y +
                                                    drawingStateB.points[1].y) /
                                                  2
                                                }
                                                radiusX={
                                                  Math.abs(
                                                    drawingStateB.points[1].x -
                                                      drawingStateB.points[0].x
                                                  ) / 2
                                                }
                                                radiusY={
                                                  Math.abs(
                                                    drawingStateB.points[1].y -
                                                      drawingStateB.points[0].y
                                                  ) / 2
                                                }
                                                stroke="#FF0000"
                                                strokeWidth={6}
                                                listening={false}
                                              />
                                            )}
                                          {drawingStateB.tool === "arrow" &&
                                            drawingStateB.points.length ===
                                              2 && (
                                              <Arrow
                                                points={
                                                  annotationManagerB.getPreviewPoints()!
                                                }
                                                stroke="#FF0000"
                                                strokeWidth={6}
                                                fill="#FF0000"
                                                pointerLength={10}
                                                pointerWidth={10}
                                                listening={false}
                                              />
                                            )}
                                        </>
                                      )}

                                    {/* Render polyline in progress */}
                                    {drawingStateB.mode === "polyline-active" &&
                                      drawingStateB.points.length >= 2 && (
                                        <Line
                                          points={
                                            annotationManagerB.getPreviewPoints()!
                                          }
                                          stroke="#FF0000"
                                          strokeWidth={6}
                                          lineCap="round"
                                          lineJoin="round"
                                          listening={false}
                                        />
                                      )}

                                    {/* Render polyline preview segment (last vertex to mouse cursor) */}
                                    {drawingStateB.mode === "polyline-active" &&
                                      polylineMousePosB &&
                                      drawingStateB.points.length >= 1 && (
                                        <Line
                                          points={[
                                            drawingStateB.points[
                                              drawingStateB.points.length - 1
                                            ].x,
                                            drawingStateB.points[
                                              drawingStateB.points.length - 1
                                            ].y,
                                            polylineMousePosB.x,
                                            polylineMousePosB.y,
                                          ]}
                                          stroke="#FF0000"
                                          strokeWidth={6}
                                          lineCap="round"
                                          lineJoin="round"
                                          opacity={0.6}
                                          listening={false}
                                        />
                                      )}

                                    {/* Render angle annotation in progress */}
                                    {drawingStateB.mode === "angle-active" &&
                                      drawingStateB.points.length >= 1 && (
                                        <>
                                          {/* Fixed arm-1 after 2nd click */}
                                          {drawingStateB.points.length >= 2 && (
                                            <Line
                                              points={[
                                                drawingStateB.points[0].x,
                                                drawingStateB.points[0].y,
                                                drawingStateB.points[1].x,
                                                drawingStateB.points[1].y,
                                              ]}
                                              stroke="#FF0000"
                                              strokeWidth={6}
                                              lineCap="round"
                                              listening={false}
                                            />
                                          )}
                                          {/* Rubber-band arm from vertex to cursor */}
                                          {polylineMousePosB && (
                                            <Line
                                              points={[
                                                drawingStateB.points[0].x,
                                                drawingStateB.points[0].y,
                                                polylineMousePosB.x,
                                                polylineMousePosB.y,
                                              ]}
                                              stroke="#FF0000"
                                              strokeWidth={6}
                                              lineCap="round"
                                              opacity={0.6}
                                              listening={false}
                                            />
                                          )}
                                        </>
                                      )}
                                  </Layer>
                                </Stage>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div
                    data-testid="frame-counter-b"
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      marginTop: "10px",
                      fontFamily: "monospace",
                    }}
                  >
                    Frame {videoB.currentFrame} of {videoB.totalFrames}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: "100px 20px",
                    backgroundColor: "#f5f5f5",
                    border: "2px dashed #ccc",
                    textAlign: "center",
                    color: "#999",
                  }}
                >
                  {fileB ? "Loading..." : "No video loaded"}
                </div>
              )}
            </div>
          </div>

          {/* SYNC Mode Controls */}
          {mode === "SYNC" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
                marginBottom: "15px",
              }}
            >
              {/* Video A Controls */}
              <div
                data-testid="video-a-controls"
                style={{
                  padding: "12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                {/* Scrub Bar */}
                <input
                  data-testid="scrub-bar-a"
                  type="range"
                  min="0"
                  max={videoA.totalFrames - 1}
                  value={sliderValueA}
                  onChange={handleSliderChangeA}
                  onMouseUp={handleSliderReleaseA}
                  onTouchEnd={handleSliderReleaseA}
                  style={{ width: "100%", height: "30px", marginBottom: "8px" }}
                />

                {/* Play/Pause */}
                <button
                  data-testid="play-pause-a"
                  onClick={handlePlayPauseA}
                  style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    backgroundColor: videoA.isPlaying ? "#FF5722" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    width: "100%",
                    marginBottom: "8px",
                  }}
                >
                  {videoA.isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>

                {/* Stepping Controls */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <button
                    data-testid="step-backward-coarse-a"
                    onClick={handleCoarseStepBackwardA}
                    disabled={videoA.currentFrame === 0}
                    style={{
                      padding: "8px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor:
                        videoA.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor:
                        videoA.currentFrame === 0 ? "#ccc" : "#4CAF50",
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
                      padding: "8px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor:
                        videoA.currentFrame >= videoA.totalFrames - 1
                          ? "not-allowed"
                          : "pointer",
                      backgroundColor:
                        videoA.currentFrame >= videoA.totalFrames - 1
                          ? "#ccc"
                          : "#4CAF50",
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
                      padding: "8px",
                      fontSize: "14px",
                      cursor:
                        videoA.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor:
                        videoA.currentFrame === 0 ? "#ccc" : "#2196F3",
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
                      padding: "8px",
                      fontSize: "14px",
                      cursor:
                        videoA.currentFrame >= videoA.totalFrames - 1
                          ? "not-allowed"
                          : "pointer",
                      backgroundColor:
                        videoA.currentFrame >= videoA.totalFrames - 1
                          ? "#ccc"
                          : "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Forward 1 →
                  </button>
                </div>

                {/* Speed Control */}
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
              </div>

              {/* Video B Controls */}
              <div
                data-testid="video-b-controls"
                style={{
                  padding: "12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                {/* Scrub Bar */}
                <input
                  data-testid="scrub-bar-b"
                  type="range"
                  min="0"
                  max={videoB.totalFrames - 1}
                  value={sliderValueB}
                  onChange={handleSliderChangeB}
                  onMouseUp={handleSliderReleaseB}
                  onTouchEnd={handleSliderReleaseB}
                  style={{ width: "100%", height: "30px", marginBottom: "8px" }}
                />

                {/* Play/Pause */}
                <button
                  data-testid="play-pause-b"
                  onClick={handlePlayPauseB}
                  style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    backgroundColor: videoB.isPlaying ? "#FF5722" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    width: "100%",
                    marginBottom: "8px",
                  }}
                >
                  {videoB.isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>

                {/* Stepping Controls */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <button
                    data-testid="step-backward-coarse-b"
                    onClick={handleCoarseStepBackwardB}
                    disabled={videoB.currentFrame === 0}
                    style={{
                      padding: "8px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor:
                        videoB.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor:
                        videoB.currentFrame === 0 ? "#ccc" : "#4CAF50",
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
                      padding: "8px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor:
                        videoB.currentFrame >= videoB.totalFrames - 1
                          ? "not-allowed"
                          : "pointer",
                      backgroundColor:
                        videoB.currentFrame >= videoB.totalFrames - 1
                          ? "#ccc"
                          : "#4CAF50",
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
                      padding: "8px",
                      fontSize: "14px",
                      cursor:
                        videoB.currentFrame === 0 ? "not-allowed" : "pointer",
                      backgroundColor:
                        videoB.currentFrame === 0 ? "#ccc" : "#2196F3",
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
                      padding: "8px",
                      fontSize: "14px",
                      cursor:
                        videoB.currentFrame >= videoB.totalFrames - 1
                          ? "not-allowed"
                          : "pointer",
                      backgroundColor:
                        videoB.currentFrame >= videoB.totalFrames - 1
                          ? "#ccc"
                          : "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                    }}
                  >
                    Forward 1 →
                  </button>
                </div>

                {/* Speed Control */}
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
              </div>
            </div>
          )}

          {/* PLAYBACK Mode Controls */}
          {mode === "PLAYBACK" && (
            <div
              data-testid="playback-controls"
              style={{
                padding: "12px",
                backgroundColor: "#f5f5f5",
                borderRadius: "4px",
                marginBottom: "15px",
              }}
            >
              {/* Unified Trim + Scrub Bar */}
              {playheadState &&
                (() => {
                  const range = calculatePlayheadRange(
                    videoA.totalFrames,
                    videoB.totalFrames,
                    playheadState.syncOffset
                  );
                  const effectiveTrimStart = trimStart ?? range.min;
                  const effectiveTrimEnd = trimEnd ?? range.max;
                  return (
                    <div style={{ marginBottom: "10px" }}>
                      <TrimScrubBar
                        min={range.min}
                        max={range.max}
                        trimStart={effectiveTrimStart}
                        trimEnd={effectiveTrimEnd}
                        playhead={sliderValueBoth}
                        isLooping={isLooping}
                        frameLabel={
                          `Video A: Frame ${sliderValueBoth} / ${range.max}` +
                          ` | Video B: Frame ${sliderValueBoth + playheadState.syncOffset}` +
                          ` / ${videoB.totalFrames - 1}` +
                          (range.min > 0 ? ` (min: ${range.min})` : "")
                        }
                        onPlayheadDrag={handleSliderChangeBoth}
                        onPlayheadRelease={handleSliderReleaseBoth}
                        onTrimStartChange={setTrimStart}
                        onTrimEndChange={setTrimEnd}
                        onLoopToggle={() => setIsLooping((l) => !l)}
                        onReturnToIn={handleReturnToIn}
                        onResetTrim={() => {
                          setTrimStart(range.min);
                          setTrimEnd(range.max);
                        }}
                      />
                    </div>
                  );
                })()}

              {/* Play/Pause */}
              <button
                data-testid="play-pause-both"
                onClick={handlePlayPauseBoth}
                style={{
                  padding: "10px 20px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  backgroundColor: isPlayingBoth ? "#FF5722" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  width: "100%",
                  marginBottom: "10px",
                }}
              >
                {isPlayingBoth ? "⏸ Pause" : "▶ Play"}
              </button>

              {/* Stepping Controls */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <button
                  data-testid="step-backward-coarse-both"
                  onClick={handleStepBackwardCoarse}
                  style={{
                    padding: "8px",
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
                    padding: "8px",
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
                    padding: "8px",
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
                    padding: "8px",
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
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                }}
              >
                Playback Speed:
                <select
                  data-testid="speed-select-both"
                  value={playbackRateBoth}
                  onChange={handleSpeedChange}
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

              {/* Sync Offset Display - moved to bottom */}
              <div
                data-testid="sync-offset-display"
                style={{
                  padding: "8px",
                  marginTop: "10px",
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                }}
              >
                <strong>Sync offset:</strong>{" "}
                {syncOffset !== null
                  ? (syncOffset > 0 ? "+" : "") + syncOffset
                  : "N/A"}{" "}
                frames (Video B is {Math.abs(syncOffset || 0)} frame
                {Math.abs(syncOffset || 0) !== 1 ? "s" : ""}{" "}
                {(syncOffset || 0) > 0
                  ? "ahead of"
                  : (syncOffset || 0) < 0
                  ? "behind"
                  : "aligned with"}{" "}
                Video A)
              </div>
            </div>
          )}

          {/* Unified Annotation Tool Selection */}
          {(videoA.isReady || videoB.isReady) && (
            <div
              style={{
                padding: "10px",
                backgroundColor: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: "4px",
                marginBottom: "15px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  data-testid="tool-select"
                  onClick={() => setSelectedTool("select")}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    border:
                      selectedTool === "select"
                        ? "2px solid #2196F3"
                        : "1px solid #999",
                    backgroundColor:
                      selectedTool === "select" ? "#E3F2FD" : "white",
                    fontWeight: selectedTool === "select" ? "bold" : "normal",
                    borderRadius: "4px",
                  }}
                >
                  Select
                </button>
                <button
                  data-testid="tool-freehand"
                  onClick={() => setSelectedTool("freehand")}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    border:
                      selectedTool === "freehand"
                        ? "2px solid #2196F3"
                        : "1px solid #999",
                    backgroundColor:
                      selectedTool === "freehand" ? "#E3F2FD" : "white",
                    fontWeight: selectedTool === "freehand" ? "bold" : "normal",
                    borderRadius: "4px",
                  }}
                >
                  Freehand
                </button>
                <button
                  data-testid="tool-polyline"
                  onClick={() => setSelectedTool("polyline")}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    border:
                      selectedTool === "polyline"
                        ? "2px solid #2196F3"
                        : "1px solid #999",
                    backgroundColor:
                      selectedTool === "polyline" ? "#E3F2FD" : "white",
                    fontWeight: selectedTool === "polyline" ? "bold" : "normal",
                    borderRadius: "4px",
                  }}
                >
                  Polyline
                </button>
                <button
                  data-testid="tool-oval"
                  onClick={() => setSelectedTool("oval")}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    border:
                      selectedTool === "oval"
                        ? "2px solid #2196F3"
                        : "1px solid #999",
                    backgroundColor:
                      selectedTool === "oval" ? "#E3F2FD" : "white",
                    fontWeight: selectedTool === "oval" ? "bold" : "normal",
                    borderRadius: "4px",
                  }}
                >
                  Oval
                </button>
                <button
                  data-testid="tool-arrow"
                  onClick={() => setSelectedTool("arrow")}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    border:
                      selectedTool === "arrow"
                        ? "2px solid #2196F3"
                        : "1px solid #999",
                    backgroundColor:
                      selectedTool === "arrow" ? "#E3F2FD" : "white",
                    fontWeight: selectedTool === "arrow" ? "bold" : "normal",
                    borderRadius: "4px",
                  }}
                >
                  Arrow
                </button>
                <button
                  data-testid="tool-text"
                  onClick={() => setSelectedTool("text")}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    border: selectedTool === "text" ? "2px solid #2196F3" : "1px solid #999",
                    backgroundColor: selectedTool === "text" ? "#E3F2FD" : "white",
                    fontWeight: selectedTool === "text" ? "bold" : "normal",
                    borderRadius: "4px",
                  }}
                >
                  Text
                </button>
                <button
                  data-testid="tool-angle"
                  onClick={() => setSelectedTool("angle")}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    border: selectedTool === "angle" ? "2px solid #2196F3" : "1px solid #999",
                    backgroundColor: selectedTool === "angle" ? "#E3F2FD" : "white",
                    fontWeight: selectedTool === "angle" ? "bold" : "normal",
                    borderRadius: "4px",
                  }}
                >
                  ∠ Angle
                </button>
                <div
                  style={{ marginLeft: "auto", display: "flex", gap: "8px" }}
                >
                  {/* Undo/Redo for active video */}
                  {videoA.isReady && activeVideo === 'A' && (
                    <>
                      <button
                        data-testid="undo-a"
                        onClick={undoA}
                        disabled={!canUndoA}
                        title="Undo (Ctrl+Z)"
                        style={{
                          padding: "8px 12px", fontSize: "14px",
                          cursor: canUndoA ? "pointer" : "not-allowed",
                          border: "1px solid #999",
                          backgroundColor: canUndoA ? "white" : "#f5f5f5",
                          color: canUndoA ? "#333" : "#999", borderRadius: "4px",
                        }}
                      >↩ Undo</button>
                      <button
                        data-testid="redo-a"
                        onClick={redoA}
                        disabled={!canRedoA}
                        title="Redo (Ctrl+Y)"
                        style={{
                          padding: "8px 12px", fontSize: "14px",
                          cursor: canRedoA ? "pointer" : "not-allowed",
                          border: "1px solid #999",
                          backgroundColor: canRedoA ? "white" : "#f5f5f5",
                          color: canRedoA ? "#333" : "#999", borderRadius: "4px",
                        }}
                      >↪ Redo</button>
                    </>
                  )}
                  {videoB.isReady && activeVideo === 'B' && (
                    <>
                      <button
                        data-testid="undo-b"
                        onClick={undoB}
                        disabled={!canUndoB}
                        title="Undo (Ctrl+Z)"
                        style={{
                          padding: "8px 12px", fontSize: "14px",
                          cursor: canUndoB ? "pointer" : "not-allowed",
                          border: "1px solid #999",
                          backgroundColor: canUndoB ? "white" : "#f5f5f5",
                          color: canUndoB ? "#333" : "#999", borderRadius: "4px",
                        }}
                      >↩ Undo</button>
                      <button
                        data-testid="redo-b"
                        onClick={redoB}
                        disabled={!canRedoB}
                        title="Redo (Ctrl+Y)"
                        style={{
                          padding: "8px 12px", fontSize: "14px",
                          cursor: canRedoB ? "pointer" : "not-allowed",
                          border: "1px solid #999",
                          backgroundColor: canRedoB ? "white" : "#f5f5f5",
                          color: canRedoB ? "#333" : "#999", borderRadius: "4px",
                        }}
                      >↪ Redo</button>
                    </>
                  )}
                  {videoA.isReady && (
                    <button
                      data-testid="clear-all-a"
                      onClick={clearAllA}
                      disabled={annotationsA.length === 0}
                      style={{
                        padding: "8px 16px",
                        fontSize: "14px",
                        cursor:
                          annotationsA.length === 0 ? "not-allowed" : "pointer",
                        border: "1px solid #d32f2f",
                        backgroundColor:
                          annotationsA.length === 0 ? "#f5f5f5" : "white",
                        color: annotationsA.length === 0 ? "#999" : "#d32f2f",
                        borderRadius: "4px",
                      }}
                    >
                      Clear All A
                    </button>
                  )}
                  {videoB.isReady && (
                    <button
                      data-testid="clear-all-b"
                      onClick={clearAllB}
                      disabled={annotationsB.length === 0}
                      style={{
                        padding: "8px 16px",
                        fontSize: "14px",
                        cursor:
                          annotationsB.length === 0 ? "not-allowed" : "pointer",
                        border: "1px solid #d32f2f",
                        backgroundColor:
                          annotationsB.length === 0 ? "#f5f5f5" : "white",
                        color: annotationsB.length === 0 ? "#999" : "#d32f2f",
                        borderRadius: "4px",
                      }}
                    >
                      Clear All B
                    </button>
                  )}
                </div>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  marginTop: "8px",
                  minHeight: "18px",
                  color: "#666",
                  fontStyle: "italic",
                }}
              >
                {selectedTool === "polyline" &&
                (drawingStateA.mode === "polyline-active" ||
                  drawingStateB.mode === "polyline-active")
                  ? "Click to add vertices. Press Enter to finish or Escape to cancel."
                  : selectedTool === "angle" &&
                    (drawingStateA.mode === "angle-active" ||
                      drawingStateB.mode === "angle-active")
                  ? "Click vertex then 2 endpoints to measure angle. Escape to cancel."
                  : selectedTool === "text"
                  ? "Click on the video to place a text label."
                  : "\u00A0"}
              </div>
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
              <strong>SYNC Mode:</strong> Use independent controls to navigate
              each video to the desired synchronization point
              <ul>
                <li>Play/pause each video independently</li>
                <li>
                  Step frame-by-frame (±1 frame) or coarse step (±5 frames)
                </li>
                <li>Adjust playback speed independently</li>
              </ul>
            </li>
            <li>
              <strong>Switch to PLAYBACK Mode:</strong> Click the mode toggle
              button
              <ul>
                <li>Sync offset is calculated: offset = frameB - frameA</li>
                <li>Original positions are saved as sync points</li>
              </ul>
            </li>
            <li>
              <strong>PLAYBACK Mode:</strong> Use unified controls to analyze
              synchronized videos
              <ul>
                <li>Play/pause both videos together</li>
                <li>Step both videos maintaining exact offset</li>
                <li>Adjust speed for both videos simultaneously</li>
              </ul>
            </li>
            <li>
              <strong>Return to SYNC Mode:</strong> Videos restore to original
              sync points for easy adjustment
            </li>
          </ol>
        </div>
      )}

      {/* Keyboard Shortcut Legend */}
      <div
        data-testid="keyboard-legend"
        style={{
          marginTop: "16px",
          padding: "12px 16px",
          backgroundColor: "#fafafa",
          border: "1px solid #ddd",
          borderRadius: "4px",
          fontSize: "12px",
          color: "#555",
        }}
      >
        <strong style={{ display: "block", marginBottom: "6px" }}>⌨️ Keyboard Shortcuts</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px" }}>
          <span><kbd>Space</kbd> Play / Pause</span>
          <span><kbd>←</kbd> Step back 1 frame</span>
          <span><kbd>→</kbd> Step forward 1 frame</span>
          <span><kbd>Shift</kbd>+<kbd>←</kbd> Step back 5 frames</span>
          <span><kbd>Shift</kbd>+<kbd>→</kbd> Step forward 5 frames</span>
        </div>
        <div style={{ marginTop: "4px", color: "#888" }}>
          In PLAYBACK mode steps both videos together. In SYNC mode steps the active video.
          Shortcuts are disabled when a text field is focused.
        </div>
      </div>
    </div>
  );
}
