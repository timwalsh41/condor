"""
User repository: manages the single default user for Phase 2.

Phase 2 uses no authentication. All persistent entities are owned by one
default user that is created on first access (get-or-create pattern).
"""

import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.orm_models import User

logger = logging.getLogger(__name__)

# Well-known UUID for the single default user so it is stable across restarts
DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_USER_NAME = "Default User"


async def get_or_create_default_user(db: AsyncSession) -> User:
    """Return the single default user, creating it if it does not yet exist.

    Uses a fixed UUID so the user identity is stable across application
    restarts and migrations.

    Args:
        db: Active async SQLAlchemy session.

    Returns:
        User: The default user ORM instance.
    """
    result = await db.execute(select(User).where(User.id == DEFAULT_USER_ID))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(id=DEFAULT_USER_ID, display_name=DEFAULT_USER_NAME)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("Created default user (id=%s)", DEFAULT_USER_ID)
    else:
        logger.debug("Resolved default user (id=%s)", DEFAULT_USER_ID)

    return user
