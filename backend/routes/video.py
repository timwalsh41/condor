"""
Video streaming endpoint with HTTP range request support.

Validates: REQ-F-PLAYBACK-003 (Video Streaming)

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from backend.models import ErrorResponse
from backend.services import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video", tags=["video"])

# Chunk size for streaming (1MB)
CHUNK_SIZE = 1024 * 1024


async def file_iterator(file_path: Path, start: int = 0, end: Optional[int] = None):
    """
    Async file iterator for streaming.

    Args:
        file_path: Path to video file
        start: Start byte position
        end: End byte position (inclusive) or None for EOF

    Yields:
        File chunks
    """
    with open(file_path, 'rb') as f:
        f.seek(start)

        if end is None:
            # Stream until EOF
            while True:
                chunk = f.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        else:
            # Stream specific range
            bytes_to_read = end - start + 1
            while bytes_to_read > 0:
                chunk_size = min(CHUNK_SIZE, bytes_to_read)
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
                bytes_to_read -= len(chunk)


@router.get("/{session_id}/{video_id}", responses={
    404: {"model": ErrorResponse},
    416: {"model": ErrorResponse}
})
async def stream_video(
    session_id: uuid.UUID,
    video_id: uuid.UUID,
    request: Request
) -> StreamingResponse:
    """
    Stream video with HTTP range request support.

    Validates: REQ-F-PLAYBACK-003 (Video Streaming)

    Supports:
        - Full file streaming (200 OK)
        - Partial content streaming (206 Partial Content)
        - Range requests for seeking

    Args:
        session_id: Session UUID
        video_id: Video UUID
        request: FastAPI request object (for Range header)

    Returns:
        StreamingResponse with video stream

    Raises:
        HTTPException: If video not found or range invalid
    """
    # Get video file path
    video_path = storage.get_video_path(session_id, video_id)

    if not video_path.exists():
        logger.warning(f"Video not found: session={session_id}, video={video_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    file_size = video_path.stat().st_size

    # Parse Range header
    range_header = request.headers.get("Range")

    if not range_header:
        # No range request - stream full file
        logger.debug(f"Streaming full video: {video_path.name} ({file_size} bytes)")
        return StreamingResponse(
            file_iterator(video_path),
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size)
            }
        )

    # Parse range: "bytes=start-end"
    try:
        range_value = range_header.strip().lower().replace("bytes=", "")
        range_parts = range_value.split("-")

        if len(range_parts) != 2:
            raise ValueError("Invalid range format")

        start_str, end_str = range_parts

        # Parse start byte
        start = int(start_str) if start_str else 0

        # Parse end byte (inclusive)
        if end_str:
            end = int(end_str)
        else:
            end = file_size - 1

        # Validate range
        if start < 0 or end >= file_size or start > end:
            raise ValueError("Range out of bounds")

        content_length = end - start + 1

        logger.debug(f"Streaming partial video: {video_path.name} "
                    f"(bytes {start}-{end}/{file_size})")

        return StreamingResponse(
            file_iterator(video_path, start, end),
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            media_type="video/mp4",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length)
            }
        )

    except (ValueError, IndexError) as e:
        logger.warning(f"Invalid range request: {range_header} ({e})")
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail=f"Invalid range request",
            headers={"Content-Range": f"bytes */{file_size}"}
        )
