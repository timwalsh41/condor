"""
Unit tests for async upload processing.

Tests background task processing, thread-safety, and timeout handling.

Phase: Phase 1 Task 1.3.1 (Async Upload Processing)
"""

import pytest
import uuid
import time
import threading
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from backend.services import progress_tracker
from backend.routes.upload import optimize_video_background


@pytest.fixture
def video_id():
    """Generate test video ID."""
    return uuid.uuid4()


@pytest.fixture
def session_id():
    """Generate test session ID."""
    return uuid.uuid4()


@pytest.fixture(autouse=True)
def cleanup_progress_tracker(video_id):
    """Clean up progress tracker after each test."""
    yield
    progress_tracker.clear_status(video_id)


def test_progress_tracker_thread_safety(video_id):
    """
    Test that progress_tracker operations are thread-safe.

    Validates: CRITICAL-2 fix (thread-safe progress tracker)
    """
    errors = []

    def set_status_worker(worker_id):
        """Worker thread that sets status repeatedly."""
        try:
            for i in range(100):
                progress_tracker.set_status(
                    video_id,
                    "processing",
                    progress=i / 100.0
                )
        except Exception as e:
            errors.append(f"Worker {worker_id}: {e}")

    # Create multiple threads that all update the same video_id
    threads = []
    for i in range(10):
        thread = threading.Thread(target=set_status_worker, args=(i,))
        threads.append(thread)
        thread.start()

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # Verify no errors occurred
    assert len(errors) == 0, f"Thread safety errors: {errors}"

    # Verify final status can be read
    status = progress_tracker.get_status(video_id)
    assert status is not None
    assert status.status == "processing"


def test_progress_tracker_concurrent_reads_writes(video_id):
    """
    Test concurrent reads and writes to progress tracker.

    Validates: CRITICAL-2 fix (no race conditions)
    """
    errors = []
    read_values = []

    def writer_thread():
        """Thread that writes progress."""
        try:
            for i in range(50):
                progress_tracker.set_status(
                    video_id,
                    "processing",
                    progress=i / 50.0
                )
                time.sleep(0.001)  # Small delay
        except Exception as e:
            errors.append(f"Writer: {e}")

    def reader_thread():
        """Thread that reads progress."""
        try:
            for _ in range(50):
                status = progress_tracker.get_status(video_id)
                if status:
                    read_values.append(status.progress)
                time.sleep(0.001)  # Small delay
        except Exception as e:
            errors.append(f"Reader: {e}")

    # Start writer and multiple readers
    writer = threading.Thread(target=writer_thread)
    readers = [threading.Thread(target=reader_thread) for _ in range(5)]

    writer.start()
    for reader in readers:
        reader.start()

    writer.join()
    for reader in readers:
        reader.join()

    # Verify no errors
    assert len(errors) == 0, f"Concurrency errors: {errors}"
    # Verify we successfully read values
    assert len(read_values) > 0


@patch('backend.routes.upload.process_uploaded_video')
@patch('backend.routes.upload.get_video_info')
@patch('backend.routes.upload.get_video_duration')
def test_optimize_video_background_success(
    mock_duration,
    mock_info,
    mock_process,
    video_id,
    session_id,
    tmp_path
):
    """
    Test successful background optimization.

    Validates: Background task updates progress tracker correctly
    """
    # Setup mocks
    video_path = tmp_path / "test.mp4"
    video_path.touch()

    mock_process.return_value = video_path
    mock_info.return_value = {
        'codec': 'h264',
        'width': 1920,
        'height': 1080,
        'framerate': 30.0,
        'gop_size': 30
    }
    mock_duration.return_value = 10.0

    # Run background task
    optimize_video_background(
        video_id,
        video_path,
        rotation=0,
        session_uuid=session_id,
        original_filename="test.mp4",
        estimated_duration_seconds=4.2
    )

    # Verify final status
    status = progress_tracker.get_status(video_id)
    assert status is not None
    assert status.status == "complete"
    assert status.progress == 1.0
    assert status.metadata is not None
    assert status.metadata.codec == "h264"


