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
  handleAnnotationDragStart: (
    annotationId: string,
    e: Konva.KonvaEventObject<MouseEvent>
  ) => void;
  handleControlPointMouseDown: (
    annotationId: string,
    controlIndex: number,
    e: Konva.KonvaEventObject<MouseEvent>
  ) => void;
  handleStageMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleStageMouseUp: () => void;
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
  updateAnnotationText: (id: string, text: string) => void;
  /**
   * Hydrate annotations from an external source (e.g., session restore).
   * Replaces all current annotations, resets undo/redo history, and clears selection.
   */
  hydrateAnnotations: (annotations: Annotation[]) => void;
  isDraggingAnnotation: boolean;
  isReshapingAnnotation: boolean;
  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Custom hook for managing video annotations
 *
 * @param videoDecoder - WebCodecs decoder result for the video
 * @param videoId - Identifier for this video channel ('A' or 'B')
 * @param activeVideo - Current active video (for keyboard shortcuts)
 * @param setActiveVideo - Callback to mark this video as active for keyboard shortcuts
 * @param selectedTool - Currently selected annotation tool (managed by parent)
 * @param onToolChange - Callback to change the selected tool
 * @returns Annotation state, manager, and event handlers
 */
export function useVideoAnnotations(
  videoDecoder: UseWebCodecsDecoderResult,
  videoId: "A" | "B",
  activeVideo: "A" | "B" | null,
  setActiveVideo: (id: "A" | "B") => void,
  selectedTool: AnnotationType,
  onToolChange: (tool: AnnotationType) => void
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

  // Drag state (Subtask 0.5.10)
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [dragMoved, setDragMoved] = useState(false); // Track if drag actually moved

  // Reshape state (Subtask 0.5.11)
  const [isReshapingAnnotation, setIsReshapingAnnotation] = useState(false);

  // Undo/redo history (Phase 2, Task 2.12)
  const [undoStack, setUndoStack] = useState<Annotation[][]>([[]]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  /**
   * Push the current annotation state onto the undo stack and clear redo stack.
   * Call this after any mutation that should be undoable.
   */
  const pushHistory = useCallback((current: Annotation[]) => {
    setUndoStack((prev) => [...prev, [...current]]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length <= 1) return prev; // Nothing to undo
      const newStack = prev.slice(0, -1);
      const prevState = newStack[newStack.length - 1];
      manager.setAnnotations(prevState);
      const restored = manager.getAnnotations();
      setAnnotations(restored);
      setSelectedIds(manager.getSelectedIds());
      setRedoStack((r) => [[...prev[prev.length - 1]], ...r]);
      return newStack;
    });
  }, [manager]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const [nextState, ...rest] = prev;
      manager.setAnnotations(nextState);
      const restored = manager.getAnnotations();
      setAnnotations(restored);
      setSelectedIds(manager.getSelectedIds());
      setUndoStack((u) => [...u, [...nextState]]);
      return rest;
    });
  }, [manager]);

  // Canvas scale for CSS transform
  const [scale, setScale] = useState(1);

  // Sync selected tool from prop to manager
  useEffect(() => {
    manager.setTool(selectedTool);
  }, [selectedTool, manager]);

  // Cancel in-progress drawing when this video loses focus
  useEffect(() => {
    // If this video is no longer active and we're drawing, cancel it
    if (activeVideo !== videoId && manager.isDrawing()) {
      console.log(`Video ${videoId}: Cancelling in-progress drawing (video lost focus)`);
      manager.cancelDrawing();
      setDrawingState(manager.getDrawingState());
      setPolylineMousePos(null);
    }
  }, [activeVideo, videoId, manager]);

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

  // Keyboard support for polyline/angle tools (Enter to finalize, Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard events if this video is active and polyline/angle is in progress
      if (activeVideo !== videoId) return;
      const isPolyline = manager.isPolylineActive();
      const isAngle = manager.isAngleActive();
      if (!isPolyline && !isAngle) return;

      if (isPolyline && e.key === "Enter") {
        e.preventDefault();
        console.log(`Video ${videoId}: Polyline finalized via Enter key`);
        const annotation = manager.finishDrawing();
        if (annotation) {
          const current = manager.getAnnotations();
          setAnnotations(current);
          pushHistory(current);
        }
        setDrawingState(manager.getDrawingState());
        setPolylineMousePos(null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        console.log(`Video ${videoId}: Drawing cancelled via Escape key`);
        manager.cancelDrawing();
        setDrawingState(manager.getDrawingState());
        setPolylineMousePos(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeVideo, videoId, manager, pushHistory]);

  // Delete/Backspace key handler for removing selected annotations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea (safety check)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const count = manager.deleteSelected();
        if (count > 0) {
          console.log(
            `Video ${videoId}: Deleted ${count} selected annotation(s)`
          );
          const current = manager.getAnnotations();
          setAnnotations(current);
          setSelectedIds(manager.getSelectedIds());
          pushHistory(current);
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

      // Skip drawing if in select mode
      if (selectedTool === "select") return;

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
    [videoDecoder.isReady, videoId, setActiveVideo, selectedTool, manager, getPoint]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const point = getPoint(e);
      if (!point) return;

      // Update cursor position for preview (polyline and angle rubber-band)
      if (manager.isPolylineActive() || manager.isAngleActive()) {
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
      const current = manager.getAnnotations();
      setAnnotations(current);
      pushHistory(current);
    } else {
      console.warn(
        `Video ${videoId}: Invalid annotation: points validation failed`
      );
    }

    setDrawingState(manager.getDrawingState());
  }, [manager, videoId]);

  // Click handler for polyline, text, and angle tools
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!videoDecoder.isReady) return;

      // Skip if in select mode
      if (selectedTool === "select") return;

      const tool = manager.getTool();

      // Don't start drawing on annotation shapes — only on stage background
      const target = e.target;
      if (target !== e.target.getStage()) return;

      setActiveVideo(videoId); // Mark this video as active

      const point = getPoint(e);
      if (!point) return;

      // ── Text tool: place annotation at click point ──────────────────────
      if (tool === "text") {
        const text = window.prompt("Enter annotation text:");
        if (!text || !text.trim()) return;
        manager.createAndAddText(point, text.trim());
        const current = manager.getAnnotations();
        setAnnotations(current);
        pushHistory(current);
        return;
      }

      // ── Angle tool: accumulate 3 click points ───────────────────────────
      if (tool === "angle") {
        if (!manager.isAngleActive()) {
          // First click: start angle (vertex)
          console.log(`Video ${videoId}: Angle started at:`, point);
          manager.startDrawing(point);
          setSelectedIds(manager.getSelectedIds());
        } else {
          // 2nd and 3rd clicks (addAngleVertex auto-finalizes on 3rd)
          const annotation = manager.addAngleVertex(point);
          if (annotation) {
            console.log(`Video ${videoId}: Angle annotation created:`, annotation);
            const current = manager.getAnnotations();
            setAnnotations(current);
            pushHistory(current);
          }
        }
        setDrawingState(manager.getDrawingState());
        return;
      }

      // ── Polyline tool ────────────────────────────────────────────────────
      if (tool !== "polyline") return;

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
    [videoDecoder.isReady, videoId, setActiveVideo, selectedTool, manager, getPoint, pushHistory]
  );

  // Double-click handler for polyline finalization
  const handleDoubleClick = useCallback(() => {
    if (!manager.isPolylineActive()) return;

    const annotation = manager.finalizePolylineDoubleClick();
    if (annotation) {
      console.log(
        `Video ${videoId}: Polyline finalized via double-click:`,
        annotation
      );
      const current = manager.getAnnotations();
      setAnnotations(current);
      pushHistory(current);
    }
    setDrawingState(manager.getDrawingState());
    setPolylineMousePos(null);
  }, [manager, videoId, pushHistory]);

  // Annotation click handler for selection
  const handleAnnotationClick = useCallback(
    (annotationId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      // Don't allow selection during drawing
      if (manager.isDrawing() || manager.isPolylineActive()) {
        return;
      }

      // Don't change selection if we just finished a drag
      if (dragMoved) {
        setDragMoved(false); // Reset for next interaction
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
    [manager, videoId, dragMoved]
  );

  // Clear all annotations
  const clearAll = useCallback(() => {
    if (manager.getCount() > 0) {
      manager.clearAll();
      const current = manager.getAnnotations();
      setAnnotations(current);
      setSelectedIds(manager.getSelectedIds());
      pushHistory(current);
      console.log(`Video ${videoId}: All annotations cleared`);
    }
  }, [manager, videoId, pushHistory]);

  // Update text content of a text annotation
  const updateAnnotationText = useCallback(
    (id: string, text: string) => {
      if (manager.updateAnnotationText(id, text)) {
        const current = manager.getAnnotations();
        setAnnotations(current);
        pushHistory(current);
      }
    },
    [manager, pushHistory]
  );

  /**
   * Hydrate annotations from an external source (e.g., session restore).
   * Replaces internal manager state and React state, then resets undo/redo
   * history so the loaded annotations become the new clean baseline.
   */
  const hydrateAnnotations = useCallback(
    (incomingAnnotations: Annotation[]) => {
      manager.setAnnotations([...incomingAnnotations]);
      const current = manager.getAnnotations();
      setAnnotations(current);
      setSelectedIds(new Set());
      // Reset history: loaded state is the baseline, no undo path back to empty
      setUndoStack([[...current]]);
      setRedoStack([]);
      console.log(`Video ${videoId}: Hydrated ${current.length} annotation(s) from session restore`);
    },
    [manager, videoId]
  );

  // ========================================
  // Drag Handlers (Subtask 0.5.10)
  // ========================================

  /**
   * Handle drag start for an annotation.
   * Initiates drag for all selected annotations.
   */
  const handleAnnotationDragStart = useCallback(
    (annotationId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      // Don't allow dragging during drawing
      if (manager.isDrawing() || manager.isPolylineActive()) {
        return;
      }

      const point = getPoint(e);
      if (!point) return;

      // Stop Konva's built-in drag behavior
      e.cancelBubble = true;

      console.log(
        `Video ${videoId}: Starting drag for annotation ${annotationId} and ${selectedIds.size} selected annotation(s)`
      );

      manager.startDrag(annotationId);
      setIsDraggingAnnotation(true);
      setDragStartPos(point);
      setDragMoved(false); // Reset on drag start
    },
    [manager, videoId, selectedIds.size, getPoint]
  );

  /**
   * Handle mouse down on control point for reshaping.
   * Prevents reshape during drawing or dragging.
   */
  const handleControlPointMouseDown = useCallback(
    (
      annotationId: string,
      controlIndex: number,
      e: Konva.KonvaEventObject<MouseEvent>
    ) => {
      // Prevent reshape during drawing
      if (manager.isDrawing() || manager.isPolylineActive()) {
        return;
      }

      // Stop event propagation to prevent triggering annotation drag or click
      e.cancelBubble = true;

      console.log(
        `Video ${videoId}: Starting reshape for annotation ${annotationId}, control point ${controlIndex}`
      );

      const success = manager.startReshape(annotationId, controlIndex);
      if (success) {
        setIsReshapingAnnotation(true);
      }
    },
    [manager, videoId]
  );

  /**
   * Handle mouse move during drag (on Stage).
   * Updates all selected annotations with the current delta.
   * Also handles reshape updates.
   */
  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Handle annotation drag
      if (isDraggingAnnotation && dragStartPos) {
        const point = getPoint(e);
        if (!point) return;

        // Calculate delta from drag start
        const delta: Point = {
          x: point.x - dragStartPos.x,
          y: point.y - dragStartPos.y,
        };

        // Update all selected annotations
        manager.updateDrag(delta);
        setAnnotations(manager.getAnnotations());
        setDragMoved(true); // Mark that we actually moved
        return;
      }

      // Handle reshape
      if (isReshapingAnnotation) {
        const point = getPoint(e);
        if (!point) return;

        manager.updateReshape(point);
        setAnnotations(manager.getAnnotations());
      }
    },
    [
      isDraggingAnnotation,
      dragStartPos,
      isReshapingAnnotation,
      manager,
      getPoint,
    ]
  );

  /**
   * Handle mouse up during drag or reshape (on Stage).
   * Finalizes the drag or reshape operation.
   */
  const handleStageMouseUp = useCallback(() => {
    // End annotation drag
    if (isDraggingAnnotation) {
      console.log(`Video ${videoId}: Drag ended`);
      manager.endDrag();
      setIsDraggingAnnotation(false);
      setDragStartPos(null);
      setAnnotations(manager.getAnnotations());
      setSelectedIds(manager.getSelectedIds()); // Sync selection state after drag
      return;
    }

    // End reshape
    if (isReshapingAnnotation) {
      console.log(`Video ${videoId}: Reshape ended`);
      manager.endReshape();
      setIsReshapingAnnotation(false);
      const current = manager.getAnnotations();
      setAnnotations(current);
      pushHistory(current);
    }
  }, [
    isDraggingAnnotation,
    isReshapingAnnotation,
    manager,
    videoId,
    pushHistory,
  ]);

  return {
    manager,
    selectedTool,
    setSelectedTool: onToolChange,
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
      handleAnnotationDragStart,
      handleControlPointMouseDown,
      handleStageMouseMove,
      handleStageMouseUp,
    },
    clearAll,
    updateAnnotationText,
    hydrateAnnotations,
    isDraggingAnnotation,
    isReshapingAnnotation,
    undo,
    redo,
    canUndo: undoStack.length > 1,
    canRedo: redoStack.length > 0,
  };
}
