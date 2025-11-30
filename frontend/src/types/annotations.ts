/**
 * Annotation Types and Interfaces
 * 
 * Defines the data structures for video annotations.
 * Subtask 0.5.2: Freehand drawing support
 * Future: Polyline, oval, arrow tools (0.5.3-0.5.5)
 */

export type AnnotationType = "freehand" | "polyline" | "oval" | "arrow";

export interface Annotation {
  id: string;
  type: AnnotationType;
  points: number[]; // Coordinate array: [x1, y1, x2, y2, ...]
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
  color: '#FF0000', // Red for visibility
  strokeWidth: 3,
};
