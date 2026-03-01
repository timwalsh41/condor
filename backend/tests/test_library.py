"""
Integration tests for the video library API (Task 2.6).

Covers the library repository CRUD operations and the /api/library HTTP
endpoints against the live condor_db.

Validates: REQ-P2-LIB-001, REQ-P2-LIB-002, REQ-P2-LIB-003
"""

import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import get_settings
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.main import app
from backend.models import LibraryVideoCreate, LibraryVideoUpdate
from backend.orm_models import LibraryVideo, User
from backend.repositories import library_repository
from backend.repositories.user_repository import DEFAULT_USER_ID


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
    """Return the default user (assumed to already exist from startup seeding)."""
    from backend.repositories.user_repository import get_or_create_default_user

    return await get_or_create_default_user(db)


@pytest_asyncio.fixture()
async def video_in_db(db: AsyncSession, test_user: User) -> LibraryVideo:
    """Insert a LibraryVideo row directly (bypasses file I/O) for read-path tests."""
    video = LibraryVideo(
        id=uuid.uuid4(),
        user_id=test_user.id,
        file_path="/tmp/test_video.mp4",
        filename="test_video.mp4",
        framerate=30.0,
        duration=10.5,
        width=1920,
        height=1080,
        codec="h264",
        gop_size=None,
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)
    yield video
    # Cleanup
    try:
        await db.delete(video)
        await db.commit()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Repository – list / get / update / delete
# ---------------------------------------------------------------------------


class TestLibraryRepository:
    """Test CRUD operations of the library repository.

    Validates: REQ-P2-LIB-001, REQ-P2-LIB-002, REQ-P2-LIB-003
    """

    async def test_list_library_videos_returns_list(
        self, db: AsyncSession, test_user: User, video_in_db: LibraryVideo
    ):
        """list_library_videos returns a list containing the seeded video.

        Validates: REQ-P2-LIB-001
        """
        videos = await library_repository.list_library_videos(db, test_user.id)
        assert isinstance(videos, list)
        ids = [v.id for v in videos]
        assert video_in_db.id in ids

    async def test_get_library_video_found(
        self, db: AsyncSession, test_user: User, video_in_db: LibraryVideo
    ):
        """get_library_video returns the correct record by id.

        Validates: REQ-P2-LIB-001
        """
        result = await library_repository.get_library_video(
            db, test_user.id, video_in_db.id
        )
        assert result is not None
        assert result.id == video_in_db.id
        assert result.filename == "test_video.mp4"

    async def test_get_library_video_not_found(
        self, db: AsyncSession, test_user: User
    ):
        """get_library_video returns None for unknown id.

        Validates: REQ-P2-LIB-001
        """
        result = await library_repository.get_library_video(
            db, test_user.id, uuid.uuid4()
        )
        assert result is None

    async def test_update_library_video_applies_changes(
        self, db: AsyncSession, test_user: User, video_in_db: LibraryVideo
    ):
        """update_library_video persists changed fields and returns the record.

        Validates: REQ-P2-LIB-002
        """
        payload = LibraryVideoUpdate(golfer_name="Tiger Woods", quality_score=9)
        updated = await library_repository.update_library_video(
            db, test_user.id, video_in_db.id, payload
        )
        assert updated is not None
        assert updated.golfer_name == "Tiger Woods"
        assert updated.quality_score == 9

    async def test_update_library_video_not_found(
        self, db: AsyncSession, test_user: User
    ):
        """update_library_video returns None for unknown id.

        Validates: REQ-P2-LIB-002
        """
        payload = LibraryVideoUpdate(notes="ghost")
        result = await library_repository.update_library_video(
            db, test_user.id, uuid.uuid4(), payload
        )
        assert result is None

    async def test_delete_library_video_removes_record(
        self, db: AsyncSession, test_user: User
    ):
        """delete_library_video removes the row and returns True.

        Validates: REQ-P2-LIB-003
        """
        # Create a video to delete (without a real file on disk)
        video = LibraryVideo(
            id=uuid.uuid4(),
            user_id=test_user.id,
            file_path="/tmp/to_delete.mp4",
            filename="to_delete.mp4",
            framerate=24.0,
            duration=5.0,
            width=1280,
            height=720,
            codec="h264",
        )
        db.add(video)
        await db.commit()

        deleted = await library_repository.delete_library_video(
            db, test_user.id, video.id
        )
        assert deleted is True

        # Confirm gone
        result = await library_repository.get_library_video(db, test_user.id, video.id)
        assert result is None

    async def test_delete_library_video_not_found(
        self, db: AsyncSession, test_user: User
    ):
        """delete_library_video returns False for unknown id.

        Validates: REQ-P2-LIB-003
        """
        result = await library_repository.delete_library_video(
            db, test_user.id, uuid.uuid4()
        )
        assert result is False

    async def test_create_library_video_from_upload(
        self, db: AsyncSession, test_user: User, tmp_path: Path
    ):
        """create_library_video copies the file and persists metadata.

        Uses mocked find_video and get_fast_video_info to avoid needing a
        real encoded video file.

        Validates: REQ-P2-LIB-001
        """
        # Create a dummy source file
        fake_upload = tmp_path / "upload.mp4"
        fake_upload.write_bytes(b"fake video content")

        video_id = uuid.uuid4()
        payload = LibraryVideoCreate(video_id=video_id, golfer_name="Test Golfer")

        fake_info = {
            "codec": "h264",
            "width": 1920,
            "height": 1080,
            "framerate": 30.0,
            "duration": 8.0,
        }

        with (
            patch(
                "backend.repositories.library_repository.storage_svc.find_video",
                return_value=fake_upload,
            ),
            patch(
                "backend.repositories.library_repository.get_fast_video_info",
                return_value=fake_info,
            ),
        ):
            settings = get_settings()
            video = await library_repository.create_library_video(db, test_user.id, payload)

        assert video.id is not None
        assert video.golfer_name == "Test Golfer"
        assert video.framerate == 30.0
        assert video.codec == "h264"
        assert video.width == 1920

        # Cleanup
        await db.delete(video)
        await db.commit()
        if Path(video.file_path).exists():
            Path(video.file_path).unlink()


