/**
 * Unit tests for annotationStore (Zustand store for video annotations state).
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnotationStore } from '../annotationStore';
import type { Annotation } from '../../utils/types';

describe('annotationStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAnnotationStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have empty annotations for video A initially', () => {
      const { annotationsA } = useAnnotationStore.getState();
      expect(annotationsA.size).toBe(0);
    });

    it('should have empty annotations for video B initially', () => {
      const { annotationsB } = useAnnotationStore.getState();
      expect(annotationsB.size).toBe(0);
    });

    it('should have null selected annotation ID initially', () => {
      const { selectedAnnotationId } = useAnnotationStore.getState();
      expect(selectedAnnotationId).toBeNull();
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
      const mockAnnotations = new Map<number, Annotation[]>();
      const annotation: Annotation = {
        id: 'annotation-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        color: '#ff0000',
      };
      mockAnnotations.set(10, [annotation]);

      useAnnotationStore.getState().setAnnotationsA(mockAnnotations);

      const { annotationsA } = useAnnotationStore.getState();
      expect(annotationsA.size).toBe(1);
      expect(annotationsA.get(10)).toEqual([annotation]);
    });

    it('should update annotations for video A', () => {
      const mockAnnotations1 = new Map<number, Annotation[]>();
      mockAnnotations1.set(10, [
        { id: 'a1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, color: '#ff0000' },
      ]);

      const mockAnnotations2 = new Map<number, Annotation[]>();
      mockAnnotations2.set(20, [
        { id: 'a2', type: 'circle', x: 50, y: 50, radius: 25, color: '#00ff00' },
      ]);

      useAnnotationStore.getState().setAnnotationsA(mockAnnotations1);
      useAnnotationStore.getState().setAnnotationsA(mockAnnotations2);

      const { annotationsA } = useAnnotationStore.getState();
      expect(annotationsA.size).toBe(1);
      expect(annotationsA.get(20)).toBeDefined();
      expect(annotationsA.get(10)).toBeUndefined();
    });
  });

  describe('Annotations B Management', () => {
    it('should set annotations for video B', () => {
      const mockAnnotations = new Map<number, Annotation[]>();
      const annotation: Annotation = {
        id: 'annotation-2',
        type: 'circle',
        x: 150,
        y: 150,
        radius: 50,
        color: '#00ff00',
      };
      mockAnnotations.set(20, [annotation]);

      useAnnotationStore.getState().setAnnotationsB(mockAnnotations);

      const { annotationsB } = useAnnotationStore.getState();
      expect(annotationsB.size).toBe(1);
      expect(annotationsB.get(20)).toEqual([annotation]);
    });
  });

  describe('Selected Annotation Management', () => {
    it('should set selected annotation ID', () => {
      useAnnotationStore.getState().setSelectedAnnotationId('annotation-123');

      const { selectedAnnotationId } = useAnnotationStore.getState();
      expect(selectedAnnotationId).toBe('annotation-123');
    });

    it('should clear selected annotation ID', () => {
      useAnnotationStore.getState().setSelectedAnnotationId('annotation-123');
      useAnnotationStore.getState().setSelectedAnnotationId(null);

      const { selectedAnnotationId } = useAnnotationStore.getState();
      expect(selectedAnnotationId).toBeNull();
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
      const mockAnnotations = new Map<number, Annotation[]>();
      mockAnnotations.set(10, [
        { id: 'a1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, color: '#ff0000' },
      ]);

      useAnnotationStore.getState().setAnnotationsA(mockAnnotations);
      useAnnotationStore.getState().setSelectedAnnotationId('annotation-123');
      useAnnotationStore.getState().setActiveVideoSlot('A');
      useAnnotationStore.getState().setActiveTool('freehand');

      // Reset
      useAnnotationStore.getState().reset();

      // Verify reset
      const state = useAnnotationStore.getState();
      expect(state.annotationsA.size).toBe(0);
      expect(state.annotationsB.size).toBe(0);
      expect(state.selectedAnnotationId).toBeNull();
      expect(state.activeVideoSlot).toBeNull();
      expect(state.activeTool).toBe('select');
    });
  });
});
