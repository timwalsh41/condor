"""
Mocked Google Photos import endpoints.

This module provides a simulated Google Photos integration for the MVP.
No real OAuth or Google API calls are made — all auth and media data is
generated in-process to exercise the full import → library workflow.

Validates: REQ-P2-IMPORT-001
"""

import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import (
    GooglePhotosStatus,
    GooglePhotosAlbum,
    GooglePhotosVideo,
    GooglePhotosImportRequest,
    ImportJobResponse,
)
from backend.orm_models import ImportJob, LibraryVideo, User
from backend.repositories import import_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google-photos", tags=["google-photos"])

# ---------------------------------------------------------------------------
# In-memory mock state (resets when server restarts — intentional for MVP)
# ---------------------------------------------------------------------------

# Maps user_id (str) -> mock account email when "connected"
_connected_users: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Static mock catalogue
# ---------------------------------------------------------------------------

_MOCK_ALBUMS: list[dict] = [
    {"id": "gp-album-001", "title": "Golf Practice 2024", "video_count": 3},
    {"id": "gp-album-002", "title": "Tournament Rounds", "video_count": 2},
    {"id": "gp-album-003", "title": "Swing Analysis", "video_count": 5},
]

_MOCK_VIDEOS_BY_ALBUM: dict[str, list[dict]] = {
    "gp-album-001": [
        {"id": "gp-v001", "filename": "driver_practice_01.mp4", "duration": 45.2, "width": 1920, "height": 1080},
        {"id": "gp-v002", "filename": "iron_7_series.mp4",      "duration": 32.8, "width": 1920, "height": 1080},
        {"id": "gp-v003", "filename": "chip_shots_range.mp4",   "duration": 78.0, "width": 1280, "height": 720},
    ],
    "gp-album-002": [
        {"id": "gp-v004", "filename": "tournament_round1.mp4",  "duration": 120.5, "width": 1920, "height": 1080},
        {"id": "gp-v005", "filename": "tournament_round2.mp4",  "duration": 115.3, "width": 1920, "height": 1080},
    ],
    "gp-album-003": [
        {"id": "gp-v006", "filename": "backswing_analysis.mp4",  "duration": 28.0, "width": 1920, "height": 1080},
        {"id": "gp-v007", "filename": "downswing_slo_mo.mp4",    "duration": 15.5, "width": 1920, "height": 1080},
        {"id": "gp-v008", "filename": "follow_through.mp4",      "duration": 22.0, "width": 1280, "height": 720},
        {"id": "gp-v009", "filename": "alignment_drill.mp4",     "duration": 55.0, "width": 1920, "height": 1080},
        {"id": "gp-v010", "filename": "putting_green_session.mp4","duration": 90.3, "width": 1920, "height": 1080},
    ],
}

