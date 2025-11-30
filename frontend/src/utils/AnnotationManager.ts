/**
 * Annotation Manager
 * 
 * Manages annotation state and operations for a single video channel.
 * Provides methods for creating, adding, and validating annotations.
 * 
 * Subtask 0.5.2: Freehand drawing support
 */

import type { Annotation, AnnotationType, AnnotationStyle } from '../types/annotations';
import { DEFAULT_ANNOTATION_STYLE } from '../types/annotations';

export class AnnotationManager {
  private annotations: Annotation[] = [];
  private nextId: number = 1;

  /**
   * Create a new annotation with the given parameters.
   * Automatically generates a unique ID.
   */
  createAnnotation(
    type: AnnotationType,
    points: number[],
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
    return this.annotations.find(a => a.id === id);
  }

  /**
   * Remove annotation by ID.
   * Returns true if annotation was found and removed.
   */
  removeAnnotation(id: string): boolean {
    const index = this.annotations.findIndex(a => a.id === id);
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
  static validatePoints(type: AnnotationType, points: number[]): boolean {
    // Points must have even length (x,y coordinate pairs)
    if (points.length % 2 !== 0) {
      return false;
    }

    // Type-specific validation
    switch (type) {
      case 'freehand':
      case 'polyline':
        // Need at least 2 points (4 coordinates)
        return points.length >= 4;

      case 'oval':
        // Need exactly 2 points (4 coordinates): top-left and bottom-right
        return points.length === 4;

      case 'arrow':
        // Need exactly 2 points (4 coordinates): start and end
        return points.length === 4;

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
    points: number[],
    style: AnnotationStyle = DEFAULT_ANNOTATION_STYLE
  ): Annotation | null {
    if (!AnnotationManager.validatePoints(type, points)) {
      return null;
    }

    const annotation = this.createAnnotation(type, points, style);
    this.addAnnotation(annotation);
    return annotation;
  }
}
