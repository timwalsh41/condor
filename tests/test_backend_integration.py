"""
Integration tests for backend API endpoints.

Tests full request/response flows including upload, optimization, and streaming.
Uses real test videos from tests/fixtures/videos/ to validate complete workflow.

Validates:
    - REQ-F-UPLOAD-001: Local File Upload
    - REQ-F-UPLOAD-002: Temporary Storage Management
    - REQ-F-UPLOAD-003: Framerate Validation
    - REQ-F-UPLOAD-004: Video Rotation During Upload
    - REQ-F-PLAYBACK-003: Video Streaming

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

import pytest
import uuid
import io
from pathlib import Path
from fastapi.testclient import TestClient

from backend.main import app
from backend.services import storage

# Test video paths
TEST_VIDEOS_DIR = Path(__file__).parent / "fixtures" / "videos"
TEST_VIDEO_H264_GOP30 = TEST_VIDEOS_DIR / "test_gop30_h264.mp4"
TEST_VIDEO_H264_GOP250 = TEST_VIDEOS_DIR / "test_gop250_h264.mp4"
TEST_VIDEO_HEVC = TEST_VIDEOS_DIR / "test_gop30_hevc.mp4"
TEST_VIDEO_30FPS = TEST_VIDEOS_DIR / "test_30fps_10s.mp4"


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def test_video_h264_optimal():
    """Real H.264 video with GOP=30 (already optimal)."""
    if not TEST_VIDEO_H264_GOP30.exists():
        pytest.skip(f"Test video not found: {TEST_VIDEO_H264_GOP30}")

    with open(TEST_VIDEO_H264_GOP30, 'rb') as f:
        content = f.read()
    return ("test_optimal.mp4", io.BytesIO(content), "video/mp4")


@pytest.fixture
def test_video_h264_large_gop():
    """Real H.264 video with GOP=250 (needs optimization)."""
    if not TEST_VIDEO_H264_GOP250.exists():
        pytest.skip(f"Test video not found: {TEST_VIDEO_H264_GOP250}")

    with open(TEST_VIDEO_H264_GOP250, 'rb') as f:
        content = f.read()
    return ("test_gop250.mp4", io.BytesIO(content), "video/mp4")


@pytest.fixture
def test_video_hevc():
    """Real HEVC video (needs conversion to H.264)."""
    if not TEST_VIDEO_HEVC.exists():
        pytest.skip(f"Test video not found: {TEST_VIDEO_HEVC}")

    with open(TEST_VIDEO_HEVC, 'rb') as f:
        content = f.read()
    return ("test_hevc.mp4", io.BytesIO(content), "video/mp4")


@pytest.fixture(autouse=True)
def cleanup_sessions():
    """Clean up test session directories after each test."""
    yield
    # Cleanup any test sessions in /tmp/condor/
    import shutil
    base_dir = Path("/tmp/condor")
    if base_dir.exists():
        for session_dir in base_dir.iterdir():
            if session_dir.is_dir():
                shutil.rmtree(session_dir)


# ============================================
# HEALTH CHECK TESTS
# ============================================

def test_health_check(client):
    """Test health check endpoint returns 200 OK."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


# ============================================
# UPLOAD ENDPOINT TESTS (REQ-F-UPLOAD-001)
# ============================================

def test_upload_video_success(client, test_video_h264_optimal):
    """
    Test successful video upload with optimal H.264 video.

    Validates: REQ-F-UPLOAD-001 (Local File Upload)
    Validates: REQ-F-UPLOAD-003 (Framerate Validation)
    """
    filename, file_obj, content_type = test_video_h264_optimal

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "0"}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify VideoMetadata structure
    assert "video_id" in data
    assert "session_id" in data
    assert "filename" in data
    assert data["filename"] == filename
    assert "framerate" in data
    assert data["framerate"] > 0  # REQ-F-UPLOAD-003
    assert "codec" in data
    assert data["codec"] == "h264"
    assert "gop_size" in data
    # GOP detection runs in a background task (since commit 92f9ca3), so the
    # immediate response carries gop_size=None; poll the status endpoint.
    assert data["gop_size"] is None
    status_data = _poll_upload_status(client, data["video_id"])
    assert status_data["status"] == "complete"
    assert status_data["metadata"]["gop_size"] == 30  # Already optimal


def _poll_upload_status(client, video_id, max_attempts=50):
    """Poll GET /api/upload/{video_id}/status until a terminal state.

    Matches the documented client contract (docs/API/BACKEND_API.md):
    pending -> analyzing -> processing -> complete | error.
    """
    import time

    for _ in range(max_attempts):
        status_response = client.get(f"/api/upload/{video_id}/status")
        assert status_response.status_code == 200
        status_data = status_response.json()
        if status_data["status"] in ("complete", "error"):
            return status_data
        time.sleep(0.1)
    raise AssertionError(f"Upload {video_id} did not reach a terminal state")


def test_upload_video_auto_generates_session_id(client, test_video_h264_optimal):
    """
    Test that session_id is auto-generated if not provided.

    Validates: REQ-F-UPLOAD-001
    """
    filename, file_obj, content_type = test_video_h264_optimal

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "0"}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify session_id was auto-generated (valid UUID)
    assert "session_id" in data
    uuid.UUID(data["session_id"])  # Should not raise


