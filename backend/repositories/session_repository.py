"""
Session repository: CRUD operations for AnalysisSession entities.

All operations are scoped to a user_id so records are correctly isolated
to the single default user.
"""

import uuid
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import AnalysisSessionCreate, AnalysisSessionUpdate
from backend.orm_models import AnalysisSession

logger = logging.getLogger(__name__)


async def create_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    payload: AnalysisSessionCreate,
) -> AnalysisSession:
    """Create a new analysis session.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        payload: Validated create request.

    Returns:
        AnalysisSession: The newly created ORM instance.
    """
    # Serialize annotation payload to plain dict for JSONB storage
    annotations_dict = (
        payload.annotations.model_dump() if payload.annotations else None
    )

    session = AnalysisSession(
        id=uuid.uuid4(),
        user_id=user_id,
        name=payload.name,
        notes=payload.notes,
        video_a_id=payload.video_a_id,
        video_b_id=payload.video_b_id,
        sync_frame_a=payload.sync_frame_a,
        sync_frame_b=payload.sync_frame_b,
        trim_start_a=payload.trim_start_a,
        trim_end_a=payload.trim_end_a,
        trim_start_b=payload.trim_start_b,
        trim_end_b=payload.trim_end_b,
        playback_speed=payload.playback_speed,
        loop_playback=payload.loop_playback,
        annotations=annotations_dict,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    logger.info("Analysis session created (id=%s name=%r)", session.id, session.name)
    return session


async def list_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[AnalysisSession]:
    """Return all sessions for the given user, newest first.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.

    Returns:
        list[AnalysisSession]: All sessions for the user.
    """
    result = await db.execute(
        select(AnalysisSession)
        .where(AnalysisSession.user_id == user_id)
        .order_by(AnalysisSession.created_at.desc())
    )
    return list(result.scalars().all())


async def get_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> AnalysisSession | None:
    """Fetch a single session by ID, enforcing user ownership.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        session_id: Session UUID.

    Returns:
        AnalysisSession | None: Matching record, or None if not found.
    """
    result = await db.execute(
        select(AnalysisSession).where(
            AnalysisSession.id == session_id,
            AnalysisSession.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    payload: AnalysisSessionUpdate,
) -> AnalysisSession | None:
    """Update an existing session with the provided fields.

    Only fields present in the payload (exclude_unset) are changed.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        session_id: Session UUID to update.
        payload: Validated update request.

    Returns:
        AnalysisSession | None: Updated record, or None if not found.
    """
    session = await get_session(db, user_id, session_id)
    if session is None:
        return None

    update_data = payload.model_dump(exclude_unset=True)

    # Serialize nested annotation payload if present
    if "annotations" in update_data and update_data["annotations"] is not None:
        ann = payload.annotations
        update_data["annotations"] = ann.model_dump() if ann else None

    for field, value in update_data.items():
        setattr(session, field, value)

    await db.commit()
    await db.refresh(session)
    logger.info("Analysis session updated (id=%s)", session_id)
    return session


async def delete_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> bool:
    """Delete a session.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        session_id: Session UUID to delete.

    Returns:
        bool: True if deleted, False if not found.
    """
    session = await get_session(db, user_id, session_id)
    if session is None:
        return False

    await db.delete(session)
    await db.commit()
    logger.info("Analysis session deleted (id=%s)", session_id)
    return True
