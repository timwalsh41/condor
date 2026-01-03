/**
 * Zustand store for video annotations state.
 *
 * Manages annotations per video, selected annotation, and active tool
 * for dual-video annotation workflow.
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { create } from 'zustand';
import type { Annotation, AnnotationType } from '../types/annotations';

/**
 * Annotation store state and actions.
 */
interface AnnotationStoreState {
  // Annotations for video A (indexed by frame number)
  annotationsA: Map<number, Annotation[]>;

  // Annotations for video B (indexed by frame number)
  annotationsB: Map<number, Annotation[]>;

  // Currently selected annotation ID (for editing)
  selectedAnnotationId: string | null;

  // Active video slot for annotation ('A' | 'B')
  activeVideoSlot: 'A' | 'B' | null;

  // Active annotation tool
  activeTool: AnnotationType;

  // Actions
  setAnnotationsA: (annotations: Map<number, Annotation[]>) => void;
  setAnnotationsB: (annotations: Map<number, Annotation[]>) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  setActiveVideoSlot: (slot: 'A' | 'B' | null) => void;
  setActiveTool: (tool: AnnotationType) => void;
  reset: () => void;
}

/**
 * Initial store state.
 */
const initialState = {
  annotationsA: new Map<number, Annotation[]>(),
  annotationsB: new Map<number, Annotation[]>(),
  selectedAnnotationId: null,
  activeVideoSlot: null,
  activeTool: 'select' as AnnotationType,
};

/**
 * Annotation store for managing video annotations state.
 */
export const useAnnotationStore = create<AnnotationStoreState>((set) => ({
  ...initialState,

  setAnnotationsA: (annotations) => set({ annotationsA: annotations }),

  setAnnotationsB: (annotations) => set({ annotationsB: annotations }),

  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),

  setActiveVideoSlot: (slot) => set({ activeVideoSlot: slot }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  /**
   * Reset store to initial state.
   *
   * **Use Case**: Called when user starts new session or clears all annotations.
   *
   * **Side Effects**:
   * - Clears all annotations for both videos
   * - Resets selected annotation and active video slot
   * - Resets active tool to 'select'
   *
   * **Integration**: Should be called when loading new videos or clearing annotation state.
   */
  reset: () => set(initialState),
}));
