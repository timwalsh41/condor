/**
 * Annotation Manager
 *
 * Manages annotation state and operations for a single video channel.
 * Provides methods for creating, adding, validating annotations, and managing drawing state.
 *
 * Subtask 0.5.2: Freehand drawing support
 * Subtask 0.5.3: Integrated annotation framework with drawing state machine
 */

import type {
  Annotation,
  AnnotationType,
  AnnotationStyle,
  DrawingState,
  Point,
} from "../types/annotations";
import { DEFAULT_ANNOTATION_STYLE } from "../types/annotations";

export class AnnotationManager {
  private annotations: Annotation[] = [];
  private nextId: number = 1;
  private drawingState: DrawingState = { mode: "idle" };
  private selectedTool: AnnotationType = "freehand";
  private selectedIds: Set<string> = new Set();
  private dragState: {
    isDragging: boolean;
    primaryAnnotationId: string | null;
    startPositions: Map<string, Point[]>;
  } = {
    isDragging: false,
    primaryAnnotationId: null,
    startPositions: new Map(),
  };

  /**
   * Set the currently selected tool.
   */
  setTool(tool: AnnotationType): void {
    this.selectedTool = tool;
  }

  /**
   * Get the currently selected tool.
   */
  getTool(): AnnotationType {
    return this.selectedTool;
  }

