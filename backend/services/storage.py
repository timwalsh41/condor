"""
Storage service for session-based temporary file management.

Manages video files in session-isolated directories with automatic cleanup.

Architecture:
    /tmp/<session_id>/
        <video_id>.mp4           # Optimized video
        <video_id>_original.mp4  # Original (deleted after optimization)

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

import logging
import shutil
from pathlib import Path
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)

# Base directory for temporary storage
TMP_STORAGE_BASE = Path("/tmp/condor")


def get_session_dir(session_id: UUID) -> Path:
    """
    Get session directory path.

    Args:
        session_id: Session UUID

    Returns:
        Path to session directory
    """
    return TMP_STORAGE_BASE / str(session_id)


def ensure_session_dir(session_id: UUID) -> Path:
    """
    Ensure session directory exists.

    Args:
        session_id: Session UUID

    Returns:
        Path to session directory

    Raises:
        OSError: If directory creation fails
    """
    session_dir = get_session_dir(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    logger.debug(f"Ensured session directory: {session_dir}")
    return session_dir


def get_video_path(session_id: UUID, video_id: UUID, original: bool = False) -> Path:
    """
    Get path to video file.

    Args:
        session_id: Session UUID
        video_id: Video UUID
        original: If True, return path to original file (before optimization)

    Returns:
        Path to video file
    """
    session_dir = get_session_dir(session_id)
    suffix = "_original.mp4" if original else ".mp4"
    return session_dir / f"{video_id}{suffix}"


def cleanup_original(session_id: UUID, video_id: UUID) -> None:
    """
    Delete original video file after optimization.

    Args:
        session_id: Session UUID
        video_id: Video UUID
    """
    original_path = get_video_path(session_id, video_id, original=True)
    if original_path.exists():
        original_path.unlink()
        logger.debug(f"Deleted original file: {original_path}")


def cleanup_session(session_id: UUID) -> None:
    """
    Delete all files for a session.

    Validates: REQ-F-UPLOAD-002 (Temporary Storage Management)

    Args:
        session_id: Session UUID
    """
    session_dir = get_session_dir(session_id)
    if session_dir.exists():
        shutil.rmtree(session_dir)
        logger.info(f"Cleaned up session: {session_id}")


def cleanup_video(session_id: UUID, video_id: UUID) -> None:
    """
    Delete specific video and its original.

    Args:
        session_id: Session UUID
        video_id: Video UUID
    """
    video_path = get_video_path(session_id, video_id)
    original_path = get_video_path(session_id, video_id, original=True)

    if video_path.exists():
        video_path.unlink()
        logger.debug(f"Deleted video: {video_path}")

    if original_path.exists():
        original_path.unlink()
        logger.debug(f"Deleted original: {original_path}")


def cleanup_partial_upload(session_id: UUID, video_id: UUID) -> None:
    """
    Clean up partial/failed upload immediately.

    Validates: REQ-F-UPLOAD-002 (Cleanup on failure)

    Args:
        session_id: Session UUID
        video_id: Video UUID
    """
    try:
        cleanup_video(session_id, video_id)
        logger.info(f"Cleaned up partial upload: session={session_id}, video={video_id}")
    except Exception as e:
        logger.error(f"Failed to clean up partial upload: {e}")
