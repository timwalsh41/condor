import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type Konva from "konva";
import { useWebCodecsDecoder } from "../hooks/useWebCodecsDecoder";
import { useVideoAnnotations } from "../hooks/useVideoAnnotations";
import { useVideoControls } from "../hooks/useVideoControls";
import type { AnnotationType } from "../types/annotations";
import {
  checkWebCodecsSupport,
  getBrowserCodecSupport,
} from "../utils/featureDetection";
import {
  initializePlayhead,
  advancePlayhead,
  calculateTargetFrames,
  calculatePlayheadRange,
} from "../utils/dualVideoPlayback";
import { VideoUploadWorkflow } from "./VideoUploadWorkflow";
import { VideoPanel } from "./VideoPanel";
import { PlaybackControls } from "./PlaybackControls";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { useVideoStore } from "../store/videoStore";
import { useSessionStore } from "../store/sessionStore";
import { useTrimStore } from "../store/trimStore";
import { useSyncStore } from "../store/syncStore";
import { usePlaybackStore } from "../store/playbackStore";
import type { VideoMetadata } from "../types/api";

/**
 * Dual Video Synchronizer - Production Application (Orchestrator)
 *
 * Coordinates video decoders, annotation hooks, and extracted sub-components.
 * Two modes:
 * - SYNC: Independent controls for setting synchronization points
 * - PLAYBACK: Unified controls maintaining frame offset
 *
 * Refactored from monolith (~3500 lines) to orchestrator (~250 lines).
 * Rendering delegated to: VideoPanel, VideoCanvas, VideoControls,
 * PlaybackControls, AnnotationToolbar.
 * Handlers delegated to: useVideoControls hook.
 */

