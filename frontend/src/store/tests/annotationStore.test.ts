/**
 * Unit tests for annotationStore (Zustand store for video annotations state).
 *
 * Phase: Phase 1 Task 1.3 (DualVideoSyncDemo Backend Integration)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnotationStore } from '../annotationStore';
import type { Annotation } from '../../types/annotations';

describe('annotationStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAnnotationStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have empty annotations for video A initially', () => {
      const { annotationsA } = useAnnotationStore.getState();
      expect(annotationsA).toEqual([]);
      expect(annotationsA.length).toBe(0);
    });

    it('should have empty annotations for video B initially', () => {
      const { annotationsB } = useAnnotationStore.getState();
      expect(annotationsB).toEqual([]);
      expect(annotationsB.length).toBe(0);
    });

    it('should have empty selected annotation IDs initially', () => {
      const { selectedAnnotationIds } = useAnnotationStore.getState();
      expect(selectedAnnotationIds.size).toBe(0);
    });

    it('should have null active video slot initially', () => {
      const { activeVideoSlot } = useAnnotationStore.getState();
      expect(activeVideoSlot).toBeNull();
    });

    it('should have select tool active initially', () => {
      const { activeTool } = useAnnotationStore.getState();
      expect(activeTool).toBe('select');
    });
  });

  describe('Annotations A Management', () => {
    it('should set annotations for video A', () => {
      const annotation: Annotation = {
        id: 'annotation-1',
        type: 'freehand',
        points: [
          { x: 100, y: 100 },
          { x: 150, y: 150 },
        ],
        color: '#ff0000',
        strokeWidth: 6,
      };

      useAnnotationStore.getState().setAnnotationsA([annotation]);

      const { annotationsA } = useAnnotationStore.getState();
      expect(annotationsA.length).toBe(1);
      expect(annotationsA[0]).toEqual(annotation);
    });

    it('should update annotations for video A', () => {
      const annotation1: Annotation = {
        id: 'a1',
        type: 'polyline',
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        color: '#ff0000',
        strokeWidth: 6,
      };

      const annotation2: Annotation = {
        id: 'a2',
        type: 'oval',
        points: [{ x: 50, y: 50 }, { x: 100, y: 100 }],
        color: '#00ff00',
        strokeWidth: 6,
      };

      useAnnotationStore.getState().setAnnotationsA([annotation1]);
      useAnnotationStore.getState().setAnnotationsA([annotation2]);

      const { annotationsA } = useAnnotationStore.getState();
      expect(annotationsA.length).toBe(1);
      expect(annotationsA[0]).toEqual(annotation2);
    });

    it('should support multiple annotations for video A', () => {
      const annotations: Annotation[] = [
        {
          id: 'a1',
          type: 'freehand',
          points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
          color: '#ff0000',
          strokeWidth: 6,
        },
        {
          id: 'a2',
          type: 'arrow',
          points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
          color: '#ff0000',
          strokeWidth: 6,
        },
      ];

      useAnnotationStore.getState().setAnnotationsA(annotations);

      const { annotationsA } = useAnnotationStore.getState();
      expect(annotationsA.length).toBe(2);
      expect(annotationsA).toEqual(annotations);
    });
  });

  describe('Annotations B Management', () => {
    it('should set annotations for video B', () => {
      const annotation: Annotation = {
        id: 'annotation-2',
        type: 'oval',
        points: [{ x: 150, y: 150 }, { x: 200, y: 200 }],
        color: '#00ff00',
        strokeWidth: 6,
      };

      useAnnotationStore.getState().setAnnotationsB([annotation]);

      const { annotationsB } = useAnnotationStore.getState();
      expect(annotationsB.length).toBe(1);
      expect(annotationsB[0]).toEqual(annotation);
    });

    it('should keep annotations A and B independent', () => {
      const annotationA: Annotation = {
        id: 'a1',
        type: 'freehand',
        points: [{ x: 0, y: 0 }],
        color: '#ff0000',
        strokeWidth: 6,
      };

      const annotationB: Annotation = {
        id: 'b1',
        type: 'polyline',
        points: [{ x: 100, y: 100 }],
        color: '#00ff00',
        strokeWidth: 6,
      };

      useAnnotationStore.getState().setAnnotationsA([annotationA]);
      useAnnotationStore.getState().setAnnotationsB([annotationB]);

      const { annotationsA, annotationsB } = useAnnotationStore.getState();
      expect(annotationsA.length).toBe(1);
      expect(annotationsB.length).toBe(1);
      expect(annotationsA[0]).toEqual(annotationA);
      expect(annotationsB[0]).toEqual(annotationB);
    });
  });

  describe('Selected Annotation IDs Management', () => {
    it('should set selected annotation IDs', () => {
      const selectedIds = new Set(['annotation-1', 'annotation-2']);
      useAnnotationStore.getState().setSelectedAnnotationIds(selectedIds);

      const { selectedAnnotationIds } = useAnnotationStore.getState();
      expect(selectedAnnotationIds.size).toBe(2);
      expect(selectedAnnotationIds.has('annotation-1')).toBe(true);
      expect(selectedAnnotationIds.has('annotation-2')).toBe(true);
    });

    it('should clear selected annotation IDs', () => {
      useAnnotationStore.getState().setSelectedAnnotationIds(new Set(['annotation-1']));
      useAnnotationStore.getState().setSelectedAnnotationIds(new Set());

      const { selectedAnnotationIds } = useAnnotationStore.getState();
      expect(selectedAnnotationIds.size).toBe(0);
    });

    it('should support multi-select', () => {
      const selectedIds = new Set(['a1', 'a2', 'a3']);
      useAnnotationStore.getState().setSelectedAnnotationIds(selectedIds);

      const { selectedAnnotationIds } = useAnnotationStore.getState();
      expect(selectedAnnotationIds.size).toBe(3);
    });
  });

  describe('Active Video Slot Management', () => {
    it('should set active video slot to A', () => {
      useAnnotationStore.getState().setActiveVideoSlot('A');

      const { activeVideoSlot } = useAnnotationStore.getState();
      expect(activeVideoSlot).toBe('A');
    });

    it('should set active video slot to B', () => {
      useAnnotationStore.getState().setActiveVideoSlot('B');

      const { activeVideoSlot } = useAnnotationStore.getState();
      expect(activeVideoSlot).toBe('B');
    });

    it('should clear active video slot', () => {
      useAnnotationStore.getState().setActiveVideoSlot('A');
      useAnnotationStore.getState().setActiveVideoSlot(null);

      const { activeVideoSlot } = useAnnotationStore.getState();
      expect(activeVideoSlot).toBeNull();
    });
  });

  describe('Active Tool Management', () => {
    it('should set active tool to freehand', () => {
      useAnnotationStore.getState().setActiveTool('freehand');

      const { activeTool } = useAnnotationStore.getState();
      expect(activeTool).toBe('freehand');
    });

    it('should set active tool to polyline', () => {
      useAnnotationStore.getState().setActiveTool('polyline');

      const { activeTool } = useAnnotationStore.getState();
      expect(activeTool).toBe('polyline');
    });

    it('should set active tool to oval', () => {
      useAnnotationStore.getState().setActiveTool('oval');

      const { activeTool } = useAnnotationStore.getState();
      expect(activeTool).toBe('oval');
    });

    it('should set active tool to arrow', () => {
      useAnnotationStore.getState().setActiveTool('arrow');

      const { activeTool } = useAnnotationStore.getState();
      expect(activeTool).toBe('arrow');
    });
  });

  describe('Reset', () => {
    it('should reset store to initial state', () => {
      // Set some state
      const annotation: Annotation = {
        id: 'a1',
        type: 'freehand',
        points: [{ x: 0, y: 0 }],
        color: '#ff0000',
        strokeWidth: 6,
      };

      useAnnotationStore.getState().setAnnotationsA([annotation]);
      useAnnotationStore.getState().setSelectedAnnotationIds(new Set(['annotation-1']));
      useAnnotationStore.getState().setActiveVideoSlot('A');
      useAnnotationStore.getState().setActiveTool('freehand');

      // Reset
      useAnnotationStore.getState().reset();

      // Verify reset
      const state = useAnnotationStore.getState();
      expect(state.annotationsA).toEqual([]);
      expect(state.annotationsB).toEqual([]);
      expect(state.selectedAnnotationIds.size).toBe(0);
      expect(state.activeVideoSlot).toBeNull();
      expect(state.activeTool).toBe('select');
    });
  });
});
