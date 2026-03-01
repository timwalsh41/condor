"""
Database connectivity module using SQLAlchemy async engine.

Provides an async engine, session factory, FastAPI dependency for
injecting database sessions, and a connectivity health check.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.sql import text

from backend.config import get_settings

logger = logging.getLogger(__name__)

# Create async engine lazily using settings; pool_pre_ping keeps connections healthy
settings = get_settings()
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verify connection liveness before use
    echo=False,           # Set True for SQL query logging during development
)

# Session factory - expire_on_commit=False avoids lazy-load errors after commit
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields an async database session.

    Ensures the session is closed after each request, even on error.

    Yields:
        AsyncSession: An active SQLAlchemy async session.
    """
    async with AsyncSessionLocal() as session:
        yield session


async def check_db_connectivity() -> bool:
    """Test database connectivity by executing a trivial query.

    Attempts to run ``SELECT 1`` against the configured database.
    Logs success or a descriptive error message on failure.

    Returns:
        bool: True if the database is reachable, False otherwise.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connectivity check passed")
        return True
    except Exception as e:
        logger.warning(f"Database connectivity check failed: {e}")
        return False
