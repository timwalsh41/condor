"""
Video Optimization Service for GOP=30 Re-encoding.

This module provides server-side video optimization to guarantee GOP=30
(keyframe every 30 frames), which simplifies client-side frame cache
implementation and ensures predictable decode performance.

Architecture: Upload → Analyze GOP → Re-encode if needed → Store optimized

Performance Impact:
- GOP=250 (unoptimized): Worst-case backward seek = 2500ms
- GOP=30 (optimized): Worst-case backward seek = 300ms (8x improvement)

Phase: Phase 0 Task 0.3 Phase 2.5 (Technical Spike)
"""

import subprocess
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
import time

logger = logging.getLogger(__name__)


def get_video_info(video_path: Path) -> Dict:
    """
    Extract video metadata using ffprobe.

    Args:
        video_path: Path to video file

    Returns:
        Dictionary with:
            - codec: str (e.g., 'h264', 'hevc')
            - width: int
            - height: int
            - gop_size: int (maximum GOP size from I-frame spacing)
            - framerate: float

    Raises:
        subprocess.CalledProcessError: If ffprobe fails
        ValueError: If video metadata invalid or incomplete
    """
    try:
        # Extract stream metadata
        stream_result = subprocess.run([
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
            '-of', 'json',
            str(video_path)
        ], capture_output=True, text=True, check=True, timeout=30)

        stream_data = json.loads(stream_result.stdout)

        if not stream_data.get('streams'):
            raise ValueError(f"No video streams found in {video_path}")

        stream = stream_data['streams'][0]

        # Extract frame types to calculate GOP size
        frames_result = subprocess.run([
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'frame=pict_type',
            '-of', 'json',
            str(video_path)
        ], capture_output=True, text=True, check=True, timeout=60)

        frames_data = json.loads(frames_result.stdout)
        frames = frames_data.get('frames', [])

        # Calculate GOP size from I-frame positions
        i_frame_indices = [i for i, f in enumerate(frames) if f.get('pict_type') == 'I']

        if len(i_frame_indices) > 1:
            gop_sizes = [i_frame_indices[i+1] - i_frame_indices[i]
                        for i in range(len(i_frame_indices) - 1)]
            # CRITICAL: Use MAX not MEAN to catch worst-case GOP
            # Reason: Variable GOP videos might average 30 but have max 250
            max_gop = int(max(gop_sizes))
        else:
            # Single keyframe or unknown - assume needs optimization
            max_gop = 999

        # Parse framerate (e.g., "30000/1001" → 29.97)
        r_frame_rate = stream['r_frame_rate']
        num, denom = map(int, r_frame_rate.split('/'))
        framerate = num / denom

        return {
            'codec': stream['codec_name'],
            'width': stream['width'],
            'height': stream['height'],
            'gop_size': max_gop,
            'framerate': framerate
        }

    except subprocess.CalledProcessError as e:
        logger.error(f"ffprobe failed for {video_path}: {e.stderr}")
        raise
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error(f"Failed to parse video metadata for {video_path}: {e}")
        raise ValueError(f"Invalid video metadata: {e}")


def get_fast_video_info(video_path: Path) -> Dict:
    """
    Extract fast video metadata WITHOUT GOP detection (returns in ~0.15s).

    This function only extracts stream metadata (codec, dimensions, framerate, duration).
    GOP size detection is deferred to detect_gop_async() for better UX.

    Args:
        video_path: Path to video file

    Returns:
        Dictionary with:
            - codec: str (e.g., 'h264', 'hevc')
            - width: int
            - height: int
            - framerate: float
            - duration: float

    Raises:
        subprocess.CalledProcessError: If ffprobe fails
        ValueError: If video metadata invalid or incomplete
    """
    try:
        # Extract stream metadata only (fast: ~0.15s)
        stream_result = subprocess.run([
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
            '-of', 'json',
            str(video_path)
        ], capture_output=True, text=True, check=True, timeout=30)

        stream_data = json.loads(stream_result.stdout)

        if not stream_data.get('streams'):
            raise ValueError(f"No video streams found in {video_path}")

        stream = stream_data['streams'][0]

        # Extract duration from format (not stream)
        duration_result = subprocess.run([
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(video_path)
        ], capture_output=True, text=True, check=True, timeout=30)

        duration = float(duration_result.stdout.strip())

        # Parse framerate (e.g., "30000/1001" → 29.97)
        r_frame_rate = stream['r_frame_rate']
        num, denom = map(int, r_frame_rate.split('/'))
        framerate = num / denom

        return {
            'codec': stream['codec_name'],
            'width': stream['width'],
            'height': stream['height'],
            'framerate': framerate,
            'duration': duration
        }

    except subprocess.CalledProcessError as e:
        logger.error(f"ffprobe failed for {video_path}: {e.stderr}")
        raise
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error(f"Failed to parse video metadata for {video_path}: {e}")
        raise ValueError(f"Invalid video metadata: {e}")


