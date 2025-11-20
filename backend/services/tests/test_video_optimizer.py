"""
Unit tests for video_optimizer module.

Tests GOP detection, decision logic, and re-encoding functionality.
Phase: Phase 0 Task 0.3 Phase 2.5 (Technical Spike)
"""

import pytest
from pathlib import Path
from backend.services.video_optimizer import (
    get_video_info,
    needs_optimization,
    optimize_video,
    process_uploaded_video,
)


# ============================================
# UNIT TESTS (Decision Logic & Edge Cases)
# ============================================

def test_needs_optimization_large_gop():
    """Videos with GOP >30 need optimization."""
    video_info = {
        'gop_size': 250,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is True


def test_needs_optimization_already_optimal():
    """Videos with GOP ≤30 and H.264 don't need optimization."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is False


def test_needs_optimization_small_gop():
    """Videos with GOP <30 don't need optimization."""
    video_info = {
        'gop_size': 15,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is False


def test_needs_optimization_hevc_codec():
    """HEVC videos with optimal GOP don't need re-encoding."""
    video_info = {
        'gop_size': 30,
        'codec': 'hevc',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is False


def test_needs_optimization_hevc_small_gop():
    """HEVC videos with GOP <30 don't need re-encoding."""
    video_info = {
        'gop_size': 15,
        'codec': 'hevc',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is False


def test_needs_optimization_other_codec():
    """Other codecs (VP9, AV1, etc.) with optimal GOP don't need re-encoding."""
    video_info = {
        'gop_size': 30,
        'codec': 'vp9',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is False


def test_needs_optimization_large_resolution():
    """Videos >1080p need downscaling."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 3840,  # 4K
        'height': 2160
    }
    assert needs_optimization(video_info) is True


def test_needs_optimization_all_optimal():
    """Video with all optimal parameters doesn't need re-encoding."""
    video_info = {
        'gop_size': 25,
        'codec': 'h264',
        'width': 1280,
        'height': 720
    }
    assert needs_optimization(video_info) is False


# ============================================
# INTEGRATION TESTS (Require ffmpeg/ffprobe)
# ============================================

@pytest.mark.skipif(not Path('/usr/bin/ffprobe').exists(),
                   reason="ffprobe not available")
def test_get_video_info_with_test_video():
    """
    Test GOP size extraction from actual video file.

    Note: Requires test video to exist. This test validates the
    max(gop_sizes) logic vs mean(gop_sizes).
    """
    # This will be tested with generated test videos in next step
    pytest.skip("Requires test video generation - see test_video_generation.sh")


@pytest.mark.skipif(not Path('/usr/bin/ffmpeg').exists(),
                   reason="ffmpeg not available")
def test_optimize_video_produces_gop30():
    """
    Validate that re-encoded video has GOP=30.

    Note: Requires test video and ffmpeg. This is an integration test
    that verifies the entire re-encoding pipeline.
    """
    # This will be tested with generated test videos in next step
    pytest.skip("Requires test video generation - see test_video_generation.sh")


# ============================================
# EDGE CASE TESTS
# ============================================

def test_needs_optimization_edge_gop_30():
    """GOP exactly 30 is optimal (boundary condition)."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is False


def test_needs_optimization_edge_gop_31():
    """GOP 31 needs optimization (boundary condition)."""
    video_info = {
        'gop_size': 31,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is True


def test_needs_optimization_edge_resolution_1920x1080():
    """1080p is optimal (boundary condition)."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is False


def test_needs_optimization_edge_resolution_1921x1080():
    """Width >1920 needs downscaling (boundary condition)."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1921,
        'height': 1080
    }
    assert needs_optimization(video_info) is True
