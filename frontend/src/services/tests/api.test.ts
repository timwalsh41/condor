/**
 * Unit tests for API client service.
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VideoMetadata, UploadStatus } from '../../types/api';

// Mock axios before importing the API module
const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      get: mockGet,
    })),
    isAxiosError: vi.fn(),
  },
}));

// Import after mocking
const { uploadVideo, getUploadStatus, getStreamingVideoUrl, fetchVideoBlob, ApiError } = await import('../api');
const axios = await import('axios');

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockReset();
    mockGet.mockReset();
  });

  describe('uploadVideo', () => {
    it('should upload video successfully', async () => {
      const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      const mockResponse: VideoMetadata = {
        video_id: 'video-123',
        session_id: 'session-123',
        filename: 'test.mp4',
        framerate: 30,
        duration: 10.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await uploadVideo(mockFile);

      expect(result).toEqual(mockResponse);
    });

    it('should upload video with session ID and rotation', async () => {
      const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      const mockResponse: VideoMetadata = {
        video_id: 'video-123',
        session_id: 'session-456',
        filename: 'test.mp4',
        framerate: 30,
        duration: 10.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      await uploadVideo(mockFile, 'session-456', 90);

      expect(mockPost).toHaveBeenCalled();
      const formData = mockPost.mock.calls[0][1] as FormData;
      expect(formData.get('session_id')).toBe('session-456');
      expect(formData.get('rotation')).toBe('90');
    });

    it('should throw ApiError on upload failure', async () => {
      const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });

      mockPost.mockRejectedValue({
        response: {
          status: 400,
          data: { detail: 'Invalid file type' },
        },
        isAxiosError: true,
      });

      (axios.default.isAxiosError as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await expect(uploadVideo(mockFile)).rejects.toThrow(ApiError);
      await expect(uploadVideo(mockFile)).rejects.toThrow('Invalid file type');
    });
  });

  describe('getUploadStatus', () => {
    it('should get upload status successfully', async () => {
      const mockResponse: UploadStatus = {
        video_id: 'video-123',
        status: 'complete',
        progress: 1.0,
        error_message: null,
        metadata: {
          video_id: 'video-123',
          session_id: 'session-123',
          filename: 'test.mp4',
          framerate: 30,
          duration: 10.0,
          width: 1920,
          height: 1080,
          codec: 'h264',
          gop_size: 30,
        },
      };

      mockGet.mockResolvedValue({ data: mockResponse });

      const result = await getUploadStatus('video-123');

      expect(result).toEqual(mockResponse);
    });

    it('should throw ApiError when video not found', async () => {
      mockGet.mockRejectedValue({
        response: {
          status: 404,
          data: { detail: 'Video not found' },
        },
        isAxiosError: true,
      });

      (axios.default.isAxiosError as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await expect(getUploadStatus('invalid-id')).rejects.toThrow(ApiError);
      await expect(getUploadStatus('invalid-id')).rejects.toThrow('Video not found');
    });
  });

  describe('getStreamingVideoUrl', () => {
    it('should generate correct streaming URL', () => {
      const url = getStreamingVideoUrl('session-123', 'video-456');
      expect(url).toBe('/api/video/session-123/video-456');
    });
  });

  describe('fetchVideoBlob', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch video blob successfully', async () => {
      const mockBlob = new Blob(['test'], { type: 'video/mp4' });
      const mockResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await fetchVideoBlob('session-123', 'video-456');

      expect(result).toBe(mockBlob);
      expect(global.fetch).toHaveBeenCalledWith('/api/video/session-123/video-456');
    });

    it('should throw ApiError when video not found', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      await expect(fetchVideoBlob('session-123', 'invalid-id')).rejects.toThrow(ApiError);
      await expect(fetchVideoBlob('session-123', 'invalid-id')).rejects.toThrow('Failed to fetch video: Not Found');
    });

    it('should throw ApiError on network error', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await expect(fetchVideoBlob('session-123', 'video-456')).rejects.toThrow(ApiError);
      await expect(fetchVideoBlob('session-123', 'video-456')).rejects.toThrow('Failed to fetch video blob');
    });
  });
});
