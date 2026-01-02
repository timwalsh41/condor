"""
Pydantic models for request/response validation.

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


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
    gop_size: int = Field(description="GOP size (keyframe interval)", gt=0)


class UploadStatus(BaseModel):
    """
    Upload processing status for polling.

    Validates: REQ-F-UPLOAD-001 (progress feedback)
    """
    video_id: UUID = Field(description="Unique video identifier")
    status: str = Field(description="Processing status: pending, processing, complete, error")
    progress: Optional[float] = Field(None, description="Processing progress (0.0-1.0)")
    error_message: Optional[str] = Field(None, description="Error message if status=error")
    metadata: Optional[VideoMetadata] = Field(None, description="Video metadata if status=complete")


class ErrorResponse(BaseModel):
    """
    Structured error response.

    Validates: REQ-F-ERROR-001 (User-facing error messages)
    """
    detail: str = Field(description="Human-readable error message")
    error_code: Optional[str] = Field(None, description="Machine-readable error code")