@patch('backend.routes.upload.process_uploaded_video')
@patch('backend.routes.upload.storage')
def test_optimize_video_background_timeout(
    mock_storage,
    mock_process,
    video_id,
    session_id,
    tmp_path
):
    """
    Test background optimization timeout handling.

    Validates: CRITICAL-3 fix (timeout handling)
    """
    import subprocess

    # Setup mock to raise TimeoutExpired
    video_path = tmp_path / "test.mp4"
    video_path.touch()

    mock_process.side_effect = subprocess.TimeoutExpired(
        cmd=['ffmpeg'],
        timeout=10.0
    )

    # Run background task
    optimize_video_background(
        video_id,
        video_path,
        rotation=0,
        session_uuid=session_id,
        original_filename="test.mp4",
        estimated_duration_seconds=4.2
    )

    # Verify error status
    status = progress_tracker.get_status(video_id)
    assert status is not None
    assert status.status == "error"
    assert "timed out" in status.error_message.lower()

    # Verify cleanup was called
    mock_storage.cleanup_partial_upload.assert_called_once_with(session_id, video_id)


@patch('backend.routes.upload.process_uploaded_video')
@patch('backend.routes.upload.storage')
def test_optimize_video_background_error(
    mock_storage,
    mock_process,
    video_id,
    session_id,
    tmp_path
):
    """
    Test background optimization error handling.

    Validates: Error handling and cleanup
    """
    # Setup mock to raise error
    video_path = tmp_path / "test.mp4"
    video_path.touch()

    mock_process.side_effect = RuntimeError("FFmpeg failed")

    # Run background task
    optimize_video_background(
        video_id,
        video_path,
        rotation=0,
        session_uuid=session_id,
        original_filename="test.mp4",
        estimated_duration_seconds=4.2
    )

    # Verify error status
    status = progress_tracker.get_status(video_id)
    assert status is not None
    assert status.status == "error"
    assert "optimization failed" in status.error_message.lower()

    # Verify cleanup was called
    mock_storage.cleanup_partial_upload.assert_called_once_with(session_id, video_id)


def test_progress_tracker_estimated_duration(video_id):
    """
    Test that progress tracker stores estimated duration.

    Validates: estimated_duration_seconds field added
    """
    # Set status with estimated duration
    progress_tracker.set_status(
        video_id,
        "processing",
        progress=0.0,
        estimated_duration_seconds=25.5
    )

    # Retrieve and verify
    status = progress_tracker.get_status(video_id)
    assert status is not None
    assert status.estimated_duration_seconds == 25.5


def test_background_task_logs_elapsed_time(video_id, session_id, tmp_path, caplog):
    """
    Test that background task logs elapsed time.

    Validates: Logging for debugging and monitoring
    """
    import logging

    # Set log level to capture INFO logs from backend.routes.upload
    caplog.set_level(logging.INFO, logger='backend.routes.upload')

    with patch('backend.routes.upload.process_uploaded_video') as mock_process, \
         patch('backend.routes.upload.get_video_info') as mock_info, \
         patch('backend.routes.upload.get_video_duration') as mock_duration:

        video_path = tmp_path / "test.mp4"
        video_path.touch()

        mock_process.return_value = video_path
        mock_info.return_value = {
            'codec': 'h264',
            'width': 1920,
            'height': 1080,
            'framerate': 30.0,
            'gop_size': 30
        }
        mock_duration.return_value = 10.0

        # Run background task
        optimize_video_background(
            video_id,
            video_path,
            rotation=0,
            session_uuid=session_id,
            original_filename="test.mp4",
            estimated_duration_seconds=4.2
        )

        # Verify logging contains elapsed time
        assert "elapsed=" in caplog.text
        assert "estimated=" in caplog.text