def test_upload_video_with_session_id(client, test_video_h264_optimal):
    """Test upload with provided session_id."""
    filename, file_obj, content_type = test_video_h264_optimal
    session_id = str(uuid.uuid4())

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"session_id": session_id, "rotation": "0"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == session_id


def test_upload_video_invalid_session_id_format(client, test_video_h264_optimal):
    """
    Test upload with invalid session_id format returns 400.

    Validates: REQ-F-UPLOAD-001 (Input validation)
    """
    filename, file_obj, content_type = test_video_h264_optimal

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"session_id": "not-a-uuid", "rotation": "0"}
    )

    assert response.status_code == 400
    assert "Invalid session_id format" in response.json()["detail"]


def test_upload_video_empty_file(client):
    """
    Test upload of empty file returns 400.

    Validates: REQ-F-UPLOAD-001 (File validation)
    """
    response = client.post(
        "/api/upload",
        files={"file": ("empty.mp4", io.BytesIO(b""), "video/mp4")},
        data={"rotation": "0"}
    )

    assert response.status_code == 400
    assert "Empty file" in response.json()["detail"]


def test_upload_video_invalid_mime_type(client):
    """
    Test upload with non-video MIME type returns 400.

    Validates: REQ-F-UPLOAD-001 (Format validation)
    """
    response = client.post(
        "/api/upload",
        files={"file": ("test.txt", io.BytesIO(b"not a video"), "text/plain")},
        data={"rotation": "0"}
    )

    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_video_oversized_file(client):
    """
    Test upload of file exceeding size limit returns 413.

    Validates: REQ-F-UPLOAD-001 (Size validation)
    """
    # Create a large dummy file (>200MB)
    # Note: This test is slow (generates 201MB in memory)
    large_file = io.BytesIO(b"x" * (201 * 1024 * 1024))

    response = client.post(
        "/api/upload",
        files={"file": ("large.mp4", large_file, "video/mp4")},
        data={"rotation": "0"}
    )

    assert response.status_code == 413
    assert "exceeds maximum size" in response.json()["detail"]


# ============================================
# ROTATION TESTS (REQ-F-UPLOAD-004)
# ============================================

def test_upload_video_with_rotation_90(client, test_video_h264_optimal):
    """
    Test upload with 90° rotation.

    Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)
    """
    filename, file_obj, content_type = test_video_h264_optimal

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "90"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["codec"] == "h264"
    # Rotation triggers re-encoding; GOP detection runs in a background task
    # (since commit 92f9ca3), so poll the status endpoint for the final value.
    assert data["gop_size"] is None
    status_data = _poll_upload_status(client, data["video_id"])
    assert status_data["status"] == "complete"
    assert status_data["metadata"]["gop_size"] == 30


def test_upload_video_with_rotation_180(client, test_video_h264_optimal):
    """Test upload with 180° rotation."""
    filename, file_obj, content_type = test_video_h264_optimal

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "180"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["codec"] == "h264"


def test_upload_video_with_rotation_270(client, test_video_h264_optimal):
    """Test upload with 270° rotation."""
    filename, file_obj, content_type = test_video_h264_optimal

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "270"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["codec"] == "h264"


def test_upload_video_invalid_rotation_angle(client, test_video_h264_optimal):
    """
    Test upload with invalid rotation angle returns 400.

    Validates: REQ-F-UPLOAD-004 (Rotation validation)
    """
    filename, file_obj, content_type = test_video_h264_optimal

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "45"}
    )

    assert response.status_code == 400
    assert "Invalid rotation angle" in response.json()["detail"]


# ============================================
# GOP OPTIMIZATION TESTS (REQ-F-UPLOAD-001)
# ============================================

def test_upload_video_with_large_gop_optimization(client, test_video_h264_large_gop):
    """
    Test upload of H.264 video with GOP=250 triggers optimization to GOP=30.

    Validates: REQ-F-UPLOAD-001 (Video optimization)
    """
    import time

    filename, file_obj, content_type = test_video_h264_large_gop

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "0"}
    )

    assert response.status_code == 200
    data = response.json()
    video_id = data["video_id"]

    # Poll for processing completion (async processing)
    max_attempts = 100
    for _ in range(max_attempts):
        status_response = client.get(f"/api/upload/{video_id}/status")
        assert status_response.status_code == 200
        status_data = status_response.json()

        if status_data["status"] == "complete":
            # Verify optimization occurred
            assert status_data["metadata"]["codec"] == "h264"
            assert status_data["metadata"]["gop_size"] == 30  # Optimized from 250 to 30
            return

        assert status_data["status"] == "processing", f"Unexpected status: {status_data['status']}"
        time.sleep(0.1)

    pytest.fail("Processing did not complete within expected time")


# ============================================
# HEVC CONVERSION TESTS (REQ-F-UPLOAD-004)
# ============================================

