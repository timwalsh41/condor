"""
In-memory upload progress tracker.

Provides simple state management for video upload/processing status.
Designed for easy migration to WebSocket-based real-time updates in the future.

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
Updated: Phase 1 Task 1.3.1 - Added thread-safety locks
"""

import logging
import threading
from typing import Dict, Optional
from uuid import UUID
from backend.models import UploadStatus, VideoMetadata

logger = logging.getLogger(__name__)

# In-memory storage for upload status
# Format: {video_id: UploadStatus}
_upload_status: Dict[UUID, UploadStatus] = {}

# Thread-safety lock for dictionary access
_status_lock = threading.Lock()


def set_status(
    video_id: UUID,
    status: str,
    progress: Optional[float] = None,
    error_message: Optional[str] = None,
    metadata: Optional[VideoMetadata] = None,
    estimated_duration_seconds: Optional[float] = None
) -> None:
    """
    Update upload status (thread-safe).

    Args:
        video_id: Video UUID
        status: Processing status (pending, processing, complete, error)
        progress: Optional progress value (0.0-1.0)
        error_message: Optional error message if status=error
        metadata: Optional video metadata if status=complete
        estimated_duration_seconds: Optional estimated processing time in seconds
    """
    with _status_lock:
        _upload_status[video_id] = UploadStatus(
            video_id=video_id,
            status=status,
            progress=progress,
            error_message=error_message,
            metadata=metadata,
            estimated_duration_seconds=estimated_duration_seconds
        )
    logger.debug(f"Upload status updated: video_id={video_id}, status={status}")


def get_status(video_id: UUID) -> Optional[UploadStatus]:
    """
    Get upload status (thread-safe).

    Args:
        video_id: Video UUID

    Returns:
        UploadStatus or None if not found
    """
    with _status_lock:
        return _upload_status.get(video_id)


def clear_status(video_id: UUID) -> None:
    """
    Remove upload status entry (thread-safe).

    Args:
        video_id: Video UUID
    """
    with _status_lock:
        if video_id in _upload_status:
            del _upload_status[video_id]
            logger.debug(f"Upload status cleared: video_id={video_id}")
