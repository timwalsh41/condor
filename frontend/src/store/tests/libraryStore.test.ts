/**
 * Unit tests for libraryStore.
 *
 * Tests the library management functionality including:
 * - isVideoInLibrary helper function
 * - Video CRUD operations
 * - State management
 *
 * Phase 2, Bug Fix Set 2, Task 2.3 (Library Video Save Button State)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLibraryStore } from '../libraryStore';
import type { LibraryVideo, LibraryVideoCreate } from '../../types/api';
import * as api from '../../services/api';

vi.mock('../../services/api');

const mockVideoA: LibraryVideo = {
  id: 'library-uuid-a',
  filename: 'swing_a.mp4',
  framerate: 30,
  duration: 5.0,
  width: 1920,
  height: 1080,
  codec: 'h264',
  gop_size: 30,
  golfer_name: 'John Doe',
  club: 'Driver',
  swing_date: '2026-03-11',
  notes: 'Test swing',
  quality_score: 8,
  camera_view: 'DTL',
  created_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
};

const mockVideoB: LibraryVideo = {
  id: 'library-uuid-b',
  filename: 'swing_b.mp4',
  framerate: 60,
  duration: 4.5,
  width: 1280,
  height: 720,
  codec: 'h264',
  gop_size: 60,
  golfer_name: null,
  club: null,
  swing_date: null,
  notes: null,
  quality_score: null,
  camera_view: null,
  created_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
};

describe('libraryStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const store = useLibraryStore.getState();
    store.videos = [];
    store.loading = false;
    store.error = null;
    vi.clearAllMocks();
  });

  describe('isVideoInLibrary', () => {
    it('returns true when video ID exists in library', () => {
      // Arrange: Set up store with videos
      useLibraryStore.setState({ videos: [mockVideoA, mockVideoB] });

      // Act & Assert
      const { isVideoInLibrary } = useLibraryStore.getState();
      expect(isVideoInLibrary('library-uuid-a')).toBe(true);
      expect(isVideoInLibrary('library-uuid-b')).toBe(true);
    });

    it('returns false when video ID does not exist in library', () => {
      // Arrange: Set up store with one video
      useLibraryStore.setState({ videos: [mockVideoA] });

      // Act & Assert
      const { isVideoInLibrary } = useLibraryStore.getState();
      expect(isVideoInLibrary('non-existent-id')).toBe(false);
      expect(isVideoInLibrary('library-uuid-b')).toBe(false);
    });

    it('returns false when library is empty', () => {
      // Arrange: Empty store
      useLibraryStore.setState({ videos: [] });

      // Act & Assert
      const { isVideoInLibrary } = useLibraryStore.getState();
      expect(isVideoInLibrary('any-id')).toBe(false);
    });

    it('correctly handles partial ID matches', () => {
      // Arrange: Set up store with video
      useLibraryStore.setState({ videos: [mockVideoA] });

      // Act & Assert
      const { isVideoInLibrary } = useLibraryStore.getState();
      // Should not match partial strings
      expect(isVideoInLibrary('library')).toBe(false);
      expect(isVideoInLibrary('uuid-a')).toBe(false);
      expect(isVideoInLibrary('library-uuid')).toBe(false);
      // Should match exact ID
      expect(isVideoInLibrary('library-uuid-a')).toBe(true);
    });
  });

  describe('fetchVideos', () => {
    it('loads videos from API and updates state', async () => {
      // Arrange
      vi.mocked(api.listLibraryVideos).mockResolvedValue([mockVideoA, mockVideoB]);

      // Act
      const { fetchVideos } = useLibraryStore.getState();
      await fetchVideos();

      // Assert
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(2);
      expect(state.videos[0]).toEqual(mockVideoA);
      expect(state.videos[1]).toEqual(mockVideoB);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('handles fetch errors', async () => {
      // Arrange
      vi.mocked(api.listLibraryVideos).mockRejectedValue(new Error('Network error'));

      // Act
      const { fetchVideos } = useLibraryStore.getState();
      await fetchVideos();

      // Assert
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('sets loading state during fetch', async () => {
      // Arrange
      let resolvePromise: (value: LibraryVideo[]) => void;
      const pendingPromise = new Promise<LibraryVideo[]>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(api.listLibraryVideos).mockReturnValue(pendingPromise);

      // Act
      const { fetchVideos } = useLibraryStore.getState();
      const fetchPromise = fetchVideos();

      // Assert: loading should be true while fetch is pending
      expect(useLibraryStore.getState().loading).toBe(true);

      // Resolve the promise
      resolvePromise!([mockVideoA]);
      await fetchPromise;

      // Assert: loading should be false after fetch completes
      expect(useLibraryStore.getState().loading).toBe(false);
    });
  });

  describe('addVideo', () => {
    it('adds new video to library and updates state', async () => {
      // Arrange
      const newVideo: LibraryVideoCreate = {
        video_id: 'upload-uuid-123',
        golfer_name: 'Test Golfer',
        club: '5 Iron',
        swing_date: '2026-03-12',
        notes: 'New swing',
        quality_score: 9,
        camera_view: 'FO',
      };
      vi.mocked(api.addToLibrary).mockResolvedValue(mockVideoA);

      // Act
      const { addVideo } = useLibraryStore.getState();
      const result = await addVideo(newVideo);

      // Assert
      expect(result).toEqual(mockVideoA);
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(1);
      expect(state.videos[0]).toEqual(mockVideoA);
      expect(api.addToLibrary).toHaveBeenCalledWith(newVideo);
    });

    it('prepends new video to the list', async () => {
      // Arrange: Start with one video
      useLibraryStore.setState({ videos: [mockVideoB] });
      const newVideo: LibraryVideoCreate = {
        video_id: 'upload-uuid-123',
        golfer_name: null,
        club: null,
        swing_date: null,
        notes: null,
        quality_score: null,
        camera_view: null,
      };
      vi.mocked(api.addToLibrary).mockResolvedValue(mockVideoA);

      // Act
      const { addVideo } = useLibraryStore.getState();
      await addVideo(newVideo);

      // Assert: New video should be first in the list
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(2);
      expect(state.videos[0]).toEqual(mockVideoA);
      expect(state.videos[1]).toEqual(mockVideoB);
    });

    it('handles add errors', async () => {
      // Arrange
      const newVideo: LibraryVideoCreate = {
        video_id: 'upload-uuid-123',
        golfer_name: null,
        club: null,
        swing_date: null,
        notes: null,
        quality_score: null,
        camera_view: null,
      };
      vi.mocked(api.addToLibrary).mockRejectedValue(new Error('Duplicate video'));

      // Act & Assert
      const { addVideo } = useLibraryStore.getState();
      await expect(addVideo(newVideo)).rejects.toThrow('Duplicate video');
      
      // State should not be updated on error
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(0);
      expect(state.error).toBeNull(); // addVideo clears error before calling API
    });
  });

  describe('updateVideo', () => {
    it('updates video metadata in state', async () => {
      // Arrange
      useLibraryStore.setState({ videos: [mockVideoA, mockVideoB] });
      const updates = { golfer_name: 'Updated Name', quality_score: 10 };
      const updatedVideo = { ...mockVideoA, ...updates };
      vi.mocked(api.updateLibraryVideo).mockResolvedValue(updatedVideo);

      // Act
      const { updateVideo } = useLibraryStore.getState();
      await updateVideo('library-uuid-a', updates);

      // Assert
      const state = useLibraryStore.getState();
      expect(state.videos[0].golfer_name).toBe('Updated Name');
      expect(state.videos[0].quality_score).toBe(10);
      // Other video should be unchanged
      expect(state.videos[1]).toEqual(mockVideoB);
    });

    it('handles update errors', async () => {
      // Arrange
      useLibraryStore.setState({ videos: [mockVideoA] });
      vi.mocked(api.updateLibraryVideo).mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      const { updateVideo } = useLibraryStore.getState();
      await expect(updateVideo('library-uuid-a', { golfer_name: 'New' })).rejects.toThrow('Update failed');
      
      // Original video should still be in state
      const state = useLibraryStore.getState();
      expect(state.videos[0]).toEqual(mockVideoA);
    });
  });

  describe('removeVideo', () => {
    it('removes video from state', async () => {
      // Arrange
      useLibraryStore.setState({ videos: [mockVideoA, mockVideoB] });
      vi.mocked(api.deleteLibraryVideo).mockResolvedValue(undefined);

      // Act
      const { removeVideo } = useLibraryStore.getState();
      await removeVideo('library-uuid-a');

      // Assert
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(1);
      expect(state.videos[0]).toEqual(mockVideoB);
    });

    it('handles non-existent video removal gracefully', async () => {
      // Arrange
      useLibraryStore.setState({ videos: [mockVideoA] });
      vi.mocked(api.deleteLibraryVideo).mockResolvedValue(undefined);

      // Act
      const { removeVideo } = useLibraryStore.getState();
      await removeVideo('non-existent-id');

      // Assert: Original video should still be there
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(1);
      expect(state.videos[0]).toEqual(mockVideoA);
    });

    it('handles remove errors', async () => {
      // Arrange
      useLibraryStore.setState({ videos: [mockVideoA] });
      vi.mocked(api.deleteLibraryVideo).mockRejectedValue(new Error('Delete failed'));

      // Act & Assert
      const { removeVideo } = useLibraryStore.getState();
      await expect(removeVideo('library-uuid-a')).rejects.toThrow('Delete failed');
      
      // Video should still be in state on error
      const state = useLibraryStore.getState();
      expect(state.videos).toHaveLength(1);
      expect(state.videos[0]).toEqual(mockVideoA);
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      // Arrange
      useLibraryStore.setState({ error: 'Some error' });

      // Act
      const { clearError } = useLibraryStore.getState();
      clearError();

      // Assert
      const state = useLibraryStore.getState();
      expect(state.error).toBeNull();
    });
  });
});
