"""
Tests for the mocked Google Photos import endpoints.

Covers repository operations, route-level HTTP tests, and the full
import→library workflow.

Validates: REQ-P2-IMPORT-001
"""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import get_settings
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.main import app
from backend.orm_models import ImportJob, LibraryVideo, User
from backend.repositories import import_repository
from backend.repositories.user_repository import get_or_create_default_user
from backend.routes import google_photos as gp_module


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def engine():
    """Async engine connected to condor_db."""
    settings = get_settings()
    _engine = create_async_engine(settings.DATABASE_URL, echo=False)
    yield _engine
    await _engine.dispose()


@pytest_asyncio.fixture()
async def db(engine):
    """Async session against condor_db."""
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture()
async def test_user(db: AsyncSession) -> User:
    """Return the default user (get-or-create, idempotent)."""
    return await get_or_create_default_user(db)


@pytest_asyncio.fixture(autouse=True)
async def clear_mock_connection(test_user: User):
    """Ensure the in-memory connected state is reset before each test."""
    user_key = str(test_user.id)
    gp_module._connected_users.pop(user_key, None)
    yield
    gp_module._connected_users.pop(user_key, None)


@pytest_asyncio.fixture()
async def async_client(db: AsyncSession, test_user: User):
    """Async HTTP client with DB and user dependencies overridden."""

    async def override_get_db():
        yield db

    async def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def connected_client(async_client: AsyncClient):
    """Async client with Google Photos already connected."""
    resp = await async_client.post("/api/google-photos/connect")
    assert resp.status_code == 200
    return async_client


# ---------------------------------------------------------------------------
# Import repository tests
# ---------------------------------------------------------------------------


class TestImportRepository:
    """Unit tests for import_repository operations.

    Validates: REQ-P2-IMPORT-001
    """

    async def test_create_import_job_returns_pending(
        self, db: AsyncSession, test_user: User
    ):
        """create_import_job creates a row with status='pending'.

        Validates: REQ-P2-IMPORT-001
        """
        job = await import_repository.create_import_job(
            db, user_id=test_user.id, provider="google_photos"
        )
        await db.commit()

        assert job.id is not None
        assert job.status == "pending"
        assert job.provider == "google_photos"
        assert job.user_id == test_user.id

        # Cleanup
        await db.delete(job)
        await db.commit()

    async def test_get_import_job_found(
        self, db: AsyncSession, test_user: User
    ):
        """get_import_job returns the correct record.

        Validates: REQ-P2-IMPORT-001
        """
        job = await import_repository.create_import_job(db, user_id=test_user.id)
        await db.commit()

        fetched = await import_repository.get_import_job(db, job.id, test_user.id)
        assert fetched is not None
        assert fetched.id == job.id

        # Cleanup
        await db.delete(job)
        await db.commit()

    async def test_get_import_job_wrong_user(
        self, db: AsyncSession, test_user: User
    ):
        """get_import_job returns None when user_id doesn't match.

        Validates: REQ-P2-IMPORT-001
        """
        job = await import_repository.create_import_job(db, user_id=test_user.id)
        await db.commit()

        result = await import_repository.get_import_job(db, job.id, uuid.uuid4())
        assert result is None

        # Cleanup
        await db.delete(job)
        await db.commit()

    async def test_update_import_job_status(
        self, db: AsyncSession, test_user: User
    ):
        """update_import_job_status persists status and items changes.

        Validates: REQ-P2-IMPORT-001
        """
        job = await import_repository.create_import_job(db, user_id=test_user.id)
        await db.commit()

        updated = await import_repository.update_import_job_status(
            db, job, status="completed", items={"videos": ["v1"]}
        )
        await db.commit()

        assert updated.status == "completed"
        assert updated.items == {"videos": ["v1"]}

        # Cleanup
        await db.delete(updated)
        await db.commit()


# ---------------------------------------------------------------------------
# HTTP route tests
# ---------------------------------------------------------------------------


