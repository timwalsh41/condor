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
    """
    HEVC videos need re-encoding for WebCodecs compatibility.

    Validates: REQ-F-UPLOAD-004 (HEVC→H.264 conversion)
    """
    video_info = {
        'gop_size': 30,
        'codec': 'hevc',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is True


def test_needs_optimization_hevc_small_gop():
    """
    HEVC videos need re-encoding regardless of GOP (for WebCodecs compatibility).

    Validates: REQ-F-UPLOAD-004 (HEVC→H.264 conversion)
    """
    video_info = {
        'gop_size': 15,
        'codec': 'hevc',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is True


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


def test_needs_optimization_edge_resolution_1920x1081():
    """Width >1920 needs downscaling (boundary condition)."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1081
    }
    assert needs_optimization(video_info) is True


# ============================================
# ROTATION TESTS (REQ-F-UPLOAD-004)
# ============================================

def test_needs_optimization_with_rotation_90():
    """
    Videos with rotation need re-encoding.

    Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)
    """
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info, rotation=90) is True


def test_needs_optimization_with_rotation_180():
    """Videos with 180° rotation need re-encoding."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info, rotation=180) is True


def test_needs_optimization_with_rotation_270():
    """Videos with 270° rotation need re-encoding."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info, rotation=270) is True


def test_needs_optimization_with_rotation_0():
    """Videos with 0° rotation (no rotation) don't need re-encoding if already optimal."""
    video_info = {
        'gop_size': 30,
        'codec': 'h264',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info, rotation=0) is False


# ============================================
# HEVC CODEC TESTS (REQ-F-UPLOAD-004)
# ============================================

def test_needs_optimization_hevc_hvc1():
    """
    HEVC videos (hvc1 codec tag) need re-encoding to H.264.

    Validates: REQ-F-UPLOAD-004 (HEVC→H.264 conversion)
    """
    video_info = {
        'gop_size': 30,
        'codec': 'hvc1',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is True


def test_needs_optimization_hevc_hev1():
    """HEVC videos (hev1 codec tag) need re-encoding to H.264."""
    video_info = {
        'gop_size': 30,
        'codec': 'hev1',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is True


def test_needs_optimization_hevc_uppercase():
    """HEVC videos (uppercase codec) need re-encoding to H.264."""
    video_info = {
        'gop_size': 30,
        'codec': 'HEVC',
        'width': 1920,
        'height': 1080
    }
    assert needs_optimization(video_info) is True


# ============================================
# TRANSPOSE FILTER TESTS
# ============================================

def test_get_transpose_filter_0_degrees():
    """0° rotation returns None (no filter)."""
    from backend.services.video_optimizer import get_transpose_filter
    assert get_transpose_filter(0) is None


def test_get_transpose_filter_90_degrees():
    """90° rotation returns transpose=1 filter."""
    from backend.services.video_optimizer import get_transpose_filter
    assert get_transpose_filter(90) == "transpose=1"


def test_get_transpose_filter_180_degrees():
    """180° rotation returns double transpose filter."""
    from backend.services.video_optimizer import get_transpose_filter
    assert get_transpose_filter(180) == "transpose=1,transpose=1"


def test_get_transpose_filter_270_degrees():
    """270° rotation returns transpose=2 filter."""
    from backend.services.video_optimizer import get_transpose_filter
    assert get_transpose_filter(270) == "transpose=2"


def test_get_transpose_filter_invalid_angle():
    """Invalid rotation angles raise ValueError."""
    from backend.services.video_optimizer import get_transpose_filter
    with pytest.raises(ValueError, match="Invalid rotation angle"):
        get_transpose_filter(45)
