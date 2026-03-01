"""
SQLAlchemy ORM models for Phase 2 persistence layer.

Defines tables for users, library videos, analysis sessions, and import jobs.
All entities are scoped to a single default user (Phase 2 single-user model).
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


class User(Base):
    """Single default user for Phase 2 (no authentication required).

    Phase 2 deploys with exactly one user record used as the ownership
    anchor for all library videos, sessions, and import jobs.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    display_name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Default User"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    library_videos: Mapped[list["LibraryVideo"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["AnalysisSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    import_jobs: Mapped[list["ImportJob"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class LibraryVideo(Base):
    """A video in the user's library with associated metadata.

    Stores both the file reference (path on disk) and user-editable
    metadata such as golfer name, club, swing date, notes, and quality.
    """

    __tablename__ = "library_videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # File reference
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # Video technical metadata
    framerate: Mapped[float] = mapped_column(Float, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    codec: Mapped[str] = mapped_column(String(50), nullable=False)
    gop_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # User-editable metadata
    golfer_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    club: Mapped[str | None] = mapped_column(String(100), nullable=True)
    swing_date: Mapped[str | None] = mapped_column(String(20), nullable=True)  # ISO date string
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[int | None] = mapped_column(
        Integer,
        CheckConstraint("quality_score BETWEEN 1 AND 5", name="ck_quality_score"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="library_videos")


class AnalysisSession(Base):
    """A saved analysis session capturing full Analyze view state.

    Stores video references, sync points, trim bounds, playback settings,
    and the full annotation payload for both videos.
    """

    __tablename__ = "analysis_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Session metadata
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Video references (nullable to support single-video sessions)
    video_a_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("library_videos.id", ondelete="SET NULL"),
        nullable=True,
    )
    video_b_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("library_videos.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Sync state (frame numbers)
    sync_frame_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sync_frame_b: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Trim state (frame numbers, null = untrimmed)
    trim_start_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trim_end_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trim_start_b: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trim_end_b: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Playback settings
    playback_speed: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    loop_playback: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Annotation payload as JSONB (keyed by video: {a: [...], b: [...]})
    annotations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="sessions")
    video_a: Mapped["LibraryVideo | None"] = relationship(foreign_keys=[video_a_id])
    video_b: Mapped["LibraryVideo | None"] = relationship(foreign_keys=[video_b_id])


class ImportJob(Base):
    """A Google Photos (or other provider) import job.

    Tracks the status of a bulk import operation and its individual items.
    """

    __tablename__ = "import_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, default="google_photos"
    )
    # Status: pending | running | completed | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # List of import items with per-item status (JSONB)
    items: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="import_jobs")
