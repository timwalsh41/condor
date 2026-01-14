/**
 * Unit tests for VideoUploadWorkflow component.
 *
 * Tests business logic:
 * - File validation (size, type)
 * - Polling state machine (timeout, error handling, state transitions)
 * - Upload orchestration
 * - Error handling
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoUploadWorkflow } from '../VideoUploadWorkflow';
import * as apiModule from '../../services/api';
import type { VideoMetadata } from '../../types/api';

// Mock the API module
vi.mock('../../services/api');
const mockUploadVideo = vi.mocked(apiModule.uploadVideo);
const mockGetUploadStatus = vi.mocked(apiModule.getUploadStatus);
const mockFetchVideoBlob = vi.mocked(apiModule.fetchVideoBlob);

// Mock child components
vi.mock('../VideoRotationModal', () => ({
  VideoRotationModal: ({ onConfirm, onCancel }: { onConfirm: (rotation: number) => void; onCancel: () => void }) => (
    <div data-testid="rotation-modal">
      <button onClick={() => onConfirm(0)} data-testid="rotation-confirm">Upload</button>
      <button onClick={() => onConfirm(90)} data-testid="rotation-confirm-90">Upload with 90° rotation</button>
      <button onClick={onCancel} data-testid="rotation-cancel">Cancel</button>
    </div>
  ),
}));

vi.mock('../UploadProgressIndicator', () => ({
  UploadProgressIndicator: ({ progress, state }: { progress: number; state: string }) => (
    <div data-testid="progress-indicator">
      <span data-testid="progress">{Math.round(progress * 100)}%</span>
      <span data-testid="state">{state}</span>
    </div>
  ),
}));

vi.mock('../ErrorNotification', () => ({
  ErrorNotification: ({ error, onRetry, onDismiss }: { error: string; onRetry: () => void; onDismiss: () => void }) => (
    <div data-testid="error-notification">
      <span data-testid="error-message">{error}</span>
      <button onClick={onRetry}>Retry</button>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

describe('VideoUploadWorkflow', () => {
  const mockOnUploadComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Selection', () => {
    it('should render file input in idle state', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      expect(input).toBeTruthy();
      expect(input.getAttribute('type')).toBe('file');
    });

    it('should accept valid file and show rotation modal', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByTestId('rotation-modal')).toBeTruthy();
      expect(screen.getByTestId('rotation-confirm')).toBeTruthy();
      expect(screen.getByTestId('rotation-cancel')).toBeTruthy();
    });
  });

  describe('File Validation - Size Limit', () => {
    it('should reject files larger than 200MB', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const largeFile = new File(
        [new ArrayBuffer(201 * 1024 * 1024)], // 201MB
        'large.mp4',
        { type: 'video/mp4' }
      );

      // Mock size property since File constructor doesn't set it accurately
      Object.defineProperty(largeFile, 'size', { value: 201 * 1024 * 1024 });

      fireEvent.change(input, { target: { files: [largeFile] } });

      expect(screen.getByTestId('error-notification')).toBeTruthy();
      expect(screen.getByTestId('error-message').textContent).toMatch(
        /File size exceeds maximum allowed size of 200MB/
      );
    });

    it('should accept files at exactly 200MB', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const validFile = new File(
        [new ArrayBuffer(200 * 1024 * 1024)], // Exactly 200MB
        'valid.mp4',
        { type: 'video/mp4' }
      );

      Object.defineProperty(validFile, 'size', { value: 200 * 1024 * 1024 });

      fireEvent.change(input, { target: { files: [validFile] } });

      // Should show rotation controls, not error
      expect(screen.getByTestId('rotation-modal')).toBeTruthy();
      expect(screen.queryByTestId('error-notification')).toBeNull();
    });
  });

  describe('File Validation - Type', () => {
    it('should reject non-video files', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const invalidFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

      fireEvent.change(input, { target: { files: [invalidFile] } });

      expect(screen.getByTestId('error-notification')).toBeTruthy();
      expect(screen.getByTestId('error-message').textContent).toMatch(
        /Invalid file type: application\/pdf/
      );
    });

    it('should accept video/mp4 files', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const validFile = new File(['video content'], 'video.mp4', { type: 'video/mp4' });

      fireEvent.change(input, { target: { files: [validFile] } });

      expect(screen.getByTestId('rotation-modal')).toBeTruthy();
      expect(screen.queryByTestId('error-notification')).toBeNull();
    });

    it('should accept video/* MIME types', () => {
      const videoTypes = ['video/webm', 'video/quicktime', 'video/x-matroska'];

      videoTypes.forEach((type) => {
        const { unmount } = render(
          <VideoUploadWorkflow
            videoSlot="A"
            onUploadComplete={mockOnUploadComplete}
          />
        );

        const input = screen.getByLabelText(/select video file for slot A/i);
        const validFile = new File(['video content'], `video.${type.split('/')[1]}`, { type });

        fireEvent.change(input, { target: { files: [validFile] } });

        expect(screen.getByTestId('rotation-modal')).toBeTruthy();
        expect(screen.queryByTestId('error-notification')).toBeNull();

        unmount();
      });
    });
  });

  describe('Rotation Workflow', () => {
    it('should show rotation modal on file selection', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByTestId('rotation-modal')).toBeTruthy();
    });

    it('should pass rotation to uploadVideo API', async () => {
      const mockMetadata: VideoMetadata = {
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

      mockUploadVideo.mockResolvedValue(mockMetadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'video-123',
        status: 'complete',
        progress: 1.0,
        metadata: mockMetadata,
      });
      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      // Confirm upload with 90° rotation
      fireEvent.click(screen.getByTestId('rotation-confirm-90'));

      await waitFor(() => {
        expect(mockUploadVideo).toHaveBeenCalledWith(
          file,
          undefined,
          90,
          expect.any(Function) // onUploadProgress callback
        );
      }, { timeout: 10000 });
    });
  });

  describe('Upload Orchestration', () => {
    it('should call uploadVideo on upload confirmation', async () => {
      const mockMetadata: VideoMetadata = {
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

      mockUploadVideo.mockResolvedValue(mockMetadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'video-123',
        status: 'complete',
        progress: 1.0,
        metadata: mockMetadata,
      });
      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          sessionId="session-456"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        expect(mockUploadVideo).toHaveBeenCalledWith(
          file,
          'session-456',
          0,
          expect.any(Function) // onUploadProgress callback
        );
      }, { timeout: 10000 });
    });

    it('should show uploading state during upload', async () => {
      const mockMetadata: VideoMetadata = {
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

      // Delay the upload response to give time to observe the uploading state
      mockUploadVideo.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockMetadata), 100);
        });
      });
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'video-123',
        status: 'complete',
        progress: 1.0,
        metadata: mockMetadata,
      });
      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      // Check for uploading state UI
      await waitFor(() => {
        expect(screen.getByText(/Uploading file:|Analyzing video metadata/i)).toBeTruthy();
      }, { timeout: 10000 });
    });
  });

  describe('Polling State Machine', () => {
    it('should poll status after upload succeeds', async () => {
      const mockMetadata: VideoMetadata = {
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

      mockUploadVideo.mockResolvedValue(mockMetadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'video-123',
        status: 'complete',
        progress: 1.0,
        metadata: mockMetadata,
      });
      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        expect(mockGetUploadStatus).toHaveBeenCalledWith('video-123');
      }, { timeout: 10000 });
    });

    it('should fetch video blob when upload completes', async () => {
      const mockMetadata: VideoMetadata = {
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

      const mockBlob = new Blob(['video data'], { type: 'video/mp4' });

      mockUploadVideo.mockResolvedValue(mockMetadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'video-123',
        status: 'complete',
        progress: 1.0,
        metadata: mockMetadata,
      });
      mockFetchVideoBlob.mockResolvedValue(mockBlob);

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        expect(mockFetchVideoBlob).toHaveBeenCalledWith('session-456', 'video-123');
        expect(mockOnUploadComplete).toHaveBeenCalledWith(mockMetadata, mockBlob);
      }, { timeout: 10000 });
    });
  });

  describe('Error Handling', () => {
    it('should show error when upload fails', async () => {
      mockUploadVideo.mockRejectedValue(new Error('Network error'));

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message');
        expect(errorMessage.textContent).toMatch(/Network error/);
      }, { timeout: 10000 });
    });

    it('should show error when polling returns error status', async () => {
      const mockMetadata: VideoMetadata = {
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

      mockUploadVideo.mockResolvedValue(mockMetadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'video-123',
        status: 'error',
        progress: 0,
        error_message: 'Processing failed: invalid codec',
      });

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message');
        expect(errorMessage.textContent).toMatch(/Processing failed: invalid codec/);
      }, { timeout: 10000 });
    });

    it('should handle retry after error', async () => {
      // First attempt fails
      mockUploadVideo.mockRejectedValueOnce(new Error('Network error'));

      // Second attempt succeeds
      const mockMetadata: VideoMetadata = {
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

      mockUploadVideo.mockResolvedValueOnce(mockMetadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'video-123',
        status: 'complete',
        progress: 1.0,
        metadata: mockMetadata,
      });
      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error-notification')).toBeTruthy();
      }, { timeout: 10000 });

      // Click retry
      fireEvent.click(screen.getByText('Retry'));

      // Select file again after retry
      const input2 = screen.getByLabelText(/select video file for slot A/i);
      const file2 = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input2, { target: { files: [file2] } });

      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        expect(mockUploadVideo).toHaveBeenCalledTimes(2);
        expect(mockOnUploadComplete).toHaveBeenCalled();
      }, { timeout: 10000 });
    });
  });

  describe('Cancel Workflow', () => {
    it('should close modal when cancel is clicked', () => {
      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByTestId('rotation-modal')).toBeTruthy();

      fireEvent.click(screen.getByTestId('rotation-cancel'));

      expect(screen.queryByTestId('rotation-modal')).toBeNull();
    });
  });

  describe('Analyzing State - GOP Detection', () => {
    it('should transition to analyzing state after upload', async () => {
      const metadata: VideoMetadata = {
        video_id: 'test-video-id',
        session_id: 'test-session',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: null, // null during GOP detection
      };

      mockUploadVideo.mockResolvedValue(metadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'test-video-id',
        status: 'analyzing',
        progress: 0.5,
        frames_analyzed: 900,
        total_frames: 1800,
      });

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        const text = screen.getByText(/Analyzing video structure/i);
        expect(text).toBeTruthy();
      });
    });

    it('should display frame progress during GOP detection', async () => {
      const metadata: VideoMetadata = {
        video_id: 'test-video-id',
        session_id: 'test-session',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: null,
      };

      mockUploadVideo.mockResolvedValue(metadata);

      // Simulate progressive GOP detection
      let callCount = 0;
      mockGetUploadStatus.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'analyzing',
            progress: 0.25,
            frames_analyzed: 450,
            total_frames: 1800,
          });
        } else if (callCount === 2) {
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'analyzing',
            progress: 0.75,
            frames_analyzed: 1350,
            total_frames: 1800,
          });
        } else {
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'complete',
            metadata: { ...metadata, gop_size: 30 },
            progress: 1.0,
          });
        }
      });

      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByTestId('rotation-confirm'));

      // Wait for analyzing state to appear
      await waitFor(() => {
        const analyzing = screen.getByText(/Analyzing video structure/i);
        expect(analyzing).toBeTruthy();
      }, { timeout: 2000 });

      // Verify frame count display
      await waitFor(() => {
        const frames = screen.getByText(/Frames analyzed:/i);
        expect(frames).toBeTruthy();
      }, { timeout: 2000 });
    });

    it('should handle analyzing state with processing workflow', async () => {
      const metadata: VideoMetadata = {
        video_id: 'test-video-id',
        session_id: 'test-session',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: null,
      };

      mockUploadVideo.mockResolvedValue(metadata);

      // Simulate full workflow: analyzing -> processing -> complete
      let callCount = 0;
      mockGetUploadStatus.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First 2 polls: analyzing state
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'analyzing',
            progress: 0.5,
            frames_analyzed: 900,
            total_frames: 1800,
          });
        } else if (callCount <= 4) {
          // Next 2 polls: processing state
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'processing',
            progress: 0.3,
            estimated_duration_seconds: 25,
          });
        } else {
          // Final: complete
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'complete',
            metadata: { ...metadata, gop_size: 30 },
            progress: 1.0,
          });
        }
      });

      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByTestId('rotation-confirm'));

      // Wait for analyzing state to appear
      await waitFor(() => {
        expect(screen.getByText(/Analyzing video structure/i)).toBeTruthy();
      }, { timeout: 2000 });

      // Wait for workflow to complete
      await waitFor(() => {
        expect(mockOnUploadComplete).toHaveBeenCalled();
      }, { timeout: 10000 });
    }, 15000);

    it('should transition from analyzing directly to complete if no optimization needed', async () => {
      const metadata: VideoMetadata = {
        video_id: 'test-video-id',
        session_id: 'test-session',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: null,
      };

      mockUploadVideo.mockResolvedValue(metadata);

      let callCount = 0;
      mockGetUploadStatus.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'analyzing',
            progress: 0.5,
            frames_analyzed: 900,
            total_frames: 1800,
          });
        } else {
          // Skip processing, go directly to complete
          return Promise.resolve({
            video_id: 'test-video-id',
            status: 'complete',
            metadata: { ...metadata, gop_size: 25 },
            progress: 1.0,
          });
        }
      });

      mockFetchVideoBlob.mockResolvedValue(new Blob());

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByTestId('rotation-confirm'));

      // Wait for analyzing state
      await waitFor(() => {
        expect(screen.getByText(/Analyzing video structure/i)).toBeTruthy();
      }, { timeout: 2000 });

      // Wait for complete state (skipping processing)
      await waitFor(() => {
        expect(mockOnUploadComplete).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should handle analyzing state error', async () => {
      const metadata: VideoMetadata = {
        video_id: 'test-video-id',
        session_id: 'test-session',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: null,
      };

      mockUploadVideo.mockResolvedValue(metadata);
      mockGetUploadStatus.mockResolvedValue({
        video_id: 'test-video-id',
        status: 'error',
        error_message: 'GOP detection failed: timeout',
      });

      render(
        <VideoUploadWorkflow
          videoSlot="A"
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = screen.getByLabelText(/select video file for slot A/i);
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByTestId('rotation-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('error-notification')).toBeTruthy();
        const errorMsg = screen.getByTestId('error-message');
        expect(errorMsg.textContent).toMatch(/GOP detection failed/i);
      }, { timeout: 2000 });
    });
  });
});
