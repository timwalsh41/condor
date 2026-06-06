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
  private reshapeState: {
    isReshaping: boolean;
    annotationId: string | null;
    controlPointIndex: number | null;
    originalPoints: Point[];
  } = {
    isReshaping: false,
    annotationId: null,
    controlPointIndex: null,
    originalPoints: [],
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
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE,
    text?: string
  ): Annotation {
    return {
      id: `annotation-${this.nextId++}`,
      type,
      points,
      color: style.color,
      strokeWidth: style.strokeWidth,
      ...(text !== undefined && { text }),
    };
  }

  /**
   * Create and add a text annotation at the given position.
   */
  createAndAddText(
    position: Point,
    text: string,
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation {
    const annotation = this.createAnnotation('text', [position], style, text);
    this.addAnnotation(annotation);
    return annotation;
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

      case "text":
        // Need exactly 1 point: the placement position
        return points.length === 1;

      case "angle":
        // Need exactly 3 points: arm1-end, vertex, arm2-end
        return points.length === 3;

      default:
        return false;
    }
  }

  /**
   * Replace the entire annotations collection (used for undo/redo).
   * Resets drawing state and selection as part of the replacement.
   */
  setAnnotations(annotations: Annotation[]): void {
    this.annotations = annotations.map((a) => ({ ...a }));
    this.drawingState = { mode: 'idle' };
    this.selectedIds.clear();
    // Sync nextId to avoid ID collisions after restore
    const maxId = annotations.reduce((max, a) => {
      const n = parseInt(a.id.replace('annotation-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    if (maxId >= this.nextId) this.nextId = maxId + 1;
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
    } else if (this.selectedTool === "angle") {
      this.drawingState = { mode: "angle-active", points: [point] };
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

    if (this.drawingState.mode === "angle-active") {
      // Angle tool not finalized this way — use finalizeAngle()
      return null;
    }

    const type =
      this.drawingState.mode === "polyline-active"
        ? "polyline"
        : this.drawingState.tool;

    const points = [...this.drawingState.points]; // Copy points
    this.drawingState = { mode: "idle" };

    return this.createAndAddAnnotation(type, points, style);
  }

  /**
   * Add a vertex point to the angle annotation being drawn.
   * Automatically finalizes after 3 points.
   * Returns the completed annotation if finalized, otherwise null.
   */
  addAngleVertex(
    point: Point,
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation | null {
    if (this.drawingState.mode !== 'angle-active') return null;
    this.drawingState.points.push(point);
    if (this.drawingState.points.length === 3) {
      return this.finalizeAngle(style);
    }
    return null;
  }

  /**
   * Finalize the current angle annotation (3 points: arm1-end, vertex, arm2-end).
   */
  finalizeAngle(
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation | null {
    if (this.drawingState.mode !== 'angle-active') return null;
    const points = [...this.drawingState.points];
    this.drawingState = { mode: 'idle' };
    if (points.length !== 3) return null;
    const annotation = this.createAnnotation('angle', points, style);
    this.addAnnotation(annotation);
    return annotation;
  }

  /**
   * Finalize polyline on double-click.
   * Removes the duplicate point added by the first click of the double-click,
   * then creates the annotation.
   *
   * Background: When user double-clicks to finish a polyline:
   * - First click triggers addPolylineVertex (adds a point)
   * - Second click triggers finalization
   * This results in a duplicate point at the double-click location.
   * This method removes that duplicate before finalizing.
   *
   * Returns the created annotation or null if validation failed.
   */
  finalizePolylineDoubleClick(
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation | null {
    if (this.drawingState.mode !== "polyline-active") return null;

    const points = [...this.drawingState.points];

    // Remove the duplicate point added by first click of double-click
    if (points.length > 1) {
      points.pop();
    }

    this.drawingState = { mode: "idle" };
    return this.createAndAddAnnotation("polyline", points, style);
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
   * Returns true if angle drawing is in progress.
   */
  isAngleActive(): boolean {
    return this.drawingState.mode === 'angle-active';
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
    } else if (this.drawingState.mode === "angle-active") {
      return { mode: "angle-active", points: [...this.drawingState.points] };
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
    if (this.drawingState.mode === "angle-active") return "angle";
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
   * Update the text content of a text annotation by ID.
   * Returns true if the annotation was found and updated.
   */
  updateAnnotationText(id: string, text: string): boolean {
    const annotation = this.annotations.find((a) => a.id === id);
    if (annotation && annotation.type === "text") {
      annotation.text = text;
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

  // ========================================
  // Reshape Methods (Subtask 0.5.11)
  // ========================================

  /**
   * Start reshaping operation for a single annotation.
   * Stores original points for the annotation being reshaped.
   * @param annotationId - ID of the annotation to reshape
   * @param controlPointIndex - Index of the control point being dragged
   * @returns true if reshape started successfully, false if annotation not found
   */
  startReshape(annotationId: string, controlPointIndex: number): boolean {
    const annotation = this.getAnnotationById(annotationId);
    if (!annotation) return false;

    this.reshapeState = {
      isReshaping: true,
      annotationId,
      controlPointIndex,
      originalPoints: annotation.points.map((p) => ({ ...p })),
    };
    return true;
  }

  /**
   * Update annotation shape during reshape.
   * For arrow/polyline: directly updates the vertex at controlPointIndex.
   * For oval: recalculates bounding box based on which control point moved.
   * @param newPosition - New position for the control point
   */
  updateReshape(newPosition: Point): void {
    if (!this.reshapeState.isReshaping || !this.reshapeState.annotationId) {
      return;
    }

    const annotation = this.getAnnotationById(this.reshapeState.annotationId);
    if (!annotation) return;

    const controlIndex = this.reshapeState.controlPointIndex!;

    switch (annotation.type) {
      case "arrow":
      case "polyline": {
        // Direct vertex manipulation - update the point at controlIndex
        if (controlIndex >= 0 && controlIndex < annotation.points.length) {
          const newPoints = annotation.points.map((p, i) =>
            i === controlIndex ? { ...newPosition } : { ...p }
          );
          this.updateAnnotationPoints(annotation.id, newPoints);
        }
        break;
      }

      case "angle": {
        // Direct vertex manipulation for all 3 points (arm1-end, vertex, arm2-end)
        if (controlIndex >= 0 && controlIndex < annotation.points.length) {
          const newPoints = annotation.points.map((p, i) =>
            i === controlIndex ? { ...newPosition } : { ...p }
          );
          this.updateAnnotationPoints(annotation.id, newPoints);
        }
        break;
      }

      case "oval": {
        // Oval has 8 control points: 4 corners + 4 edges
        // Map control point to bounding box manipulation
        const original = this.reshapeState.originalPoints;
        const start = original[0];
        const end = original[1];
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        let newMinX = minX;
        let newMaxX = maxX;
        let newMinY = minY;
        let newMaxY = maxY;

        // Control point mapping for oval resize:
        // 0: top-left corner, 1: top-center, 2: top-right corner, 3: right-center
        // 4: bottom-right corner, 5: bottom-center, 6: bottom-left corner, 7: left-center
        switch (controlIndex) {
          case 0: // Top-left corner
            newMinX = newPosition.x;
            newMinY = newPosition.y;
            break;
          case 1: // Top-center edge
            newMinY = newPosition.y;
            break;
          case 2: // Top-right corner
            newMaxX = newPosition.x;
            newMinY = newPosition.y;
            break;
          case 3: // Right-center edge
            newMaxX = newPosition.x;
            break;
          case 4: // Bottom-right corner
            newMaxX = newPosition.x;
            newMaxY = newPosition.y;
            break;
          case 5: // Bottom-center edge
            newMaxY = newPosition.y;
            break;
          case 6: // Bottom-left corner
            newMinX = newPosition.x;
            newMaxY = newPosition.y;
            break;
          case 7: // Left-center edge
            newMinX = newPosition.x;
            break;
        }

        // Update the two defining points (start, end) from new bounding box
        const newPoints: Point[] = [
          { x: newMinX, y: newMinY },
          { x: newMaxX, y: newMaxY },
        ];
        this.updateAnnotationPoints(annotation.id, newPoints);
        break;
      }

      case "freehand":
        // Freehand doesn't support reshape
        break;
    }
  }

  /**
   * End reshaping operation and clear reshape state.
   */
  endReshape(): void {
    this.reshapeState = {
      isReshaping: false,
      annotationId: null,
      controlPointIndex: null,
      originalPoints: [],
    };
  }

  /**
   * Check if currently reshaping.
   */
  isReshaping(): boolean {
    return this.reshapeState.isReshaping;
  }

  /**
   * Get the current reshape state (for external queries).
   */
  getReshapeState(): {
    isReshaping: boolean;
    annotationId: string | null;
    controlPointIndex: number | null;
  } {
    return {
      isReshaping: this.reshapeState.isReshaping,
      annotationId: this.reshapeState.annotationId,
      controlPointIndex: this.reshapeState.controlPointIndex,
    };
  }
}
