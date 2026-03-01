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