def detect_gop_size(video_path: Path, progress_callback=None) -> int:
    """
    Detect GOP size by analyzing frame types with optional progress reporting.

    Performance: ~9ms per frame (empirically measured).
    Uses CSV streaming for real-time progress updates.

    Args:
        video_path: Path to video file
        progress_callback: Optional callback(frames_analyzed, total_frames) for progress updates

    Returns:
        Maximum GOP size (keyframe interval), or 999 if detection fails

    Raises:
        subprocess.CalledProcessError: If ffprobe fails
        subprocess.TimeoutExpired: If analysis exceeds timeout
    """
    try:
        # Start ffprobe with CSV output for streaming
        process = subprocess.Popen([
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'frame=pict_type',
            '-of', 'csv=p=0',  # CSV format: just the values, no headers
            str(video_path)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        # Parse frame types incrementally
        i_frame_indices = []
        frame_index = 0

        for line in process.stdout:
            pict_type = line.strip().rstrip(',')  # Strip trailing comma from CSV format

            # Skip empty lines (artifact from CSV format quirk)
            if not pict_type:
                continue

            if pict_type == 'I':
                i_frame_indices.append(frame_index)

            frame_index += 1

            # Report progress every 10 frames to reduce overhead
            if progress_callback and frame_index % 10 == 0:
                progress_callback(frame_index, None)  # total_frames unknown until complete

        # Wait for process to complete
        return_code = process.wait(timeout=120)  # 2 minute timeout

        if return_code != 0:
            stderr = process.stderr.read()
            logger.error(f"ffprobe GOP detection failed: {stderr}")
            raise subprocess.CalledProcessError(return_code, process.args, stderr=stderr)

        # Calculate GOP size from I-frame positions
        if len(i_frame_indices) > 1:
            gop_sizes = [i_frame_indices[i+1] - i_frame_indices[i]
                        for i in range(len(i_frame_indices) - 1)]
            # CRITICAL: Use MAX not MEAN to catch worst-case GOP
            max_gop = int(max(gop_sizes))
        else:
            # Single keyframe or unknown - assume needs optimization
            max_gop = 999

        # Final progress update
        if progress_callback:
            progress_callback(frame_index, frame_index)

        logger.info(f"GOP detection complete: {frame_index} frames analyzed, max_gop={max_gop}")
        return max_gop

    except subprocess.TimeoutExpired:
        logger.error(f"GOP detection timeout for {video_path}")
        if process:
            process.kill()
        # Return 999 to trigger re-encoding (safe fallback)
        return 999
    except Exception as e:
        logger.error(f"GOP detection error for {video_path}: {e}")
        # Return 999 to trigger re-encoding (safe fallback)
        return 999


def detect_gop_async(video_path: Path, video_id, total_frames_estimate: int):
    """
    Background task for GOP detection with progress updates via progress_tracker.

    This function runs in a background thread and updates progress via progress_tracker.set_status().

    Performance: ~9ms per frame (e.g., 1800 frames @ 60fps = ~16 seconds).

    Args:
        video_path: Path to video file
        video_id: UUID for progress tracking
        total_frames_estimate: Estimated total frames (duration * framerate) for progress calculation

    Side Effects:
        - Updates progress_tracker with "analyzing" status and frame progress
        - Updates progress_tracker with GOP size when complete
        - Sets status to "error" if GOP detection fails critically

    Returns:
        Detected GOP size (or 999 on failure)
    """
    from uuid import UUID
    from backend.services import progress_tracker

    logger.info(f"Starting async GOP detection: video_id={video_id}, estimated_frames={total_frames_estimate}")

    def progress_callback(frames_analyzed: int, total_frames: Optional[int]):
        """Update progress tracker with GOP detection progress."""
        actual_total = total_frames if total_frames else total_frames_estimate
        progress = min(frames_analyzed / actual_total, 1.0) if actual_total > 0 else 0.0

        progress_tracker.set_status(
            video_id=UUID(video_id) if isinstance(video_id, str) else video_id,
            status="analyzing",
            progress=progress,
            frames_analyzed=frames_analyzed,
            total_frames=actual_total
        )

    try:
        gop_size = detect_gop_size(video_path, progress_callback)
        logger.info(f"Async GOP detection complete: video_id={video_id}, gop_size={gop_size}")
        return gop_size

    except Exception as e:
        logger.error(f"Async GOP detection failed: video_id={video_id}, error={e}")
        # Set error status only if critically failed (not just fallback to 999)
        progress_tracker.set_status(
            video_id=UUID(video_id) if isinstance(video_id, str) else video_id,
            status="error",
            error_message=f"GOP detection failed: {str(e)}"
        )
        return 999


def needs_optimization(video_info: Dict, rotation: int = 0) -> bool:
    """
    Determine if video needs re-encoding for GOP=30 optimization.

    Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)

    Args:
        video_info: Dictionary from get_video_info() or get_fast_video_info()
        rotation: Rotation angle in degrees (0, 90, 180, 270)

    Returns:
        True if video needs re-encoding, False if already optimal

    Optimization criteria:
        - Codec is HEVC/H.265 (hvc1, hev1) - convert to H.264 for WebCodecs
        - GOP size > 30 (or None/missing, assume needs optimization)
        - Resolution > 1080p
        - Rotation requested (any non-zero rotation)
    """
    codec = video_info['codec'].lower()
    is_hevc = codec in ['hevc', 'hvc1', 'hev1']

    # If GOP size unknown (None or missing), assume needs optimization
    gop_size = video_info.get('gop_size')
    needs_gop_optimization = gop_size is None or gop_size > 30

    return (
        is_hevc or
        needs_gop_optimization or
        video_info['width'] > 1920 or
        video_info['height'] > 1080 or
        rotation != 0
    )


def get_video_duration(video_path: Path) -> float:
    """
    Get video duration in seconds.

    Args:
        video_path: Path to video file

    Returns:
        Duration in seconds

    Raises:
        subprocess.CalledProcessError: If ffprobe fails
    """
    result = subprocess.run([
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        str(video_path)
    ], capture_output=True, text=True, check=True, timeout=30)

    return float(result.stdout.strip())


def get_transpose_filter(rotation: int) -> Optional[str]:
    """
    Get ffmpeg transpose filter for rotation.

    Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)

    Args:
        rotation: Rotation angle (0, 90, 180, 270)

    Returns:
        Transpose filter string or None if no rotation

    Raises:
        ValueError: If rotation angle is invalid
    """
    if rotation == 0:
        return None
    elif rotation == 90:
        return "transpose=1"  # 90° clockwise
    elif rotation == 180:
        return "transpose=1,transpose=1"  # 180° = 90° CW twice
    elif rotation == 270:
        return "transpose=2"  # 90° counter-clockwise
    else:
        raise ValueError(f"Invalid rotation angle: {rotation}. Must be 0, 90, 180, or 270")


def optimize_video(input_path: Path, output_path: Path, rotation: int = 0, timeout: Optional[float] = None, progress_callback=None) -> Dict:
    """
    Re-encode video with optimal settings for frame-accurate seeking.

    Re-encodes to H.264 with GOP=30 using software encoder (libx264)
    for WebCodecs compatibility and predictable client-side decode performance.

    Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)

    Args:
        input_path: Path to input video
        output_path: Path for output video
        rotation: Rotation angle in degrees (0, 90, 180, 270)
        timeout: Optional timeout in seconds (default: 2x expected processing time)
        progress_callback: Optional callback(progress_fraction) for progress updates (0.0-1.0)

    Returns:
        Dictionary with processing stats:
            - success: bool
            - encoder: str ('libx264')
            - processing_time: float (seconds)
            - realtime_factor: float (processing_time / video_duration)

    Raises:
        subprocess.CalledProcessError: If ffmpeg fails
        subprocess.TimeoutExpired: If encoding exceeds timeout
        ValueError: If rotation angle is invalid
    """
    import re

    start_time = time.time()
    video_duration = get_video_duration(input_path)

    # Calculate timeout if not provided: 2x expected processing time
    if timeout is None:
        expected_time = video_duration * 0.42
        timeout = expected_time * 2.0
        logger.info(f"Calculated timeout: {timeout:.1f}s (2x expected time)")

    logger.info(f"Starting video re-encoding with libx264 (rotation={rotation}°)")

    # Build ffmpeg command
    cmd = [
        'ffmpeg', '-y',
        '-i', str(input_path),
    ]

    # Add video filters (rotation)
    transpose_filter = get_transpose_filter(rotation)
    if transpose_filter:
        cmd.extend(['-vf', transpose_filter])

    # Video encoding settings
    cmd.extend([
        '-c:v', 'libx264',
        '-g', '30',                  # GOP size = 30 frames
        '-keyint_min', '30',         # Minimum GOP size (enforce consistency)
        '-sc_threshold', '0',        # Disable scene cut detection (consistent GOP)
        '-crf', '23',                # Quality (18=visually lossless, 23=high quality)
        '-preset', 'ultrafast',      # Encoding speed (ultrafast for Pi 4)
        '-an',                       # Remove audio
        '-movflags', '+faststart',   # Web-optimized
    ])

    # Add progress reporting if callback provided
    if progress_callback:
        cmd.extend(['-progress', 'pipe:1'])  # Output progress to stdout

    cmd.append(str(output_path))

    # Use Popen for progress reporting, or run() for simple execution
    if progress_callback:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        # Parse progress output
        current_time = 0.0
        for line in process.stdout:
            # ffmpeg progress format: "out_time_ms=12345678" (microseconds)
            if line.startswith('out_time_ms='):
                try:
                    time_us = int(line.split('=')[1].strip())
                    current_time = time_us / 1_000_000  # Convert to seconds
                    progress = min(current_time / video_duration, 1.0) if video_duration > 0 else 0.0
                    progress_callback(progress)
                except (ValueError, IndexError):
                    pass  # Ignore parse errors

        # Wait for completion
        return_code = process.wait(timeout=timeout)
        if return_code != 0:
            stderr = process.stderr.read()
            logger.error(f"ffmpeg encoding failed: {stderr}")
            raise subprocess.CalledProcessError(return_code, cmd, stderr=stderr)
    else:
        # No progress reporting - use simple run()
        subprocess.run(cmd, capture_output=True, timeout=timeout, check=True)

    elapsed = time.time() - start_time
    logger.info(f"Software encoding successful: {elapsed:.1f}s")

    return {
        'success': True,
        'encoder': 'libx264',
        'processing_time': elapsed,
        'realtime_factor': elapsed / video_duration
    }


def process_uploaded_video(video_file: Path, rotation: int = 0, timeout: Optional[float] = None) -> Path:
    """
    Main entry point for video processing.

    Analyzes video and re-encodes if needed (HEVC, GOP > 30, resolution > 1080p, or rotation).

    Validates: REQ-F-UPLOAD-004 (Video Rotation During Upload)

    Args:
        video_file: Path to uploaded video file
        rotation: Rotation angle in degrees (0, 90, 180, 270)
        timeout: Optional timeout in seconds for ffmpeg (default: 2x expected time)

    Returns:
        Path to optimized video (may be same as input if no optimization needed)

    Raises:
        subprocess.CalledProcessError: If ffprobe/ffmpeg fails
        subprocess.TimeoutExpired: If encoding exceeds timeout
        ValueError: If video metadata invalid or rotation invalid
    """
    # Step 1: Analyze video
    logger.info(f"Analyzing video: {video_file.name}")
    info = get_video_info(video_file)
    logger.info(f"Video info: codec={info['codec']}, GOP={info['gop_size']}, "
                f"resolution={info['width']}x{info['height']}, "
                f"framerate={info['framerate']:.2f}")

    # Step 2: Check if optimization needed
    if not needs_optimization(info, rotation):
        logger.info("Video already optimized, skipping re-encoding")
        # Rename _original.mp4 to .mp4 for streaming endpoint
        final_path = video_file.parent / video_file.name.replace('_original.mp4', '.mp4')
        video_file.rename(final_path)
        return final_path

    # Step 3: Re-encode to H.264 with GOP=30 and rotation
    codec = info['codec'].lower()
    is_hevc = codec in ['hevc', 'hvc1', 'hev1']
    reasons = []
    if is_hevc:
        reasons.append(f"codec {info['codec']} → h264")
    if info['gop_size'] > 30:
        reasons.append(f"GOP {info['gop_size']} → 30")
    if rotation != 0:
        reasons.append(f"rotation {rotation}°")

    logger.info(f"Re-encoding video ({', '.join(reasons)})")
    output_file = video_file.with_suffix('.optimized.mp4')

    stats = optimize_video(video_file, output_file, rotation, timeout)

    logger.info(f"Re-encoding complete: encoder={stats['encoder']}, "
                f"time={stats['processing_time']:.1f}s, "
                f"realtime_factor={stats['realtime_factor']:.2f}x")

    # Step 4: Replace original with optimized
    video_file.unlink()
    output_file.rename(video_file)

    return video_file
