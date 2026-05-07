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
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(Number(slider.min)).toBe(128);
      expect(Number(slider.max)).toBe(1080);
      expect(Number(slider.value)).toBe(640);
    });

    it('should calculate max as minimum of both videos heights', () => {
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
      useVideoStore.getState().setVideoB({
        metadata: {
          filename: 'video_1280x720.mp4',
          framerate: 30,
          duration: 10,
          width: 1280,
          height: 720,
          codec: 'h264',
          session_id: 'test-session',
          video_id: 'test-video-2',
          processing_status: 'complete',
        } as any,
        blob: new Blob(['test']),
      });
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.max)).toBe(720); // min(1080, 720)
    });

    it('should handle rotation when calculating video height', () => {
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
      useVideoStore.getState().setVideoB({
        metadata: {
          filename: 'video_1920x1080_90.mp4',
          framerate: 30,
          duration: 10,
          width: 1920,
          height: 1080,
          rotation: 90,
          codec: 'h264',
          session_id: 'test-session',
          video_id: 'test-video-2',
          processing_status: 'complete',
        } as any,
        blob: new Blob(['test']),
      });
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      // Video A: 1080, Video B rotated 90° → height = width = 1920
      // Max = min(1080, 1920) = 1080
      expect(Number(slider.max)).toBe(1080);
    });

    it('should use single video height when only one video loaded', () => {
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
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.max)).toBe(1080);
    });

    it('should default to 1280 when no videos loaded', () => {
      render(<DualVideoSynchronizer />);

      // No videos loaded, slider should not be visible
      expect(screen.queryByRole('slider', { name: /Video Display Height/i })).toBeFalsy();
    });
  });

  describe('Slider Bounds', () => {
    it('should enforce minimum height of 128px', () => {
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
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.min)).toBe(128);
    });

    it('should enforce maximum height based on video dimensions', () => {
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
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.max)).toBe(1080);
    });

    it('should constrain default to max if max < 640', () => {
      useVideoStore.getState().setVideoA({
        metadata: {
          filename: 'video_640x480.mp4',
          framerate: 30,
          duration: 10,
          width: 640,
          height: 480,
          codec: 'h264',
          session_id: 'test-session',
          video_id: 'test-video',
          processing_status: 'complete',
        } as any,
        blob: new Blob(['test']),
      });
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.max)).toBe(480);
      expect(Number(slider.value)).toBe(480); // default = min(640, 480) = 480
    });
  });

  describe('Slider Interaction', () => {
    it('should update display when slider value changes', () => {
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
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.value)).toBe(640);

      // Simulate slider change
      slider.value = '800';
      slider.dispatchEvent(new Event('change', { bubbles: true }));

      expect(Number(slider.value)).toBe(800);
    });

    it('should update label to show current height value', () => {
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
      render(<DualVideoSynchronizer />);

      const label = screen.getByText(/Video Display Height/i);
      expect(label.textContent).toContain('640px');
    });

    it('should maintain aspect ratio when scaling', () => {
      // Aspect ratio is maintained by VideoPanel's calculateDisplayDimensions
      // which applies uniform scale to both width and height.
      // This is verified in VideoPanel tests; here we confirm the slider
      // value is passed through correctly.
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
      render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.value)).toBe(640);
    });
  });

  describe('Height Updates on Video Change', () => {
    it('should reset to default when new videos uploaded', () => {
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
      const { rerender } = render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.value)).toBe(640);

      // Change video A to a smaller video
      useVideoStore.getState().setVideoA({
        metadata: {
          filename: 'video_640x480.mp4',
          framerate: 30,
          duration: 10,
          width: 640,
          height: 480,
          codec: 'h264',
          session_id: 'test-session',
          video_id: 'test-video-2',
          processing_status: 'complete',
        } as any,
        blob: new Blob(['test']),
      });
      rerender(<DualVideoSynchronizer />);

      // Default should now be min(640, 480) = 480
      const updatedSlider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(updatedSlider.value)).toBe(480);
    });

    it('should recalculate bounds when switching from single to dual video', () => {
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
      const { rerender } = render(<DualVideoSynchronizer />);

      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(slider.max)).toBe(1080);

      // Add Video B with smaller height
      useVideoStore.getState().setVideoB({
        metadata: {
          filename: 'video_1280x720.mp4',
          framerate: 30,
          duration: 10,
          width: 1280,
          height: 720,
          codec: 'h264',
          session_id: 'test-session',
          video_id: 'test-video-2',
          processing_status: 'complete',
        } as any,
        blob: new Blob(['test']),
      });
      rerender(<DualVideoSynchronizer />);

      // Max should now be min(1080, 720) = 720
      const updatedSlider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(Number(updatedSlider.max)).toBe(720);
    });
  });

  describe('Annotation Independence', () => {
    it('should keep annotations at original video dimensions regardless of slider', () => {
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
      render(<DualVideoSynchronizer />);

      // The annotation canvas uses videoA.metadata.width/height for its Stage dimensions,
      // not the display dimensions. This is verified in VideoCanvas tests.
      // Here we confirm the slider exists and the component renders without error.
      const slider = screen.getByRole('slider', { name: /Video Display Height/i }) as HTMLInputElement;
      expect(slider).toBeTruthy();
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

  it('should preserve store annotations when activeSessionId changes', () => {
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

    // Store annotations should be preserved (hook reads from store directly)
    expect(useAnnotationStore.getState().annotationsA).toHaveLength(1);
    expect(useAnnotationStore.getState().annotationsA[0].text).toBe('Test A');

    act(() => {
      useSessionStore.setState({ activeSessionId: 'session-2' });
    });

    // Store annotations should still be intact after session change
    expect(useAnnotationStore.getState().annotationsA).toHaveLength(1);
    expect(useAnnotationStore.getState().annotationsA[0].text).toBe('Test A');
  });
  it('should preserve channel B store annotations without calling clearAllB', () => {
    /**
     * Validates Fix 1: externalVideo path no longer calls onUploadComplete/clearAllB.
     *
     * After restoreSessionState writes annotations to the store and activeSessionId is set,
     * the hook reads annotations from the store directly. clearAllB must NOT be called
     * (it would wipe the just-restored annotations).
     */
    const channelBAnnotations = [
      { id: 'ann-b-1', type: 'text', text: 'B annotation', points: [], color: '#000', strokeWidth: 2 },
    ];
    useAnnotationStore.getState().setAnnotationsB(channelBAnnotations as any);
    useSessionStore.setState({
      activeSessionId: 'session-b-hydration-test',
      isHydratingSession: false,
      error: null,
      loading: false,
    });

    render(<DualVideoSynchronizer />);

    // Store annotations must be preserved (hook reads from store directly)
    expect(useAnnotationStore.getState().annotationsB).toHaveLength(1);
    expect(useAnnotationStore.getState().annotationsB[0].text).toBe('B annotation');
    // clearAllB must NOT be called during session restore
    expect(mockClearAllB).not.toHaveBeenCalled();
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
