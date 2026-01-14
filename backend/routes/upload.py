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
from typing import Optional, Dict

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status, BackgroundTasks

from backend.models import VideoMetadata, UploadStatus, ErrorResponse
from backend.services import storage, progress_tracker
from backend.services.video_optimizer import (
    get_video_info,
    get_fast_video_info,
    get_video_duration,
    process_uploaded_video,
    needs_optimization
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])

# Upload constraints
MAX_FILE_SIZE_MB = 200
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def gop_detection_and_optimization_background(
    video_id: uuid.UUID,
    video_path: Path,
    rotation: int,
    session_uuid: uuid.UUID,
    original_filename: str,
    video_info_fast: Dict,
    duration: float
) -> None:
    """
    Background task for GOP detection followed by conditional optimization.

    Workflow:
        - If rotation requested: Skip GOP detection, go straight to re-encoding
        - If no rotation:
            1. Run GOP detection with progress updates (status: "analyzing")
            2. Update video_info with detected GOP size
            3. Check if optimization needed
            4. If yes: Queue optimization task (status: "processing")
            5. If no: Mark as complete (status: "complete")

    Args:
        video_id: Video UUID
        video_path: Path to video file
        rotation: Rotation angle (0, 90, 180, 270)
        session_uuid: Session UUID for cleanup on error
        original_filename: Original uploaded filename
        video_info_fast: Fast metadata dict (codec, dimensions, framerate, duration)
        duration: Video duration in seconds
    """
    from backend.services.video_optimizer import detect_gop_async
    import time

    logger.info(f"Starting video processing workflow: video_id={video_id}, rotation={rotation}°")

    try:
        # Optimization: If rotation requested, skip GOP detection (we know we need to re-encode)
        if rotation != 0:
            logger.info(f"Rotation requested ({rotation}°), skipping GOP detection: video_id={video_id}")
            # Use fast metadata without GOP size (will be determined after re-encoding)
            video_info = {**video_info_fast, 'gop_size': None}
            gop_size = None
        else:
            # Step 1: Run GOP detection with progress updates
            logger.info(f"No rotation, running GOP detection: video_id={video_id}")
            total_frames_estimate = int(duration * video_info_fast['framerate'])
            gop_size = detect_gop_async(video_path, video_id, total_frames_estimate)

            # Step 2: Update video_info with GOP size
            video_info = {**video_info_fast, 'gop_size': gop_size}

            logger.info(f"GOP detection complete: video_id={video_id}, gop_size={gop_size}")

        # Step 3: Check if optimization needed
        if needs_optimization(video_info, rotation):
            # Calculate estimated processing time (0.42x realtime factor)
            estimated_duration_seconds = duration * 0.42

            # Initialize progress tracking for optimization
            progress_tracker.set_status(
                video_id,
                "processing",
                progress=0.0,
                estimated_duration_seconds=estimated_duration_seconds
            )

            logger.info(f"Optimization needed, starting re-encoding: video_id={video_id}")

            # Step 4: Run optimization with progress reporting
            start_time = time.time()

            # Progress callback for optimization
            def optimization_progress_callback(progress_fraction: float):
                """Update progress_tracker with optimization progress."""
                progress_tracker.set_status(
                    video_id,
                    "processing",
                    progress=progress_fraction,
                    estimated_duration_seconds=estimated_duration_seconds
                )

            timeout_seconds = estimated_duration_seconds * 2.0

            # Call optimize_video directly with progress callback instead of process_uploaded_video
            from backend.services.video_optimizer import optimize_video
            optimized_file = video_path.with_suffix('.optimized.mp4')
            optimize_video(video_path, optimized_file, rotation, timeout=timeout_seconds, progress_callback=optimization_progress_callback)

            # Replace original with optimized
            video_path.unlink()
            optimized_path = optimized_file.rename(video_path)

            # Rename file from _original.mp4 to .mp4 for streaming endpoint
            final_path = optimized_path.parent / optimized_path.name.replace('_original.mp4', '.mp4')
            optimized_path.rename(final_path)

            # Get final metadata after optimization
            final_info = get_video_info(final_path)
            final_duration = get_video_duration(final_path)

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
            logger.info(f"Optimization complete: video_id={video_id}, elapsed={elapsed:.1f}s")

        else:
            # Step 5: No optimization needed - mark as complete
            # Rename file from _original.mp4 to .mp4
            final_path = video_path.parent / video_path.name.replace('_original.mp4', '.mp4')
            video_path.rename(final_path)

            metadata = VideoMetadata(
                video_id=video_id,
                session_id=session_uuid,
                filename=original_filename,
                framerate=video_info['framerate'],
                duration=duration,
                width=video_info['width'],
                height=video_info['height'],
                codec=video_info['codec'],
                gop_size=gop_size
            )

            progress_tracker.set_status(video_id, "complete", progress=1.0, metadata=metadata)
            logger.info(f"No optimization needed: video_id={video_id}")

    except subprocess.TimeoutExpired as e:
        logger.error(f"GOP detection/optimization timeout: video_id={video_id}", exc_info=True)
        storage.cleanup_partial_upload(session_uuid, video_id)
        progress_tracker.set_status(
            video_id,
            "error",
            error_message="Video processing timed out. Video may be too long or complex."
        )
    except Exception as e:
        logger.error(f"GOP detection/optimization failed: video_id={video_id}, error={e}", exc_info=True)
        storage.cleanup_partial_upload(session_uuid, video_id)
        progress_tracker.set_status(
            video_id,
            "error",
            error_message=f"Video processing failed: {str(e)}"
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

        # Extract FAST metadata (codec, dimensions, framerate, duration - returns in ~0.15s)
        # GOP detection deferred to background task for better UX
        try:
            import asyncio
            import functools

            # Run fast metadata extraction (NO GOP detection)
            loop = asyncio.get_event_loop()
            video_info_fast = await asyncio.wait_for(
                loop.run_in_executor(None, functools.partial(get_fast_video_info, original_path)),
                timeout=30.0
            )
            logger.info(f"Fast metadata extracted: codec={video_info_fast['codec']}, "
                       f"resolution={video_info_fast['width']}x{video_info_fast['height']}, "
                       f"framerate={video_info_fast['framerate']:.2f}fps, "
                       f"duration={video_info_fast['duration']:.1f}s")

            # Create metadata response with gop_size=None (will be updated after GOP detection)
            metadata = VideoMetadata(
                video_id=video_id,
                session_id=session_uuid,
                filename=file.filename or "unknown.mp4",
                framerate=video_info_fast['framerate'],
                duration=video_info_fast['duration'],
                width=video_info_fast['width'],
                height=video_info_fast['height'],
                codec=video_info_fast['codec'],
                gop_size=None  # Will be populated after GOP detection
            )

            # Initialize progress tracking for GOP detection
            total_frames_estimate = int(video_info_fast['duration'] * video_info_fast['framerate'])
            progress_tracker.set_status(
                video_id,
                "analyzing",
                progress=0.0,
                frames_analyzed=0,
                total_frames=total_frames_estimate
            )

            # Launch background GOP detection + conditional optimization task
            background_tasks.add_task(
                gop_detection_and_optimization_background,
                video_id,
                original_path,
                rotation,
                session_uuid,
                file.filename or "unknown.mp4",
                video_info_fast,
                video_info_fast['duration']
            )

            logger.info(f"Upload complete, GOP detection queued: video_id={video_id}, "
                       f"estimated_frames={total_frames_estimate}")

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
