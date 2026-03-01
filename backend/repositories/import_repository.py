"""
Import job repository: CRUD operations for ImportJob entities.

All operations are scoped to a user_id.
"""

import uuid
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.orm_models import ImportJob

logger = logging.getLogger(__name__)


async def create_import_job(
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: str = "google_photos",
    items: Optional[dict] = None,
) -> ImportJob:
    """Create a new ImportJob record with status 'pending'.

    Args:
        db: Active async database session.
        user_id: Owning user's UUID.
        provider: Import provider identifier (default: "google_photos").
        items: Optional initial JSONB items payload.

    Returns:
        ImportJob: The newly created ORM instance.
    """
    job = ImportJob(
        user_id=user_id,
        provider=provider,
        status="pending",
        items=items,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


async def get_import_job(
    db: AsyncSession,
    job_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Optional[ImportJob]:
    """Retrieve a single ImportJob by ID, scoped to a user.

    Args:
        db: Active async database session.
        job_id: UUID of the import job.
        user_id: UUID of the owning user (enforces row-level isolation).

    Returns:
        ImportJob or None if not found.
    """
    result = await db.execute(
        select(ImportJob).where(
            ImportJob.id == job_id,
            ImportJob.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_import_job_status(
    db: AsyncSession,
    job: ImportJob,
    status: str,
    items: Optional[dict] = None,
    error_message: Optional[str] = None,
) -> ImportJob:
    """Update the status (and optionally items/error) of an import job.

    Args:
        db: Active async database session.
        job: The ImportJob ORM instance to update.
        status: New status string (pending | running | completed | failed).
        items: Updated JSONB items payload (if any).
        error_message: Error description (if status=failed).

    Returns:
        ImportJob: The updated ORM instance.
    """
    job.status = status
    if items is not None:
        job.items = items
    if error_message is not None:
        job.error_message = error_message
    await db.flush()
    await db.refresh(job)
    return job
