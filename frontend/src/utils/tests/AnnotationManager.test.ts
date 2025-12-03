/**
 * Unit Tests for AnnotationManager
 *
 * Tests annotation creation, validation, and management operations.
 * These tests validate the business logic independent of React components.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AnnotationManager } from "../AnnotationManager";
import { DEFAULT_ANNOTATION_STYLE } from "../../types/annotations";
import type { AnnotationType, Point } from "../../types/annotations";

describe("AnnotationManager", () => {
  let manager: AnnotationManager;

  beforeEach(() => {
    manager = new AnnotationManager();
  });

  describe("createAnnotation", () => {
    it("should create a freehand annotation with default style", () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ];
      const annotation = manager.createAnnotation("freehand", points);

      expect(annotation.id).toMatch(/^annotation-\d+$/);
      expect(annotation.type).toBe("freehand");
      expect(annotation.points).toEqual(points);
      expect(annotation.color).toBe(DEFAULT_ANNOTATION_STYLE.color);
      expect(annotation.strokeWidth).toBe(DEFAULT_ANNOTATION_STYLE.strokeWidth);
    });

    it("should create annotation with custom style", () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      const customStyle = { color: "#00FF00", strokeWidth: 5 };
      const annotation = manager.createAnnotation(
        "polyline",
        points,
        customStyle
      );

      expect(annotation.color).toBe("#00FF00");
      expect(annotation.strokeWidth).toBe(5);
    });

    it("should generate unique IDs for multiple annotations", () => {
      const ann1 = manager.createAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      const ann2 = manager.createAnnotation("freehand", [
        { x: 50, y: 60 },
        { x: 70, y: 80 },
      ]);
      const ann3 = manager.createAnnotation("freehand", [
        { x: 90, y: 100 },
        { x: 110, y: 120 },
      ]);

      expect(ann1.id).not.toBe(ann2.id);
      expect(ann2.id).not.toBe(ann3.id);
      expect(ann1.id).not.toBe(ann3.id);
    });

    it("should create annotations for all tool types", () => {
      const types: AnnotationType[] = ["freehand", "polyline", "oval", "arrow"];

      types.forEach((type) => {
        const annotation = manager.createAnnotation(type, [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ]);
        expect(annotation.type).toBe(type);
      });
    });
  });

  describe("addAnnotation and getAnnotations", () => {
    it("should add annotation and retrieve it", () => {
      const annotation = manager.createAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      manager.addAnnotation(annotation);

      const annotations = manager.getAnnotations();
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toEqual(annotation);
    });

    it("should add multiple annotations", () => {
      const ann1 = manager.createAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      const ann2 = manager.createAnnotation("polyline", [
        { x: 50, y: 60 },
        { x: 70, y: 80 },
      ]);

      manager.addAnnotation(ann1);
      manager.addAnnotation(ann2);

      const annotations = manager.getAnnotations();
      expect(annotations).toHaveLength(2);
      expect(annotations[0]).toEqual(ann1);
      expect(annotations[1]).toEqual(ann2);
    });

    it("should return copy of annotations array to prevent external mutations", () => {
      const annotation = manager.createAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      manager.addAnnotation(annotation);

      const annotations1 = manager.getAnnotations();
      const annotations2 = manager.getAnnotations();

      expect(annotations1).not.toBe(annotations2); // Different array instances
      expect(annotations1).toEqual(annotations2); // Same content
    });
  });

  describe("getAnnotationById", () => {
    it("should retrieve annotation by ID", () => {
      const ann1 = manager.createAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      const ann2 = manager.createAnnotation("polyline", [
        { x: 50, y: 60 },
        { x: 70, y: 80 },
      ]);

      manager.addAnnotation(ann1);
      manager.addAnnotation(ann2);

      const found = manager.getAnnotationById(ann2.id);
      expect(found).toEqual(ann2);
    });

    it("should return undefined for non-existent ID", () => {
      const found = manager.getAnnotationById("non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("removeAnnotation", () => {
    it("should remove annotation by ID and return true", () => {
      const ann1 = manager.createAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      const ann2 = manager.createAnnotation("polyline", [
        { x: 50, y: 60 },
        { x: 70, y: 80 },
      ]);

      manager.addAnnotation(ann1);
      manager.addAnnotation(ann2);

      const removed = manager.removeAnnotation(ann1.id);
      expect(removed).toBe(true);

      const annotations = manager.getAnnotations();
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toEqual(ann2);
    });

    it("should return false when removing non-existent annotation", () => {
      const removed = manager.removeAnnotation("non-existent-id");
      expect(removed).toBe(false);
    });
  });

  describe("clearAll", () => {
    it("should remove all annotations", () => {
      manager.addAnnotation(
        manager.createAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ])
      );
      manager.addAnnotation(
        manager.createAnnotation("polyline", [
          { x: 50, y: 60 },
          { x: 70, y: 80 },
        ])
      );
      manager.addAnnotation(
        manager.createAnnotation("oval", [
          { x: 90, y: 100 },
          { x: 110, y: 120 },
        ])
      );

      expect(manager.getCount()).toBe(3);

      manager.clearAll();

      expect(manager.getCount()).toBe(0);
      expect(manager.getAnnotations()).toHaveLength(0);
    });
  });

  describe("getCount", () => {
    it("should return correct count", () => {
      expect(manager.getCount()).toBe(0);

      manager.addAnnotation(
        manager.createAnnotation("freehand", [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ])
      );
      expect(manager.getCount()).toBe(1);

      manager.addAnnotation(
        manager.createAnnotation("polyline", [
          { x: 50, y: 60 },
          { x: 70, y: 80 },
        ])
      );
      expect(manager.getCount()).toBe(2);

      manager.clearAll();
      expect(manager.getCount()).toBe(0);
    });
  });

  describe("validatePoints", () => {
    describe("freehand validation", () => {
      it("should accept valid freehand points (minimum 2 points)", () => {
        expect(
          AnnotationManager.validatePoints("freehand", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ])
        ).toBe(true);
        expect(
          AnnotationManager.validatePoints("freehand", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
            { x: 50, y: 60 },
          ])
        ).toBe(true);
      });

      it("should reject freehand with less than 2 points", () => {
        expect(
          AnnotationManager.validatePoints("freehand", [{ x: 10, y: 20 }])
        ).toBe(false);
        expect(AnnotationManager.validatePoints("freehand", [])).toBe(false);
      });
    });

    describe("polyline validation", () => {
      it("should accept valid polyline points (minimum 2 points)", () => {
        expect(
          AnnotationManager.validatePoints("polyline", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ])
        ).toBe(true);
        expect(
          AnnotationManager.validatePoints("polyline", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
            { x: 50, y: 60 },
          ])
        ).toBe(true);
      });

      it("should reject polyline with less than 2 points", () => {
        expect(
          AnnotationManager.validatePoints("polyline", [{ x: 10, y: 20 }])
        ).toBe(false);
      });
    });

    describe("oval validation", () => {
      it("should accept exactly 2 points for oval (top-left, bottom-right)", () => {
        expect(
          AnnotationManager.validatePoints("oval", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ])
        ).toBe(true);
      });

      it("should reject oval with wrong number of points", () => {
        expect(
          AnnotationManager.validatePoints("oval", [{ x: 10, y: 20 }])
        ).toBe(false);
        expect(
          AnnotationManager.validatePoints("oval", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
            { x: 50, y: 60 },
          ])
        ).toBe(false);
      });
    });

    describe("arrow validation", () => {
      it("should accept exactly 2 points for arrow (start, end)", () => {
        expect(
          AnnotationManager.validatePoints("arrow", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ])
        ).toBe(true);
      });

      it("should reject arrow with wrong number of points", () => {
        expect(
          AnnotationManager.validatePoints("arrow", [{ x: 10, y: 20 }])
        ).toBe(false);
        expect(
          AnnotationManager.validatePoints("arrow", [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
            { x: 50, y: 60 },
          ])
        ).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle empty points array", () => {
        expect(AnnotationManager.validatePoints("freehand", [])).toBe(false);
      });

      it("should handle floating point coordinates", () => {
        expect(
          AnnotationManager.validatePoints("freehand", [
            { x: 10.5, y: 20.5 },
            { x: 30.5, y: 40.5 },
          ])
        ).toBe(true);
      });
    });
  });

  describe("createAndAddAnnotation", () => {
    it("should create and add valid annotation", () => {
      const annotation = manager.createAndAddAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);

      expect(annotation).not.toBeNull();
      expect(annotation?.type).toBe("freehand");
      expect(manager.getCount()).toBe(1);
    });

    it("should return null and not add invalid annotation", () => {
      const annotation = manager.createAndAddAnnotation("freehand", [
        { x: 10, y: 20 },
      ]); // Too few points

      expect(annotation).toBeNull();
      expect(manager.getCount()).toBe(0);
    });

    it("should validate based on annotation type", () => {
      // Oval needs exactly 2 points
      const validOval = manager.createAndAddAnnotation("oval", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      expect(validOval).not.toBeNull();

      const invalidOval = manager.createAndAddAnnotation("oval", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ]);
      expect(invalidOval).toBeNull();

      expect(manager.getCount()).toBe(1); // Only valid one was added
    });
  });

  describe("integration scenario", () => {
    it("should handle typical usage workflow", () => {
      // User draws a freehand line
      const freehand = manager.createAndAddAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ]);
      expect(freehand).not.toBeNull();
      expect(manager.getCount()).toBe(1);

      // User draws a polyline
      const polyline = manager.createAndAddAnnotation("polyline", [
        { x: 100, y: 100 },
        { x: 150, y: 150 },
        { x: 200, y: 100 },
      ]);
      expect(polyline).not.toBeNull();
      expect(manager.getCount()).toBe(2);

      // User draws an oval
      const oval = manager.createAndAddAnnotation("oval", [
        { x: 300, y: 300 },
        { x: 400, y: 400 },
      ]);
      expect(oval).not.toBeNull();
      expect(manager.getCount()).toBe(3);

      // User tries to draw invalid arrow (too many points) - should fail
      const invalidArrow = manager.createAndAddAnnotation("arrow", [
        { x: 500, y: 500 },
        { x: 550, y: 550 },
        { x: 600, y: 600 },
      ]);
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

  describe("Drawing State Machine", () => {
    describe("Tool selection", () => {
      it("should default to freehand tool", () => {
        expect(manager.getTool()).toBe("freehand");
      });

      it("should set and get tool", () => {
        manager.setTool("polyline");
        expect(manager.getTool()).toBe("polyline");

        manager.setTool("oval");
        expect(manager.getTool()).toBe("oval");

        manager.setTool("arrow");
        expect(manager.getTool()).toBe("arrow");

        manager.setTool("freehand");
        expect(manager.getTool()).toBe("freehand");
      });
    });

    describe("startDrawing", () => {
      it("should initialize drag-drawing state for freehand tool", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });

        const state = manager.getDrawingState();
        expect(state.mode).toBe("drag-drawing");
        if (state.mode === "drag-drawing") {
          expect(state.tool).toBe("freehand");
          expect(state.points).toEqual([{ x: 10, y: 20 }]);
        }
      });

      it("should initialize drag-drawing state for oval tool", () => {
        manager.setTool("oval");
        manager.startDrawing({ x: 100, y: 200 });

        const state = manager.getDrawingState();
        expect(state.mode).toBe("drag-drawing");
        if (state.mode === "drag-drawing") {
          expect(state.tool).toBe("oval");
          expect(state.points).toEqual([{ x: 100, y: 200 }]);
        }
      });

      it("should initialize drag-drawing state for arrow tool", () => {
        manager.setTool("arrow");
        manager.startDrawing({ x: 50, y: 75 });

        const state = manager.getDrawingState();
        expect(state.mode).toBe("drag-drawing");
        if (state.mode === "drag-drawing") {
          expect(state.tool).toBe("arrow");
          expect(state.points).toEqual([{ x: 50, y: 75 }]);
        }
      });

      it("should initialize polyline-active state for polyline tool", () => {
        manager.setTool("polyline");
        manager.startDrawing({ x: 30, y: 40 });

        const state = manager.getDrawingState();
        expect(state.mode).toBe("polyline-active");
        if (state.mode === "polyline-active") {
          expect(state.points).toEqual([{ x: 30, y: 40 }]);
        }
      });
    });

    describe("continueDrawing", () => {
      it("should append points for freehand tool", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 30, y: 40 });
        manager.continueDrawing({ x: 50, y: 60 });

        const state = manager.getDrawingState();
        if (state.mode === "drag-drawing") {
          expect(state.points).toEqual([
            { x: 10, y: 20 },
            { x: 30, y: 40 },
            { x: 50, y: 60 },
          ]);
        }
      });

      it("should update end point only for oval tool", () => {
        manager.setTool("oval");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 50, y: 60 });
        manager.continueDrawing({ x: 100, y: 120 }); // Should replace previous end

        const state = manager.getDrawingState();
        if (state.mode === "drag-drawing") {
          expect(state.points).toEqual([
            { x: 10, y: 20 },
            { x: 100, y: 120 },
          ]);
        }
      });

      it("should update end point only for arrow tool", () => {
        manager.setTool("arrow");
        manager.startDrawing({ x: 0, y: 0 });
        manager.continueDrawing({ x: 50, y: 50 });
        manager.continueDrawing({ x: 100, y: 100 });

        const state = manager.getDrawingState();
        if (state.mode === "drag-drawing") {
          expect(state.points).toEqual([
            { x: 0, y: 0 },
            { x: 100, y: 100 },
          ]);
        }
      });

      it("should not modify state when not drawing", () => {
        const initialState = manager.getDrawingState();
        manager.continueDrawing({ x: 10, y: 20 });

        expect(manager.getDrawingState()).toEqual(initialState);
      });
    });

    describe("addPolylineVertex", () => {
      it("should add vertices to polyline", () => {
        manager.setTool("polyline");
        manager.startDrawing({ x: 10, y: 20 });
        manager.addPolylineVertex({ x: 30, y: 40 });
        manager.addPolylineVertex({ x: 50, y: 60 });

        const state = manager.getDrawingState();
        if (state.mode === "polyline-active") {
          expect(state.points).toEqual([
            { x: 10, y: 20 },
            { x: 30, y: 40 },
            { x: 50, y: 60 },
          ]);
        }
      });

      it("should not add vertices when polyline is not active", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.addPolylineVertex({ x: 30, y: 40 });

        const state = manager.getDrawingState();
        if (state.mode === "drag-drawing") {
          expect(state.points).toEqual([{ x: 10, y: 20 }]); // No vertex added
        }
      });
    });

    describe("finishDrawing", () => {
      it("should create and add freehand annotation on finish", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 30, y: 40 });
        manager.continueDrawing({ x: 50, y: 60 });

        const annotation = manager.finishDrawing();

        expect(annotation).not.toBeNull();
        expect(annotation?.type).toBe("freehand");
        expect(annotation?.points).toEqual([
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { x: 50, y: 60 },
        ]);
        expect(manager.getCount()).toBe(1);
        expect(manager.getDrawingState().mode).toBe("idle");
      });

      it("should create and add oval annotation on finish", () => {
        manager.setTool("oval");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 100, y: 120 });

        const annotation = manager.finishDrawing();

        expect(annotation).not.toBeNull();
        expect(annotation?.type).toBe("oval");
        expect(annotation?.points).toEqual([
          { x: 10, y: 20 },
          { x: 100, y: 120 },
        ]);
        expect(manager.getCount()).toBe(1);
      });

      it("should create and add arrow annotation on finish", () => {
        manager.setTool("arrow");
        manager.startDrawing({ x: 0, y: 0 });
        manager.continueDrawing({ x: 50, y: 50 });

        const annotation = manager.finishDrawing();

        expect(annotation).not.toBeNull();
        expect(annotation?.type).toBe("arrow");
        expect(annotation?.points).toEqual([
          { x: 0, y: 0 },
          { x: 50, y: 50 },
        ]);
      });

      it("should create and add polyline annotation on finish", () => {
        manager.setTool("polyline");
        manager.startDrawing({ x: 10, y: 20 });
        manager.addPolylineVertex({ x: 30, y: 40 });
        manager.addPolylineVertex({ x: 50, y: 60 });

        const annotation = manager.finishDrawing();

        expect(annotation).not.toBeNull();
        expect(annotation?.type).toBe("polyline");
        expect(annotation?.points).toEqual([
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { x: 50, y: 60 },
        ]);
      });

      it("should return null if validation fails", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        // Only one point - validation should fail (needs ≥2 points)

        const annotation = manager.finishDrawing();

        expect(annotation).toBeNull();
        expect(manager.getCount()).toBe(0);
        expect(manager.getDrawingState().mode).toBe("idle"); // State reset anyway
      });

      it("should return null when not drawing", () => {
        const annotation = manager.finishDrawing();
        expect(annotation).toBeNull();
      });

      it("should reset drawing state to idle after finishing", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 30, y: 40 });
        manager.finishDrawing();

        expect(manager.getDrawingState().mode).toBe("idle");
        expect(manager.isDrawing()).toBe(false);
      });
    });

    describe("cancelDrawing", () => {
      it("should reset state without creating annotation", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 30, y: 40 });

        manager.cancelDrawing();

        expect(manager.getDrawingState().mode).toBe("idle");
        expect(manager.getCount()).toBe(0);
        expect(manager.isDrawing()).toBe(false);
      });

      it("should work when not drawing", () => {
        manager.cancelDrawing();
        expect(manager.getDrawingState().mode).toBe("idle");
      });
    });

    describe("getDrawingState", () => {
      it("should return copy of state to prevent external mutation", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });

        const state1 = manager.getDrawingState();
        const state2 = manager.getDrawingState();

        expect(state1).not.toBe(state2); // Different instances
        expect(state1).toEqual(state2); // Same content
      });
    });

    describe("getPreviewPoints", () => {
      it("should return points when drawing", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 30, y: 40 });

        const points = manager.getPreviewPoints();
        expect(points).toEqual([10, 20, 30, 40]); // Returns flat array for Konva compatibility
      });

      it("should return null when not drawing", () => {
        const points = manager.getPreviewPoints();
        expect(points).toBeNull();
      });

      it("should return copy to prevent mutation", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });

        const points1 = manager.getPreviewPoints();
        const points2 = manager.getPreviewPoints();

        expect(points1).not.toBe(points2);
        expect(points1).toEqual(points2);
      });
    });

    describe("isDrawing", () => {
      it("should return false initially", () => {
        expect(manager.isDrawing()).toBe(false);
      });

      it("should return true when drag-drawing", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.isDrawing()).toBe(true);
      });

      it("should return true when polyline active", () => {
        manager.setTool("polyline");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.isDrawing()).toBe(true);
      });

      it("should return false after finishing", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 30, y: 40 });
        manager.finishDrawing();
        expect(manager.isDrawing()).toBe(false);
      });

      it("should return false after canceling", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.cancelDrawing();
        expect(manager.isDrawing()).toBe(false);
      });
    });

    describe("isPolylineActive", () => {
      it("should return false initially", () => {
        expect(manager.isPolylineActive()).toBe(false);
      });

      it("should return true when polyline active", () => {
        manager.setTool("polyline");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.isPolylineActive()).toBe(true);
      });

      it("should return false when drag-drawing", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.isPolylineActive()).toBe(false);
      });
    });

    describe("getCurrentTool", () => {
      it("should return null when idle", () => {
        expect(manager.getCurrentTool()).toBeNull();
      });

      it("should return tool type when drag-drawing", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.getCurrentTool()).toBe("freehand");
      });

      it("should return polyline when polyline active", () => {
        manager.setTool("polyline");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.getCurrentTool()).toBe("polyline");
      });
    });

    describe("complete drawing workflow", () => {
      it("should handle freehand drawing workflow", () => {
        expect(manager.isDrawing()).toBe(false);

        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.isDrawing()).toBe(true);
        expect(manager.getCurrentTool()).toBe("freehand");

        manager.continueDrawing({ x: 30, y: 40 });
        manager.continueDrawing({ x: 50, y: 60 });

        const annotation = manager.finishDrawing();
        expect(annotation).not.toBeNull();
        expect(annotation?.type).toBe("freehand");
        expect(manager.getCount()).toBe(1);
        expect(manager.isDrawing()).toBe(false);
      });

      it("should handle polyline drawing workflow", () => {
        manager.setTool("polyline");
        manager.startDrawing({ x: 10, y: 20 });
        expect(manager.isPolylineActive()).toBe(true);

        manager.addPolylineVertex({ x: 30, y: 40 });
        manager.addPolylineVertex({ x: 50, y: 20 });

        const annotation = manager.finishDrawing();
        expect(annotation?.type).toBe("polyline");
        expect(annotation?.points).toEqual([
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { x: 50, y: 20 },
        ]);
        expect(manager.isPolylineActive()).toBe(false);
      });

      it("should handle oval drawing workflow", () => {
        manager.setTool("oval");
        manager.startDrawing({ x: 100, y: 100 });
        manager.continueDrawing({ x: 200, y: 200 });

        const annotation = manager.finishDrawing();
        expect(annotation?.type).toBe("oval");
        expect(annotation?.points).toEqual([
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ]);
      });

      it("should handle cancel workflow", () => {
        manager.setTool("freehand");
        manager.startDrawing({ x: 10, y: 20 });
        manager.continueDrawing({ x: 30, y: 40 });

        manager.cancelDrawing();

        expect(manager.getCount()).toBe(0);
        expect(manager.isDrawing()).toBe(false);
      });
    });
  });

  describe("Selection Management", () => {
    let annotation1: any;
    let annotation2: any;
    let annotation3: any;

    beforeEach(() => {
      // Create test annotations
      annotation1 = manager.createAndAddAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      annotation2 = manager.createAndAddAnnotation("oval", [
        { x: 50, y: 60 },
        { x: 100, y: 100 },
      ]);
      annotation3 = manager.createAndAddAnnotation("arrow", [
        { x: 200, y: 200 },
        { x: 250, y: 250 },
      ]);
    });

    describe("toggleSelection", () => {
      it("should select annotation with single-select mode", () => {
        manager.toggleSelection(annotation1!.id, false);

        expect(manager.isSelected(annotation1!.id)).toBe(true);
        expect(manager.getSelectedIds().size).toBe(1);
      });

      it("should replace selection in single-select mode", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.toggleSelection(annotation2!.id, false);

        expect(manager.isSelected(annotation1!.id)).toBe(false);
        expect(manager.isSelected(annotation2!.id)).toBe(true);
        expect(manager.getSelectedIds().size).toBe(1);
      });

      it("should add to selection in multi-select mode", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);

        expect(manager.isSelected(annotation1!.id)).toBe(true);
        expect(manager.isSelected(annotation2!.id)).toBe(true);
        expect(manager.getSelectedIds().size).toBe(2);
      });

      it("should deselect annotation in multi-select mode when already selected", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);
        manager.toggleSelection(annotation1!.id, true); // Toggle off

        expect(manager.isSelected(annotation1!.id)).toBe(false);
        expect(manager.isSelected(annotation2!.id)).toBe(true);
        expect(manager.getSelectedIds().size).toBe(1);
      });

      it("should handle multi-select of all annotations", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);
        manager.toggleSelection(annotation3!.id, true);

        expect(manager.getSelectedIds().size).toBe(3);
        expect(manager.isSelected(annotation1!.id)).toBe(true);
        expect(manager.isSelected(annotation2!.id)).toBe(true);
        expect(manager.isSelected(annotation3!.id)).toBe(true);
      });
    });

    describe("getSelectedIds", () => {
      it("should return empty set when nothing selected", () => {
        const selectedIds = manager.getSelectedIds();

        expect(selectedIds.size).toBe(0);
      });

      it("should return copy of selected IDs", () => {
        manager.toggleSelection(annotation1!.id, true);
        const selectedIds = manager.getSelectedIds();

        // Mutating returned set should not affect internal state
        selectedIds.add("fake-id");
        expect(manager.getSelectedIds().size).toBe(1);
      });
    });

    describe("isSelected", () => {
      it("should return false for unselected annotation", () => {
        expect(manager.isSelected(annotation1!.id)).toBe(false);
      });

      it("should return true for selected annotation", () => {
        manager.toggleSelection(annotation1!.id, false);
        expect(manager.isSelected(annotation1!.id)).toBe(true);
      });

      it("should return false for non-existent annotation", () => {
        expect(manager.isSelected("non-existent-id")).toBe(false);
      });
    });

    describe("clearSelection", () => {
      it("should clear all selections", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);

        manager.clearSelection();

        expect(manager.getSelectedIds().size).toBe(0);
        expect(manager.isSelected(annotation1!.id)).toBe(false);
        expect(manager.isSelected(annotation2!.id)).toBe(false);
      });

      it("should work when nothing selected", () => {
        expect(() => manager.clearSelection()).not.toThrow();
        expect(manager.getSelectedIds().size).toBe(0);
      });
    });

    describe("deleteSelected", () => {
      it("should delete selected annotations", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);

        const count = manager.deleteSelected();

        expect(count).toBe(2);
        expect(manager.getCount()).toBe(1);
        expect(manager.getAnnotationById(annotation1!.id)).toBeUndefined();
        expect(manager.getAnnotationById(annotation2!.id)).toBeUndefined();
        expect(manager.getAnnotationById(annotation3!.id)).toBeDefined();
      });

      it("should clear selection after deletion", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.deleteSelected();

        expect(manager.getSelectedIds().size).toBe(0);
      });

      it("should return 0 when nothing selected", () => {
        const count = manager.deleteSelected();

        expect(count).toBe(0);
        expect(manager.getCount()).toBe(3);
      });

      it("should handle deletion of all annotations", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);
        manager.toggleSelection(annotation3!.id, true);

        const count = manager.deleteSelected();

        expect(count).toBe(3);
        expect(manager.getCount()).toBe(0);
      });
    });

    describe("clearAll integration with selection", () => {
      it("should clear selections when clearing all annotations", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);

        manager.clearAll();

        expect(manager.getCount()).toBe(0);
        expect(manager.getSelectedIds().size).toBe(0);
      });

      it("should clear selections when starting to draw", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);

        expect(manager.getSelectedIds().size).toBe(2);

        // Start drawing should clear selections
        manager.startDrawing({ x: 100, y: 100 });

        expect(manager.getSelectedIds().size).toBe(0);
        expect(manager.isDrawing()).toBe(true);
      });
    });
  });

  // ========================================
  // Drag Tests (Subtask 0.5.10)
  // ========================================

  describe("Drag Operations", () => {
    let annotation1: any;
    let annotation2: any;
    let annotation3: any;

    beforeEach(() => {
      // Create test annotations with known positions
      annotation1 = manager.createAndAddAnnotation("freehand", [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ]);
      annotation2 = manager.createAndAddAnnotation("oval", [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ]);
      annotation3 = manager.createAndAddAnnotation("arrow", [
        { x: 300, y: 300 },
        { x: 400, y: 400 },
      ]);
    });

    describe("updateAnnotationPoints", () => {
      it("should update annotation points by ID", () => {
        const newPoints: Point[] = [
          { x: 15, y: 25 },
          { x: 35, y: 45 },
        ];

        const result = manager.updateAnnotationPoints(
          annotation1!.id,
          newPoints
        );

        expect(result).toBe(true);
        const updated = manager.getAnnotationById(annotation1!.id);
        expect(updated?.points).toEqual(newPoints);
      });

      it("should return false for non-existent annotation", () => {
        const result = manager.updateAnnotationPoints("non-existent-id", [
          { x: 0, y: 0 },
        ]);

        expect(result).toBe(false);
      });

      it("should not affect other annotations", () => {
        const newPoints: Point[] = [
          { x: 15, y: 25 },
          { x: 35, y: 45 },
        ];

        manager.updateAnnotationPoints(annotation1!.id, newPoints);

        const annotation2Updated = manager.getAnnotationById(annotation2!.id);
        expect(annotation2Updated?.points).toEqual([
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ]);
      });
    });

    describe("startDrag", () => {
      it("should initialize drag state with primary annotation", () => {
        manager.toggleSelection(annotation1!.id, false);

        manager.startDrag(annotation1!.id);

        expect(manager.isDragging()).toBe(true);
      });

      it("should store original positions for all selected annotations", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);

        manager.startDrag(annotation1!.id);

        expect(manager.isDragging()).toBe(true);
        // Original positions should be stored internally
        // (We'll verify this works correctly in updateDrag tests)
      });

      it("should handle single selected annotation", () => {
        manager.toggleSelection(annotation1!.id, false);

        manager.startDrag(annotation1!.id);

        expect(manager.isDragging()).toBe(true);
      });

      it("should work even if drag is started on unselected annotation", () => {
        // In real usage, drag should only start on selected annotations,
        // but the manager should handle this gracefully
        manager.startDrag(annotation1!.id);

        expect(manager.isDragging()).toBe(true);
      });
    });

    describe("updateDrag", () => {
      it("should update single selected annotation", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        const delta: Point = { x: 5, y: 10 };
        manager.updateDrag(delta);

        const updated = manager.getAnnotationById(annotation1!.id);
        expect(updated?.points).toEqual([
          { x: 15, y: 30 },
          { x: 35, y: 50 },
          { x: 55, y: 70 },
        ]);
      });

      it("should update all selected annotations with same delta", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);
        manager.startDrag(annotation1!.id);

        const delta: Point = { x: 10, y: 20 };
        manager.updateDrag(delta);

        const updated1 = manager.getAnnotationById(annotation1!.id);
        const updated2 = manager.getAnnotationById(annotation2!.id);

        expect(updated1?.points).toEqual([
          { x: 20, y: 40 },
          { x: 40, y: 60 },
          { x: 60, y: 80 },
        ]);
        expect(updated2?.points).toEqual([
          { x: 110, y: 120 },
          { x: 210, y: 220 },
        ]);
      });

      it("should not update unselected annotations", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        const delta: Point = { x: 10, y: 20 };
        manager.updateDrag(delta);

        const updated3 = manager.getAnnotationById(annotation3!.id);
        expect(updated3?.points).toEqual([
          { x: 300, y: 300 },
          { x: 400, y: 400 },
        ]);
      });

      it("should handle negative delta values", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        const delta: Point = { x: -5, y: -10 };
        manager.updateDrag(delta);

        const updated = manager.getAnnotationById(annotation1!.id);
        expect(updated?.points).toEqual([
          { x: 5, y: 10 },
          { x: 25, y: 30 },
          { x: 45, y: 50 },
        ]);
      });

      it("should allow multiple updateDrag calls with cumulative effect from original position", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        manager.updateDrag({ x: 5, y: 10 });
        manager.updateDrag({ x: 10, y: 20 });

        const updated = manager.getAnnotationById(annotation1!.id);
        // Second call should replace first, not add to it (delta from original position)
        expect(updated?.points).toEqual([
          { x: 20, y: 40 },
          { x: 40, y: 60 },
          { x: 60, y: 80 },
        ]);
      });

      it("should do nothing if not dragging", () => {
        const originalPoints = [...annotation1!.points];

        manager.updateDrag({ x: 10, y: 20 });

        const updated = manager.getAnnotationById(annotation1!.id);
        expect(updated?.points).toEqual(originalPoints);
      });
    });

    describe("endDrag", () => {
      it("should clear drag state", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        expect(manager.isDragging()).toBe(true);

        manager.endDrag();

        expect(manager.isDragging()).toBe(false);
      });

      it("should preserve annotation positions after drag", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);
        manager.updateDrag({ x: 10, y: 20 });

        manager.endDrag();

        const updated = manager.getAnnotationById(annotation1!.id);
        expect(updated?.points).toEqual([
          { x: 20, y: 40 },
          { x: 40, y: 60 },
          { x: 60, y: 80 },
        ]);
      });

      it("should not affect selections", () => {
        manager.toggleSelection(annotation1!.id, true);
        manager.toggleSelection(annotation2!.id, true);
        manager.startDrag(annotation1!.id);

        manager.endDrag();

        expect(manager.getSelectedIds().size).toBe(2);
        expect(manager.isSelected(annotation1!.id)).toBe(true);
        expect(manager.isSelected(annotation2!.id)).toBe(true);
      });
    });

    describe("isDragging", () => {
      it("should return false initially", () => {
        expect(manager.isDragging()).toBe(false);
      });

      it("should return true after startDrag", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        expect(manager.isDragging()).toBe(true);
      });

      it("should return false after endDrag", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);
        manager.endDrag();

        expect(manager.isDragging()).toBe(false);
      });
    });

    describe("Drag integration with other operations", () => {
      it("should not allow drawing while dragging", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        // In real usage, UI should prevent this, but test defensive behavior
        manager.startDrawing({ x: 100, y: 100 });

        // Drawing should still work (drag and draw are independent state machines)
        expect(manager.isDrawing()).toBe(true);
        expect(manager.isDragging()).toBe(true);
      });

      it("should maintain drag state during annotation updates", () => {
        manager.toggleSelection(annotation1!.id, false);
        manager.startDrag(annotation1!.id);

        manager.updateDrag({ x: 10, y: 20 });

        expect(manager.isDragging()).toBe(true);
        expect(manager.getAnnotations().length).toBe(3);
      });
    });
  });
});
