/**
 * Zustand store for video metadata and session state.
 *
 * Manages uploaded video metadata, blob references, and session identifiers
 * for dual-video synchronization workflow.
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { create } from 'zustand';
import type { VideoMetadata } from '../types/api';

/**
 * Video state including metadata and blob reference.
 */
export interface VideoState {
  metadata: VideoMetadata | null;
  blob: Blob | null;
}

/**
 * Video store state and actions.
 */
interface VideoStoreState {
  // Session identifier (shared across both videos)
  sessionId: string | null;

  // Video A state
  videoA: VideoState | null;

  // Video B state
  videoB: VideoState | null;

  // Upload progress tracking
  uploadingVideoA: boolean;
  uploadingVideoB: boolean;

  // Flag set during save-to-library transitions to prevent the video change
  // detection effect from resetting sync/trim state.
  isSavingToLibrary: boolean;

  // Actions
  setSessionId: (sessionId: string) => void;
  setVideoA: (video: VideoState | null) => void;
  setVideoB: (video: VideoState | null) => void;
  setUploadingVideoA: (uploading: boolean) => void;
  setUploadingVideoB: (uploading: boolean) => void;
  setSavingToLibrary: (saving: boolean) => void;
  reset: () => void;
}

/**
 * Initial store state.
 */
const initialState = {
  sessionId: null,
  videoA: null,
  videoB: null,
  uploadingVideoA: false,
  uploadingVideoB: false,
  isSavingToLibrary: false,
};

/**
 * Video store for managing video metadata and session state.
 */
export const useVideoStore = create<VideoStoreState>((set) => ({
  ...initialState,

  setSessionId: (sessionId) => set({ sessionId }),

  setVideoA: (video) => set({ videoA: video }),

  setVideoB: (video) => set({ videoB: video }),

  setUploadingVideoA: (uploading) => set({ uploadingVideoA: uploading }),

  setUploadingVideoB: (uploading) => set({ uploadingVideoB: uploading }),

  setSavingToLibrary: (saving) => set({ isSavingToLibrary: saving }),

  /**
   * Reset store to initial state.
   *
   * **Use Case**: Called when user starts new session or navigates away from app.
   *
   * **Side Effects**:
   * - Clears all cached video metadata and blob references
   * - Resets session ID and upload progress
   * - May cause memory leaks if blobs are not garbage collected
   *
   * **Integration**: Should be called from App component unmount or session reset handler.
   */
  reset: () => set({ ...initialState }),
}));
