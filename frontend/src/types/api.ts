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
  gop_size: number | null;  // null during GOP detection
}

/**
 * Upload processing status for polling.
 * @see backend/models.py:UploadStatus
 */
export interface UploadStatus {
  video_id: string;
  status: "pending" | "analyzing" | "processing" | "complete" | "error";
  progress?: number | null;
  error_message?: string | null;
  metadata?: VideoMetadata | null;
  estimated_duration_seconds?: number | null;
  frames_analyzed?: number | null;
  total_frames?: number | null;
}

/**
 * Structured error response.
 * @see backend/models.py:ErrorResponse
 */
export interface ErrorResponse {
  detail: string;
  error_code?: string | null;
}

/**
 * Library video record returned by the API.
 * @see backend/models.py:LibraryVideoResponse
 */
export interface LibraryVideo {
  id: string;
  filename: string;
  framerate: number;
  duration: number;
  width: number;
  height: number;
  codec: string;
  gop_size: number | null;
  golfer_name: string | null;
  club: string | null;
  swing_date: string | null;
  notes: string | null;
  quality_score: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload to add an uploaded video to the library.
 * @see backend/models.py:LibraryVideoCreate
 */
export interface LibraryVideoCreate {
  video_id: string;
  golfer_name?: string | null;
  club?: string | null;
  swing_date?: string | null;
  notes?: string | null;
  quality_score?: number | null;
}

/**
 * Payload to update library video metadata (all fields optional).
 * @see backend/models.py:LibraryVideoUpdate
 */
export interface LibraryVideoUpdate {
  golfer_name?: string | null;
  club?: string | null;
  swing_date?: string | null;
  notes?: string | null;
  quality_score?: number | null;
}

// ---------------------------------------------------------------------------
// Analysis Session types
// ---------------------------------------------------------------------------

/** Annotation payload keyed by video slot. */
export interface AnnotationPayload {
  a: Record<string, unknown>[];
  b: Record<string, unknown>[];
}

/** Lightweight session record for list responses. */
export interface AnalysisSessionSummary {
  id: string;
  name: string;
  notes: string | null;
  video_a_id: string | null;
  video_b_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Full session record with all state fields. */
export interface AnalysisSessionResponse extends AnalysisSessionSummary {
  sync_frame_a: number | null;
  sync_frame_b: number | null;
  trim_start_a: number | null;
  trim_end_a: number | null;
  trim_start_b: number | null;
  trim_end_b: number | null;
  playback_speed: number;
  loop_playback: boolean;
  annotations: AnnotationPayload | null;
}

/** Payload to create a new analysis session. */
export interface AnalysisSessionCreate {
  name: string;
  notes?: string | null;
  video_a_id?: string | null;
  video_b_id?: string | null;
  sync_frame_a?: number | null;
  sync_frame_b?: number | null;
  trim_start_a?: number | null;
  trim_end_a?: number | null;
  trim_start_b?: number | null;
  trim_end_b?: number | null;
  playback_speed?: number;
  loop_playback?: boolean;
  annotations?: AnnotationPayload | null;
}

/** Payload to update an existing analysis session (all fields optional). */
export type AnalysisSessionUpdate = Partial<Omit<AnalysisSessionCreate, 'name'>> & {
  name?: string;
};
