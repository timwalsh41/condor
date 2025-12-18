/**
 * Annotation Types and Interfaces
 *
 * Defines the data structures for video annotations.
 * Subtask 0.5.2: Freehand drawing support
 * Subtask 0.5.3: Integrated annotation framework with all tools
 */

export type AnnotationType = "select" | "freehand" | "polyline" | "oval" | "arrow";

/**
 * Point interface for type-safe coordinate handling
 */
export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  points: Point[]; // Array of Point objects for clearer structure
  color: string;
  strokeWidth: number;
}

export interface AnnotationStyle {
  color: string;
  strokeWidth: number;
}

/**
 * Default annotation style for MVP (Phase 0)
 * REQ-F-ANNOT-004: Fixed style in MVP, customization deferred to Phase 4
 */
export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  color: "#FF0000", // Red for visibility
  strokeWidth: 6,
};

/**
 * Drawing state machine for annotation tools
 * Supports both drag-based (freehand, oval, arrow) and click-based (polyline) interactions
 */
export type DrawingState =
  | { mode: "idle" }
  | {
      mode: "drag-drawing";
      tool: "freehand" | "oval" | "arrow";
      points: Point[];
    }
  | { mode: "polyline-active"; points: Point[] };
