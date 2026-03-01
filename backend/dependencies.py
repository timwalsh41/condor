"""
FastAPI dependencies for Phase 2 user-scoped workflows.

Provides get_current_user — a dependency that resolves (or creates) the
single default user for every request without requiring authentication.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.orm_models import User
from backend.repositories.user_repository import get_or_create_default_user


async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    """FastAPI dependency: resolve the default user for this request.

    Usage in route handlers::

        @router.get("/example")
        async def example(user: User = Depends(get_current_user)):
            ...

    Args:
        db: Injected async database session.

    Returns:
        User: The resolved default user ORM instance.
    """
    return await get_or_create_default_user(db)
