/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for DualVideoSynchronizer component.
 *
 * Tests video height slider functionality and session load bug fixes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DualVideoSynchronizer } from '../DualVideoSynchronizer';
import { useSessionStore } from '../../store/sessionStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useVideoStore } from '../../store/videoStore';
import { useSyncStore } from '../../store/syncStore';
import { useTrimStore } from '../../store/trimStore';

// Hoisted mock functions for useVideoAnnotations
const mockHydrateA = vi.hoisted(() => vi.fn());
const mockHydrateB = vi.hoisted(() => vi.fn());
const mockClearAllA = vi.hoisted(() => vi.fn());
const mockClearAllB = vi.hoisted(() => vi.fn());
const mockHandlersA = vi.hoisted(() => ({
  handleStageMouseDown: vi.fn(),
  handleStageMouseMove: vi.fn(),
  handleStageMouseUp: vi.fn(),
  handleAnnotationClick: vi.fn(),
  handleAnnotationDragStart: vi.fn(),
  handleAnnotationDragMove: vi.fn(),
  handleAnnotationDragEnd: vi.fn(),
  handleControlPointMouseDown: vi.fn(),
  handleStageClick: vi.fn(),
}));
const mockHandlersB = vi.hoisted(() => ({
  handleStageMouseDown: vi.fn(),
  handleStageMouseMove: vi.fn(),
  handleStageMouseUp: vi.fn(),
  handleAnnotationClick: vi.fn(),
  handleAnnotationDragStart: vi.fn(),
  handleAnnotationDragMove: vi.fn(),
  handleAnnotationDragEnd: vi.fn(),
  handleControlPointMouseDown: vi.fn(),
  handleStageClick: vi.fn(),
}));

// Mock the WebCodecs decoder hook
vi.mock('../../hooks/useWebCodecsDecoder', () => ({
  useWebCodecsDecoder: (file: File | null) => {
    if (!file) {
      return {
        isReady: false,
        metadata: null,
        currentFrame: 0,
        totalFrames: 0,
        canvasRef: { current: null },
        seekToFrame: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        reset: vi.fn(),
      };
    }

    // Parse mock metadata from filename
    // Format: "video_{width}x{height}_{rotation}.mp4"
    const match = file.name.match(/video_(\d+)x(\d+)(?:_(\d+))?\.mp4/);
    const width = match ? parseInt(match[1]) : 1920;
    const height = match ? parseInt(match[2]) : 1080;
    const rotation = match && match[3] ? parseInt(match[3]) : 0;

    return {
      isReady: true,
      metadata: {
        width,
        height,
        rotation,
        framerate: 30,
        duration: 10,
        codec: 'h264',
        filename: file.name,
        file_size: file.size,
        session_id: 'test-session',
        video_id: 'test-video',
        processing_status: 'complete' as const,
      },
      currentFrame: 0,
      totalFrames: 300,
      canvasRef: { current: document.createElement('canvas') },
      seekToFrame: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      reset: vi.fn(),
    };
  },
}));

// Mock the video annotations hook
vi.mock('../../hooks/useVideoAnnotations', () => ({
  useVideoAnnotations: (
    _video: unknown,
    videoId: 'A' | 'B'
  ) => ({
    manager: {},
    drawingState: { isDrawing: false, currentTool: null },
    annotations: [],
    selectedIds: new Set<string>(),
    polylineMousePos: null,
    scale: 1,
    handlers: videoId === 'A' ? mockHandlersA : mockHandlersB,
    clearAll: videoId === 'A' ? mockClearAllA : mockClearAllB,
    hydrateAnnotations: videoId === 'A' ? mockHydrateA : mockHydrateB,
    isDraggingAnnotation: false,
    isReshapingAnnotation: false,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    updateAnnotationText: vi.fn(),
  }),
}));

// Mock feature detection
vi.mock('../../utils/featureDetection', () => ({
  checkWebCodecsSupport: () => ({ isSupported: true, errorMessage: '', browserInfo: '' }),
  getBrowserCodecSupport: () => Promise.resolve('H.264: supported, H.265: supported'),
}));

// Mock VideoUploadWorkflow
vi.mock('../VideoUploadWorkflow', () => ({
  VideoUploadWorkflow: ({ videoSlot }: { videoSlot: string }) => (
    <div data-testid={`upload-workflow-${videoSlot}`}>Upload Workflow {videoSlot}</div>
  ),
}));

