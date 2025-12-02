/**
 * useVideoAnnotations Hook
 *
 * Custom hook that encapsulates all annotation state and logic for a single video channel.
 * Provides annotation manager, drawing state, event handlers, and canvas scaling.
 *
 * Subtask 0.5.5: Refactoring to reduce duplication and improve architecture
 */

import { useState, useEffect, useCallback } from "react";
import type Konva from "konva";
import { AnnotationManager } from "../utils/AnnotationManager";
import type {
  Annotation,
  AnnotationType,
  DrawingState,
  Point,
} from "../types/annotations";
import type { UseWebCodecsDecoderResult } from "./useWebCodecsDecoder";

/**
 * Event handlers for annotation drawing
 */
export interface AnnotationHandlers {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseUp: () => void;
  handleClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleDoubleClick: () => void;
  handleAnnotationClick: (
    annotationId: string,
    e: Konva.KonvaEventObject<MouseEvent>
  ) => void;
}

/**
 * Return type for useVideoAnnotations hook
 */
export interface UseVideoAnnotationsResult {
  manager: AnnotationManager;
  selectedTool: AnnotationType;
  setSelectedTool: (tool: AnnotationType) => void;
  drawingState: DrawingState;
  annotations: Annotation[];
  selectedIds: Set<string>;
  polylineMousePos: Point | null;
  scale: number;
  handlers: AnnotationHandlers;
  clearAll: () => void;
}

/**
 * Custom hook for managing video annotations
 *
 * @param videoDecoder - WebCodecs decoder result for the video
 * @param videoId - Identifier for this video channel ('A' or 'B')
 * @param activeVideo - Current active video (for keyboard shortcuts)
 * @param setActiveVideo - Callback to mark this video as active for keyboard shortcuts
 * @returns Annotation state, manager, and event handlers
 */