# ---------------------------------------------------------------------------
# Routes – HTTP-level tests
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def async_client(db: AsyncSession, test_user: User):
    """Async HTTP client with DB and user dependencies overridden."""

    # Override get_db to use the test session
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


class TestLibraryRoutes:
    """HTTP-level tests for /api/library endpoints.

    Validates: REQ-P2-LIB-001, REQ-P2-LIB-002, REQ-P2-LIB-003
    """

    async def test_list_library_empty(self, async_client: AsyncClient):
        """GET /api/library returns 200 with a list (possibly empty).

        Validates: REQ-P2-LIB-001
        """
        resp = await async_client.get("/api/library")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_list_library_includes_seeded_video(
        self,
        async_client: AsyncClient,
        video_in_db: LibraryVideo,
    ):
        """GET /api/library includes previously seeded video.

        Validates: REQ-P2-LIB-001
        """
        resp = await async_client.get("/api/library")
        assert resp.status_code == 200
        ids = [v["id"] for v in resp.json()]
        assert str(video_in_db.id) in ids

    async def test_get_library_video_found(
        self,
        async_client: AsyncClient,
        video_in_db: LibraryVideo,
    ):
        """GET /api/library/{id} returns the correct video.

        Validates: REQ-P2-LIB-001
        """
        resp = await async_client.get(f"/api/library/{video_in_db.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(video_in_db.id)
        assert data["filename"] == "test_video.mp4"

    async def test_get_library_video_not_found(self, async_client: AsyncClient):
        """GET /api/library/{id} returns 404 for unknown id.

        Validates: REQ-P2-LIB-001
        """
        resp = await async_client.get(f"/api/library/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_update_library_video(
        self,
        async_client: AsyncClient,
        video_in_db: LibraryVideo,
    ):
        """PUT /api/library/{id} updates metadata and returns the record.

        Validates: REQ-P2-LIB-002
        """
        resp = await async_client.put(
            f"/api/library/{video_in_db.id}",
            json={"golfer_name": "Phil Mickelson", "quality_score": 7},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["golfer_name"] == "Phil Mickelson"
        assert data["quality_score"] == 7

    async def test_update_library_video_not_found(self, async_client: AsyncClient):
        """PUT /api/library/{id} returns 404 for unknown id.

        Validates: REQ-P2-LIB-002
        """
        resp = await async_client.put(
            f"/api/library/{uuid.uuid4()}", json={"notes": "ghost"}
        )
        assert resp.status_code == 404

    async def test_delete_library_video(
        self,
        async_client: AsyncClient,
        db: AsyncSession,
        test_user: User,
    ):
        """DELETE /api/library/{id} returns 204 and removes the record.

        Validates: REQ-P2-LIB-003
        """
        # Insert video directly to avoid file I/O
        video = LibraryVideo(
            id=uuid.uuid4(),
            user_id=test_user.id,
            file_path="/tmp/delete_me.mp4",
            filename="delete_me.mp4",
            framerate=25.0,
            duration=3.0,
            width=640,
            height=480,
            codec="h264",
        )
        db.add(video)
        await db.commit()

        resp = await async_client.delete(f"/api/library/{video.id}")
        assert resp.status_code == 204

        # Confirm gone via GET
        get_resp = await async_client.get(f"/api/library/{video.id}")
        assert get_resp.status_code == 404

    async def test_delete_library_video_not_found(self, async_client: AsyncClient):
        """DELETE /api/library/{id} returns 404 for unknown id.

        Validates: REQ-P2-LIB-003
        """
        resp = await async_client.delete(f"/api/library/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_add_to_library_video_not_found(self, async_client: AsyncClient):
        """POST /api/library returns 404 when video_id is not in upload storage.

        Validates: REQ-P2-LIB-001
        """
        resp = await async_client.post(
            "/api/library", json={"video_id": str(uuid.uuid4())}
        )
        assert resp.status_code == 404