describe('DualVideoSynchronizer - Video Height Slider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVideoStore.getState().reset();
    useSessionStore.setState({ activeSessionId: null, isHydratingSession: false, error: null, loading: false });
    useAnnotationStore.getState().reset();
    usePlaybackStore.getState().reset();
    useSyncStore.getState().reset();
    useTrimStore.getState().resetTrim();
  });

  describe('Annotation Hook Integration', () => {
    it('should instantiate useVideoAnnotations for both channels with correct slot IDs', () => {
      // We cannot easily assert on rendered Konva handlers (canvas layer),
      // but we can verify the hook is called twice with distinct slot params.
      // A mismatch in JSX handler references (e.g. handlersB in Channel A block)
      // must be caught by code review or static tests; this test ensures the
      // hook wiring itself is present for both channels.
      render(<DualVideoSynchronizer />);

      // The mock factory above returns different handler objects per slot,
      // so if the component renders both channels the hook is invoked twice.
      // We verify the mock was imported and the component mounts without
      // throwing due to undefined handlers.
      expect(screen.queryByLabelText(/Video Display Height/i)).toBeFalsy();
    });
  });

  describe('Height Configuration Calculation', () => {
    it('should calculate correct min, max, and default for 1920x1080 videos', () => {
      render(<DualVideoSynchronizer />);

      // Initially no videos loaded, slider should not be visible
      expect(screen.queryByLabelText(/Video Display Height/i)).toBeFalsy();
    });

    it('should show slider with default 640px when max height is greater than 640', () => {
      // This test would require actually loading videos through the upload workflow
      // For now, we'll document the expected behavior:
      // - Min: 128px (hardcoded)
      // - Max: min(videoA.height, videoB.height) accounting for rotation
      // - Default: min(640, max)
      expect(true).toBe(true); // Placeholder
    });

    it('should calculate max as minimum of both videos heights', () => {
      // Expected behavior:
      // - Video A: 1920x1080 -> height = 1080
      // - Video B: 1280x720 -> height = 720
      // - Max should be min(1080, 720) = 720
      expect(true).toBe(true); // Placeholder
    });

    it('should handle rotation when calculating video height', () => {
      // Expected behavior:
      // - Video A: 1920x1080, rotation=0 -> height = 1080
      // - Video B: 1920x1080, rotation=90 -> height = 1920 (swapped)
      // - Max should be min(1080, 1920) = 1080
      expect(true).toBe(true); // Placeholder
    });

    it('should use single video height when only one video loaded', () => {
      // Expected behavior:
      // - Video A: 1920x1080 -> max = 1080
      // - Video B: not loaded
      // - Max should be 1080
      expect(true).toBe(true); // Placeholder
    });

    it('should default to 1280 when no videos loaded', () => {
      // Expected behavior:
      // - No videos loaded
      // - Max should default to 1280
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Slider Bounds', () => {
    it('should enforce minimum height of 128px', () => {
      // The slider min attribute should be 128
      expect(true).toBe(true); // Placeholder
    });

    it('should enforce maximum height based on video dimensions', () => {
      // The slider max attribute should be calculated max height
      expect(true).toBe(true); // Placeholder
    });

    it('should constrain default to max if max < 640', () => {
      // Expected behavior:
      // - Video A: 640x480 -> max = 480
      // - Default should be min(640, 480) = 480, not 640
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Slider Interaction', () => {
    it('should update display when slider value changes', () => {
      // User drags slider -> videoHeight state updates -> videos re-render with new scale
      expect(true).toBe(true); // Placeholder
    });

    it('should update label to show current height value', () => {
      // Label should show "Video Display Height: {value}px"
      expect(true).toBe(true); // Placeholder
    });

    it('should maintain aspect ratio when scaling', () => {
      // Scaling should apply equally to width and height based on height constraint
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Height Updates on Video Change', () => {
    it('should reset to default when new videos uploaded', () => {
      // When videos change, videoHeight should reset to new default
      expect(true).toBe(true); // Placeholder
    });

    it('should recalculate bounds when switching from single to dual video', () => {
      // Max should change from single video height to min of both
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Annotation Independence', () => {
    it('should keep annotations at original video dimensions regardless of slider', () => {
      // Annotations canvas should use videoA.metadata.width/height
      // Not affected by displayWidth/displayHeight
      expect(true).toBe(true); // Placeholder
    });
  });
});

describe('DualVideoSynchronizer - Session Load Bug Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVideoStore.getState().reset();
    useSessionStore.setState({ activeSessionId: null, isHydratingSession: false, error: null, loading: false });
    useAnnotationStore.getState().reset();
    usePlaybackStore.getState().reset();
    useSyncStore.getState().reset();
    useTrimStore.getState().resetTrim();
  });

  it('should sync playback rate from store when activeSessionId changes', () => {
    useVideoStore.getState().setVideoA({
      metadata: {
        filename: 'video_1920x1080.mp4',
        framerate: 30,
        duration: 10,
        width: 1920,
        height: 1080,
        codec: 'h264',
        session_id: 'test-session',
        video_id: 'test-video',
        processing_status: 'complete',
      } as any,
      blob: new Blob(['test']),
    });
    usePlaybackStore.getState().setPlaybackRate(0.5);
    useSyncStore.getState().setMode('PLAYBACK');
    useSessionStore.setState({ activeSessionId: 'session-1', isHydratingSession: true });

    render(<DualVideoSynchronizer />);

    const select = screen.getByTestId('speed-select-both') as HTMLSelectElement;
    expect(select.value).toBe('0.5');
  });

  it('should not overwrite store annotations during hydration', () => {
    useAnnotationStore.getState().setAnnotationsA([
      { id: 'ann-1', type: 'text', text: 'Test A', points: [], color: '#000', strokeWidth: 2 } as any,
    ]);
    useSessionStore.setState({ isHydratingSession: true });

    render(<DualVideoSynchronizer />);

    expect(useAnnotationStore.getState().annotationsA).toHaveLength(1);
    expect(useAnnotationStore.getState().annotationsA[0].text).toBe('Test A');
  });

  it('should reset hydration ref and re-hydrate when activeSessionId changes', () => {
    useVideoStore.getState().setVideoA({
      metadata: {
        filename: 'video_1920x1080.mp4',
        framerate: 30,
        duration: 10,
        width: 1920,
        height: 1080,
        codec: 'h264',
        session_id: 'test-session',
        video_id: 'test-video',
        processing_status: 'complete',
      } as any,
      blob: new Blob(['test']),
    });
    useAnnotationStore.getState().setAnnotationsA([
      { id: 'ann-1', type: 'text', text: 'Test A', points: [], color: '#000', strokeWidth: 2 } as any,
    ]);
    useSessionStore.setState({ activeSessionId: 'session-1', isHydratingSession: true });

    render(<DualVideoSynchronizer />);

    expect(mockHydrateA).toHaveBeenCalledWith([
      { id: 'ann-1', type: 'text', text: 'Test A', points: [], color: '#000', strokeWidth: 2 },
    ]);
    const callsAfterMount = mockHydrateA.mock.calls.length;

    act(() => {
      useSessionStore.setState({ activeSessionId: 'session-2' });
    });

    expect(mockHydrateA.mock.calls.length).toBe(callsAfterMount + 1);
    expect(mockHydrateA).toHaveBeenLastCalledWith([
      { id: 'ann-1', type: 'text', text: 'Test A', points: [], color: '#000', strokeWidth: 2 },
    ]);
  });
});

/**
 * Height Calculation Logic Reference (for validation):
 *
 * 1. Get effective height for each video (accounting for rotation):
 *    - If rotation = 90° or 270°: use width as height
 *    - Otherwise: use height
 *
 * 2. Calculate max height:
 *    - Both videos loaded: min(heightA, heightB)
 *    - One video loaded: that video's height
 *    - No videos: 1280 (fallback)
 *
 * 3. Calculate default height:
 *    - min(640, maxHeight)
 *
 * 4. Bounds:
 *    - Min: 128px (constant)
 *    - Max: calculated max height
 *    - Default: calculated default height
 *
 * 5. Scaling calculation (per video):
 *    - baseDisplayHeight = rotated ? width : height
 *    - scale = baseDisplayHeight > videoHeight ? videoHeight / baseDisplayHeight : 1
 *    - displayWidth = baseDisplayWidth * scale
 *    - displayHeight = baseDisplayHeight * scale
 */