export function useVideoAnnotations(
  videoDecoder: UseWebCodecsDecoderResult,
  videoId: "A" | "B",
  activeVideo: "A" | "B" | null,
  setActiveVideo: (id: "A" | "B") => void
): UseVideoAnnotationsResult {
  // Annotation manager instance (one per video)
  const [manager] = useState(() => new AnnotationManager());

  // Drawing state
  const [drawingState, setDrawingState] = useState<DrawingState>({
    mode: "idle",
  });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [polylineMousePos, setPolylineMousePos] = useState<Point | null>(null);

  // Canvas scale for CSS transform
  const [scale, setScale] = useState(1);

  // Calculate annotation canvas scale to match video display size
  useEffect(() => {
    if (!videoDecoder.canvasRef.current || !videoDecoder.metadata) return;

    const updateScale = () => {
      const canvas = videoDecoder.canvasRef.current;
      if (!canvas) return;

      const displayWidth = canvas.clientWidth;
      const videoWidth = videoDecoder.metadata!.width;
      const scale = displayWidth / videoWidth;

      setScale(scale);
    };

    // Initial calculation
    updateScale();

    // Update on window resize
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [videoDecoder.canvasRef, videoDecoder.metadata, videoDecoder.isReady]);

  // Keyboard support for polyline tool (Enter to finalize, Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard events if this video is active and polyline is in progress
      if (activeVideo !== videoId || !manager.isPolylineActive()) return;

      if (e.key === "Enter") {
        e.preventDefault();
        console.log(`Video ${videoId}: Polyline finalized via Enter key`);
        const annotation = manager.finishDrawing();
        if (annotation) {
          setAnnotations(manager.getAnnotations());
        }
        setDrawingState(manager.getDrawingState());
        setPolylineMousePos(null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        console.log(`Video ${videoId}: Polyline cancelled via Escape key`);
        manager.cancelDrawing();
        setDrawingState(manager.getDrawingState());
        setPolylineMousePos(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeVideo, videoId, manager]);

  // Delete key handler for removing selected annotations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea (safety check)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Delete") {
        const count = manager.deleteSelected();
        if (count > 0) {
          console.log(
            `Video ${videoId}: Deleted ${count} selected annotation(s)`
          );
          setAnnotations(manager.getAnnotations());
          setSelectedIds(manager.getSelectedIds());
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manager, videoId]);

  // Helper to convert Konva position to Point
  const getPoint = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): Point | null => {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      return pos ? { x: pos.x, y: pos.y } : null;
    },
    []
  );

  // Selected tool - synced with manager
  const selectedTool = manager.getTool();
  const setSelectedTool = useCallback(
    (tool: AnnotationType) => {
      manager.setTool(tool);
      // Force re-render by updating state
      setDrawingState(manager.getDrawingState());
    },
    [manager]
  );

  // Mouse handlers for drag-based tools (freehand, oval, arrow)
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!videoDecoder.isReady) return;

      // Don't start drawing if clicking on an annotation shape
      // (annotation shapes have onClick handlers that handle selection)
      const target = e.target;
      if (target !== e.target.getStage()) {
        // Clicked on a shape (annotation), not the stage background
        return;
      }

      setActiveVideo(videoId); // Mark this video as active

      // Only handle drag-based tools in mouseDown
      const tool = manager.getTool();
      if (!(["freehand", "oval", "arrow"] as AnnotationType[]).includes(tool))
        return;

      const point = getPoint(e);
      if (!point) return;

      console.log(`Video ${videoId} ${tool} drawing started at:`, point);
      manager.startDrawing(point);
      setDrawingState(manager.getDrawingState());
      setSelectedIds(manager.getSelectedIds()); // Sync selection state (cleared on draw start)
    },
    [videoDecoder.isReady, videoId, setActiveVideo, manager, getPoint]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const point = getPoint(e);
      if (!point) return;

      // Update polyline preview cursor position
      if (manager.isPolylineActive()) {
        setPolylineMousePos(point);
        return;
      }

      // Handle drag-based drawing
      if (!manager.isDrawing()) return;
      manager.continueDrawing(point);
      setDrawingState(manager.getDrawingState());
    },
    [manager, getPoint]
  );

  const handleMouseUp = useCallback(() => {
    if (!manager.isDrawing()) return;

    // Don't finish polyline on mouseUp - polyline uses click/doubleClick/Enter
    if (manager.isPolylineActive()) {
      setPolylineMousePos(null);
      return;
    }

    const annotation = manager.finishDrawing();

    if (annotation) {
      console.log(
        `Video ${videoId} ${annotation.type} annotation created:`,
        annotation
      );
      setAnnotations(manager.getAnnotations());
    } else {
      console.warn(
        `Video ${videoId}: Invalid annotation: points validation failed`
      );
    }

    setDrawingState(manager.getDrawingState());
  }, [manager, videoId]);

  // Click handler for polyline tool
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!videoDecoder.isReady || manager.getTool() !== "polyline") return;

      // Don't start polyline if clicking on an annotation shape
      // (annotation shapes have onClick handlers that handle selection)
      const target = e.target;
      if (target !== e.target.getStage()) {
        // Clicked on a shape (annotation), not the stage background
        return;
      }

      setActiveVideo(videoId); // Mark this video as active

      const point = getPoint(e);
      if (!point) return;

      if (!manager.isDrawing()) {
        // Start new polyline
        console.log(`Video ${videoId}: Polyline started at:`, point);
        manager.startDrawing(point);
        setSelectedIds(manager.getSelectedIds()); // Sync selection state (cleared on draw start)
      } else if (manager.isPolylineActive()) {
        // Add vertex to existing polyline
        console.log(`Video ${videoId}: Polyline vertex added at:`, point);
        manager.addPolylineVertex(point);
      }

      setDrawingState(manager.getDrawingState());
    },
    [videoDecoder.isReady, videoId, setActiveVideo, manager, getPoint]
  );

  // Double-click handler for polyline finalization
  const handleDoubleClick = useCallback(() => {
    if (!manager.isPolylineActive()) return;

    const annotation = manager.finishDrawing();
    if (annotation) {
      console.log(
        `Video ${videoId}: Polyline finalized via double-click:`,
        annotation
      );
      setAnnotations(manager.getAnnotations());
    }
    setDrawingState(manager.getDrawingState());
    setPolylineMousePos(null);
  }, [manager, videoId]);

  // Annotation click handler for selection
  const handleAnnotationClick = useCallback(
    (annotationId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      // Don't allow selection during drawing
      if (manager.isDrawing() || manager.isPolylineActive()) {
        return;
      }

      // Read event properties BEFORE stopping propagation
      const isMultiSelect = e.evt.ctrlKey || e.evt.metaKey;

      // Stop event from bubbling to Stage (prevents starting new polyline)
      e.cancelBubble = true;

      manager.toggleSelection(annotationId, isMultiSelect);
      setSelectedIds(manager.getSelectedIds());
      console.log(
        `Video ${videoId}: Annotation ${annotationId} ${
          isMultiSelect ? "toggled in" : "selected"
        } selection (ctrlKey=${e.evt.ctrlKey}, metaKey=${e.evt.metaKey})`
      );
    },
    [manager, videoId]
  );

  // Clear all annotations
  const clearAll = useCallback(() => {
    if (manager.getCount() > 0) {
      manager.clearAll();
      setAnnotations(manager.getAnnotations());
      setSelectedIds(manager.getSelectedIds());
      console.log(`Video ${videoId}: All annotations cleared`);
    }
  }, [manager, videoId]);

  return {
    manager,
    selectedTool,
    setSelectedTool,
    drawingState,
    annotations,
    selectedIds,
    polylineMousePos,
    scale,
    handlers: {
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleClick,
      handleDoubleClick,
      handleAnnotationClick,
    },
    clearAll,
  };
}
