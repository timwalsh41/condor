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
  }

  /**
   * Get count of annotations.
   */
  getCount(): number {
    return this.annotations.length;
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
   * Start drawing with the specified tool at the given point.
   * For drag-based tools (freehand, oval, arrow), initializes drag drawing state.
   * For click-based tools (polyline), initializes polyline with first vertex.
   */
  startDrawing(tool: AnnotationType, point: Point): void {
    if (tool === "polyline") {
      this.drawingState = { mode: "polyline-active", points: [point] };
    } else {
      // freehand, oval, arrow are drag-based
      this.drawingState = {
        mode: "drag-drawing",
        tool: tool as "freehand" | "oval" | "arrow",
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
}
