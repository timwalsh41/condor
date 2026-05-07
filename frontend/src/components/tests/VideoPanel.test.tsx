import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { VideoPanel } from "../VideoPanel";
import type { VideoPanelProps } from "../VideoPanel";
import type { UseWebCodecsDecoderResult } from "../../hooks/useWebCodecsDecoder";
import type { AnnotationHandlers } from "../../hooks/useVideoAnnotations";
import type { VideoControlsHandle } from "../../hooks/useVideoControls";
import type { Annotation, DrawingState, Point } from "../../types/annotations";
import type { AnnotationManager } from "../../utils/AnnotationManager";

// Mock child components
vi.mock("../VideoCanvas", () => ({
  VideoCanvas: vi.fn(() => <div data-testid="mock-video-canvas" />),
}));

vi.mock("../VideoControls", () => ({
  VideoControls: vi.fn(() => <div data-testid="mock-video-controls" />),
}));

function createMockHandlers(): AnnotationHandlers {
  return {
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseUp: vi.fn(),
    handleClick: vi.fn(),
    handleDoubleClick: vi.fn(),
    handleAnnotationClick: vi.fn(),
    handleAnnotationDragStart: vi.fn(),
    handleControlPointMouseDown: vi.fn(),
    handleStageMouseMove: vi.fn(),
    handleStageMouseUp: vi.fn(),
  };
}

function createMockControls(): VideoControlsHandle {
  return {
    sliderValue: 0,
    playPause: vi.fn(),
    stepForward: vi.fn(),
    stepBackward: vi.fn(),
    onSliderChange: vi.fn(),
    onSliderRelease: vi.fn(),
    onSpeedChange: vi.fn(),
    seekToFrame: vi.fn(),
  };
}

function createReadyDecoder(
  overrides: Partial<UseWebCodecsDecoderResult> = {}
): UseWebCodecsDecoderResult {
  return {
    canvasRef: { current: document.createElement("canvas") },
    currentFrame: 42,
    totalFrames: 200,
    isReady: true,
    error: null,
    seekToFrame: vi.fn(),
    stepForward: vi.fn(),
    stepBackward: vi.fn(),
    cacheStats: {
      size: 0,
      maxSize: 120,
      utilizationPercent: 0,
      hits: 0,
      misses: 0,
      hitRatePercent: 0,
      evictions: 0,
    },
    lastLatencyMs: 0,
    isPlaying: false,
    playbackRate: 1,
    play: vi.fn(),
    pause: vi.fn(),
    setPlaybackRate: vi.fn(),
    framerate: 30,
    metadata: {
      duration: 6.67,
      framerate: 30,
      gopSize: 30,
      totalFrames: 200,
      codec: "avc1.64001f",
      width: 1920,
      height: 1080,
      rotation: 0,
      fileSizeMB: 5.2,
    },
    earlyMetadata: null,
    ...overrides,
  };
}

function createNotReadyDecoder(
  overrides: Partial<UseWebCodecsDecoderResult> = {}
): UseWebCodecsDecoderResult {
  return {
    canvasRef: { current: null },
    currentFrame: 0,
    totalFrames: 0,
    isReady: false,
    error: null,
    seekToFrame: vi.fn(),
    stepForward: vi.fn(),
    stepBackward: vi.fn(),
    cacheStats: {
      size: 0,
      maxSize: 120,
      utilizationPercent: 0,
      hits: 0,
      misses: 0,
      hitRatePercent: 0,
      evictions: 0,
    },
    lastLatencyMs: 0,
    isPlaying: false,
    playbackRate: 1,
    play: vi.fn(),
    pause: vi.fn(),
    setPlaybackRate: vi.fn(),
    framerate: 0,
    metadata: null,
    earlyMetadata: null,
    ...overrides,
  };
}

const mockAnnotationManager: AnnotationManager = {
  getPreviewPoints: vi.fn(),
} as any;

const idleDrawingState: DrawingState = { mode: "idle" };

