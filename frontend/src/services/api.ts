/**
 * Typed API client for backend communication.
 *
 * Validates:
 *   - REQ-F-UPLOAD-001: Video upload with metadata
 *   - REQ-F-PLAYBACK-003: Video streaming URL generation
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import axios, { AxiosError } from 'axios';
import type { VideoMetadata, UploadStatus, ErrorResponse } from '../types/api';
import type { RotationAngle } from '../types/rotation';

/**
 * Base API configuration.
 */
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 minutes for large uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * API error with structured error response.
 */
export class ApiError extends Error {
  statusCode: number;
  errorResponse?: ErrorResponse;

  constructor(
    message: string,
    statusCode: number,
    errorResponse?: ErrorResponse
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorResponse = errorResponse;
  }
}

/**
 * Handle API errors with structured error response.
 */
function handleApiError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorResponse>;
    const status = axiosError.response?.status || 500;
    const errorResponse = axiosError.response?.data;
    const message = errorResponse?.detail || axiosError.message || 'Unknown error';

    throw new ApiError(message, status, errorResponse);
  }

  throw new ApiError('Network error occurred', 500);
}

/**
 * Upload video file with optional rotation.
 *
 * @param file Video file to upload
 * @param sessionId Optional session UUID (auto-generated if not provided)
 * @param rotation Rotation angle (0°, 90°, 180°, or 270°)
 * @param onUploadProgress Optional callback for upload progress (0.0-1.0)
 * @returns VideoMetadata with video information
 * @throws ApiError if upload fails
 */
export async function uploadVideo(
  file: File,
  sessionId?: string,
  rotation: RotationAngle = 0,
  onUploadProgress?: (progress: number) => void
): Promise<VideoMetadata> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }
    formData.append('rotation', String(rotation));

    const response = await apiClient.post<VideoMetadata>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onUploadProgress) {
          const progress = progressEvent.loaded / progressEvent.total;
          onUploadProgress(progress);
        }
      },
    });

    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Get upload processing status (polling endpoint).
 *
 * @param videoId Video UUID
 * @returns UploadStatus with current processing state
 * @throws ApiError if video not found or request fails
 */
export async function getUploadStatus(videoId: string): Promise<UploadStatus> {
  try {
    const response = await apiClient.get<UploadStatus>(`/upload/${videoId}/status`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Generate streaming video URL for WebCodecs playback.
 *
 * @param sessionId Session UUID
 * @param videoId Video UUID
 * @returns Streaming video URL
 */
export function getStreamingVideoUrl(sessionId: string, videoId: string): string {
  return `/api/video/${sessionId}/${videoId}`;
}

/**
 * Fetch video blob from streaming endpoint.
 *
 * @param sessionId Session UUID
 * @param videoId Video UUID
 * @returns Video blob for WebCodecs decoder
 * @throws ApiError if video not found or fetch fails
 */
export async function fetchVideoBlob(sessionId: string, videoId: string): Promise<Blob> {
  try {
    const url = getStreamingVideoUrl(sessionId, videoId);
    const response = await fetch(url);

    if (!response.ok) {
      throw new ApiError(
        `Failed to fetch video: ${response.statusText}`,
        response.status
      );
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to fetch video blob', 500);
  }
}
