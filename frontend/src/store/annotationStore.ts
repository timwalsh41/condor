/**
 * Zustand store for video annotations state.
 *
 * Manages annotations per video, selected annotation, and active tool
 * for dual-video annotation workflow.
 *
 * REQ-F-ANNOT-005: Static annotations (not time-based) - annotations appear on all frames
 *
 * Phase: Phase 1 Task 1.3 (DualVideoSyncDemo Backend Integration)
 */

import { create } from 'zustand';
import type { Annotation, AnnotationType } from '../types/annotations';

/**
 * Annotation store state and actions.
 */
interface AnnotationStoreState {
  // Annotations for video A (static - appear on all frames per REQ-F-ANNOT-005)
  annotationsA: Annotation[];

  // Annotations for video B (static - appear on all frames per REQ-F-ANNOT-005)
  annotationsB: Annotation[];

  // Currently selected annotation IDs (for editing - supports multi-select)
  selectedAnnotationIds: Set<string>;

  // Active video slot for annotation ('A' | 'B')
  activeVideoSlot: 'A' | 'B' | null;

  // Active annotation tool
  activeTool: AnnotationType;

  // Actions
  setAnnotationsA: (annotations: Annotation[]) => void;
  setAnnotationsB: (annotations: Annotation[]) => void;
  setSelectedAnnotationIds: (ids: Set<string>) => void;
  setActiveVideoSlot: (slot: 'A' | 'B' | null) => void;
  setActiveTool: (tool: AnnotationType) => void;
  reset: () => void;
}

/**
 * Initial store state.
 */
const initialState = {
  annotationsA: [],
  annotationsB: [],
  selectedAnnotationIds: new Set<string>(),
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

  setSelectedAnnotationIds: (ids) => set({ selectedAnnotationIds: ids }),

  setActiveVideoSlot: (slot) => set({ activeVideoSlot: slot }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  /**
   * Reset store to initial state.
   *
   * **Use Case**: Called when user starts new session or clears all annotations.
   *
   * **Side Effects**:
   * - Clears all annotations for both videos
   * - Resets selected annotations and active video slot
   * - Resets active tool to 'select'
   *
   * **Integration**: Should be called when loading new videos or clearing annotation state.
   */
  reset: () => set(initialState),
}));
