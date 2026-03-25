/**
 * Unit tests for AddToLibraryPanel component.
 *
 * Tests the key behavior added in Bug 2 fix: after a successful "Add to Library"
 * save, the videoStore metadata.video_id is updated to the library_videos.id
 * returned by the backend.  Without this update, subsequent "Save Session" calls
 * would use the upload-session UUID (not a library FK), causing a 500 error.
 *
 * Phase 2, Bug Fix Set 1, Bug 2 (Save Analysis Fails with HTTP 500)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddToLibraryPanel } from '../AddToLibraryPanel';
import { useVideoStore } from '../../store/videoStore';
import { useLibraryStore } from '../../store/libraryStore';
import type { LibraryVideo, VideoMetadata } from '../../types/api';

vi.mock('../../store/videoStore');
vi.mock('../../store/libraryStore');

// Shared test fixtures
const uploadMetadataA: VideoMetadata = {
  video_id: 'upload-uuid-a',
  session_id: 'session-1',
  filename: 'swing_a.mp4',
  framerate: 30,
  duration: 5.0,
  width: 1920,
  height: 1080,
  codec: 'h264',
  gop_size: 30,
};

const uploadMetadataB: VideoMetadata = {
  video_id: 'upload-uuid-b',
  session_id: 'session-1',
  filename: 'swing_b.mp4',
  framerate: 60,
  duration: 4.5,
  width: 1280,
  height: 720,
  codec: 'h264',
  gop_size: 60,
};

const libraryVideoA: LibraryVideo = {
  id: 'library-uuid-a',
  filename: 'swing_a.mp4',
  framerate: 30,
  duration: 5.0,
  width: 1920,
  height: 1080,
  codec: 'h264',
  gop_size: 30,
  golfer_name: null,
  club: null,
  swing_date: null,
  notes: null,
  quality_score: null,
  created_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
};

const libraryVideoB: LibraryVideo = {
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
  created_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
};

describe('AddToLibraryPanel', () => {
  const mockSetVideoA = vi.fn();
  const mockSetVideoB = vi.fn();
  const mockAddVideo = vi.fn();
  const mockIsVideoInLibrary = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsVideoInLibrary.mockReturnValue(false);
  });

  describe('Video ID update after successful save', () => {
    it('updates videoStore video_id to library id after saving slot A', async () => {
      // Slot A has an upload-session UUID; addVideo returns the library record
      vi.mocked(useVideoStore).mockReturnValue({
        videoA: { metadata: uploadMetadataA, blob: new Blob() },
        videoB: null,
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      mockAddVideo.mockResolvedValue(libraryVideoA);
      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [],
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: mockIsVideoInLibrary,
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      // Open the save modal for slot A
      fireEvent.click(screen.getByRole('button', { name: /video a/i }));

      // Submit without filling optional fields
      fireEvent.click(screen.getByRole('button', { name: /save to library/i }));

      await waitFor(() => {
        expect(mockAddVideo).toHaveBeenCalledWith(
          expect.objectContaining({ video_id: 'upload-uuid-a' })
        );
        // setVideoA should receive metadata with the library_videos.id, not the upload UUID
        expect(mockSetVideoA).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({ video_id: 'library-uuid-a' }),
          })
        );
      });

      // The B slot store setter should not be touched
      expect(mockSetVideoB).not.toHaveBeenCalled();
    });

    it('updates videoStore video_id to library id after saving slot B', async () => {
      vi.mocked(useVideoStore).mockReturnValue({
        videoA: null,
        videoB: { metadata: uploadMetadataB, blob: new Blob() },
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      mockAddVideo.mockResolvedValue(libraryVideoB);
      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [],
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: mockIsVideoInLibrary,
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      fireEvent.click(screen.getByRole('button', { name: /video b/i }));
      fireEvent.click(screen.getByRole('button', { name: /save to library/i }));

      await waitFor(() => {
        expect(mockSetVideoB).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({ video_id: 'library-uuid-b' }),
          })
        );
      });

      expect(mockSetVideoA).not.toHaveBeenCalled();
    });

    it('preserves all other metadata fields when updating video_id', async () => {
      vi.mocked(useVideoStore).mockReturnValue({
        videoA: { metadata: uploadMetadataA, blob: new Blob() },
        videoB: null,
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      mockAddVideo.mockResolvedValue(libraryVideoA);
      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [],
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: mockIsVideoInLibrary,
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      fireEvent.click(screen.getByRole('button', { name: /video a/i }));
      fireEvent.click(screen.getByRole('button', { name: /save to library/i }));

      await waitFor(() => {
        expect(mockSetVideoA).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              video_id: 'library-uuid-a',   // updated
              session_id: 'session-1',       // preserved
              filename: 'swing_a.mp4',       // preserved
              framerate: 30,                 // preserved
              width: 1920,                   // preserved
              height: 1080,                  // preserved
            }),
          })
        );
      });
    });
  });

  describe('Error handling', () => {
    it('does not update videoStore when addVideo fails', async () => {
      vi.mocked(useVideoStore).mockReturnValue({
        videoA: { metadata: uploadMetadataA, blob: new Blob() },
        videoB: null,
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      mockAddVideo.mockRejectedValue(new Error('Network error'));
      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [],
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: mockIsVideoInLibrary,
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      fireEvent.click(screen.getByRole('button', { name: /video a/i }));
      fireEvent.click(screen.getByRole('button', { name: /save to library/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeTruthy();
      });

      // Store setters should not be called on failure
      expect(mockSetVideoA).not.toHaveBeenCalled();
      expect(mockSetVideoB).not.toHaveBeenCalled();
    });
  });

  describe('Rendering', () => {
    it('does not render when no videos are loaded', () => {
      vi.mocked(useVideoStore).mockReturnValue({
        videoA: null,
        videoB: null,
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [],
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: mockIsVideoInLibrary,
        clearError: vi.fn(),
      });

      const { container } = render(<AddToLibraryPanel />);
      expect(container.firstChild).toBeNull();
    });

    it('shows save button only for loaded video slots', () => {
      vi.mocked(useVideoStore).mockReturnValue({
        videoA: { metadata: uploadMetadataA, blob: new Blob() },
        videoB: null,
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [],
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: mockIsVideoInLibrary,
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      expect(screen.getByRole('button', { name: /video a/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /video b/i })).toBeNull();
    });
  });

  describe('Library video save button state', () => {
    it('disables save button and shows "saved" when video is already in library', async () => {
      // Create metadata for a video loaded from library (has library ID as video_id)
      const libraryMetadataA: VideoMetadata = {
        video_id: 'library-uuid-a', // This matches libraryVideoA.id
        session_id: 'session-1',
        filename: 'swing_a.mp4',
        framerate: 30,
        duration: 5.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
      };

      vi.mocked(useVideoStore).mockReturnValue({
        videoA: { metadata: libraryMetadataA, blob: new Blob() },
        videoB: null,
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [libraryVideoA], // Video A is in library
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: vi.fn(),
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      // Wait for useEffect to run and update savedSlots state
      await waitFor(() => {
        // Button should show "saved" and be disabled
        const button = screen.getByText(/✓ Video A saved/);
        expect(button).toBeTruthy();
        expect(button.hasAttribute('disabled')).toBe(true);
      });
    });

    it('shows enabled "+ Video A" button when video is not in library', () => {
      vi.mocked(useVideoStore).mockReturnValue({
        videoA: { metadata: uploadMetadataA, blob: new Blob() },
        videoB: null,
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [], // Empty library
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: vi.fn(),
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      // Button should show "+ Video A" and be enabled
      const button = screen.getByText(/＋ Video A/);
      expect(button).toBeTruthy();
      expect(button.hasAttribute('disabled')).toBe(false);
    });

    it('correctly handles both slots with mixed library status', async () => {
      // Create metadata for video loaded from library and video not in library
      const libraryMetadataA: VideoMetadata = {
        video_id: 'library-uuid-a', // This matches libraryVideoA.id
        session_id: 'session-1',
        filename: 'swing_a.mp4',
        framerate: 30,
        duration: 5.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
      };

      vi.mocked(useVideoStore).mockReturnValue({
        videoA: { metadata: libraryMetadataA, blob: new Blob() },
        videoB: { metadata: uploadMetadataB, blob: new Blob() },
        setVideoA: mockSetVideoA,
        setVideoB: mockSetVideoB,
      } as ReturnType<typeof useVideoStore>);

      vi.mocked(useLibraryStore).mockReturnValue({
        addVideo: mockAddVideo,
        videos: [libraryVideoA], // Only video A is in library
        loading: false,
        error: null,
        fetchVideos: vi.fn(),
        updateVideo: vi.fn(),
        removeVideo: vi.fn(),
        isVideoInLibrary: vi.fn(),
        clearError: vi.fn(),
      });

      render(<AddToLibraryPanel />);

      // Wait for useEffect to run and update savedSlots state
      await waitFor(() => {
        // Video A button should be disabled and show "saved"
        const buttonA = screen.getByText(/✓ Video A saved/);
        expect(buttonA).toBeTruthy();
        expect(buttonA.hasAttribute('disabled')).toBe(true);
      });

      // Video B button should be enabled and show "+"
      const buttonB = screen.getByText(/＋ Video B/);
      expect(buttonB).toBeTruthy();
      expect(buttonB.hasAttribute('disabled')).toBe(false);
    });
  });

});
