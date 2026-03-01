"""
Integration tests for the analysis session API (Task 2.8).

Covers session repository CRUD operations and the /api/sessions HTTP
endpoints against the live condor_db.

Validates: REQ-P2-SESS-001
"""

import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import get_settings
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.main import app
from backend.models import AnalysisSessionCreate, AnalysisSessionUpdate, AnnotationPayload
from backend.orm_models import AnalysisSession, User
from backend.repositories import session_repository
from backend.repositories.user_repository import get_or_create_default_user


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def engine():
    settings = get_settings()
    _engine = create_async_engine(settings.DATABASE_URL, echo=False)
    yield _engine
    await _engine.dispose()


@pytest_asyncio.fixture()
async def db(engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture()
async def test_user(db: AsyncSession) -> User:
    return await get_or_create_default_user(db)


@pytest_asyncio.fixture()
async def session_in_db(db: AsyncSession, test_user: User) -> AnalysisSession:
    """Insert an AnalysisSession row directly for read-path tests."""
    s = AnalysisSession(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Test Session",
        notes="Test notes",
        playback_speed=1.0,
        loop_playback=False,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    yield s
    try:
        await db.delete(s)
        await db.commit()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


class TestSessionRepository:
    """Test CRUD operations of the session repository.

    Validates: REQ-P2-SESS-001
    """

    async def test_create_session_persists(self, db: AsyncSession, test_user: User):
        """create_session returns a persisted record with the correct fields.

        Validates: REQ-P2-SESS-001
        """
        payload = AnalysisSessionCreate(
            name="My Swing Session",
            notes="Wedge practice",
            playback_speed=0.5,
            loop_playback=True,
            annotations=AnnotationPayload(
                a=[{"type": "line", "points": [0, 0, 10, 10]}], b=[]
            ),
        )
        s = await session_repository.create_session(db, test_user.id, payload)
        assert s.id is not None
        assert s.name == "My Swing Session"
        assert s.playback_speed == 0.5
        assert s.loop_playback is True
        assert isinstance(s.annotations, dict)
        assert s.annotations["a"][0]["type"] == "line"

        # cleanup
        await db.delete(s)
        await db.commit()

    async def test_list_sessions_includes_created(
        self, db: AsyncSession, test_user: User, session_in_db: AnalysisSession
    ):
        """list_sessions includes the seeded session.

        Validates: REQ-P2-SESS-001
        """
        sessions = await session_repository.list_sessions(db, test_user.id)
        ids = [s.id for s in sessions]
        assert session_in_db.id in ids

    async def test_get_session_found(
        self, db: AsyncSession, test_user: User, session_in_db: AnalysisSession
    ):
        """get_session returns the matching session by ID.

        Validates: REQ-P2-SESS-001
        """
        result = await session_repository.get_session(db, test_user.id, session_in_db.id)
        assert result is not None
        assert result.id == session_in_db.id
        assert result.name == "Test Session"

    async def test_get_session_not_found(self, db: AsyncSession, test_user: User):
        """get_session returns None for unknown ID.

        Validates: REQ-P2-SESS-001
        """
        result = await session_repository.get_session(db, test_user.id, uuid.uuid4())
        assert result is None

    async def test_update_session_applies_changes(
        self, db: AsyncSession, test_user: User, session_in_db: AnalysisSession
    ):
        """update_session persists updated fields.

        Validates: REQ-P2-SESS-001
        """
        payload = AnalysisSessionUpdate(name="Updated Name", playback_speed=2.0)
        updated = await session_repository.update_session(
            db, test_user.id, session_in_db.id, payload
        )
        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.playback_speed == 2.0
        # Unchanged field preserved
        assert updated.notes == "Test notes"

    async def test_update_session_not_found(self, db: AsyncSession, test_user: User):
        """update_session returns None for unknown ID.

        Validates: REQ-P2-SESS-001
        """
        result = await session_repository.update_session(
            db, test_user.id, uuid.uuid4(), AnalysisSessionUpdate(name="ghost")
        )
        assert result is None

    async def test_delete_session_removes_record(
        self, db: AsyncSession, test_user: User
    ):
        """delete_session removes the row and returns True.

        Validates: REQ-P2-SESS-001
        """
        s = AnalysisSession(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="To Delete",
            playback_speed=1.0,
            loop_playback=False,
        )
        db.add(s)
        await db.commit()

        deleted = await session_repository.delete_session(db, test_user.id, s.id)
        assert deleted is True
        assert await session_repository.get_session(db, test_user.id, s.id) is None

    async def test_delete_session_not_found(self, db: AsyncSession, test_user: User):
        """delete_session returns False for unknown ID.

        Validates: REQ-P2-SESS-001
        """
        result = await session_repository.delete_session(db, test_user.id, uuid.uuid4())
        assert result is False


# ---------------------------------------------------------------------------
# Route tests
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def async_client(db: AsyncSession, test_user: User):
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


class TestSessionRoutes:
    """HTTP-level tests for /api/sessions endpoints.

    Validates: REQ-P2-SESS-001
    """

    async def test_list_sessions(self, async_client: AsyncClient):
        """GET /api/sessions returns 200 with a list.

        Validates: REQ-P2-SESS-001
        """
        resp = await async_client.get("/api/sessions")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_create_session(self, async_client: AsyncClient, db: AsyncSession, test_user: User):
        """POST /api/sessions creates a session and returns 201.

        Validates: REQ-P2-SESS-001
        """
        resp = await async_client.post(
            "/api/sessions",
            json={
                "name": "Route Test Session",
                "notes": "via HTTP",
                "playback_speed": 0.75,
                "loop_playback": True,
                "annotations": {"a": [], "b": []},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Route Test Session"
        assert data["playback_speed"] == 0.75
        assert data["loop_playback"] is True
        assert data["annotations"] == {"a": [], "b": []}
        assert "id" in data

        # cleanup
        s = await session_repository.get_session(db, test_user.id, uuid.UUID(data["id"]))
        if s:
            await db.delete(s)
            await db.commit()

    async def test_get_session_found(
        self, async_client: AsyncClient, session_in_db: AnalysisSession
    ):
        """GET /api/sessions/{id} returns the session.

        Validates: REQ-P2-SESS-001
        """
        resp = await async_client.get(f"/api/sessions/{session_in_db.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Session"

    async def test_get_session_not_found(self, async_client: AsyncClient):
        """GET /api/sessions/{id} returns 404 for unknown id.

        Validates: REQ-P2-SESS-001
        """
        resp = await async_client.get(f"/api/sessions/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_update_session(
        self, async_client: AsyncClient, session_in_db: AnalysisSession
    ):
        """PUT /api/sessions/{id} updates and returns the session.

        Validates: REQ-P2-SESS-001
        """
        resp = await async_client.put(
            f"/api/sessions/{session_in_db.id}",
            json={"name": "Updated via HTTP", "loop_playback": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated via HTTP"
        assert data["loop_playback"] is True

    async def test_update_session_annotations(
        self, async_client: AsyncClient, session_in_db: AnalysisSession
    ):
        """PUT /api/sessions/{id} persists annotation payload.

        Validates: REQ-P2-SESS-001
        """
        annotations = {
            "a": [{"type": "arrow", "points": [0, 0, 50, 50]}],
            "b": [],
        }
        resp = await async_client.put(
            f"/api/sessions/{session_in_db.id}",
            json={"annotations": annotations},
        )
        assert resp.status_code == 200
        assert resp.json()["annotations"]["a"][0]["type"] == "arrow"

    async def test_delete_session(
        self,
        async_client: AsyncClient,
        db: AsyncSession,
        test_user: User,
    ):
        """DELETE /api/sessions/{id} returns 204 and removes the record.

        Validates: REQ-P2-SESS-001
        """
        s = AnalysisSession(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="Delete Me",
            playback_speed=1.0,
            loop_playback=False,
        )
        db.add(s)
        await db.commit()

        resp = await async_client.delete(f"/api/sessions/{s.id}")
        assert resp.status_code == 204

        get_resp = await async_client.get(f"/api/sessions/{s.id}")
        assert get_resp.status_code == 404

    async def test_delete_session_not_found(self, async_client: AsyncClient):
        """DELETE /api/sessions/{id} returns 404 for unknown id.

        Validates: REQ-P2-SESS-001
        """
        resp = await async_client.delete(f"/api/sessions/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_list_sessions_includes_seeded(
        self,
        async_client: AsyncClient,
        session_in_db: AnalysisSession,
    ):
        """GET /api/sessions includes a seeded session.

        Validates: REQ-P2-SESS-001
        """
        resp = await async_client.get("/api/sessions")
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert str(session_in_db.id) in ids
