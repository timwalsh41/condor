/**
 * Unit Tests for AnnotationManager
 * 
 * Tests annotation creation, validation, and management operations.
 * These tests validate the business logic independent of React components.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnnotationManager } from '../AnnotationManager';
import { DEFAULT_ANNOTATION_STYLE } from '../../types/annotations';
import type { AnnotationType } from '../../types/annotations';

describe('AnnotationManager', () => {
  let manager: AnnotationManager;

  beforeEach(() => {
    manager = new AnnotationManager();
  });

  describe('createAnnotation', () => {
    it('should create a freehand annotation with default style', () => {
      const points = [10, 20, 30, 40, 50, 60];
      const annotation = manager.createAnnotation('freehand', points);

      expect(annotation.id).toMatch(/^annotation-\d+$/);
      expect(annotation.type).toBe('freehand');
      expect(annotation.points).toEqual(points);
      expect(annotation.color).toBe(DEFAULT_ANNOTATION_STYLE.color);
      expect(annotation.strokeWidth).toBe(DEFAULT_ANNOTATION_STYLE.strokeWidth);
    });

    it('should create annotation with custom style', () => {
      const points = [10, 20, 30, 40];
      const customStyle = { color: '#00FF00', strokeWidth: 5 };
      const annotation = manager.createAnnotation('polyline', points, customStyle);

      expect(annotation.color).toBe('#00FF00');
      expect(annotation.strokeWidth).toBe(5);
    });

    it('should generate unique IDs for multiple annotations', () => {
      const ann1 = manager.createAnnotation('freehand', [10, 20, 30, 40]);
      const ann2 = manager.createAnnotation('freehand', [50, 60, 70, 80]);
      const ann3 = manager.createAnnotation('freehand', [90, 100, 110, 120]);

      expect(ann1.id).not.toBe(ann2.id);
      expect(ann2.id).not.toBe(ann3.id);
      expect(ann1.id).not.toBe(ann3.id);
    });

    it('should create annotations for all tool types', () => {
      const types: AnnotationType[] = ['freehand', 'polyline', 'oval', 'arrow'];
      
      types.forEach(type => {
        const annotation = manager.createAnnotation(type, [10, 20, 30, 40]);
        expect(annotation.type).toBe(type);
      });
    });
  });

  describe('addAnnotation and getAnnotations', () => {
    it('should add annotation and retrieve it', () => {
      const annotation = manager.createAnnotation('freehand', [10, 20, 30, 40]);
      manager.addAnnotation(annotation);

      const annotations = manager.getAnnotations();
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toEqual(annotation);
    });

    it('should add multiple annotations', () => {
      const ann1 = manager.createAnnotation('freehand', [10, 20, 30, 40]);
      const ann2 = manager.createAnnotation('polyline', [50, 60, 70, 80]);
      
      manager.addAnnotation(ann1);
      manager.addAnnotation(ann2);

      const annotations = manager.getAnnotations();
      expect(annotations).toHaveLength(2);
      expect(annotations[0]).toEqual(ann1);
      expect(annotations[1]).toEqual(ann2);
    });

    it('should return copy of annotations array to prevent external mutations', () => {
      const annotation = manager.createAnnotation('freehand', [10, 20, 30, 40]);
      manager.addAnnotation(annotation);

      const annotations1 = manager.getAnnotations();
      const annotations2 = manager.getAnnotations();

      expect(annotations1).not.toBe(annotations2); // Different array instances
      expect(annotations1).toEqual(annotations2); // Same content
    });
  });

  describe('getAnnotationById', () => {
    it('should retrieve annotation by ID', () => {
      const ann1 = manager.createAnnotation('freehand', [10, 20, 30, 40]);
      const ann2 = manager.createAnnotation('polyline', [50, 60, 70, 80]);
      
      manager.addAnnotation(ann1);
      manager.addAnnotation(ann2);

      const found = manager.getAnnotationById(ann2.id);
      expect(found).toEqual(ann2);
    });

    it('should return undefined for non-existent ID', () => {
      const found = manager.getAnnotationById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('removeAnnotation', () => {
    it('should remove annotation by ID and return true', () => {
      const ann1 = manager.createAnnotation('freehand', [10, 20, 30, 40]);
      const ann2 = manager.createAnnotation('polyline', [50, 60, 70, 80]);
      
      manager.addAnnotation(ann1);
      manager.addAnnotation(ann2);

      const removed = manager.removeAnnotation(ann1.id);
      expect(removed).toBe(true);

      const annotations = manager.getAnnotations();
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toEqual(ann2);
    });

    it('should return false when removing non-existent annotation', () => {
      const removed = manager.removeAnnotation('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should remove all annotations', () => {
      manager.addAnnotation(manager.createAnnotation('freehand', [10, 20, 30, 40]));
      manager.addAnnotation(manager.createAnnotation('polyline', [50, 60, 70, 80]));
      manager.addAnnotation(manager.createAnnotation('oval', [90, 100, 110, 120]));

      expect(manager.getCount()).toBe(3);

      manager.clearAll();

      expect(manager.getCount()).toBe(0);
      expect(manager.getAnnotations()).toHaveLength(0);
    });
  });

  describe('getCount', () => {
    it('should return correct count', () => {
      expect(manager.getCount()).toBe(0);

      manager.addAnnotation(manager.createAnnotation('freehand', [10, 20, 30, 40]));
      expect(manager.getCount()).toBe(1);

      manager.addAnnotation(manager.createAnnotation('polyline', [50, 60, 70, 80]));
      expect(manager.getCount()).toBe(2);

      manager.clearAll();
      expect(manager.getCount()).toBe(0);
    });
  });

  describe('validatePoints', () => {
    describe('freehand validation', () => {
      it('should accept valid freehand points (minimum 2 points)', () => {
        expect(AnnotationManager.validatePoints('freehand', [10, 20, 30, 40])).toBe(true);
        expect(AnnotationManager.validatePoints('freehand', [10, 20, 30, 40, 50, 60])).toBe(true);
      });

      it('should reject freehand with less than 2 points', () => {
        expect(AnnotationManager.validatePoints('freehand', [10, 20])).toBe(false);
        expect(AnnotationManager.validatePoints('freehand', [])).toBe(false);
      });

      it('should reject odd-length coordinate arrays', () => {
        expect(AnnotationManager.validatePoints('freehand', [10, 20, 30])).toBe(false);
      });
    });

    describe('polyline validation', () => {
      it('should accept valid polyline points (minimum 2 points)', () => {
        expect(AnnotationManager.validatePoints('polyline', [10, 20, 30, 40])).toBe(true);
        expect(AnnotationManager.validatePoints('polyline', [10, 20, 30, 40, 50, 60])).toBe(true);
      });

      it('should reject polyline with less than 2 points', () => {
        expect(AnnotationManager.validatePoints('polyline', [10, 20])).toBe(false);
      });
    });

    describe('oval validation', () => {
      it('should accept exactly 2 points for oval (top-left, bottom-right)', () => {
        expect(AnnotationManager.validatePoints('oval', [10, 20, 30, 40])).toBe(true);
      });

      it('should reject oval with wrong number of points', () => {
        expect(AnnotationManager.validatePoints('oval', [10, 20])).toBe(false);
        expect(AnnotationManager.validatePoints('oval', [10, 20, 30, 40, 50, 60])).toBe(false);
      });
    });

    describe('arrow validation', () => {
      it('should accept exactly 2 points for arrow (start, end)', () => {
        expect(AnnotationManager.validatePoints('arrow', [10, 20, 30, 40])).toBe(true);
      });

      it('should reject arrow with wrong number of points', () => {
        expect(AnnotationManager.validatePoints('arrow', [10, 20])).toBe(false);
        expect(AnnotationManager.validatePoints('arrow', [10, 20, 30, 40, 50, 60])).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty points array', () => {
        expect(AnnotationManager.validatePoints('freehand', [])).toBe(false);
      });

      it('should handle floating point coordinates', () => {
        expect(AnnotationManager.validatePoints('freehand', [10.5, 20.5, 30.5, 40.5])).toBe(true);
      });
    });
  });

  describe('createAndAddAnnotation', () => {
    it('should create and add valid annotation', () => {
      const annotation = manager.createAndAddAnnotation('freehand', [10, 20, 30, 40]);

      expect(annotation).not.toBeNull();
      expect(annotation?.type).toBe('freehand');
      expect(manager.getCount()).toBe(1);
    });

    it('should return null and not add invalid annotation', () => {
      const annotation = manager.createAndAddAnnotation('freehand', [10, 20]); // Too few points

      expect(annotation).toBeNull();
      expect(manager.getCount()).toBe(0);
    });

    it('should validate based on annotation type', () => {
      // Oval needs exactly 2 points
      const validOval = manager.createAndAddAnnotation('oval', [10, 20, 30, 40]);
      expect(validOval).not.toBeNull();

      const invalidOval = manager.createAndAddAnnotation('oval', [10, 20, 30, 40, 50, 60]);
      expect(invalidOval).toBeNull();

      expect(manager.getCount()).toBe(1); // Only valid one was added
    });
  });

  describe('integration scenario', () => {
    it('should handle typical usage workflow', () => {
      // User draws a freehand line
      const freehand = manager.createAndAddAnnotation('freehand', [10, 20, 30, 40, 50, 60]);
      expect(freehand).not.toBeNull();
      expect(manager.getCount()).toBe(1);

      // User draws a polyline
      const polyline = manager.createAndAddAnnotation('polyline', [100, 100, 150, 150, 200, 100]);
      expect(polyline).not.toBeNull();
      expect(manager.getCount()).toBe(2);

      // User draws an oval
      const oval = manager.createAndAddAnnotation('oval', [300, 300, 400, 400]);
      expect(oval).not.toBeNull();
      expect(manager.getCount()).toBe(3);

      // User tries to draw invalid arrow (too many points) - should fail
      const invalidArrow = manager.createAndAddAnnotation('arrow', [500, 500, 550, 550, 600, 600]);
      expect(invalidArrow).toBeNull();
      expect(manager.getCount()).toBe(3); // Still 3, invalid one not added

      // User deletes the polyline
      const removed = manager.removeAnnotation(polyline!.id);
      expect(removed).toBe(true);
      expect(manager.getCount()).toBe(2);

      // User clears all annotations
      manager.clearAll();
      expect(manager.getCount()).toBe(0);
    });
  });
});