class TestGooglePhotosRoutes:
    """HTTP-level tests for /api/google-photos endpoints.

    Validates: REQ-P2-IMPORT-001
    """

    # Status / Connect / Disconnect ------------------------------------------

    async def test_status_not_connected(self, async_client: AsyncClient):
        """GET /status returns connected=False when not connected.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await async_client.get("/api/google-photos/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is False
        assert data["account_email"] is None

    async def test_connect_sets_connected(self, async_client: AsyncClient):
        """POST /connect returns connected=True and a mock email.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await async_client.post("/api/google-photos/connect")
        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is True
        assert "@" in data["account_email"]

    async def test_status_after_connect(self, connected_client: AsyncClient):
        """GET /status returns connected=True after connecting.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.get("/api/google-photos/status")
        assert resp.status_code == 200
        assert resp.json()["connected"] is True

    async def test_disconnect_clears_connection(self, connected_client: AsyncClient):
        """POST /disconnect returns 200 and clears connection state.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.post("/api/google-photos/disconnect")
        assert resp.status_code == 200

        status_resp = await connected_client.get("/api/google-photos/status")
        assert status_resp.json()["connected"] is False

    # Albums -----------------------------------------------------------------

    async def test_list_albums_requires_connection(self, async_client: AsyncClient):
        """GET /albums returns 401 when not connected.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await async_client.get("/api/google-photos/albums")
        assert resp.status_code == 401

    async def test_list_albums_returns_mock_data(self, connected_client: AsyncClient):
        """GET /albums returns the hardcoded mock album list.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.get("/api/google-photos/albums")
        assert resp.status_code == 200
        albums = resp.json()
        assert len(albums) == 3
        titles = [a["title"] for a in albums]
        assert "Golf Practice 2024" in titles
        assert "Tournament Rounds" in titles
        assert "Swing Analysis" in titles

    # Album videos -----------------------------------------------------------

    async def test_list_album_videos_returns_videos(self, connected_client: AsyncClient):
        """GET /albums/{id}/videos returns videos for a valid album.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.get("/api/google-photos/albums/gp-album-001/videos")
        assert resp.status_code == 200
        videos = resp.json()
        assert len(videos) == 3
        filenames = [v["filename"] for v in videos]
        assert "driver_practice_01.mp4" in filenames

    async def test_list_album_videos_not_found(self, connected_client: AsyncClient):
        """GET /albums/{id}/videos returns 404 for unknown album.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.get("/api/google-photos/albums/nonexistent/videos")
        assert resp.status_code == 404

    async def test_list_album_videos_requires_connection(self, async_client: AsyncClient):
        """GET /albums/{id}/videos returns 401 when not connected.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await async_client.get("/api/google-photos/albums/gp-album-001/videos")
        assert resp.status_code == 401

    # Import -----------------------------------------------------------------

    async def test_import_creates_library_videos(
        self, connected_client: AsyncClient, db: AsyncSession, test_user: User
    ):
        """POST /import creates LibraryVideo rows and a completed ImportJob.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.post(
            "/api/google-photos/import",
            json={"video_ids": ["gp-v001", "gp-v002"]},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "completed"
        assert data["provider"] == "google_photos"
        assert len(data["items"]["videos"]) == 2

        # Cleanup: delete the job and library videos
        job_id = data["id"]
        job = await import_repository.get_import_job(db, uuid.UUID(job_id), test_user.id)
        if job and job.items:
            for item in job.items.get("videos", []):
                lib_id = uuid.UUID(item["library_video_id"])
                from sqlalchemy import select
                result = await db.execute(
                    select(LibraryVideo).where(LibraryVideo.id == lib_id)
                )
                lib_vid = result.scalar_one_or_none()
                if lib_vid:
                    await db.delete(lib_vid)
        if job:
            await db.delete(job)
        await db.commit()

    async def test_import_unknown_video_id_returns_422(
        self, connected_client: AsyncClient
    ):
        """POST /import returns 422 for unknown mock video IDs.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.post(
            "/api/google-photos/import",
            json={"video_ids": ["gp-v001", "does-not-exist"]},
        )
        assert resp.status_code == 422

    async def test_import_requires_connection(self, async_client: AsyncClient):
        """POST /import returns 401 when not connected.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await async_client.post(
            "/api/google-photos/import",
            json={"video_ids": ["gp-v001"]},
        )
        assert resp.status_code == 401

    async def test_get_import_job_status(
        self, connected_client: AsyncClient, db: AsyncSession, test_user: User
    ):
        """GET /import/{job_id} returns the job status.

        Validates: REQ-P2-IMPORT-001
        """
        # Create a job via import
        resp = await connected_client.post(
            "/api/google-photos/import",
            json={"video_ids": ["gp-v003"]},
        )
        assert resp.status_code == 201
        job_id = resp.json()["id"]

        # Fetch it
        status_resp = await connected_client.get(f"/api/google-photos/import/{job_id}")
        assert status_resp.status_code == 200
        assert status_resp.json()["id"] == job_id
        assert status_resp.json()["status"] == "completed"

        # Cleanup
        job = await import_repository.get_import_job(db, uuid.UUID(job_id), test_user.id)
        if job and job.items:
            for item in job.items.get("videos", []):
                lib_id = uuid.UUID(item["library_video_id"])
                from sqlalchemy import select
                result = await db.execute(
                    select(LibraryVideo).where(LibraryVideo.id == lib_id)
                )
                lib_vid = result.scalar_one_or_none()
                if lib_vid:
                    await db.delete(lib_vid)
        if job:
            await db.delete(job)
        await db.commit()

    async def test_get_import_job_not_found(self, connected_client: AsyncClient):
        """GET /import/{job_id} returns 404 for an unknown job.

        Validates: REQ-P2-IMPORT-001
        """
        resp = await connected_client.get(f"/api/google-photos/import/{uuid.uuid4()}")
        assert resp.status_code == 404