def test_upload_hevc_video_converts_to_h264(client, test_video_hevc):
    """
    Test upload of HEVC video triggers conversion to H.264.

    Validates: REQ-F-UPLOAD-004 (HEVC→H.264 conversion for WebCodecs)
    """
    import time

    filename, file_obj, content_type = test_video_hevc

    response = client.post(
        "/api/upload",
        files={"file": (filename, file_obj, content_type)},
        data={"rotation": "0"}
    )

    assert response.status_code == 200
    data = response.json()
    video_id = data["video_id"]

    # Poll for processing completion (async processing)
    max_attempts = 100
    for _ in range(max_attempts):
        status_response = client.get(f"/api/upload/{video_id}/status")
        assert status_response.status_code == 200
        status_data = status_response.json()

        if status_data["status"] == "complete":
            # Verify HEVC was converted to H.264
            assert status_data["metadata"]["codec"] == "h264"  # Not hevc/hvc1/hev1
            assert status_data["metadata"]["gop_size"] == 30  # Optimized during conversion
            return

        assert status_data["status"] == "processing", f"Unexpected status: {status_data['status']}"
        time.sleep(0.1)

    pytest.fail("Processing did not complete within expected time")


# ============================================
# UPLOAD STATUS TESTS
# ============================================

def test_get_upload_status_not_found(client):
    """Test get upload status for non-existent video returns 404."""
    fake_video_id = uuid.uuid4()

    response = client.get(f"/api/upload/{fake_video_id}/status")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


# ============================================
# VIDEO STREAMING TESTS (REQ-F-PLAYBACK-003)
# ============================================

def test_stream_video_not_found(client):
    """
    Test streaming non-existent video returns 404.

    Validates: REQ-F-PLAYBACK-003 (Error handling)
    """
    fake_session_id = uuid.uuid4()
    fake_video_id = uuid.uuid4()

    response = client.get(f"/api/video/{fake_session_id}/{fake_video_id}")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_stream_video_full_file(client):
    """
    Test streaming full video file (no Range header).

    Validates: REQ-F-PLAYBACK-003 (Video Streaming)
    """
    # Create a test video file
    session_id = uuid.uuid4()
    video_id = uuid.uuid4()
    storage.ensure_session_dir(session_id)
    video_path = storage.get_video_path(session_id, video_id)
    video_path.write_bytes(b"fake video content")

    response = client.get(f"/api/video/{session_id}/{video_id}")

    assert response.status_code == 200
    assert response.headers["Content-Type"] == "video/mp4"
    assert "Accept-Ranges" in response.headers
    assert response.content == b"fake video content"


def test_stream_video_with_range_request(client):
    """
    Test streaming with HTTP Range request.

    Validates: REQ-F-PLAYBACK-003 (Range request support)
    """
    # Create a test video file
    session_id = uuid.uuid4()
    video_id = uuid.uuid4()
    storage.ensure_session_dir(session_id)
    video_path = storage.get_video_path(session_id, video_id)
    video_path.write_bytes(b"0123456789abcdef")  # 16 bytes

    response = client.get(
        f"/api/video/{session_id}/{video_id}",
        headers={"Range": "bytes=5-10"}
    )

    assert response.status_code == 206  # Partial Content
    assert response.headers["Content-Range"] == "bytes 5-10/16"
    assert response.content == b"56789a"


def test_stream_video_with_open_ended_range(client):
    """Test streaming with open-ended Range request (bytes=10-)."""
    session_id = uuid.uuid4()
    video_id = uuid.uuid4()
    storage.ensure_session_dir(session_id)
    video_path = storage.get_video_path(session_id, video_id)
    video_path.write_bytes(b"0123456789abcdef")  # 16 bytes

    response = client.get(
        f"/api/video/{session_id}/{video_id}",
        headers={"Range": "bytes=10-"}
    )

    assert response.status_code == 206
    assert response.content == b"abcdef"


def test_stream_video_invalid_range_request(client):
    """
    Test streaming with invalid Range request returns 416.

    Validates: REQ-F-PLAYBACK-003 (Error handling)
    """
    session_id = uuid.uuid4()
    video_id = uuid.uuid4()
    storage.ensure_session_dir(session_id)
    video_path = storage.get_video_path(session_id, video_id)
    video_path.write_bytes(b"0123456789")  # 10 bytes

    # Request range beyond file size
    response = client.get(
        f"/api/video/{session_id}/{video_id}",
        headers={"Range": "bytes=100-200"}
    )

    assert response.status_code == 416  # Range Not Satisfiable
    assert "Content-Range" in response.headers


# ============================================
# CLEANUP TESTS (REQ-F-UPLOAD-002)
# ============================================

def test_upload_failure_cleanup(client):
    """
    Test that failed uploads clean up partial files.

    Validates: REQ-F-UPLOAD-002 (Cleanup on failure)
    """
    # Upload an invalid file (will fail during processing)
    response = client.post(
        "/api/upload",
        files={"file": ("invalid.mp4", io.BytesIO(b"not a real video"), "video/mp4")},
        data={"rotation": "0"}
    )

    # Should return 500 (processing failed)
    assert response.status_code == 500

    # Verify no orphaned files remain
    # Note: This is hard to verify without inspecting storage directly
    # The cleanup logic is tested in unit tests for storage service
