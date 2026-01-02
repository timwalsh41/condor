"""
Video upload endpoint with validation and optimization.

Validates: REQ-F-UPLOAD-001, REQ-F-UPLOAD-002, REQ-F-UPLOAD-003, REQ-F-UPLOAD-004

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

import logging
import uuid
import aiofiles
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status

from backend.models import VideoMetadata, UploadStatus, ErrorResponse
from backend.services import storage, progress_tracker
from backend.services.video_optimizer import (
    get_video_info,
    get_video_duration,
    process_uploaded_video
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])

# Upload constraints
MAX_FILE_SIZE_MB = 200
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("/upload", response_model=VideoMetadata, responses={
    400: {"model": ErrorResponse},
    413: {"model": ErrorResponse},
    500: {"model": ErrorResponse}
})
async def upload_video(
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

    # Initialize progress tracking
    progress_tracker.set_status(video_id, "pending", progress=0.0)

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

        progress_tracker.set_status(video_id, "processing", progress=0.1)

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
                    progress_tracker.clear_status(video_id)

                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Video file exceeds maximum size ({MAX_FILE_SIZE_MB}MB). "
                               f"Please use a shorter or lower resolution video."
                    )

                await f.write(chunk)

        logger.info(f"File saved: {original_path} ({file_size / (1024*1024):.1f}MB)")
        progress_tracker.set_status(video_id, "processing", progress=0.3)

        # Extract metadata and optimize
        try:
            # Get initial video info
            video_info = get_video_info(original_path)
            logger.info(f"Video metadata extracted: codec={video_info['codec']}, "
                       f"GOP={video_info['gop_size']}, "
                       f"framerate={video_info['framerate']:.2f}fps")

            progress_tracker.set_status(video_id, "processing", progress=0.5)

            # Process video (optimization + rotation)
            optimized_path = process_uploaded_video(original_path, rotation)

            progress_tracker.set_status(video_id, "processing", progress=0.9)

            # Get final video info (after optimization)
            final_info = get_video_info(optimized_path)
            duration = get_video_duration(optimized_path)

            # Create metadata response
            metadata = VideoMetadata(
                video_id=video_id,
                session_id=session_uuid,
                filename=file.filename or "unknown.mp4",
                framerate=final_info['framerate'],
                duration=duration,
                width=final_info['width'],
                height=final_info['height'],
                codec=final_info['codec'],
                gop_size=final_info['gop_size']
            )

            progress_tracker.set_status(video_id, "complete", progress=1.0, metadata=metadata)

            logger.info(f"Upload complete: video_id={video_id}, "
                       f"codec={metadata.codec}, GOP={metadata.gop_size}")

            return metadata

        except Exception as e:
            logger.error(f"Video processing failed: {e}", exc_info=True)
            storage.cleanup_partial_upload(session_uuid, video_id)
            progress_tracker.set_status(
                video_id,
                "error",
                error_message=f"Failed to read video metadata. File may be corrupted: {str(e)}"
            )
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
        progress_tracker.set_status(
            video_id,
            "error",
            error_message=f"Upload failed: {str(e)}"
        )
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
