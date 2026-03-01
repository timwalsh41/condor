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
import type {
  VideoMetadata, UploadStatus, ErrorResponse,
  LibraryVideo, LibraryVideoCreate, LibraryVideoUpdate,
  AnalysisSessionSummary, AnalysisSessionResponse,
  AnalysisSessionCreate, AnalysisSessionUpdate,
} from '../types/api';
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

// ---------------------------------------------------------------------------
// Library API
// ---------------------------------------------------------------------------

/**
 * List all videos in the user's library.
 *
 * @returns Array of library video records, newest first.
 * @throws ApiError on failure.
 */
export async function listLibraryVideos(): Promise<LibraryVideo[]> {
  try {
    const response = await apiClient.get<LibraryVideo[]>('/library');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Add an uploaded video to the library.
 *
 * @param payload video_id and optional metadata.
 * @returns Created library video record.
 * @throws ApiError on failure.
 */
export async function addToLibrary(payload: LibraryVideoCreate): Promise<LibraryVideo> {
  try {
    const response = await apiClient.post<LibraryVideo>('/library', payload);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Fetch a single library video by ID.
 *
 * @param videoId Library video UUID.
 * @returns Library video record.
 * @throws ApiError if not found.
 */
export async function getLibraryVideo(videoId: string): Promise<LibraryVideo> {
  try {
    const response = await apiClient.get<LibraryVideo>(`/library/${videoId}`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Update library video metadata.
 *
 * @param videoId Library video UUID.
 * @param updates Fields to update.
 * @returns Updated library video record.
 * @throws ApiError if not found.
 */
export async function updateLibraryVideo(videoId: string, updates: LibraryVideoUpdate): Promise<LibraryVideo> {
  try {
    const response = await apiClient.put<LibraryVideo>(`/library/${videoId}`, updates);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Delete a library video.
 *
 * @param videoId Library video UUID.
 * @throws ApiError if not found.
 */
export async function deleteLibraryVideo(videoId: string): Promise<void> {
  try {
    await apiClient.delete(`/library/${videoId}`);
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Return a URL that streams the library video from the backend.
 *
 * Suitable for use as a ``<video src>`` or for fetching the blob.
 *
 * @param videoId Library video UUID.
 */
export function getLibraryVideoStreamUrl(videoId: string): string {
  return `/api/library/${videoId}/stream`;
}

/**
 * Fetch the blob of a library video for WebCodecs playback.
 *
 * @param videoId Library video UUID.
 * @returns Video blob.
 * @throws ApiError on failure.
 */
export async function fetchLibraryVideoBlob(videoId: string): Promise<Blob> {
  try {
    const url = getLibraryVideoStreamUrl(videoId);
    const response = await fetch(url);
    if (!response.ok) {
      throw new ApiError(`Failed to fetch library video: ${response.statusText}`, response.status);
    }
    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Failed to fetch library video blob', 500);
  }
}

// ---------------------------------------------------------------------------
// Sessions API
// ---------------------------------------------------------------------------

/**
 * List all analysis sessions (newest first).
 *
 * @returns Array of lightweight session summaries.
 * @throws ApiError on failure.
 */
export async function listSessions(): Promise<AnalysisSessionSummary[]> {
  try {
    const response = await apiClient.get<AnalysisSessionSummary[]>('/sessions');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Create a new analysis session.
 *
 * @param payload Session state to persist.
 * @returns Created session record.
 * @throws ApiError on failure.
 */
export async function createSession(payload: AnalysisSessionCreate): Promise<AnalysisSessionResponse> {
  try {
    const response = await apiClient.post<AnalysisSessionResponse>('/sessions', payload);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Fetch a single session by ID.
 *
 * @param sessionId Session UUID.
 * @returns Full session record.
 * @throws ApiError if not found.
 */
export async function getSession(sessionId: string): Promise<AnalysisSessionResponse> {
  try {
    const response = await apiClient.get<AnalysisSessionResponse>(`/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Update a session.
 *
 * @param sessionId Session UUID.
 * @param updates Fields to update.
 * @returns Updated session record.
 * @throws ApiError if not found.
 */
export async function updateSession(
  sessionId: string,
  updates: AnalysisSessionUpdate,
): Promise<AnalysisSessionResponse> {
  try {
    const response = await apiClient.put<AnalysisSessionResponse>(`/sessions/${sessionId}`, updates);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Delete an analysis session.
 *
 * @param sessionId Session UUID.
 * @throws ApiError if not found.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await apiClient.delete(`/sessions/${sessionId}`);
  } catch (error) {
    handleApiError(error);
  }
}
