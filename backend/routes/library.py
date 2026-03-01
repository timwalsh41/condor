"""
Library management endpoints.

Provides CRUD operations for the user's video library, plus HTTP streaming
of stored library videos (HTTP range requests supported).

Validates: REQ-P2-LIB-001, REQ-P2-LIB-002, REQ-P2-LIB-003
"""

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import LibraryVideoCreate, LibraryVideoUpdate, LibraryVideoResponse, ErrorResponse
from backend.orm_models import User
from backend.repositories import library_repository
from backend.routes.video import file_iterator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/library", tags=["library"])


@router.get("", response_model=list[LibraryVideoResponse])
async def list_library(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LibraryVideoResponse]:
    """List all videos in the user's library, newest first.

    Returns:
        list of library video records.
    """
    videos = await library_repository.list_library_videos(db, current_user.id)
    return [LibraryVideoResponse.model_validate(v) for v in videos]


@router.post("", response_model=LibraryVideoResponse, status_code=status.HTTP_201_CREATED)
async def add_to_library(
    payload: LibraryVideoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryVideoResponse:
    """Add a previously uploaded video to the library.

    The ``video_id`` in the request body must correspond to a video that
    was successfully processed by the upload endpoint.

    Args:
        payload: Create request with ``video_id`` and optional metadata.

    Returns:
        The created library video record with extracted technical metadata.

    Raises:
        404 if the video_id does not correspond to a known upload.
    """
    try:
        video = await library_repository.create_library_video(db, current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return LibraryVideoResponse.model_validate(video)


@router.get("/{video_id}", response_model=LibraryVideoResponse)
async def get_library_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryVideoResponse:
    """Retrieve metadata for a single library video.

    Args:
        video_id: UUID of the library video.

    Raises:
        404 if not found or not owned by the current user.
    """
    video = await library_repository.get_library_video(db, current_user.id, video_id)
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return LibraryVideoResponse.model_validate(video)


@router.put("/{video_id}", response_model=LibraryVideoResponse)
async def update_library_video(
    video_id: uuid.UUID,
    payload: LibraryVideoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryVideoResponse:
    """Update editable metadata for a library video.

    Only fields provided in the request body are updated; omitted fields
    are left unchanged.

    Args:
        video_id: UUID of the library video to update.
        payload: Fields to update.

    Raises:
        404 if not found or not owned by the current user.
    """
    video = await library_repository.update_library_video(db, current_user.id, video_id, payload)
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return LibraryVideoResponse.model_validate(video)


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_library_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a library video and its file from disk.

    Args:
        video_id: UUID of the library video to delete.

    Raises:
        404 if not found or not owned by the current user.
    """
    deleted = await library_repository.delete_library_video(db, current_user.id, video_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")


@router.get("/{video_id}/stream", responses={404: {"model": ErrorResponse}, 416: {"model": ErrorResponse}})
async def stream_library_video(
    video_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Stream a library video file with HTTP range request support.

    Allows the frontend to load library videos directly into the video player
    via a standard ``<video src>`` URL.

    Args:
        video_id: UUID of the library video to stream.

    Raises:
        404 if the video is not found or the file does not exist on disk.
        416 if the Range header is invalid.
    """
    video = await library_repository.get_library_video(db, current_user.id, video_id)
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    video_path = Path(video.file_path)
    if not video_path.exists():
        logger.error("Library video file missing on disk (id=%s path=%s)", video_id, video_path)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found on disk")

    file_size = video_path.stat().st_size
    range_header = request.headers.get("Range")

    if not range_header:
        return StreamingResponse(
            file_iterator(video_path),
            media_type="video/mp4",
            headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
        )

    try:
        range_value = range_header.strip().lower().replace("bytes=", "")
        start_str, end_str = range_value.split("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1

        if start < 0 or end >= file_size or start > end:
            raise ValueError("Range out of bounds")

        return StreamingResponse(
            file_iterator(video_path, start, end),
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            media_type="video/mp4",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(end - start + 1),
            },
        )
    except (ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Invalid range request",
            headers={"Content-Range": f"bytes */{file_size}"},
        ) from exc
