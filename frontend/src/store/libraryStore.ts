/**
 * Zustand store for the video library.
 *
 * Manages library video list, loading state, and editing state.
 *
 * Phase 2, Task 2.7 (Video Library Frontend Workflows)
 */

import { create } from 'zustand';
import type { LibraryVideo, LibraryVideoCreate, LibraryVideoUpdate } from '../types/api';
import {
  listLibraryVideos,
  addToLibrary,
  updateLibraryVideo,
  deleteLibraryVideo,
} from '../services/api';

/**
 * Library store state and actions.
 */
interface LibraryStoreState {
  /** All library videos, newest first. */
  videos: LibraryVideo[];
  /** Whether the list is being fetched. */
  loading: boolean;
  /** Error message from the last operation, or null. */
  error: string | null;

  // Actions
  /** Fetch the library list from the backend and update state. */
  fetchVideos: () => Promise<void>;
  /** Add a video to the library. */
  addVideo: (payload: LibraryVideoCreate) => Promise<LibraryVideo>;
  /** Update library video metadata. */
  updateVideo: (videoId: string, updates: LibraryVideoUpdate) => Promise<void>;
  /** Delete a library video. */
  removeVideo: (videoId: string) => Promise<void>;
  /** Check if a video is in the library by ID. */
  isVideoInLibrary: (videoId: string) => boolean;
  /** Clear any stored error. */
  clearError: () => void;
}

export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  videos: [],
  loading: false,
  error: null,

  fetchVideos: async () => {
    set({ loading: true, error: null });
    try {
      const videos = await listLibraryVideos();
      set({ videos, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load library';
      set({ error: message, loading: false });
    }
  },

  addVideo: async (payload: LibraryVideoCreate) => {
    set({ error: null });
    const video = await addToLibrary(payload);
    set((state) => ({ videos: [video, ...state.videos] }));
    return video;
  },

  updateVideo: async (videoId: string, updates: LibraryVideoUpdate) => {
    set({ error: null });
    const updated = await updateLibraryVideo(videoId, updates);
    set((state) => ({
      videos: state.videos.map((v) => (v.id === videoId ? updated : v)),
    }));
  },

  removeVideo: async (videoId: string) => {
    set({ error: null });
    await deleteLibraryVideo(videoId);
    set((state) => ({
      videos: state.videos.filter((v) => v.id !== videoId),
    }));
  },

  isVideoInLibrary: (videoId: string) => {
    return get().videos.some((v) => v.id === videoId);
  },

  clearError: () => set({ error: null }),
}));