export function DualVideoSynchronizer() {
  // ─── Store subscriptions ────────────────────────────────────────────────
  const { sessionId, videoA: videoAStore, videoB: videoBStore, setSessionId, setVideoA, setVideoB } =
    useVideoStore();
  const { mode, setMode, resetSyncState } = useSyncStore();
  const { resetTrimState } = useTrimStore();
  const { trimStart, trimEnd, setTrimStart, setTrimEnd } = useTrimStore();
  const isHydratingSession = useSessionStore((state) => state.isHydratingSession);
  const isSavingToLibrary = useVideoStore((state) => state.isSavingToLibrary);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);

  // ─── File memoization ───────────────────────────────────────────────────
  /* eslint-disable react-hooks/exhaustive-deps */
  const fileA = useMemo(() =>
    videoAStore?.blob && videoAStore.metadata
      ? new File([videoAStore.blob], videoAStore.metadata.filename, { type: "video/mp4" })
      : null,
    [videoAStore?.blob, videoAStore?.metadata?.filename]
  );

  const fileB = useMemo(() =>
    videoBStore?.blob && videoBStore.metadata
      ? new File([videoBStore.blob], videoBStore.metadata.filename, { type: "video/mp4" })
      : null,
    [videoBStore?.blob, videoBStore?.metadata?.filename]
  );

  const externalVideoA = useMemo(() =>
    sessionId === 'library' && videoAStore?.metadata && videoAStore?.blob
      ? { metadata: videoAStore.metadata, blob: videoAStore.blob }
      : undefined,
    [sessionId, videoAStore?.metadata?.video_id, videoAStore?.blob]
  );

  const externalVideoB = useMemo(() =>
    sessionId === 'library' && videoBStore?.metadata && videoBStore?.blob
      ? { metadata: videoBStore.metadata, blob: videoBStore.blob }
      : undefined,
    [sessionId, videoBStore?.metadata?.video_id, videoBStore?.blob]
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  // ─── Video decoders ─────────────────────────────────────────────────────
  const videoA = useWebCodecsDecoder(fileA);
  const videoB = useWebCodecsDecoder(fileB);

  // Refs to always access latest decoder state (avoid stale closures)
  const videoARef = useRef(videoA);
  const videoBRef = useRef(videoB);
  useEffect(() => {
    videoARef.current = videoA;
    videoBRef.current = videoB;
  });

  // ─── Video controls hooks (SYNC mode) ───────────────────────────────────
  const controlsA = useVideoControls(videoARef);
  const controlsB = useVideoControls(videoBRef);

  // ─── Local UI state ─────────────────────────────────────────────────────
  const [activeVideo, setActiveVideo] = useState<"A" | "B" | null>(null);
  const [selectedTool, setSelectedTool] = useState<AnnotationType>("select");
  const [videoHeight, setVideoHeight] = useState(640);

  // ─── Annotation hooks ───────────────────────────────────────────────────
  const videoAAnnotations = useVideoAnnotations(videoA, "A", activeVideo, setActiveVideo, selectedTool, setSelectedTool);
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

  const videoBAnnotations = useVideoAnnotations(videoB, "B", activeVideo, setActiveVideo, selectedTool, setSelectedTool);
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

  // ─── Konva layer refs ───────────────────────────────────────────────────
  const layerARef = useRef<Konva.Layer>(null);
  const layerBRef = useRef<Konva.Layer>(null);

  // ─── Video change detection ─────────────────────────────────────────────
  const prevVideoAIdRef = useRef<string | null>(null);
  const prevVideoBIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSessionId) return;
    prevVideoAIdRef.current = videoAStore?.metadata?.video_id ?? null;
    prevVideoBIdRef.current = videoBStore?.metadata?.video_id ?? null;
  }, [activeSessionId, videoAStore?.metadata?.video_id, videoBStore?.metadata?.video_id]);

  useEffect(() => {
    if (isHydratingSession) return;
    if (isSavingToLibrary) {
      prevVideoAIdRef.current = videoAStore?.metadata?.video_id ?? null;
      prevVideoBIdRef.current = videoBStore?.metadata?.video_id ?? null;
      return;
    }
    const currentVideoAId = videoAStore?.metadata?.video_id ?? null;
    const currentVideoBId = videoBStore?.metadata?.video_id ?? null;
    if (currentVideoAId !== prevVideoAIdRef.current) {
      const prevId = prevVideoAIdRef.current;
      prevVideoAIdRef.current = currentVideoAId;
      if (prevId !== null && currentVideoAId !== null) {
        resetSyncState();
        resetTrimState();
      }
    }
    if (currentVideoBId !== prevVideoBIdRef.current) {
      const prevId = prevVideoBIdRef.current;
      prevVideoBIdRef.current = currentVideoBId;
      if (prevId !== null && currentVideoBId !== null) {
        resetSyncState();
        resetTrimState();
      }
    }
  }, [videoAStore?.metadata?.video_id, videoBStore?.metadata?.video_id, resetSyncState, resetTrimState, isHydratingSession, isSavingToLibrary]);

  // ─── Video height config ────────────────────────────────────────────────
  const videoHeightConfig = useMemo(() => {
    const getVideoHeight = (metadata: typeof videoA.metadata) => {
      if (!metadata) return null;
      const rotation = metadata.rotation || 0;
      const isRotated = rotation === 90 || rotation === 270;
      return isRotated ? metadata.width : metadata.height;
    };
    const heightA = videoA.metadata ? getVideoHeight(videoA.metadata) : null;
    const heightB = videoB.metadata ? getVideoHeight(videoB.metadata) : null;
    let maxHeight: number;
    if (heightA !== null && heightB !== null) {
      maxHeight = Math.min(heightA, heightB);
    } else if (heightA !== null) {
      maxHeight = heightA;
    } else if (heightB !== null) {
      maxHeight = heightB;
    } else {
      maxHeight = 1280;
    }
    const defaultHeight = Math.min(640, maxHeight);
    return { min: 128, max: maxHeight, default: defaultHeight };
  }, [videoA, videoB]);

  useEffect(() => {
    setVideoHeight(videoHeightConfig.default);
  }, [videoHeightConfig.default]);

  // ─── Upload completion handlers ─────────────────────────────────────────
  const handleVideoAUploadComplete = useCallback(
    (metadata: VideoMetadata, blob: Blob) => {
      if (!sessionId && metadata.session_id) {
        setSessionId(metadata.session_id);
      }
      clearAllA();
      setVideoA({ metadata, blob });
    },
    [sessionId, setSessionId, clearAllA, setVideoA]
  );

  const handleVideoBUploadComplete = useCallback(
    (metadata: VideoMetadata, blob: Blob) => {
      if (!sessionId && metadata.session_id) {
        setSessionId(metadata.session_id);
      }
      clearAllB();
      setVideoB({ metadata, blob });
    },
    [sessionId, setSessionId, clearAllB, setVideoB]
  );

  // ─── Mode switching ─────────────────────────────────────────────────────
  const switchToPlaybackMode = () => {
    if (videoA.isPlaying) videoA.pause();
    if (videoB.isPlaying) videoB.pause();

    const playhead = initializePlayhead(
      videoA.currentFrame,
      videoB.currentFrame,
      videoA.totalFrames,
      videoB.totalFrames
    );
    usePlaybackStore.getState().setPlayheadState(playhead);

    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      playhead.syncOffset
    );
    if (trimStart === null) setTrimStart(range.min);
    if (trimEnd === null) setTrimEnd(range.max);

    usePlaybackStore.getState().setSyncOffset(playhead.syncOffset);
    const { addSyncPoint, clearSyncPoints } = useSyncStore.getState();
    clearSyncPoints();
    addSyncPoint({ frameA: videoA.currentFrame, frameB: videoB.currentFrame });

    setMode("PLAYBACK");
  };

  const switchToSyncMode = async () => {
    stopPlayback();
    const syncPoints = useSyncStore.getState().syncPoints;
    if (syncPoints.length > 0) {
      const sp = syncPoints[0];
      await Promise.all([
        videoA.seekToFrame(sp.frameA),
        videoB.seekToFrame(sp.frameB),
      ]);
    }
    setMode("SYNC");
  };

  // ─── PLAYBACK mode - Synchronized stepping ──────────────────────────────
  const handleStepForwardFine = async () => {
    const syncOffset = usePlaybackStore.getState().playheadState?.syncOffset;
    if (syncOffset === undefined) return;
    const nextFrameA = videoA.currentFrame + 1;
    const nextFrameB = nextFrameA + syncOffset;
    if (nextFrameA >= videoA.totalFrames || nextFrameB >= videoB.totalFrames || nextFrameB < 0) return;
    await Promise.all([videoA.seekToFrame(nextFrameA), videoB.seekToFrame(nextFrameB)]);
  };

  const handleStepBackwardFine = async () => {
    const syncOffset = usePlaybackStore.getState().playheadState?.syncOffset;
    if (syncOffset === undefined) return;
    const nextFrameA = videoA.currentFrame - 1;
    const nextFrameB = nextFrameA + syncOffset;
    if (nextFrameA < 0 || nextFrameB >= videoB.totalFrames || nextFrameB < 0) return;
    await Promise.all([videoA.seekToFrame(nextFrameA), videoB.seekToFrame(nextFrameB)]);
  };

  const handleStepForwardCoarse = async () => {
    const syncOffset = usePlaybackStore.getState().playheadState?.syncOffset;
    if (syncOffset === undefined) return;
    const nextFrameA = videoA.currentFrame + 5;
    const nextFrameB = nextFrameA + syncOffset;
    if (nextFrameA >= videoA.totalFrames || nextFrameB >= videoB.totalFrames || nextFrameB < 0) return;
    await Promise.all([videoA.seekToFrame(nextFrameA), videoB.seekToFrame(nextFrameB)]);
  };

  const handleStepBackwardCoarse = async () => {
    const syncOffset = usePlaybackStore.getState().playheadState?.syncOffset;
    if (syncOffset === undefined) return;
    const nextFrameA = videoA.currentFrame - 5;
    const nextFrameB = nextFrameA + syncOffset;
    if (nextFrameA < 0 || nextFrameB >= videoB.totalFrames || nextFrameB < 0) return;
    await Promise.all([videoA.seekToFrame(nextFrameA), videoB.seekToFrame(nextFrameB)]);
  };

  // ─── PLAYBACK mode - Synchronized playback loop ─────────────────────────
  const playbackLoopRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const trimStartRef = useRef<number | null>(trimStart);
  const trimEndRef = useRef<number | null>(trimEnd);
  useEffect(() => { trimStartRef.current = trimStart; }, [trimStart]);
  useEffect(() => { trimEndRef.current = trimEnd; }, [trimEnd]);

  const playbackLoopBoth = useCallback(
    async (timestamp: number) => {
      const state = usePlaybackStore.getState();
      const currentPlayhead = state.playheadState;

      if (!state.isPlaying || !currentPlayhead) return;

      const nextPosition = advancePlayhead(currentPlayhead, 1);

      const restartFromTrimStart = async () => {
        const seekFrame = trimStartRef.current ?? 0;
        const newState = { ...currentPlayhead, position: seekFrame };
        usePlaybackStore.getState().setPlayheadState(newState);
        usePlaybackStore.getState().setSliderPositions({
          ...usePlaybackStore.getState().sliderPositions,
          unified: seekFrame,
        });
        const loopTargets = calculateTargetFrames(seekFrame, currentPlayhead.syncOffset);
        await Promise.all([
          videoARef.current.seekToFrame(loopTargets.frameA),
          videoBRef.current.seekToFrame(loopTargets.frameB),
        ]);
        lastFrameTimeRef.current = 0;
        playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
      };

      if (nextPosition === null) {
        if (state.isLooping) {
          restartFromTrimStart().catch(stopPlayback);
        } else {
          stopPlayback();
        }
        return;
      }

      if (trimEndRef.current !== null && nextPosition > trimEndRef.current) {
        if (state.isLooping) {
          restartFromTrimStart().catch(stopPlayback);
        } else {
          stopPlayback();
        }
        return;
      }

      const targets = calculateTargetFrames(nextPosition, currentPlayhead.syncOffset);

      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      const frameInterval = 1000 / (videoARef.current.metadata?.framerate || 30) / state.playbackRate;

      if (elapsed >= frameInterval) {
        try {
          await Promise.all([
            videoARef.current.seekToFrame(targets.frameA),
            videoBRef.current.seekToFrame(targets.frameB),
          ]);
          const newPlayheadState = { ...currentPlayhead, position: nextPosition };
          usePlaybackStore.getState().setPlayheadState(newPlayheadState);
          lastFrameTimeRef.current = timestamp;
        } catch (error) {
          console.error("[PLAYBACK] Error during seek:", error);
          stopPlayback();
          return;
        }
      }

      if (usePlaybackStore.getState().isPlaying) {
        playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
      }
    },
    []
  );

  const startPlayback = () => {
    usePlaybackStore.getState().setIsPlaying(true);
    lastFrameTimeRef.current = 0;
    playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
  };

  const stopPlayback = () => {
    usePlaybackStore.getState().setIsPlaying(false);
    if (playbackLoopRef.current) {
      cancelAnimationFrame(playbackLoopRef.current);
      playbackLoopRef.current = null;
    }
    lastFrameTimeRef.current = 0;
  };

  const handlePlayPauseBoth = () => {
    const state = usePlaybackStore.getState();
    if (state.isPlaying) {
      stopPlayback();
      return;
    }
    if (!state.playheadState) return;

    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      state.playheadState.syncOffset
    );
    const effectiveTrimStart = trimStart ?? range.min;
    const effectiveTrimEnd = trimEnd ?? range.max;
    if (state.playheadState.position < effectiveTrimStart || state.playheadState.position > effectiveTrimEnd) {
      const newState = { ...state.playheadState, position: effectiveTrimStart };
      usePlaybackStore.getState().setPlayheadState(newState);
      usePlaybackStore.getState().setSliderPositions({
        ...usePlaybackStore.getState().sliderPositions,
        unified: effectiveTrimStart,
      });
      const targets = calculateTargetFrames(effectiveTrimStart, state.playheadState.syncOffset);
      Promise.all([
        videoA.seekToFrame(targets.frameA),
        videoB.seekToFrame(targets.frameB),
      ]).then(startPlayback).catch(console.error);
      return;
    }

    startPlayback();
  };

  const handleReturnToIn = async () => {
    const state = usePlaybackStore.getState();
    if (!state.playheadState) return;
    if (state.isPlaying) stopPlayback();
    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      state.playheadState.syncOffset
    );
    const seekFrame = trimStart ?? range.min;
    const targets = calculateTargetFrames(seekFrame, state.playheadState.syncOffset);
    await Promise.all([videoA.seekToFrame(targets.frameA), videoB.seekToFrame(targets.frameB)]);
    const newState = { ...state.playheadState, position: seekFrame };
    usePlaybackStore.getState().setPlayheadState(newState);
    usePlaybackStore.getState().setSliderPositions({
      ...usePlaybackStore.getState().sliderPositions,
      unified: seekFrame,
    });
  };

  const handleSpeedChange = (rate: number) => {
    usePlaybackStore.getState().setPlaybackRate(rate);
  };

  const handleSliderChangeBoth = (frame: number) => {
    usePlaybackStore.getState().setSliderPositions({
      ...usePlaybackStore.getState().sliderPositions,
      unified: frame,
    });
  };

  const handleSliderReleaseBoth = async (frameValue: number) => {
    const state = usePlaybackStore.getState();
    if (!state.playheadState) return;
    if (state.isPlaying) stopPlayback();

    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      state.playheadState.syncOffset
    );
    const newPosition = Math.max(range.min, Math.min(range.max, frameValue));
    usePlaybackStore.getState().setSliderPositions({
      ...usePlaybackStore.getState().sliderPositions,
      unified: newPosition,
    });

    const targets = calculateTargetFrames(newPosition, state.playheadState.syncOffset);
    await Promise.all([videoA.seekToFrame(targets.frameA), videoB.seekToFrame(targets.frameB)]);
    usePlaybackStore.getState().setPlayheadState({
      ...state.playheadState,
      position: newPosition,
    });
  };

  const handleLoopToggle = () => {
    const newVal = !usePlaybackStore.getState().isLooping;
    usePlaybackStore.getState().setIsLooping(newVal);
  };

  const handleResetTrim = () => {
    const state = usePlaybackStore.getState();
    if (!state.playheadState) return;
    const range = calculatePlayheadRange(
      videoA.totalFrames,
      videoB.totalFrames,
      state.playheadState.syncOffset
    );
    setTrimStart(range.min);
    setTrimEnd(range.max);
  };

  // ─── Keyboard Shortcuts ─────────────────────────────────────────────────
  const keyboardActionsRef = useRef({
    mode,
    handlePlayPauseBoth,
    handleStepForwardFine,
    handleStepBackwardFine,
    handleStepForwardCoarse,
    handleStepBackwardCoarse,
    controlsA,
    controlsB,
    activeVideo,
    videoA,
    videoB,
    undoA,
    redoA,
    undoB,
    redoB,
  });
  keyboardActionsRef.current = {
    mode,
    handlePlayPauseBoth,
    handleStepForwardFine,
    handleStepBackwardFine,
    handleStepForwardCoarse,
    handleStepBackwardCoarse,
    controlsA,
    controlsB,
    activeVideo,
    videoA,
    videoB,
    undoA,
    redoA,
    undoB,
    redoB,
  };

  useEffect(() => {
    function isInputFocused(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.getAttribute('contenteditable') === 'true';
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
        controlsA: cA,
        controlsB: cB,
        activeVideo: active,
        videoA: va,
        videoB: vb,
        undoA: doUndoA,
        redoA: doRedoA,
        undoB: doUndoB,
        redoB: doRedoB,
      } = keyboardActionsRef.current;

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
            if (e.shiftKey) void stepFwdCoarse();
            else void stepFwdFine();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (e.shiftKey) void stepBwdCoarse();
            else void stepBwdFine();
            break;
        }
      } else {
        switch (e.key) {
          case ' ':
            e.preventDefault();
            if (active === 'A') cA.playPause();
            else if (active === 'B') cB.playPause();
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
  }, []);

  // ─── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (playbackLoopRef.current) {
        cancelAnimationFrame(playbackLoopRef.current);
        playbackLoopRef.current = null;
      }
    };
  }, []);

  // ─── Session load effect ────────────────────────────────────────────────
  const targetSeekedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSessionId) return;
    if (!videoA.isReady || !videoB.isReady) return;
    if (targetSeekedRef.current === activeSessionId) return;
    targetSeekedRef.current = activeSessionId;

    const targetA = useSyncStore.getState().targetSyncFrameA;
    const targetB = useSyncStore.getState().targetSyncFrameB;

    let frameA = videoA.currentFrame;
    let frameB = videoB.currentFrame;

    async function doSeek() {
      if (targetA !== null) {
        await videoA.seekToFrame(targetA);
        frameA = targetA;
      }
      if (targetB !== null) {
        await videoB.seekToFrame(targetB);
        frameB = targetB;
      }
      useSyncStore.getState().clearTargetSyncFrames();
    }

    const finalizePlayhead = (fA: number, fB: number) => {
      const playhead = initializePlayhead(fA, fB, videoA.totalFrames, videoB.totalFrames);
      usePlaybackStore.getState().setPlayheadState(playhead);
      usePlaybackStore.getState().setSyncOffset(playhead.syncOffset);
    };

    doSeek().then(() => {
      finalizePlayhead(frameA, frameB);
    }).catch((err) => {
      console.error('[SESSION RESTORE] Seek failed:', err);
      finalizePlayhead(videoA.currentFrame, videoB.currentFrame);
    });
  }, [videoA.isReady, videoB.isReady, activeSessionId, videoA, videoB]);

  // ─── Browser support check ──────────────────────────────────────────────
  const support = checkWebCodecsSupport();
  const [browserCodecSupport, setBrowserCodecSupport] = useState<string>("");
  useEffect(() => {
    getBrowserCodecSupport().then(setBrowserCodecSupport);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────
  if (!support.isSupported) {
    return (
      <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
        <h1>Dual Video Sync Demo</h1>
        <div style={{ padding: "20px", backgroundColor: "#fee", border: "1px solid #c00", borderRadius: "4px", marginTop: "20px" }}>
          <h2>Browser Not Supported</h2>
          <p>{support.errorMessage}</p>
          <p>Detected browser: {support.browserInfo}</p>
        </div>
      </div>
    );
  }

  const bothVideosReady = videoA.isReady && videoB.isReady;
  const playbackState = usePlaybackStore.getState();
  const syncOffset = playbackState.playheadState?.syncOffset ?? null;

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>The Condor</h1>
      <p>Synchronized dual-video playback with WebCodecs. Set sync points in SYNC mode, then analyze with unified controls in PLAYBACK mode.</p>

      {/* Browser Compatibility Display */}
      {browserCodecSupport && (
        <div style={{ padding: "8px 12px", marginBottom: "15px", backgroundColor: "#e8f4f8", border: "1px solid #b3d9e6", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace", color: "#333" }}>
          {browserCodecSupport}
        </div>
      )}

      {/* Mode Indicator */}
      <div data-testid="mode-indicator" style={{ padding: "10px", marginTop: "15px", marginBottom: "15px", backgroundColor: mode === "SYNC" ? "#e3f2fd" : "#e8f5e9", border: mode === "SYNC" ? "2px solid #2196F3" : "2px solid #4CAF50", borderRadius: "4px", textAlign: "center" }}>
        <h2 style={{ margin: 0, color: mode === "SYNC" ? "#1976D2" : "#388E3C" }}>
          {mode === "SYNC" ? "\uD83D\uDD35 SYNC MODE" : "\uD83D\uDFE2 PLAYBACK MODE"}
        </h2>
        <p style={{ margin: "8px 0 0 0" }}>
          {mode === "SYNC" ? "Use independent controls to set synchronization points for each video" : "Videos synchronized - use unified controls to analyze together"}
        </p>
      </div>

      {/* Mode Toggle Button */}
      {bothVideosReady && (
        <div style={{ marginBottom: "15px", textAlign: "center" }}>
          <button
            data-testid="mode-toggle"
            onClick={mode === "SYNC" ? switchToPlaybackMode : switchToSyncMode}
            style={{ padding: "12px 24px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", backgroundColor: mode === "SYNC" ? "#4CAF50" : "#2196F3", color: "white", border: "none", borderRadius: "4px" }}
          >
            {mode === "SYNC" ? "Switch to PLAYBACK Mode \u2192" : "\u2190 Switch to SYNC Mode"}
          </button>
        </div>
      )}

      {/* Upload Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
        <VideoUploadWorkflow key="video-a" videoSlot="A" sessionId={sessionId || undefined} onUploadComplete={handleVideoAUploadComplete} externalVideo={externalVideoA} />
        <VideoUploadWorkflow key="video-b" videoSlot="B" sessionId={sessionId || undefined} onUploadComplete={handleVideoBUploadComplete} externalVideo={externalVideoB} />
      </div>

      {/* Video Display */}
      {(videoA.isReady || videoB.isReady) && (
        <div>
          {/* Video Size Slider */}
          <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
            <label htmlFor="video-height-slider" style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
              Video Display Height: {videoHeight}px
            </label>
            <input id="video-height-slider" type="range" min={videoHeightConfig.min} max={videoHeightConfig.max} value={videoHeight} onChange={(e) => setVideoHeight(Number(e.target.value))} style={{ width: "100%", cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginTop: "4px" }}>
              <span>{videoHeightConfig.min}px (min)</span>
              <span>{videoHeightConfig.max}px (max)</span>
            </div>
          </div>

          {/* PLAYBACK Mode Controls */}
          {mode === "PLAYBACK" && (
            <PlaybackControls
              playheadState={playbackState.playheadState}
              trimStart={trimStart}
              trimEnd={trimEnd}
              isPlaying={playbackState.isPlaying}
              isLooping={playbackState.isLooping}
              playbackRate={playbackState.playbackRate}
              syncOffset={syncOffset}
              totalFramesA={videoA.totalFrames}
              totalFramesB={videoB.totalFrames}
              sliderValue={playbackState.sliderPositions.unified}
              onPlayPause={handlePlayPauseBoth}
              onStepForward={handleStepForwardCoarse}
              onStepBackward={handleStepBackwardCoarse}
              onSliderChange={handleSliderChangeBoth}
              onSliderRelease={handleSliderReleaseBoth}
              onTrimStartChange={setTrimStart}
              onTrimEndChange={setTrimEnd}
              onReturnToIn={handleReturnToIn}
              onLoopToggle={handleLoopToggle}
              onResetTrim={handleResetTrim}
              onSpeedChange={handleSpeedChange}
            />
          )}

          {/* Annotation Toolbar */}
          {(videoA.isReady || videoB.isReady) && (
            <AnnotationToolbar
              selectedTool={selectedTool}
              onToolChange={setSelectedTool}
              activeVideo={activeVideo}
              videoAReady={videoA.isReady}
              videoBReady={videoB.isReady}
              canUndoA={canUndoA}
              canRedoA={canRedoA}
              canUndoB={canUndoB}
              canRedoB={canRedoB}
              onUndoA={undoA}
              onRedoA={redoA}
              onUndoB={undoB}
              onRedoB={redoB}
              annotationsALength={annotationsA.length}
              annotationsBLength={annotationsB.length}
              onClearAllA={clearAllA}
              onClearAllB={clearAllB}
              drawingStateA={drawingStateA}
              drawingStateB={drawingStateB}
            />
          )}

          {/* Video Panels */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "5px" }}>
            <div>
              <h3 style={{ marginTop: 0 }}>Video A</h3>
              <VideoPanel
                videoSlot="a"
                videoDecoder={videoA}
                videoHeight={videoHeight}
                file={fileA}
                annotations={annotationsA}
                selectedIds={selectedIdsA}
                drawingState={drawingStateA}
                polylineMousePos={polylineMousePosA}
                annotationScale={annotationScaleA}
                handlers={handlersA}
                annotationManager={annotationManagerA}
                layerRef={layerARef}
                isDraggingAnnotation={isDraggingAnnotationA}
                isReshapingAnnotation={isReshapingAnnotationA}
                updateAnnotationText={updateAnnotationTextA}
                mode={mode.toLowerCase() as "sync" | "playback"}
                controls={controlsA}
              />
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>Video B</h3>
              <VideoPanel
                videoSlot="b"
                videoDecoder={videoB}
                videoHeight={videoHeight}
                file={fileB}
                annotations={annotationsB}
                selectedIds={selectedIdsB}
                drawingState={drawingStateB}
                polylineMousePos={polylineMousePosB}
                annotationScale={annotationScaleB}
                handlers={handlersB}
                annotationManager={annotationManagerB}
                layerRef={layerBRef}
                isDraggingAnnotation={isDraggingAnnotationB}
                isReshapingAnnotation={isReshapingAnnotationB}
                updateAnnotationText={updateAnnotationTextB}
                mode={mode.toLowerCase() as "sync" | "playback"}
                controls={controlsB}
              />
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {(!fileA || !fileB) && (
        <div style={{ marginTop: "20px", padding: "20px", backgroundColor: "#f0f8ff", border: "1px solid #0066cc", borderRadius: "4px" }}>
          <h3 style={{ marginTop: 0 }}>Getting Started</h3>
          <ol>
            <li>Upload two MP4 video files (Video A and Video B)</li>
            <li><strong>SYNC Mode:</strong> Use independent controls to navigate each video to the desired synchronization point</li>
            <li><strong>Switch to PLAYBACK Mode:</strong> Click the mode toggle button</li>
            <li><strong>PLAYBACK Mode:</strong> Use unified controls to analyze synchronized videos</li>
            <li><strong>Return to SYNC Mode:</strong> Videos restore to original sync points for easy adjustment</li>
          </ol>
        </div>
      )}

      {/* Keyboard Shortcut Legend */}
      <div data-testid="keyboard-legend" style={{ marginTop: "16px", padding: "12px 16px", backgroundColor: "#fafafa", border: "1px solid #ddd", borderRadius: "4px", fontSize: "12px", color: "#555" }}>
        <strong style={{ display: "block", marginBottom: "6px" }}>Keyboard Shortcuts</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px" }}>
          <span><kbd>Space</kbd> Play / Pause</span>
          <span><kbd>\u2190</kbd> Step back 1 frame</span>
          <span><kbd>\u2192</kbd> Step forward 1 frame</span>
          <span><kbd>Shift</kbd>+<kbd>\u2190</kbd> Step back 5 frames</span>
          <span><kbd>Shift</kbd>+<kbd>\u2192</kbd> Step forward 5 frames</span>
        </div>
        <div style={{ marginTop: "4px", color: "#888" }}>
          In PLAYBACK mode steps both videos together. In SYNC mode steps the active video. Shortcuts are disabled when a text field is focused.
        </div>
      </div>
    </div>
  );
}
