"""
Pydantic models for request/response validation.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class VideoMetadata(BaseModel):
    """
    Video metadata returned after successful upload and optimization.

    Validates: REQ-F-UPLOAD-001, REQ-F-UPLOAD-002
    """
    video_id: UUID = Field(description="Unique video identifier")
    session_id: UUID = Field(description="Session identifier for video grouping")
    filename: str = Field(description="Original filename")
    framerate: float = Field(description="Video framerate (fps)", gt=0)
    duration: float = Field(description="Video duration (seconds)", gt=0)
    width: int = Field(description="Video width (pixels)", gt=0)
    height: int = Field(description="Video height (pixels)", gt=0)
    codec: str = Field(description="Video codec (e.g., 'h264')")
    gop_size: Optional[int] = Field(None, description="GOP size (keyframe interval), None during GOP detection")


class UploadStatus(BaseModel):
    """
    Upload processing status for polling.

    Validates: REQ-F-UPLOAD-001 (progress feedback)
    """
    video_id: UUID = Field(description="Unique video identifier")
    status: str = Field(description="Processing status: pending, analyzing, processing, complete, error")
    progress: Optional[float] = Field(None, description="Processing progress (0.0-1.0)")
    error_message: Optional[str] = Field(None, description="Error message if status=error")
    metadata: Optional[VideoMetadata] = Field(None, description="Video metadata if status=complete")
    estimated_duration_seconds: Optional[float] = Field(None, description="Estimated processing time in seconds (if status=processing)")
    frames_analyzed: Optional[int] = Field(None, description="Number of frames analyzed during GOP detection")
    total_frames: Optional[int] = Field(None, description="Total number of frames for GOP detection progress")


class ErrorResponse(BaseModel):
    """
    Structured error response.

    Validates: REQ-F-ERROR-001 (User-facing error messages)
    """
    detail: str = Field(description="Human-readable error message")
    error_code: Optional[str] = Field(None, description="Machine-readable error code")


# ---------------------------------------------------------------------------
# Library domain models (Task 2.6 — REQ-P2-LIB-001, REQ-P2-LIB-002)
# ---------------------------------------------------------------------------

class LibraryVideoCreate(BaseModel):
    """Payload for adding a video to the library.

    Requires the video_id returned by the upload API so the backend can
    locate the processed file on disk.

    Validates: REQ-P2-LIB-001, REQ-P2-LIB-002
    """

    video_id: UUID = Field(description="video_id from the upload API response")
    # Optional user-supplied metadata
    golfer_name: Optional[str] = Field(None, max_length=100)
    club: Optional[str] = Field(None, max_length=100)
    swing_date: Optional[str] = Field(
        None,
        description="Capture date in ISO 8601 format (YYYY-MM-DD)",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    )
    notes: Optional[str] = Field(None)
    quality_score: Optional[int] = Field(None, ge=1, le=10)


class LibraryVideoUpdate(BaseModel):
    """Payload for editing library video metadata.

    All fields are optional; only provided fields are updated.

    Validates: REQ-P2-LIB-002
    """

    golfer_name: Optional[str] = Field(None, max_length=100)
    club: Optional[str] = Field(None, max_length=100)
    swing_date: Optional[str] = Field(
        None,
        description="Capture date in ISO 8601 format (YYYY-MM-DD)",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    )
    notes: Optional[str] = Field(None)
    quality_score: Optional[int] = Field(None, ge=1, le=10)


class LibraryVideoResponse(BaseModel):
    """Full representation of a library video returned by the API.

    Validates: REQ-P2-LIB-001, REQ-P2-LIB-002
    """

    id: UUID
    filename: str
    framerate: float
    duration: float
    width: int
    height: int
    codec: str
    gop_size: Optional[int]
    golfer_name: Optional[str]
    club: Optional[str]
    swing_date: Optional[str]
    notes: Optional[str]
    quality_score: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Analysis Session models
# ---------------------------------------------------------------------------


class AnnotationPayload(BaseModel):
    """JSONB annotation payload keyed by video slot.

    Shape: {"a": [...annotations...], "b": [...annotations...]}
    Each annotation object is unstructured to allow future schema evolution.
    """

    a: list[dict] = Field(default_factory=list, description="Annotations for Video A")
    b: list[dict] = Field(default_factory=list, description="Annotations for Video B")

    model_config = {"from_attributes": True}


class AnalysisSessionCreate(BaseModel):
    """Payload to create a new analysis session.

    Validates: REQ-P2-SESS-001
    """

    name: str = Field(description="Session name", min_length=1, max_length=200)
    notes: Optional[str] = Field(None, description="User notes")
    video_a_id: Optional[UUID] = Field(None, description="Library video used in slot A")
    video_b_id: Optional[UUID] = Field(None, description="Library video used in slot B")
    sync_frame_a: Optional[int] = Field(None, ge=0)
    sync_frame_b: Optional[int] = Field(None, ge=0)
    trim_start_a: Optional[int] = Field(None, ge=0)
    trim_end_a: Optional[int] = Field(None, ge=0)
    trim_start_b: Optional[int] = Field(None, ge=0)
    trim_end_b: Optional[int] = Field(None, ge=0)
    playback_speed: float = Field(1.0, ge=0.1, le=4.0)
    loop_playback: bool = Field(False)
    annotations: Optional[AnnotationPayload] = Field(None)


class AnalysisSessionUpdate(BaseModel):
    """Payload to update an existing analysis session.

    All fields are optional; only provided fields are updated.

    Validates: REQ-P2-SESS-001
    """

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    notes: Optional[str] = Field(None)
    video_a_id: Optional[UUID] = Field(None)
    video_b_id: Optional[UUID] = Field(None)
    sync_frame_a: Optional[int] = Field(None, ge=0)
    sync_frame_b: Optional[int] = Field(None, ge=0)
    trim_start_a: Optional[int] = Field(None, ge=0)
    trim_end_a: Optional[int] = Field(None, ge=0)
    trim_start_b: Optional[int] = Field(None, ge=0)
    trim_end_b: Optional[int] = Field(None, ge=0)
    playback_speed: Optional[float] = Field(None, ge=0.1, le=4.0)
    loop_playback: Optional[bool] = Field(None)
    annotations: Optional[AnnotationPayload] = Field(None)


class AnalysisSessionSummary(BaseModel):
    """Lightweight session record for list responses.

    Validates: REQ-P2-SESS-001
    """

    id: UUID
    name: str
    notes: Optional[str]
    video_a_id: Optional[UUID]
    video_b_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnalysisSessionResponse(BaseModel):
    """Full session record with all state fields.

    Validates: REQ-P2-SESS-001
    """

    id: UUID
    name: str
    notes: Optional[str]
    video_a_id: Optional[UUID]
    video_b_id: Optional[UUID]
    sync_frame_a: Optional[int]
    sync_frame_b: Optional[int]
    trim_start_a: Optional[int]
    trim_end_a: Optional[int]
    trim_start_b: Optional[int]
    trim_end_b: Optional[int]
    playback_speed: float
    loop_playback: bool
    annotations: Optional[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

