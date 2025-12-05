/**
 * Unit Tests for useVideoAnnotations Hook
 *
 * Tests the custom hook that encapsulates annotation state and logic.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVideoAnnotations } from "../useVideoAnnotations";
import type { UseWebCodecsDecoderResult } from "../useWebCodecsDecoder";

// Mock video decoder result
const createMockVideoDecoder = (): UseWebCodecsDecoderResult => ({
  canvasRef: { current: null },
  currentFrame: 0,
  totalFrames: 100,
  isReady: true,
  error: null,
  seekToFrame: vi.fn(),
  stepForward: vi.fn(),
  stepBackward: vi.fn(),
  cacheStats: {
    size: 0,
    maxSize: 100,
    utilizationPercent: 0,
    hits: 0,
    misses: 0,
    hitRatePercent: 0,
    evictions: 0,
  },
  lastLatencyMs: 0,
  isPlaying: false,
  playbackRate: 1.0,
  play: vi.fn(),
  pause: vi.fn(),
  setPlaybackRate: vi.fn(),
  framerate: 30,
  metadata: {
    duration: 10,
    framerate: 30,
    gopSize: 30,
    totalFrames: 100,
    codec: "avc1.64001f",
    width: 1920,
    height: 1080,
    fileSizeMB: 5.2,
  },
});

describe("useVideoAnnotations", () => {
  let mockVideoDecoder: UseWebCodecsDecoderResult;
  let setActiveVideo: (id: "A" | "B") => void;
  let activeVideo: "A" | "B" | null;

  beforeEach(() => {
    mockVideoDecoder = createMockVideoDecoder();
    setActiveVideo = vi.fn();
    activeVideo = null; // Default to no active video
  });

  describe("initialization", () => {
    it("should initialize with default values", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.selectedTool).toBe("freehand");
      expect(result.current.drawingState).toEqual({ mode: "idle" });
      expect(result.current.annotations).toEqual([]);
      expect(result.current.polylineMousePos).toBeNull();
      expect(result.current.scale).toBe(1);
      expect(result.current.manager).toBeDefined();
      expect(result.current.handlers).toBeDefined();
    });

    it("should create unique manager instances per hook", () => {
      const { result: resultA } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );
      const { result: resultB } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "B", activeVideo, setActiveVideo)
      );

      expect(resultA.current.manager).not.toBe(resultB.current.manager);
    });
  });

  describe("tool selection", () => {
    it("should update selected tool", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      act(() => {
        result.current.setSelectedTool("polyline");
      });

      expect(result.current.selectedTool).toBe("polyline");
      expect(result.current.manager.getTool()).toBe("polyline");
    });

    it("should sync tool across multiple calls", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      act(() => {
        result.current.setSelectedTool("oval");
      });
      expect(result.current.selectedTool).toBe("oval");

      act(() => {
        result.current.setSelectedTool("arrow");
      });
      expect(result.current.selectedTool).toBe("arrow");
    });
  });

  describe("handlers", () => {
    it("should provide all required event handlers", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.handlers.handleMouseDown).toBeTypeOf("function");
      expect(result.current.handlers.handleMouseMove).toBeTypeOf("function");
      expect(result.current.handlers.handleMouseUp).toBeTypeOf("function");
      expect(result.current.handlers.handleClick).toBeTypeOf("function");
      expect(result.current.handlers.handleDoubleClick).toBeTypeOf("function");
    });

    it("should set active video on mouse interaction", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "B", activeVideo, setActiveVideo)
      );

      // Mock Konva event with stage and pointer position
      // target should be the stage itself when clicking on background
      const mockStage = {
        getPointerPosition: () => ({ x: 100, y: 200 }),
      };
      const mockEvent = {
        target: mockStage,
      } as any;
      mockStage.getStage = () => mockStage;

      act(() => {
        result.current.handlers.handleMouseDown(mockEvent);
      });

      expect(setActiveVideo).toHaveBeenCalledWith("B");
    });
  });

  describe("scale calculation", () => {
    it("should default to scale 1 when no canvas", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.scale).toBe(1);
    });

    it("should calculate scale based on canvas size", () => {
      // Create mock canvas element
      const mockCanvas = document.createElement("canvas");
      Object.defineProperty(mockCanvas, "clientWidth", {
        value: 960, // Half of 1920
        writable: false,
      });

      mockVideoDecoder.canvasRef.current = mockCanvas;

      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Scale should be calculated as clientWidth / videoWidth = 960 / 1920 = 0.5
      expect(result.current.scale).toBe(0.5);
    });
  });

  describe("integration with AnnotationManager", () => {
    it("should update annotations when drawing completes", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Simulate complete drawing workflow
      act(() => {
        result.current.setSelectedTool("freehand");
        result.current.manager.startDrawing({ x: 10, y: 20 });
        result.current.manager.continueDrawing({ x: 30, y: 40 });
        result.current.manager.finishDrawing();
      });

      // Check that annotations state was not automatically updated
      // (Handler needs to explicitly call setAnnotations)
      expect(result.current.annotations).toEqual([]);

      // Manually update annotations (simulating what handler does)
      act(() => {
        result.current.handlers.handleMouseUp();
      });
    });

    it("should maintain drawing state independently per video", () => {
      const { result: resultA } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );
      const { result: resultB } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "B", activeVideo, setActiveVideo)
      );

      act(() => {
        resultA.current.setSelectedTool("freehand");
        resultB.current.setSelectedTool("polyline");
      });

      expect(resultA.current.selectedTool).toBe("freehand");
      expect(resultB.current.selectedTool).toBe("polyline");
      expect(resultA.current.manager).not.toBe(resultB.current.manager);
    });
  });

  describe("polyline mouse position tracking", () => {
    it("should initialize with null polylineMousePos", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.polylineMousePos).toBeNull();
    });
  });

  describe("keyboard shortcuts", () => {
    it("should finalize polyline on Enter key when video is active", () => {
      activeVideo = "A"; // Set Video A as active
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Start a polyline
      act(() => {
        result.current.manager.setTool("polyline");
        result.current.manager.startDrawing({ x: 10, y: 20 });
        result.current.manager.addPolylineVertex({ x: 30, y: 40 });
      });

      expect(result.current.manager.isPolylineActive()).toBe(true);

      // Simulate Enter key press
      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        window.dispatchEvent(event);
      });

      // Polyline should be finalized
      expect(result.current.manager.isPolylineActive()).toBe(false);
    });

    it("should cancel polyline on Escape key when video is active", () => {
      activeVideo = "B"; // Set Video B as active
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "B", activeVideo, setActiveVideo)
      );

      // Start a polyline
      act(() => {
        result.current.manager.setTool("polyline");
        result.current.manager.startDrawing({ x: 10, y: 20 });
        result.current.manager.addPolylineVertex({ x: 30, y: 40 });
      });

      expect(result.current.manager.isPolylineActive()).toBe(true);

      // Simulate Escape key press
      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Escape" });
        window.dispatchEvent(event);
      });

      // Polyline should be cancelled (no longer active)
      expect(result.current.manager.isPolylineActive()).toBe(false);
    });

    it("should not handle keyboard events when video is not active", () => {
      activeVideo = "B"; // Video B is active
      const { result } = renderHook(
        () =>
          useVideoAnnotations(
            mockVideoDecoder,
            "A",
            activeVideo,
            setActiveVideo
          ) // But hook is for Video A
      );

      // Start a polyline on Video A
      act(() => {
        result.current.manager.setTool("polyline");
        result.current.manager.startDrawing({ x: 10, y: 20 });
        result.current.manager.addPolylineVertex({ x: 30, y: 40 });
      });

      expect(result.current.manager.isPolylineActive()).toBe(true);

      // Simulate Enter key press (should be ignored since Video A is not active)
      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        window.dispatchEvent(event);
      });

      // Polyline should still be active (not finalized)
      expect(result.current.manager.isPolylineActive()).toBe(true);
    });
  });

  describe("Selection and Deletion", () => {
    let mockVideoDecoder: UseWebCodecsDecoderResult;
    let activeVideo: "A" | "B" | null;
    let setActiveVideo: (id: "A" | "B") => void;

    beforeEach(() => {
      mockVideoDecoder = createMockVideoDecoder();
      activeVideo = null;
      setActiveVideo = vi.fn((id) => {
        activeVideo = id;
      });
    });

    it("should handle annotation click for selection", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create an annotation
      let annotationId: string = "";
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "freehand",
          [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ]
        );
        annotationId = annotation!.id;
      });

      // Simulate single-click on annotation (no Ctrl key)
      act(() => {
        const mockEvent = {
          evt: { ctrlKey: false, metaKey: false },
        } as any;
        result.current.handlers.handleAnnotationClick(annotationId, mockEvent);
      });

      expect(result.current.selectedIds.has(annotationId)).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);
    });

    it("should handle Ctrl-click for multi-select", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create two annotations
      let annotationId1: string = "";
      let annotationId2: string = "";
      act(() => {
        const ann1 = result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        const ann2 = result.current.manager.createAndAddAnnotation("oval", [
          { x: 50, y: 60 },
          { x: 100, y: 100 },
        ]);
        annotationId1 = ann1!.id;
        annotationId2 = ann2!.id;
      });

      // Select first annotation
      act(() => {
        const mockEvent = {
          evt: { ctrlKey: true, metaKey: false },
        } as any;
        result.current.handlers.handleAnnotationClick(annotationId1, mockEvent);
      });

      // Select second annotation with Ctrl-click
      act(() => {
        const mockEvent = {
          evt: { ctrlKey: true, metaKey: false },
        } as any;
        result.current.handlers.handleAnnotationClick(annotationId2, mockEvent);
      });

      expect(result.current.selectedIds.has(annotationId1)).toBe(true);
      expect(result.current.selectedIds.has(annotationId2)).toBe(true);
      expect(result.current.selectedIds.size).toBe(2);
    });

    it("should not allow selection during drawing", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create an annotation
      let annotationId: string = "";
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "freehand",
          [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ]
        );
        annotationId = annotation!.id;
      });

      // Start drawing a new annotation
      act(() => {
        result.current.manager.setTool("freehand");
        result.current.manager.startDrawing({ x: 100, y: 100 });
      });

      expect(result.current.manager.isDrawing()).toBe(true);

      // Try to select existing annotation during drawing
      act(() => {
        const mockEvent = {
          evt: { ctrlKey: false, metaKey: false },
        } as any;
        result.current.handlers.handleAnnotationClick(annotationId, mockEvent);
      });

      // Selection should not change (should remain empty)
      expect(result.current.selectedIds.size).toBe(0);
    });

    it("should delete selected annotations on Delete key", () => {
      const { result, rerender } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create two annotations and trigger state update
      let annotationId1: string = "";
      let annotationId2: string = "";
      act(() => {
        const ann1 = result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        const ann2 = result.current.manager.createAndAddAnnotation("oval", [
          { x: 50, y: 60 },
          { x: 100, y: 100 },
        ]);
        annotationId1 = ann1!.id;
        annotationId2 = ann2!.id;
      });

      // Force hook to sync with manager state
      rerender();

      expect(result.current.manager.getCount()).toBe(2);

      // Select first annotation
      act(() => {
        result.current.manager.toggleSelection(annotationId1, false);
      });

      // Simulate Delete key press
      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Delete" });
        window.dispatchEvent(event);
      });

      // First annotation should be deleted
      expect(result.current.annotations.length).toBe(1);
      expect(result.current.annotations[0].id).toBe(annotationId2);
      expect(result.current.selectedIds.size).toBe(0);
    });

    it("should clear all annotations", () => {
      const { result, rerender } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create annotations
      act(() => {
        result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        result.current.manager.createAndAddAnnotation("oval", [
          { x: 50, y: 60 },
          { x: 100, y: 100 },
        ]);
      });

      // Force hook to sync with manager state
      rerender();

      expect(result.current.manager.getCount()).toBe(2);

      // Clear all
      act(() => {
        result.current.clearAll();
      });

      expect(result.current.annotations.length).toBe(0);
      expect(result.current.selectedIds.size).toBe(0);
    });

    it("should not delete when Delete key pressed on input element", () => {
      const { result, rerender } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create and select annotation
      act(() => {
        const ann = result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        result.current.manager.toggleSelection(ann!.id, false);
      });

      // Force hook to sync with manager state
      rerender();

      expect(result.current.manager.getCount()).toBe(1);

      // Simulate Delete key from input element
      act(() => {
        const input = document.createElement("input");
        document.body.appendChild(input);
        const event = new KeyboardEvent("keydown", {
          key: "Delete",
          bubbles: true,
        });
        Object.defineProperty(event, "target", {
          value: input,
          enumerable: true,
        });
        window.dispatchEvent(event);
        document.body.removeChild(input);
      });

      // Annotation should NOT be deleted
      expect(result.current.manager.getCount()).toBe(1);
    });
  });

  // ========================================
  // Drag Handler Tests (Subtask 0.5.10)
  // ========================================

  describe("Drag Handlers", () => {
    it("should initialize with isDraggingAnnotation false", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.isDraggingAnnotation).toBe(false);
    });

    it("should provide handleAnnotationDragStart handler", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.handlers.handleAnnotationDragStart).toBeDefined();
      expect(typeof result.current.handlers.handleAnnotationDragStart).toBe(
        "function"
      );
    });

    it("should provide handleStageMouseMove handler", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.handlers.handleStageMouseMove).toBeDefined();
      expect(typeof result.current.handlers.handleStageMouseMove).toBe(
        "function"
      );
    });

    it("should provide handleStageMouseUp handler", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.handlers.handleStageMouseUp).toBeDefined();
      expect(typeof result.current.handlers.handleStageMouseUp).toBe(
        "function"
      );
    });

    it("should set isDraggingAnnotation to true when drag starts", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create and select annotation
      let annotationId: string;
      act(() => {
        const ann = result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        annotationId = ann!.id;
        result.current.manager.toggleSelection(annotationId, false);
      });

      // Mock Konva event
      const mockEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 10, y: 20 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleAnnotationDragStart(
          annotationId!,
          mockEvent
        );
      });

      expect(result.current.isDraggingAnnotation).toBe(true);
      expect(result.current.manager.isDragging()).toBe(true);
    });

    it("should update annotations during drag via handleStageMouseMove", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create and select annotation
      let annotationId: string;
      act(() => {
        const ann = result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        annotationId = ann!.id;
        result.current.manager.toggleSelection(annotationId, false);
      });

      // Start drag
      const startEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 10, y: 20 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleAnnotationDragStart(
          annotationId!,
          startEvent
        );
      });

      // Move mouse during drag
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 20, y: 30 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Verify annotation moved by delta (10, 10)
      const annotation = result.current.annotations.find(
        (a) => a.id === annotationId
      );
      expect(annotation?.points).toEqual([
        { x: 20, y: 30 },
        { x: 40, y: 50 },
      ]);
    });

    it("should end drag on handleStageMouseUp", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create and select annotation
      let annotationId: string;
      act(() => {
        const ann = result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        annotationId = ann!.id;
        result.current.manager.toggleSelection(annotationId, false);
      });

      // Start drag
      const startEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 10, y: 20 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleAnnotationDragStart(
          annotationId!,
          startEvent
        );
      });

      expect(result.current.isDraggingAnnotation).toBe(true);

      // End drag
      act(() => {
        result.current.handlers.handleStageMouseUp();
      });

      expect(result.current.isDraggingAnnotation).toBe(false);
      expect(result.current.manager.isDragging()).toBe(false);
    });

    it("should not start drag during drawing", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create and select annotation
      let annotationId: string;
      act(() => {
        const ann = result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        annotationId = ann!.id;
        result.current.manager.toggleSelection(annotationId, false);
      });

      // Start drawing
      act(() => {
        result.current.manager.startDrawing({ x: 100, y: 100 });
      });

      // Try to start drag
      const mockEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 10, y: 20 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleAnnotationDragStart(
          annotationId!,
          mockEvent
        );
      });

      // Drag should not start
      expect(result.current.isDraggingAnnotation).toBe(false);
      expect(result.current.manager.isDragging()).toBe(false);
    });

    it("should not update drag when not dragging", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create annotation (not selected, not dragging)
      act(() => {
        result.current.manager.createAndAddAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
      });

      const originalAnnotations = result.current.annotations;

      // Try to move mouse (no drag active)
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 100 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Annotations should not change
      expect(result.current.annotations).toEqual(originalAnnotations);
    });
  });

  // ========================================
  // Reshape Operations Tests (Subtask 0.5.11)
  // ========================================
  describe("Reshape Operations", () => {
    it("should expose handleControlPointMouseDown handler", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      expect(result.current.handlers.handleControlPointMouseDown).toBeDefined();
      expect(
        typeof result.current.handlers.handleControlPointMouseDown
      ).toBe("function");
    });

    it("should start reshape when control point is clicked", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create an arrow annotation
      let annotationId: string | undefined;
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "arrow",
          [
            { x: 100, y: 100 },
            { x: 200, y: 200 },
          ]
        );
        annotationId = annotation?.id;
      });

      expect(annotationId).toBeDefined();

      // Mock event
      const mockEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 100 }),
          }),
        },
      } as any;

      // Click control point 0
      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          annotationId!,
          0,
          mockEvent
        );
      });

      // Reshape should start
      expect(result.current.isReshapingAnnotation).toBe(true);
      expect(result.current.manager.isReshaping()).toBe(true);
      expect(mockEvent.cancelBubble).toBe(true); // Event propagation stopped
    });

    it("should update annotation during reshape", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create an arrow annotation
      let annotationId: string | undefined;
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "arrow",
          [
            { x: 100, y: 100 },
            { x: 200, y: 200 },
          ]
        );
        annotationId = annotation?.id;
      });

      // Start reshape on control point 0 (start point)
      const startEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 100 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          annotationId!,
          0,
          startEvent
        );
      });

      // Move mouse (reshape update)
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 150, y: 150 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Annotation should be updated
      const updated = result.current.manager.getAnnotationById(annotationId!);
      expect(updated!.points[0]).toEqual({ x: 150, y: 150 }); // Start point moved
      expect(updated!.points[1]).toEqual({ x: 200, y: 200 }); // End point unchanged
    });

    it("should finalize reshape on mouse up", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create an arrow annotation
      let annotationId: string | undefined;
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "arrow",
          [
            { x: 100, y: 100 },
            { x: 200, y: 200 },
          ]
        );
        annotationId = annotation?.id;
      });

      // Start reshape
      const startEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 100 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          annotationId!,
          0,
          startEvent
        );
      });

      expect(result.current.isReshapingAnnotation).toBe(true);

      // Move mouse
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 150, y: 150 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Mouse up - finalize reshape
      act(() => {
        result.current.handlers.handleStageMouseUp();
      });

      // Reshape should end
      expect(result.current.isReshapingAnnotation).toBe(false);
      expect(result.current.manager.isReshaping()).toBe(false);

      // Changes should persist
      const updated = result.current.manager.getAnnotationById(annotationId!);
      expect(updated!.points[0]).toEqual({ x: 150, y: 150 });
    });

    it("should reshape oval control points correctly", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create an oval annotation
      let annotationId: string | undefined;
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "oval",
          [
            { x: 100, y: 100 }, // Top-left
            { x: 300, y: 200 }, // Bottom-right
          ]
        );
        annotationId = annotation?.id;
      });

      // Start reshape on control point 2 (top-right corner)
      const startEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 300, y: 100 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          annotationId!,
          2,
          startEvent
        );
      });

      // Move mouse (expand right and up)
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 320, y: 80 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Annotation should be reshaped
      const updated = result.current.manager.getAnnotationById(annotationId!);
      expect(updated!.points[0]).toEqual({ x: 100, y: 80 }); // Top-left adjusted
      expect(updated!.points[1]).toEqual({ x: 320, y: 200 }); // Bottom-right adjusted
    });

    it("should reshape polyline vertices", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create a polyline annotation
      let annotationId: string | undefined;
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "polyline",
          [
            { x: 50, y: 50 },
            { x: 100, y: 150 },
            { x: 150, y: 100 },
          ]
        );
        annotationId = annotation?.id;
      });

      // Start reshape on control point 1 (middle vertex)
      const startEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 150 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          annotationId!,
          1,
          startEvent
        );
      });

      // Move mouse
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 110, y: 160 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Only the moved vertex should change
      const updated = result.current.manager.getAnnotationById(annotationId!);
      expect(updated!.points[0]).toEqual({ x: 50, y: 50 }); // Unchanged
      expect(updated!.points[1]).toEqual({ x: 110, y: 160 }); // Moved
      expect(updated!.points[2]).toEqual({ x: 150, y: 100 }); // Unchanged
    });

    it("should not start reshape during drawing", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create an arrow annotation
      let annotationId: string | undefined;
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "arrow",
          [
            { x: 100, y: 100 },
            { x: 200, y: 200 },
          ]
        );
        annotationId = annotation?.id;
      });

      // Start drawing
      const stage = {
        getPointerPosition: () => ({ x: 10, y: 10 }),
      };
      const drawEvent = {
        target: stage,
      } as any;
      drawEvent.target.getStage = () => stage;

      act(() => {
        result.current.handlers.handleMouseDown(drawEvent);
      });

      expect(result.current.manager.isDrawing()).toBe(true);

      // Try to start reshape
      const reshapeEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 100 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          annotationId!,
          0,
          reshapeEvent
        );
      });

      // Reshape should not start
      expect(result.current.isReshapingAnnotation).toBe(false);
      expect(result.current.manager.isReshaping()).toBe(false);
    });

    it("should allow reshape and drag to coexist (different annotations)", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create two annotations
      let arrowId: string | undefined;
      let ovalId: string | undefined;
      act(() => {
        const arrow = result.current.manager.createAndAddAnnotation("arrow", [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ]);
        arrowId = arrow?.id;

        const oval = result.current.manager.createAndAddAnnotation("oval", [
          { x: 300, y: 300 },
          { x: 400, y: 400 },
        ]);
        ovalId = oval?.id;
      });

      // Select arrow for dragging
      act(() => {
        result.current.manager.toggleSelection(arrowId!, false);
      });

      // Start drag on arrow
      const dragEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 100 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleAnnotationDragStart(arrowId!, dragEvent);
      });

      expect(result.current.isDraggingAnnotation).toBe(true);

      // Start reshape on oval (unusual but technically possible)
      const reshapeEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 300, y: 300 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          ovalId!,
          0,
          reshapeEvent
        );
      });

      // Both operations should be active (manager allows this)
      expect(result.current.isDraggingAnnotation).toBe(true);
      expect(result.current.isReshapingAnnotation).toBe(true);
      expect(result.current.manager.isDragging()).toBe(true);
      expect(result.current.manager.isReshaping()).toBe(true);
    });

    it("should not update reshape when not reshaping", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create annotation (not reshaping)
      act(() => {
        result.current.manager.createAndAddAnnotation("arrow", [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ]);
      });

      const originalAnnotations = result.current.annotations;

      // Try to move mouse (no reshape active)
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 150, y: 150 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Annotations should not change
      expect(result.current.annotations).toEqual(originalAnnotations);
    });

    it("should route control point clicks to reshape (not drag)", () => {
      const { result } = renderHook(() =>
        useVideoAnnotations(mockVideoDecoder, "A", activeVideo, setActiveVideo)
      );

      // Create and select an arrow annotation
      let annotationId: string | undefined;
      act(() => {
        const annotation = result.current.manager.createAndAddAnnotation(
          "arrow",
          [
            { x: 100, y: 100 },
            { x: 200, y: 200 },
          ]
        );
        annotationId = annotation?.id;
        result.current.manager.toggleSelection(annotationId!, false);
      });

      // Click control point 0 (start point)
      const controlPointEvent = {
        cancelBubble: false,
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 100, y: 100 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleControlPointMouseDown(
          annotationId!,
          0,
          controlPointEvent
        );
      });

      // Should trigger reshape, NOT drag
      expect(result.current.isReshapingAnnotation).toBe(true);
      expect(result.current.isDraggingAnnotation).toBe(false);
      expect(result.current.manager.isReshaping()).toBe(true);
      expect(result.current.manager.isDragging()).toBe(false);

      // Move mouse - should update via reshape path
      const moveEvent = {
        target: {
          getStage: () => ({
            getPointerPosition: () => ({ x: 120, y: 130 }),
          }),
        },
      } as any;

      act(() => {
        result.current.handlers.handleStageMouseMove(moveEvent);
      });

      // Annotation should be reshaped (only control point 0 moved)
      const updated = result.current.manager.getAnnotationById(annotationId!);
      expect(updated!.points[0]).toEqual({ x: 120, y: 130 }); // Moved
      expect(updated!.points[1]).toEqual({ x: 200, y: 200 }); // Unchanged

      // End with mouse up
      act(() => {
        result.current.handlers.handleStageMouseUp();
      });

      expect(result.current.isReshapingAnnotation).toBe(false);
      expect(result.current.manager.isReshaping()).toBe(false);
    });
  });
});
