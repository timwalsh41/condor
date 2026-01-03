/**
 * TypeScript types matching backend Pydantic models.
 *
 * Manual type definitions - keep in sync with backend models.
 * @see backend/models.py
 *
 * Phase 2: Migrate to automated generation with datamodel-code-generator
 */

/**
 * Video metadata returned after successful upload and optimization.
 * @see backend/models.py:VideoMetadata
 */
export interface VideoMetadata {
  video_id: string;
  session_id: string;
  filename: string;
  framerate: number;
  duration: number;
  width: number;
  height: number;
  codec: string;
  gop_size: number;
}

/**
 * Upload processing status for polling.
 * @see backend/models.py:UploadStatus
 */
export interface UploadStatus {
  video_id: string;
  status: "pending" | "processing" | "complete" | "error";
  progress?: number | null;
  error_message?: string | null;
  metadata?: VideoMetadata | null;
}

/**
 * Structured error response.
 * @see backend/models.py:ErrorResponse
 */
export interface ErrorResponse {
  detail: string;
  error_code?: string | null;
}
