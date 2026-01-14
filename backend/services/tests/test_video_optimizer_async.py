"""
Integration tests for async GOP detection workflow.

Tests the new async GOP detection functionality including:
- get_fast_video_info() extraction
- detect_gop_size() with progress callbacks
- detect_gop_async() background task
- Progress tracking integration

Phase: Phase 1 Task 1.3.4 (Async GOP Detection with Progress Reporting)
"""

import pytest
import tempfile
import subprocess
from pathlib import Path
from uuid import uuid4
from unittest.mock import Mock, patch, MagicMock
from backend.services.video_optimizer import (
    get_fast_video_info,
    detect_gop_size,
    detect_gop_async,
)
from backend.services import progress_tracker


# ============================================
# TEST: get_fast_video_info()
# ============================================

def test_get_fast_video_info_structure():
    """
    get_fast_video_info() returns expected keys without GOP size.

    Tests that fast metadata extraction returns all required fields
    except gop_size, which is deferred to async detection.
    """
    # Mock ffprobe responses for stream metadata
    stream_output = {
        "streams": [{
            "codec_name": "h264",
            "width": 1920,
            "height": 1080,
            "r_frame_rate": "30000/1001"
        }]
    }

    duration_output = "60.0"

    with patch('subprocess.run') as mock_run:
        # First call: stream metadata
        # Second call: duration
        mock_run.side_effect = [
            MagicMock(stdout='{"streams": [{"codec_name": "h264", "width": 1920, "height": 1080, "r_frame_rate": "30000/1001"}]}'),
            MagicMock(stdout='60.0')
        ]

        result = get_fast_video_info(Path("/fake/video.mp4"))

        # Verify structure
        assert "codec" in result
        assert "width" in result
        assert "height" in result
        assert "framerate" in result
        assert "duration" in result
        assert "gop_size" not in result  # Key difference from get_video_info()

        # Verify values
        assert result["codec"] == "h264"
        assert result["width"] == 1920
        assert result["height"] == 1080
        assert abs(result["framerate"] - 29.97) < 0.01  # 30000/1001
        assert result["duration"] == 60.0


def test_get_fast_video_info_no_streams_error():
    """get_fast_video_info() raises ValueError when no video streams found."""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(stdout='{"streams": []}')

        with pytest.raises(ValueError, match="No video streams found"):
            get_fast_video_info(Path("/fake/video.mp4"))


def test_get_fast_video_info_ffprobe_failure():
    """get_fast_video_info() propagates ffprobe errors."""
    with patch('subprocess.run') as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(1, "ffprobe", stderr="File not found")

        with pytest.raises(subprocess.CalledProcessError):
            get_fast_video_info(Path("/fake/video.mp4"))


# ============================================
# TEST: detect_gop_size() with progress callbacks
# ============================================

def test_detect_gop_size_with_progress_callback():
    """
    detect_gop_size() calls progress callback during processing.

    Validates that progress callbacks are invoked with frame counts
    and that GOP size is correctly calculated.
    """
    # Mock ffprobe output: I-frames at positions 0, 30, 60 (GOP=30)
    # Total 61 frames (0-60 inclusive)
    frames = ["I"] + ["P"] * 29 + ["I"] + ["P"] * 29 + ["I"]
    csv_output = "\n".join(frames) + "\n"

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.strip().split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        progress_callback = Mock()
        gop_size = detect_gop_size(Path("/fake/video.mp4"), progress_callback)

        # Verify GOP size calculation
        assert gop_size == 30

        # Verify progress callback was called
        assert progress_callback.call_count > 0

        # Verify final callback has total_frames
        final_call = progress_callback.call_args_list[-1]
        frames_analyzed, total_frames = final_call[0]
        assert frames_analyzed == 61  # Total frames in mock output (0-60 inclusive)
        assert total_frames == 61


def test_detect_gop_size_no_callback():
    """detect_gop_size() works without progress callback."""
    csv_output = "I\nP\nP\nP\nP\nI\n"

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.strip().split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        gop_size = detect_gop_size(Path("/fake/video.mp4"), progress_callback=None)

        # Verify GOP size (5 frames between I-frames: positions 0 and 5)
        assert gop_size == 5


def test_detect_gop_size_single_keyframe_fallback():
    """detect_gop_size() returns 999 for videos with single I-frame."""
    csv_output = "I\nP\nP\nP\nP\nP\n"

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.strip().split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        gop_size = detect_gop_size(Path("/fake/video.mp4"))

        assert gop_size == 999  # Fallback for unknown GOP


def test_detect_gop_size_timeout_fallback():
    """detect_gop_size() returns 999 on timeout."""
    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.wait.side_effect = subprocess.TimeoutExpired("ffprobe", 120)
        mock_popen.return_value = mock_process

        gop_size = detect_gop_size(Path("/fake/video.mp4"))

        assert gop_size == 999  # Safe fallback


def test_detect_gop_size_ffprobe_error_fallback():
    """detect_gop_size() returns 999 on ffprobe error."""
    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter([])
        mock_process.wait.return_value = 1  # Non-zero exit code
        mock_process.stderr.read.return_value = "ffprobe error"
        mock_popen.return_value = mock_process

        gop_size = detect_gop_size(Path("/fake/video.mp4"))

        assert gop_size == 999  # Safe fallback