# Flat lookup for video metadata
_ALL_VIDEOS: dict[str, dict] = {
    v["id"]: v
    for videos in _MOCK_VIDEOS_BY_ALBUM.values()
    for v in videos
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status", response_model=GooglePhotosStatus)
async def get_connection_status(
    current_user: User = Depends(get_current_user),
) -> GooglePhotosStatus:
    """Return the mock Google Photos connection status for the current user.

    Returns:
        GooglePhotosStatus with connected flag and optional account email.
    """
    user_key = str(current_user.id)
    email = _connected_users.get(user_key)
    return GooglePhotosStatus(connected=email is not None, account_email=email)


@router.post("/connect", response_model=GooglePhotosStatus)
async def connect_google_photos(
    current_user: User = Depends(get_current_user),
) -> GooglePhotosStatus:
    """Simulate Google Photos OAuth flow.

    In a production system this would redirect to Google's OAuth endpoint.
    For the mock: immediately marks the user as connected with a fake account.

    Returns:
        GooglePhotosStatus confirming successful (mock) connection.
    """
    user_key = str(current_user.id)
    _connected_users[user_key] = "demo.golfer@gmail.com"
    logger.info("Mock Google Photos connected for user %s", user_key)
    return GooglePhotosStatus(connected=True, account_email="demo.golfer@gmail.com")


@router.post("/disconnect")
async def disconnect_google_photos(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Remove the mock Google Photos connection for the current user.

    Returns:
        Confirmation message dict.
    """
    user_key = str(current_user.id)
    _connected_users.pop(user_key, None)
    logger.info("Mock Google Photos disconnected for user %s", user_key)
    return {"message": "Disconnected from Google Photos"}


@router.get("/albums", response_model=list[GooglePhotosAlbum])
async def list_albums(
    current_user: User = Depends(get_current_user),
) -> list[GooglePhotosAlbum]:
    """Return the mock album catalogue (requires connection).

    Returns:
        List of GooglePhotosAlbum objects.

    Raises:
        HTTPException 401: If the user has not connected Google Photos.
    """
    _require_connected(current_user)
    return [GooglePhotosAlbum(**album) for album in _MOCK_ALBUMS]


@router.get("/albums/{album_id}/videos", response_model=list[GooglePhotosVideo])
async def list_album_videos(
    album_id: str,
    current_user: User = Depends(get_current_user),
) -> list[GooglePhotosVideo]:
    """Return mock videos for a specific album (requires connection).

    Args:
        album_id: Album identifier from the albums list.

    Returns:
        List of GooglePhotosVideo objects for that album.

    Raises:
        HTTPException 401: If not connected.
        HTTPException 404: If the album_id is not found.
    """
    _require_connected(current_user)
    videos = _MOCK_VIDEOS_BY_ALBUM.get(album_id)
    if videos is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Album '{album_id}' not found",
        )
    return [GooglePhotosVideo(**v) for v in videos]


@router.post("/import", response_model=ImportJobResponse, status_code=status.HTTP_201_CREATED)
async def start_import(
    payload: GooglePhotosImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportJobResponse:
    """Import selected Google Photos videos into the library (mocked).

    Creates LibraryVideo records for each requested video_id using mock
    metadata, then records a completed ImportJob for audit purposes.

    Args:
        payload: List of video IDs to import.

    Returns:
        ImportJobResponse with status='completed' and item details.

    Raises:
        HTTPException 401: If not connected.
        HTTPException 422: If any requested video_id is unknown.
    """
    _require_connected(current_user)

    # Validate all requested video IDs exist in mock catalogue
    unknown = [vid for vid in payload.video_ids if vid not in _ALL_VIDEOS]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown mock video IDs: {unknown}",
        )

    # Create an ImportJob (initially pending)
    job = await import_repository.create_import_job(
        db,
        user_id=current_user.id,
        provider="google_photos",
    )

    # Create LibraryVideo rows for each mock video
    imported_items: list[dict] = []
    for video_id in payload.video_ids:
        mock = _ALL_VIDEOS[video_id]
        library_id = uuid.uuid4()

        # Construct a placeholder file path (file does not exist on disk — mock only)
        mock_path = str(
            Path("video_storage") / "library" / str(current_user.id)
            / f"google_photos_{video_id}.mp4"
        )

        lib_video = LibraryVideo(
            id=library_id,
            user_id=current_user.id,
            file_path=mock_path,
            filename=mock["filename"],
            framerate=30.0,
            duration=mock["duration"],
            width=mock["width"],
            height=mock["height"],
            codec="h264",
            gop_size=None,
            notes=f"Imported from Google Photos (mock) — source ID: {video_id}",
        )
        db.add(lib_video)
        imported_items.append(
            {
                "google_photos_id": video_id,
                "library_video_id": str(library_id),
                "filename": mock["filename"],
                "status": "imported",
            }
        )

    # Flush library rows so they are visible before we update the job
    await db.flush()

    # Update job to completed with item summary
    job = await import_repository.update_import_job_status(
        db,
        job,
        status="completed",
        items={"videos": imported_items},
    )

    await db.commit()
    await db.refresh(job)

    logger.info(
        "Google Photos mock import completed: job=%s, %d videos",
        job.id,
        len(imported_items),
    )
    return ImportJobResponse.model_validate(job)


@router.get("/import/{job_id}", response_model=ImportJobResponse)
async def get_import_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportJobResponse:
    """Retrieve the status of a previously created import job.

    Args:
        job_id: UUID of the ImportJob.

    Returns:
        ImportJobResponse with current status and item details.

    Raises:
        HTTPException 404: If the job does not belong to the current user.
    """
    job = await import_repository.get_import_job(db, job_id, current_user.id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import job not found",
        )
    return ImportJobResponse.model_validate(job)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _require_connected(current_user: User) -> None:
    """Raise HTTP 401 if the user has not connected Google Photos.

    Args:
        current_user: The authenticated user.

    Raises:
        HTTPException 401: If the user is not connected.
    """
    if str(current_user.id) not in _connected_users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Photos not connected. Call POST /api/google-photos/connect first.",
        )
