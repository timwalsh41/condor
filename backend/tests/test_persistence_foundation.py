"""
Tests for the persistence foundation (Task 2.4) and user management layer
(Task 2.5).

Validates: REQ-P2-USER-001, REQ-P2-SESS-001, REQ-P2-LIB-001
"""

import uuid
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import get_settings
from backend.orm_models import Base, User, LibraryVideo, AnalysisSession, ImportJob
from backend.repositories.user_repository import (
    get_or_create_default_user,
    DEFAULT_USER_ID,
    DEFAULT_USER_NAME,
)


# ---------------------------------------------------------------------------
# Shared async engine / session fixtures scoped to the test module
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def engine():
    """Create a test engine connecting to the real condor_db.

    Uses the application's DATABASE_URL so tests exercise the same connection
    string as the application runtime.
    """
    settings = get_settings()
    _engine = create_async_engine(settings.DATABASE_URL, echo=False)
    # Ensure schema is present (migrations must have been run beforehand)
    yield _engine
    await _engine.dispose()


@pytest_asyncio.fixture()
async def db(engine):
    """Provide an async session against the live condor_db.

    Tests using this fixture must be idempotent (use fixed IDs, clean up
    any created rows, or rely on get-or-create semantics).
    """
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Task 2.4 – ORM model unit tests (no DB required)
# ---------------------------------------------------------------------------

class TestORMModels:
    """Validate ORM model definitions are correct (REQ-P2-USER-001, REQ-P2-LIB-001, REQ-P2-SESS-001)."""

    def test_user_table_name(self):
        """User model maps to 'users' table."""
        assert User.__tablename__ == "users"

    def test_library_video_table_name(self):
        """LibraryVideo model maps to 'library_videos' table."""
        assert LibraryVideo.__tablename__ == "library_videos"

    def test_analysis_session_table_name(self):
        """AnalysisSession model maps to 'analysis_sessions' table."""
        assert AnalysisSession.__tablename__ == "analysis_sessions"

    def test_import_job_table_name(self):
        """ImportJob model maps to 'import_jobs' table."""
        assert ImportJob.__tablename__ == "import_jobs"

    def test_base_metadata_has_all_tables(self):
        """Base.metadata must reference all four schema tables."""
        table_names = set(Base.metadata.tables.keys())
        assert {"users", "library_videos", "analysis_sessions", "import_jobs"}.issubset(
            table_names
        )

    def test_user_has_required_columns(self):
        """User table must have id, display_name, created_at columns."""
        cols = {c.name for c in User.__table__.columns}
        assert {"id", "display_name", "created_at"}.issubset(cols)

    def test_library_video_user_fk(self):
        """library_videos.user_id must reference users.id."""
        fk_targets = {
            list(c.foreign_keys)[0].target_fullname
            for c in LibraryVideo.__table__.columns
            if c.foreign_keys
        }
        assert "users.id" in fk_targets

    def test_analysis_session_user_fk(self):
        """analysis_sessions.user_id must reference users.id."""
        fk_targets = {
            list(c.foreign_keys)[0].target_fullname
            for c in AnalysisSession.__table__.columns
            if c.foreign_keys
        }
        assert "users.id" in fk_targets

    def test_analysis_session_video_fks(self):
        """analysis_sessions must have foreign keys to library_videos for both video slots."""
        fk_targets: set[str] = set()
        for col in AnalysisSession.__table__.columns:
            for fk in col.foreign_keys:
                fk_targets.add(fk.target_fullname)
        assert fk_targets.issuperset({"library_videos.id"})

    def test_import_job_user_fk(self):
        """import_jobs.user_id must reference users.id."""
        fk_targets = {
            list(c.foreign_keys)[0].target_fullname
            for c in ImportJob.__table__.columns
            if c.foreign_keys
        }
        assert "users.id" in fk_targets


# ---------------------------------------------------------------------------
# Task 2.5 – User repository integration tests (require live DB)
# ---------------------------------------------------------------------------

class TestUserRepository:
    """Validate default-user resolution (REQ-P2-USER-001)."""

    async def test_get_or_create_returns_default_user(self, db):
        """get_or_create_default_user creates and returns the default user.

        Validates: REQ-P2-USER-001 — backend resolves a single default user.
        """
        user = await get_or_create_default_user(db)
        assert isinstance(user, User)
        assert user.id == DEFAULT_USER_ID

    async def test_default_user_has_expected_display_name(self, db):
        """Default user display name matches the well-known constant."""
        user = await get_or_create_default_user(db)
        assert user.display_name == DEFAULT_USER_NAME

    async def test_get_or_create_is_idempotent(self, db):
        """Calling get_or_create twice within the same session returns the same user."""
        user1 = await get_or_create_default_user(db)
        user2 = await get_or_create_default_user(db)
        assert user1.id == user2.id

    async def test_default_user_id_is_stable(self):
        """DEFAULT_USER_ID is a fixed well-known UUID (not random)."""
        assert DEFAULT_USER_ID == uuid.UUID("00000000-0000-0000-0000-000000000001")