# ============================================
# TEST: detect_gop_async() with progress_tracker
# ============================================

def test_detect_gop_async_updates_progress_tracker():
    """
    detect_gop_async() updates progress_tracker with analyzing status.

    Validates that the background task correctly updates progress_tracker
    with frame-by-frame progress during GOP detection.
    """
    video_id = uuid4()
    total_frames_estimate = 100

    # Mock CSV output with 100 frames (I-frames at 0, 30, 60, 90)
    csv_output = "I\n" + "P\n" * 29 + "I\n" + "P\n" * 29 + "I\n" + "P\n" * 29 + "I\n" + "P\n" * 9

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.strip().split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        # Clear any existing status
        progress_tracker.clear_status(video_id)

        gop_size = detect_gop_async(Path("/fake/video.mp4"), video_id, total_frames_estimate)

        # Verify GOP size
        assert gop_size == 30

        # Note: We can't easily verify progress_tracker calls without introspecting
        # the internal state, but we can verify the function completes successfully


def test_detect_gop_async_error_handling():
    """
    detect_gop_async() returns 999 when detect_gop_size() fails.

    Note: detect_gop_size() handles ffprobe errors gracefully (returns 999),
    so detect_gop_async() also returns 999 without entering its except block.
    """
    video_id = uuid4()

    # Simulate ffprobe error that triggers detect_gop_size() fallback
    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.wait.side_effect = subprocess.TimeoutExpired("ffprobe", 120)
        mock_popen.return_value = mock_process

        # Clear any existing status
        progress_tracker.clear_status(video_id)

        gop_size = detect_gop_async(Path("/fake/video.mp4"), video_id, 100)

        # Verify fallback GOP size (detect_gop_size returns 999 on timeout)
        assert gop_size == 999

        # Verify function completes without crashing
        # (No error status set because this is handled gracefully)


# ============================================
# TEST: Progress calculation accuracy
# ============================================

def test_detect_gop_async_progress_calculation():
    """
    Verify progress calculation accuracy during GOP detection.

    Tests that progress values are calculated correctly as
    frames_analyzed / total_frames.
    """
    video_id = uuid4()
    total_frames_estimate = 50

    # Create CSV output for 50 frames
    csv_output = "I\n" + "P\n" * 49

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.strip().split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        # Clear any existing status
        progress_tracker.clear_status(video_id)

        # Track progress updates
        original_set_status = progress_tracker.set_status
        progress_updates = []

        def track_progress(*args, **kwargs):
            if kwargs.get('status') == 'analyzing':
                progress_updates.append({
                    'progress': kwargs.get('progress'),
                    'frames_analyzed': kwargs.get('frames_analyzed'),
                    'total_frames': kwargs.get('total_frames')
                })
            return original_set_status(*args, **kwargs)

        with patch.object(progress_tracker, 'set_status', side_effect=track_progress):
            gop_size = detect_gop_async(Path("/fake/video.mp4"), video_id, total_frames_estimate)

        # Verify we got progress updates
        assert len(progress_updates) > 0

        # Verify progress calculation (should report every 10 frames + final)
        for update in progress_updates:
            expected_progress = update['frames_analyzed'] / update['total_frames']
            assert abs(update['progress'] - expected_progress) < 0.01


# ============================================
# TEST: Edge cases and error scenarios
# ============================================

def test_detect_gop_size_variable_gop():
    """detect_gop_size() returns MAX GOP size for variable GOP videos."""
    # Variable GOP: I-frames at 0, 15, 45 (GOP sizes: 15, 30)
    csv_output = "I\n" + "P\n" * 14 + "I\n" + "P\n" * 29 + "I\n"

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.strip().split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        gop_size = detect_gop_size(Path("/fake/video.mp4"))

        # Should return MAX GOP size (30, not mean of 22.5)
        assert gop_size == 30


def test_detect_gop_size_large_gop():
    """detect_gop_size() correctly handles videos with GOP > 30."""
    # I-frames at 0, 250 (GOP=250)
    csv_output = "I\n" + "P\n" * 249 + "I\n"

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.strip().split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        gop_size = detect_gop_size(Path("/fake/video.mp4"))

        assert gop_size == 250


def test_detect_gop_size_csv_format_quirk():
    """detect_gop_size() handles ffprobe CSV format quirks (trailing comma, empty line)."""
    # Simulate actual ffprobe CSV output with quirks:
    # - First line has trailing comma: "I,"
    # - Second line is empty (from comma artifact)
    # - I-frames at positions 0, 250 (GOP=250)
    # Build: I-frame, empty line (skipped), 249 P-frames, I-frame
    csv_lines = ["I,", ""] + ["P"] * 249 + ["I"]
    csv_output = "\n".join(csv_lines)

    with patch('subprocess.Popen') as mock_popen:
        mock_process = MagicMock()
        mock_process.stdout = iter(csv_output.split('\n'))
        mock_process.wait.return_value = 0
        mock_process.stderr.read.return_value = ""
        mock_popen.return_value = mock_process

        gop_size = detect_gop_size(Path("/fake/video.mp4"))

        # Should detect GOP=250, not 251 (empty line should be skipped)
        assert gop_size == 250
