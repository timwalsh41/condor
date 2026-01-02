"""
Unit tests for storage service.

Validates: REQ-F-UPLOAD-002 (Temporary Storage Management)

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

import pytest
import uuid
from pathlib import Path
from backend.services import storage


@pytest.fixture
def session_id():
    """Generate test session ID."""
    return uuid.uuid4()


@pytest.fixture
def video_id():
    """Generate test video ID."""
    return uuid.uuid4()


@pytest.fixture(autouse=True)
def cleanup_test_dirs(session_id):
    """Clean up test directories after each test."""
    yield
    # Cleanup after test
    storage.cleanup_session(session_id)


def test_ensure_session_dir_creates_directory(session_id):
    """
    Test that ensure_session_dir creates session directory.

    Validates: REQ-F-UPLOAD-002 (Session directory creation)
    """
    session_dir = storage.ensure_session_dir(session_id)

    assert session_dir.exists()
    assert session_dir.is_dir()
    assert str(session_id) in str(session_dir)


def test_ensure_session_dir_idempotent(session_id):
    """Test that ensure_session_dir is idempotent (can be called multiple times)."""
    dir1 = storage.ensure_session_dir(session_id)
    dir2 = storage.ensure_session_dir(session_id)

    assert dir1 == dir2
    assert dir1.exists()


def test_get_video_path_returns_correct_path(session_id, video_id):
    """Test that get_video_path returns correct file path."""
    video_path = storage.get_video_path(session_id, video_id)

    assert video_path.parent == storage.get_session_dir(session_id)
    assert video_path.name == f"{video_id}.mp4"


def test_get_video_path_original_returns_correct_path(session_id, video_id):
    """Test that get_video_path with original=True returns correct path."""
    original_path = storage.get_video_path(session_id, video_id, original=True)

    assert original_path.parent == storage.get_session_dir(session_id)
    assert original_path.name == f"{video_id}_original.mp4"


def test_cleanup_session_deletes_all_files(session_id, video_id):
    """
    Test that cleanup_session deletes session directory and all files.

    Validates: REQ-F-UPLOAD-002 (Explicit cleanup on session end)
    """
    # Create session dir and dummy files
    session_dir = storage.ensure_session_dir(session_id)
    test_file = session_dir / "test.mp4"
    test_file.write_text("dummy content")

    # Verify file exists
    assert test_file.exists()

    # Cleanup
    storage.cleanup_session(session_id)

    # Verify directory deleted
    assert not session_dir.exists()
    assert not test_file.exists()


def test_cleanup_video_deletes_video_and_original(session_id, video_id):
    """Test that cleanup_video deletes both video and original files."""
    # Create session dir and dummy files
    session_dir = storage.ensure_session_dir(session_id)
    video_path = storage.get_video_path(session_id, video_id)
    original_path = storage.get_video_path(session_id, video_id, original=True)

    video_path.write_text("video")
    original_path.write_text("original")

    # Verify files exist
    assert video_path.exists()
    assert original_path.exists()

    # Cleanup video
    storage.cleanup_video(session_id, video_id)

    # Verify files deleted
    assert not video_path.exists()
    assert not original_path.exists()
    # Session dir should still exist
    assert session_dir.exists()


def test_cleanup_original_deletes_only_original(session_id, video_id):
    """Test that cleanup_original deletes only original file."""
    # Create session dir and dummy files
    storage.ensure_session_dir(session_id)
    video_path = storage.get_video_path(session_id, video_id)
    original_path = storage.get_video_path(session_id, video_id, original=True)

    video_path.write_text("video")
    original_path.write_text("original")

    # Cleanup original
    storage.cleanup_original(session_id, video_id)

    # Verify only original deleted
    assert video_path.exists()
    assert not original_path.exists()


def test_cleanup_partial_upload_safe_when_no_files(session_id, video_id):
    """Test that cleanup_partial_upload doesn't error if files don't exist."""
    # Should not raise exception
    storage.cleanup_partial_upload(session_id, video_id)


def test_cleanup_session_safe_when_dir_not_exists(session_id):
    """Test that cleanup_session doesn't error if directory doesn't exist."""
    # Should not raise exception
    storage.cleanup_session(session_id)