  /**
   * Create a new annotation with the given parameters.
   * Automatically generates a unique ID.
   */
  createAnnotation(
    type: AnnotationType,
    points: Point[],
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation {
    return {
      id: `annotation-${this.nextId++}`,
      type,
      points,
      color: style.color,
      strokeWidth: style.strokeWidth,
    };
  }

  /**
   * Add an annotation to the manager's collection.
   * Returns the added annotation for convenience.
   */
  addAnnotation(annotation: Annotation): Annotation {
    this.annotations.push(annotation);
    return annotation;
  }

  /**
   * Get all annotations.
   */
  getAnnotations(): Annotation[] {
    return [...this.annotations]; // Return copy to prevent external mutations
  }

  /**
   * Get annotation by ID.
   */
  getAnnotationById(id: string): Annotation | undefined {
    return this.annotations.find((a) => a.id === id);
  }

  /**
   * Remove annotation by ID.
   * Returns true if annotation was found and removed.
   */
  removeAnnotation(id: string): boolean {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.annotations.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all annotations.
   */
  clearAll(): void {
    this.annotations = [];
    this.selectedIds.clear();
  }

  /**
   * Get count of annotations.
   */
  getCount(): number {
    return this.annotations.length;
  }

  // ========================================
  // Selection Methods
  // ========================================

  /**
   * Toggle selection for an annotation.
   * @param id - Annotation ID to toggle
   * @param isMultiSelect - If true, add/remove from selection. If false, replace selection.
   */
  toggleSelection(id: string, isMultiSelect: boolean): void {
    if (isMultiSelect) {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
    } else {
      this.selectedIds.clear();
      this.selectedIds.add(id);
    }
  }

  /**
   * Get all selected annotation IDs.
   * Returns a copy to prevent external mutation.
   */
  getSelectedIds(): Set<string> {
    return new Set(this.selectedIds);
  }

  /**
   * Clear all selections.
   */
  clearSelection(): void {
    this.selectedIds.clear();
  }

  /**
   * Check if an annotation is selected.
   */
  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  /**
   * Delete all selected annotations.
   * Returns the number of annotations deleted.
   */
  deleteSelected(): number {
    let count = 0;
    this.selectedIds.forEach((id) => {
      if (this.removeAnnotation(id)) {
        count++;
      }
    });
    this.selectedIds.clear();
    return count;
  }

  /**
   * Validate annotation points array.
   * Returns true if points array is valid for the annotation type.
   */
  static validatePoints(type: AnnotationType, points: Point[]): boolean {
    // Type-specific validation
    switch (type) {
      case "freehand":
      case "polyline":
        // Need at least 2 points
        return points.length >= 2;

      case "oval":
        // Need exactly 2 points: start and end (defines bounds)
        return points.length === 2;

      case "arrow":
        // Need exactly 2 points: start and end
        return points.length === 2;

      default:
        return false;
    }
  }

  /**
   * Create and add an annotation in one operation.
   * Only adds if points are valid for the annotation type.
   * Returns the added annotation or null if validation failed.
   */
  createAndAddAnnotation(
    type: AnnotationType,
    points: Point[],
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation | null {
    if (!AnnotationManager.validatePoints(type, points)) {
      return null;
    }

    const annotation = this.createAnnotation(type, points, style);
    this.addAnnotation(annotation);
    return annotation;
  }

  // ========================================
  // Drawing State Machine Methods
  // ========================================

  /**
   * Start drawing at the given point using the currently selected tool.
   * For drag-based tools (freehand, oval, arrow), initializes drag drawing state.
   * For click-based tools (polyline), initializes polyline with first vertex.
   * Clears any existing selections when starting to draw.
   */
  startDrawing(point: Point): void {
    // Clear selections when starting new drawing
    this.selectedIds.clear();

    if (this.selectedTool === "polyline") {
      this.drawingState = { mode: "polyline-active", points: [point] };
    } else {
      // freehand, oval, arrow are drag-based
      this.drawingState = {
        mode: "drag-drawing",
        tool: this.selectedTool as "freehand" | "oval" | "arrow",
        points: [point],
      };
    }
  }

  /**
   * Continue drawing with a new point (for drag-based tools).
   * - Freehand: Appends point to continuous line
   * - Oval/Arrow: Updates end point only (2-point shapes)
   */
  continueDrawing(point: Point): void {
    if (this.drawingState.mode !== "drag-drawing") return;

    if (this.drawingState.tool === "freehand") {
      // Freehand: append points for continuous line
      this.drawingState.points.push(point);
    } else {
      // Oval/Arrow: update end point only (2-point shapes)
      if (this.drawingState.points.length === 1) {
        this.drawingState.points.push(point);
      } else {
        this.drawingState.points[1] = point;
      }
    }
  }

  /**
   * Finish the current drawing and create annotation.
   * Validates points before creating annotation.
   * Returns the created annotation or null if validation failed.
   * Resets drawing state to idle.
   */
  finishDrawing(
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation | null {
    if (this.drawingState.mode === "idle") return null;

    const type =
      this.drawingState.mode === "polyline-active"
        ? "polyline"
        : this.drawingState.tool;

    const points = [...this.drawingState.points]; // Copy points
    this.drawingState = { mode: "idle" };

    return this.createAndAddAnnotation(type, points, style);
  }

  /**
   * Add a vertex to the polyline being drawn.
   * Only works when polyline is active.
   */
  addPolylineVertex(point: Point): void {
    if (this.drawingState.mode === "polyline-active") {
      this.drawingState.points.push(point);
    }
  }

  /**
   * Cancel the current drawing without creating an annotation.
   * Resets drawing state to idle.
   */
  cancelDrawing(): void {
    this.drawingState = { mode: "idle" };
  }

  /**
   * Get the current drawing state.
   * Useful for UI rendering and state synchronization.
   */
  getDrawingState(): DrawingState {
    // Return a copy to prevent external mutation
    if (this.drawingState.mode === "idle") {
      return { mode: "idle" };
    } else if (this.drawingState.mode === "polyline-active") {
      return { mode: "polyline-active", points: [...this.drawingState.points] };
    } else {
      return {
        mode: "drag-drawing",
        tool: this.drawingState.tool,
        points: [...this.drawingState.points],
      };
    }
  }

  /**
   * Get preview points for the current drawing.
   * Returns null if no drawing is in progress.
   * Useful for rendering live preview.
   * Returns points in Konva format (flat array of coordinates).
   */
  getPreviewPoints(): number[] | null {
    if (this.drawingState.mode === "idle") return null;
    // Convert Point[] to flat number[] for Konva
    return this.drawingState.points.flatMap((p) => [p.x, p.y]);
  }

  /**
   * Check if currently drawing.
   */
  isDrawing(): boolean {
    return this.drawingState.mode !== "idle";
  }

  /**
   * Check if polyline is currently active.
   */
  isPolylineActive(): boolean {
    return this.drawingState.mode === "polyline-active";
  }

  /**
   * Get the type of tool currently being used (if drawing).
   */
  getCurrentTool(): AnnotationType | null {
    if (this.drawingState.mode === "idle") return null;
    if (this.drawingState.mode === "polyline-active") return "polyline";
    return this.drawingState.tool;
  }

  // ========================================
  // Drag Methods (Subtask 0.5.10)
  // ========================================

  /**
   * Update the points of an annotation by ID.
   * Used during dragging to update annotation positions.
   * Returns true if annotation was found and updated.
   */
  updateAnnotationPoints(id: string, newPoints: Point[]): boolean {
    const annotation = this.annotations.find((a) => a.id === id);
    if (annotation) {
      annotation.points = newPoints;
      return true;
    }
    return false;
  }

  /**
   * Start dragging operation for selected annotations.
   * Stores original positions for all selected annotations.
   * @param primaryId - ID of the annotation that was clicked to start the drag
   */
  startDrag(primaryId: string): void {
    this.dragState.isDragging = true;
    this.dragState.primaryAnnotationId = primaryId;
    this.dragState.startPositions.clear();

    // Store original positions for all selected annotations
    this.selectedIds.forEach((id) => {
      const annotation = this.getAnnotationById(id);
      if (annotation) {
        // Deep copy of points array
        this.dragState.startPositions.set(
          id,
          annotation.points.map((p) => ({ ...p }))
        );
      }
    });
  }

  /**
   * Update all selected annotations during drag.
   * Applies the delta to all selected annotations from their original positions.
   * @param delta - The x,y offset from the drag start position
   */
  updateDrag(delta: Point): void {
    if (!this.dragState.isDragging) return;

    // Apply delta to all selected annotations
    this.selectedIds.forEach((id) => {
      const originalPoints = this.dragState.startPositions.get(id);
      if (originalPoints) {
        const newPoints = originalPoints.map((p) => ({
          x: p.x + delta.x,
          y: p.y + delta.y,
        }));
        this.updateAnnotationPoints(id, newPoints);
      }
    });
  }

  /**
   * End dragging operation and clear drag state.
   */
  endDrag(): void {
    this.dragState = {
      isDragging: false,
      primaryAnnotationId: null,
      startPositions: new Map(),
    };
  }

  /**
   * Check if currently dragging.
   */
  isDragging(): boolean {
    return this.dragState.isDragging;
  }
}