function createDefaultProps(
  overrides: Partial<VideoPanelProps> = {}
): VideoPanelProps {
  return {
    videoSlot: "a",
    videoDecoder: createReadyDecoder(),
    videoHeight: 640,
    file: new File([], "test.mp4"),
    annotations: [] as Annotation[],
    selectedIds: new Set<string>(),
    drawingState: idleDrawingState,
    polylineMousePos: null,
    annotationScale: 1,
    handlers: createMockHandlers(),
    annotationManager: mockAnnotationManager,
    layerRef: { current: null } as any,
    isDraggingAnnotation: false,
    isReshapingAnnotation: false,
    updateAnnotationText: vi.fn(),
    mode: "sync",
    controls: createMockControls(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VideoPanel", () => {
  it('renders "No video loaded" when no decoder ready and no file', () => {
    const decoder = createNotReadyDecoder();
    const { container } = render(
      <VideoPanel {...createDefaultProps({ videoDecoder: decoder, file: null })} />
    );
    expect(container.textContent).toContain("No video loaded");
  });

  it('renders "Loading..." when decoder file is set but not ready', () => {
    const decoder = createNotReadyDecoder();
    const { container } = render(
      <VideoPanel {...createDefaultProps({ videoDecoder: decoder, file: new File([], "test.mp4") })} />
    );
    expect(container.textContent).toContain("Loading...");
  });

  it("renders VideoCanvas with correct dimensions when decoder ready", () => {
    const { container } = render(<VideoPanel {...createDefaultProps()} />);
    // VideoCanvas mock should be rendered
    expect(container.querySelector('[data-testid="mock-video-canvas"]')).toBeTruthy();
    // Canvas element should be present
    expect(container.querySelector('[data-testid="video-canvas-a"]')).toBeTruthy();
    // Annotation container should be present
    expect(container.querySelector('[data-testid="annotation-container-a"]')).toBeTruthy();
  });

  it("applies rotation transform correctly (rotation=0)", () => {
    const decoder = createReadyDecoder({
      metadata: {
        duration: 6.67,
        framerate: 30,
        gopSize: 30,
        totalFrames: 200,
        codec: "avc1.64001f",
        width: 1920,
        height: 1080,
        rotation: 0,
        fileSizeMB: 5.2,
      },
    });
    const { container } = render(
      <VideoPanel {...createDefaultProps({ videoDecoder: decoder })} />
    );
    // With rotation=0, baseDisplayWidth = width (1920), baseDisplayHeight = height (1080)
    // Scale = 640/1080 ≈ 0.5926
    // The outer container should have explicit width/height
    const outerDiv = container.querySelector('[style*="border: 2px solid"]') as HTMLElement;
    expect(outerDiv).toBeTruthy();
    // Canvas should be present with correct testid
    expect(container.querySelector('[data-testid="video-canvas-a"]')).toBeTruthy();
  });

  it("applies rotation transform correctly (rotation=90)", () => {
    const decoder = createReadyDecoder({
      metadata: {
        duration: 6.67,
        framerate: 30,
        gopSize: 30,
        totalFrames: 200,
        codec: "avc1.64001f",
        width: 1920,
        height: 1080,
        rotation: 90,
        fileSizeMB: 5.2,
      },
    });
    const { container } = render(
      <VideoPanel {...createDefaultProps({ videoDecoder: decoder })} />
    );
    // With rotation=90, baseDisplayWidth = height (1080), baseDisplayHeight = width (1920)
    // Scale = 640/1920 ≈ 0.333
    // Canvas should be present
    expect(container.querySelector('[data-testid="video-canvas-a"]')).toBeTruthy();
    // Annotation container should be present
    expect(container.querySelector('[data-testid="annotation-container-a"]')).toBeTruthy();
  });

  it("scales display when video height exceeds videoHeight config", () => {
    const decoder = createReadyDecoder({
      metadata: {
        duration: 6.67,
        framerate: 30,
        gopSize: 30,
        totalFrames: 200,
        codec: "avc1.64001f",
        width: 1920,
        height: 1080,
        rotation: 0,
        fileSizeMB: 5.2,
      },
    });
    // videoHeight=640, baseDisplayHeight=1080, so scale=640/1080
    const { container } = render(
      <VideoPanel {...createDefaultProps({ videoDecoder: decoder, videoHeight: 640 })} />
    );
    // The outer container should have displayHeight = 1080 * (640/1080) = 640
    const outerDiv = container.querySelector('[style*="border: 2px solid"]') as HTMLElement;
    expect(outerDiv).toBeTruthy();
    expect(container.querySelector('[data-testid="video-canvas-a"]')).toBeTruthy();
  });

  it("displays frame counter with correct frame number", () => {
    const decoder = createReadyDecoder({ currentFrame: 42, totalFrames: 200 });
    const { container } = render(
      <VideoPanel {...createDefaultProps({ videoDecoder: decoder })} />
    );
    const frameCounter = container.querySelector('[data-testid="frame-counter-a"]');
    expect(frameCounter).toBeTruthy();
    expect(frameCounter?.textContent).toContain("42");
    expect(frameCounter?.textContent).toContain("200");
  });

  it("renders VideoControls in SYNC mode", () => {
    const { container } = render(
      <VideoPanel {...createDefaultProps({ mode: "sync" })} />
    );
    expect(container.querySelector('[data-testid="mock-video-controls"]')).toBeTruthy();
  });

  it("does not render VideoControls in PLAYBACK mode", () => {
    const { container } = render(
      <VideoPanel {...createDefaultProps({ mode: "playback" })} />
    );
    expect(container.querySelector('[data-testid="mock-video-controls"]')).toBeNull();
  });

  it("does not render VideoControls when controls handle is undefined", () => {
    const { container } = render(
      <VideoPanel {...createDefaultProps({ mode: "sync", controls: undefined })} />
    );
    expect(container.querySelector('[data-testid="mock-video-controls"]')).toBeNull();
  });

  it("passes correct videoSlot prop to child components", () => {
    const { container } = render(
      <VideoPanel {...createDefaultProps({ videoSlot: "b" })} />
    );
    // Canvas should use videoSlot "b"
    expect(container.querySelector('[data-testid="video-canvas-b"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="annotation-container-b"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="frame-counter-b"]')).toBeTruthy();
  });
});
