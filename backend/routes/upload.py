"""
Video upload endpoint with validation and optimization.

Validates: REQ-F-UPLOAD-001, REQ-F-UPLOAD-002, REQ-F-UPLOAD-003, REQ-F-UPLOAD-004

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

import logging
import subprocess
import uuid
import aiofiles
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status, BackgroundTasks

from backend.models import VideoMetadata, UploadStatus, ErrorResponse
from backend.services import storage, progress_tracker
from backend.services.video_optimizer import (
    get_video_info,
    get_video_duration,
    process_uploaded_video,
    needs_optimization
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])

# Upload constraints
MAX_FILE_SIZE_MB = 200
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def optimize_video_background(
    video_id: uuid.UUID,
    video_path: Path,
    rotation: int,
    session_uuid: uuid.UUID,
    original_filename: str,
    estimated_duration_seconds: float
) -> None:
    """
    Background task for video optimization.

    Progress updates: 0% (start) → 100% (complete)
    No intermediate updates during optimization to avoid threading complexity.
    Frontend displays estimated time remaining based on video duration.

    Args:
        video_id: Video UUID
        video_path: Path to video file
        rotation: Rotation angle (0, 90, 180, 270)
        session_uuid: Session UUID for cleanup on error
        original_filename: Original uploaded filename
        estimated_duration_seconds: Expected processing time (duration × 0.42)
    """
    import time

    logger.info(f"Starting background optimization: video_id={video_id}, "
                f"estimated_time={estimated_duration_seconds:.1f}s")

    start_time = time.time()

    try:
        # Run optimization with timeout (2x expected duration)
        timeout_seconds = estimated_duration_seconds * 2.0
        optimized_path = process_uploaded_video(video_path, rotation, timeout=timeout_seconds)

        # Get final metadata
        final_info = get_video_info(optimized_path)
        final_duration = get_video_duration(optimized_path)

        # Update status to complete with metadata
        metadata = VideoMetadata(
            video_id=video_id,
            session_id=session_uuid,
            filename=original_filename,
            framerate=final_info['framerate'],
            duration=final_duration,
            width=final_info['width'],
            height=final_info['height'],
            codec=final_info['codec'],
            gop_size=final_info['gop_size']
        )

        elapsed = time.time() - start_time
        progress_tracker.set_status(video_id, "complete", progress=1.0, metadata=metadata)
        logger.info(f"Background optimization complete: video_id={video_id}, "
                   f"elapsed={elapsed:.1f}s, estimated={estimated_duration_seconds:.1f}s")

    except subprocess.TimeoutExpired as e:
        elapsed = time.time() - start_time
        logger.error(f"Background optimization timeout: video_id={video_id}, "
                    f"elapsed={elapsed:.1f}s, timeout={timeout_seconds:.1f}s", exc_info=True)
        storage.cleanup_partial_upload(session_uuid, video_id)
        progress_tracker.set_status(
            video_id,
            "error",
            error_message=f"Video optimization timed out after {timeout_seconds:.0f}s. "
                         f"Video may be too long or complex."
        )
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Background optimization failed: video_id={video_id}, "
                    f"elapsed={elapsed:.1f}s, error={e}", exc_info=True)
        storage.cleanup_partial_upload(session_uuid, video_id)
        progress_tracker.set_status(
            video_id,
            "error",
            error_message=f"Video optimization failed: {str(e)}"
        )





@router.post("/upload", response_model=VideoMetadata, responses={
    400: {"model": ErrorResponse},
    413: {"model": ErrorResponse},
    500: {"model": ErrorResponse}
})
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Video file (MP4 format, H.264 or H.265/HEVC codec)"),
    session_id: Optional[str] = Form(None, description="Optional session ID (auto-generated if not provided)"),
    rotation: int = Form(0, description="Rotation angle in degrees (0, 90, 180, 270)")
) -> VideoMetadata:
    """
    Upload and optimize video file.

    Validates:
        - REQ-F-UPLOAD-001: Local File Upload
        - REQ-F-UPLOAD-002: Temporary Storage Management
        - REQ-F-UPLOAD-003: Framerate Validation (metadata extraction)
        - REQ-F-UPLOAD-004: Video Rotation During Upload

    Args:
        file: Uploaded video file
        session_id: Optional session UUID (auto-generated if not provided)
        rotation: Rotation angle (0, 90, 180, 270)

    Returns:
        VideoMetadata with video information

    Raises:
        HTTPException: If validation fails or processing errors occur
    """
    # Generate IDs
    video_id = uuid.uuid4()
    if session_id:
        try:
            session_uuid = uuid.UUID(session_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid session_id format. Must be a valid UUID."
            )
    else:
        session_uuid = uuid.uuid4()

    logger.info(f"Upload started: session={session_uuid}, video={video_id}, "
                f"filename={file.filename}, rotation={rotation}°")

    try:
        # Validation: File size
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        # Read first chunk to check MIME type and start counting size
        first_chunk = await file.read(chunk_size)
        file_size += len(first_chunk)

        if not first_chunk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file uploaded"
            )

        # Validation: MIME type (basic check)
        if file.content_type and not file.content_type.startswith("video/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.content_type}. Please use MP4 with H.264 or H.265/HEVC codec."
            )

        # Validation: Rotation angle
        if rotation not in [0, 90, 180, 270]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid rotation angle: {rotation}. Must be 0, 90, 180, or 270."
            )

        # Ensure session directory exists
        storage.ensure_session_dir(session_uuid)

        # Save file with size validation
        original_path = storage.get_video_path(session_uuid, video_id, original=True)

        async with aiofiles.open(original_path, 'wb') as f:
            # Write first chunk
            await f.write(first_chunk)

            # Continue reading and writing chunks
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break

                file_size += len(chunk)

                # Check size limit
                if file_size > MAX_FILE_SIZE_BYTES:
                    # Clean up partial file
                    await f.close()
                    storage.cleanup_partial_upload(session_uuid, video_id)

                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Video file exceeds maximum size ({MAX_FILE_SIZE_MB}MB). "
                               f"Please use a shorter or lower resolution video."
                    )

                await f.write(chunk)

        logger.info(f"File saved: {original_path} ({file_size / (1024*1024):.1f}MB)")

        # Extract metadata (analyzes all frames for GOP detection, typically 1-10 seconds)
        # Timeout: 120 seconds (2 minutes) for very long videos
        try:
            import asyncio
            import functools

            # Run synchronous metadata extraction with timeout
            loop = asyncio.get_event_loop()
            video_info = await asyncio.wait_for(
                loop.run_in_executor(None, functools.partial(get_video_info, original_path)),
                timeout=120.0
            )
            duration = await asyncio.wait_for(
                loop.run_in_executor(None, functools.partial(get_video_duration, original_path)),
                timeout=30.0
            )
            logger.info(f"Video metadata extracted: codec={video_info['codec']}, "
                       f"GOP={video_info['gop_size']}, "
                       f"framerate={video_info['framerate']:.2f}fps")

            # Create metadata response
            metadata = VideoMetadata(
                video_id=video_id,
                session_id=session_uuid,
                filename=file.filename or "unknown.mp4",
                framerate=video_info['framerate'],
                duration=duration,
                width=video_info['width'],
                height=video_info['height'],
                codec=video_info['codec'],
                gop_size=video_info['gop_size']
            )

            # Check if optimization needed
            if needs_optimization(video_info, rotation):
                # Calculate estimated processing time (0.42x realtime factor from testing)
                estimated_duration_seconds = duration * 0.42

                # Initialize progress tracking for background processing
                progress_tracker.set_status(
                    video_id,
                    "processing",
                    progress=0.0,
                    estimated_duration_seconds=estimated_duration_seconds
                )

                # Launch background optimization task
                background_tasks.add_task(
                    optimize_video_background,
                    video_id,
                    original_path,
                    rotation,
                    session_uuid,
                    file.filename or "unknown.mp4",
                    estimated_duration_seconds
                )

                logger.info(f"Upload complete, optimization queued: video_id={video_id}, "
                           f"estimated_time={estimated_duration_seconds:.1f}s")
            else:
                # No optimization needed - mark as complete immediately
                # Rename file from _original.mp4 to .mp4
                final_path = original_path.parent / original_path.name.replace('_original.mp4', '.mp4')
                original_path.rename(final_path)

                progress_tracker.set_status(video_id, "complete", progress=1.0, metadata=metadata)
                logger.info(f"Upload complete, no optimization needed: video_id={video_id}")

            return metadata

        except asyncio.TimeoutError:
            logger.error(f"Video metadata extraction timeout for {original_path}")
            storage.cleanup_partial_upload(session_uuid, video_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Video metadata extraction timed out. File may be too long or corrupted."
            )
        except Exception as e:
            logger.error(f"Video metadata extraction failed: {e}", exc_info=True)
            storage.cleanup_partial_upload(session_uuid, video_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read video metadata. File may be corrupted."
            )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        logger.error(f"Upload failed: {e}", exc_info=True)
        storage.cleanup_partial_upload(session_uuid, video_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Video upload failed. Please try again later."
        )


@router.get("/upload/{video_id}/status", response_model=UploadStatus, responses={
    404: {"model": ErrorResponse}
})
async def get_upload_status(video_id: uuid.UUID) -> UploadStatus:
    """
    Get upload processing status (polling endpoint).

    Design Note: Polling-based for MVP. Can be migrated to WebSocket for real-time
    updates in the future without changing client API surface.

    Args:
        video_id: Video UUID

    Returns:
        UploadStatus with current processing state

    Raises:
        HTTPException: If video_id not found
    """
    upload_status = progress_tracker.get_status(video_id)

    if not upload_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload status not found for video_id={video_id}"
        )

    return upload_status
