"""
Session persistence endpoints.

Provides CRUD operations for analysis sessions, enabling save/load/list/delete
of full Analyze view state including video references, sync, trim, and annotations.

Validates: REQ-P2-SESS-001
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import (
    AnalysisSessionCreate,
    AnalysisSessionUpdate,
    AnalysisSessionSummary,
    AnalysisSessionResponse,
)
from backend.orm_models import User
from backend.repositories import session_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=list[AnalysisSessionSummary])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AnalysisSessionSummary]:
    """List all sessions for the current user, newest first.

    Returns lightweight summary records (no annotation payload).

    Returns:
        list of session summaries.
    """
    sessions = await session_repository.list_sessions(db, current_user.id)
    return [AnalysisSessionSummary.model_validate(s) for s in sessions]


@router.post("", response_model=AnalysisSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: AnalysisSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisSessionResponse:
    """Create a new analysis session.

    Persists the full Analyze view state including video references, sync/trim
    frame numbers, playback settings, and annotations.

    Args:
        payload: Session creation request.

    Returns:
        Created session record with all state fields.
    """
    session = await session_repository.create_session(db, current_user.id, payload)
    return AnalysisSessionResponse.model_validate(session)


@router.get("/{session_id}", response_model=AnalysisSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisSessionResponse:
    """Retrieve the full state for a single analysis session.

    Args:
        session_id: UUID of the session to retrieve.

    Raises:
        404 if session is not found or not owned by the current user.
    """
    session = await session_repository.get_session(db, current_user.id, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return AnalysisSessionResponse.model_validate(session)


@router.put("/{session_id}", response_model=AnalysisSessionResponse)
async def update_session(
    session_id: uuid.UUID,
    payload: AnalysisSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisSessionResponse:
    """Update an existing analysis session.

    Only fields present in the request body are updated; omitted fields
    retain their existing values.

    Args:
        session_id: UUID of the session to update.
        payload: Fields to update.

    Raises:
        404 if session is not found or not owned by the current user.
    """
    session = await session_repository.update_session(db, current_user.id, session_id, payload)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return AnalysisSessionResponse.model_validate(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an analysis session.

    Args:
        session_id: UUID of the session to delete.

    Raises:
        404 if session is not found or not owned by the current user.
    """
    deleted = await session_repository.delete_session(db, current_user.id, session_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
