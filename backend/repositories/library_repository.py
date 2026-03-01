"""
Library repository: CRUD operations for LibraryVideo entities.

All operations are scoped to a user_id so records are correctly isolated
to the single default user.
"""

import shutil
import uuid
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models import LibraryVideoCreate, LibraryVideoUpdate
from backend.orm_models import LibraryVideo
from backend.services import storage as storage_svc
from backend.services.video_optimizer import get_fast_video_info

logger = logging.getLogger(__name__)


async def create_library_video(
    db: AsyncSession,
    user_id: uuid.UUID,
    payload: LibraryVideoCreate,
) -> LibraryVideo:
    """Add a processed upload to the library.

    Copies the video from temporary upload storage into the persistent
    library directory, extracts technical metadata, and persists the
    LibraryVideo row.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        payload: Validated create request.

    Returns:
        LibraryVideo: The newly created ORM instance.

    Raises:
        ValueError: If the video_id is not found in upload storage.
    """
    settings = get_settings()

    # Locate processed video in temporary upload storage
    video_path = storage_svc.find_video(str(payload.video_id))
    if video_path is None:
        raise ValueError(f"Video {payload.video_id} not found in upload storage")

    # Extract technical metadata synchronously via ffprobe
    info = get_fast_video_info(video_path)

    # Copy to persistent library storage (user-scoped subdirectory)
    library_dir = Path(settings.VIDEO_STORAGE_PATH) / "library" / str(user_id)
    library_dir.mkdir(parents=True, exist_ok=True)
    library_path = library_dir / f"{payload.video_id}.mp4"

    if not library_path.exists():
        shutil.copy2(video_path, library_path)

    video = LibraryVideo(
        id=uuid.uuid4(),
        user_id=user_id,
        file_path=str(library_path),
        filename=video_path.name,
        framerate=info["framerate"],
        duration=info["duration"],
        width=info["width"],
        height=info["height"],
        codec=info["codec"],
        gop_size=info.get("gop_size"),
        golfer_name=payload.golfer_name,
        club=payload.club,
        swing_date=payload.swing_date,
        notes=payload.notes,
        quality_score=payload.quality_score,
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)
    logger.info("Library video created (id=%s, file=%s)", video.id, library_path.name)
    return video


async def list_library_videos(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[LibraryVideo]:
    """Return all library videos for the given user, ordered newest first.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.

    Returns:
        list[LibraryVideo]: All library videos for the user.
    """
    result = await db.execute(
        select(LibraryVideo)
        .where(LibraryVideo.user_id == user_id)
        .order_by(LibraryVideo.created_at.desc())
    )
    return list(result.scalars().all())


async def get_library_video(
    db: AsyncSession,
    user_id: uuid.UUID,
    video_id: uuid.UUID,
) -> LibraryVideo | None:
    """Fetch a single library video by ID, enforcing user ownership.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        video_id: Library video UUID.

    Returns:
        LibraryVideo | None: The matching record, or None if not found.
    """
    result = await db.execute(
        select(LibraryVideo).where(
            LibraryVideo.id == video_id,
            LibraryVideo.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_library_video(
    db: AsyncSession,
    user_id: uuid.UUID,
    video_id: uuid.UUID,
    payload: LibraryVideoUpdate,
) -> LibraryVideo | None:
    """Update user-editable metadata for a library video.

    Only fields explicitly set in the payload are written; unset optional
    fields in the payload leave existing values unchanged.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        video_id: Library video UUID to update.
        payload: Validated update request.

    Returns:
        LibraryVideo | None: Updated record, or None if not found.
    """
    video = await get_library_video(db, user_id, video_id)
    if video is None:
        return None

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(video, field, value)

    await db.commit()
    await db.refresh(video)
    logger.info("Library video updated (id=%s)", video_id)
    return video


async def delete_library_video(
    db: AsyncSession,
    user_id: uuid.UUID,
    video_id: uuid.UUID,
) -> bool:
    """Delete a library video and its file from disk.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        video_id: Library video UUID to delete.

    Returns:
        bool: True if deleted, False if not found.
    """
    video = await get_library_video(db, user_id, video_id)
    if video is None:
        return False

    try:
        Path(video.file_path).unlink(missing_ok=True)
    except OSError as e:
        logger.warning("Could not delete file %s: %s", video.file_path, e)

    await db.delete(video)
    await db.commit()
    logger.info("Library video deleted (id=%s)", video_id)
    return True
