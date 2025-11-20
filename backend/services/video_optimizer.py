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


def needs_optimization(video_info: Dict) -> bool:
    """
    Determine if video needs re-encoding for GOP=30 optimization.

    Args:
        video_info: Dictionary from get_video_info()

    Returns:
        True if video needs re-encoding, False if already optimal

    Optimization criteria:
        - GOP size > 30
        - Resolution > 1080p
    """
    return (
        video_info['gop_size'] > 30 or
        video_info['width'] > 1920 or
        video_info['height'] > 1080
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


def optimize_video(input_path: Path, output_path: Path) -> Dict:
    """
    Re-encode video with optimal settings for frame-accurate seeking.

    Re-encodes to H.264 with GOP=30 using software encoder (libx264)
    for WebCodecs compatibility and predictable client-side decode performance.

    Args:
        input_path: Path to input video
        output_path: Path for output video

    Returns:
        Dictionary with processing stats:
            - success: bool
            - encoder: str ('libx264')
            - processing_time: float (seconds)
            - realtime_factor: float (processing_time / video_duration)

    Raises:
        subprocess.CalledProcessError: If ffmpeg fails
        subprocess.TimeoutExpired: If encoding exceeds 5 minute timeout
    """
    start_time = time.time()
    video_duration = get_video_duration(input_path)

    logger.info("Starting video re-encoding with libx264")

    subprocess.run([
        'ffmpeg', '-y',
        '-i', str(input_path),
        '-c:v', 'libx264',
        '-g', '30',                  # GOP size = 30 frames
        '-keyint_min', '30',         # Minimum GOP size (enforce consistency)
        '-sc_threshold', '0',        # Disable scene cut detection (consistent GOP)
        '-crf', '23',                # Quality (18=visually lossless, 23=high quality)
        '-preset', 'ultrafast',      # Encoding speed (ultrafast for Pi 4)
        '-an',                       # Remove audio
        '-movflags', '+faststart',   # Web-optimized
        str(output_path)
    ], capture_output=True, timeout=300, check=True)

    elapsed = time.time() - start_time
    logger.info(f"Software encoding successful: {elapsed:.1f}s")

    return {
        'success': True,
        'encoder': 'libx264',
        'processing_time': elapsed,
        'realtime_factor': elapsed / video_duration
    }


def process_uploaded_video(video_file: Path) -> Path:
    """
    Main entry point for video processing.

    Analyzes video and re-encodes to GOP=30 if needed (GOP > 30 or resolution > 1080p).

    Args:
        video_file: Path to uploaded video file

    Returns:
        Path to optimized video (may be same as input if no optimization needed)

    Raises:
        subprocess.CalledProcessError: If ffprobe/ffmpeg fails
        ValueError: If video metadata invalid
    """
    # Step 1: Analyze video
    logger.info(f"Analyzing video: {video_file.name}")
    info = get_video_info(video_file)
    logger.info(f"Video info: codec={info['codec']}, GOP={info['gop_size']}, "
                f"resolution={info['width']}x{info['height']}, "
                f"framerate={info['framerate']:.2f}")

    # Step 2: Check if optimization needed
    if not needs_optimization(info):
        logger.info("Video already optimized, skipping re-encoding")
        return video_file

    # Step 3: Re-encode to H.264 with GOP=30
    logger.info(f"Re-encoding video (GOP {info['gop_size']} → 30, "
                f"codec {info['codec']} → h264)")
    output_file = video_file.with_suffix('.optimized.mp4')

    stats = optimize_video(video_file, output_file)

    logger.info(f"Re-encoding complete: encoder={stats['encoder']}, "
                f"time={stats['processing_time']:.1f}s, "
                f"realtime_factor={stats['realtime_factor']:.2f}x")

    # Step 4: Replace original with optimized
    video_file.unlink()
    output_file.rename(video_file)

    return video_file
