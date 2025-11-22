#!/bin/bash

# Generate test videos with different GOP sizes for Phase 0 Task 0.3 Phase 2.5
# Tests GOP detection and re-encoding validation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIDEO_DIR="$SCRIPT_DIR/videos"

mkdir -p "$VIDEO_DIR"

echo "Generating GOP test videos..."

# Test Video 1: GOP=30 (already optimal, should skip re-encoding)
echo "1. Generating GOP=30 test video (H.264, 30fps, 5 seconds)..."
ffmpeg -y -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 \
  -vf "drawtext=fontsize=60:fontcolor=white:x=100:y=100:text='GOP30 Frame %{n}'" \
  -c:v libx264 -pix_fmt yuv420p \
  -g 30 -keyint_min 30 -sc_threshold 0 \
  -crf 23 -preset fast \
  -an \
  "$VIDEO_DIR/test_gop30_h264.mp4"

# Test Video 2: GOP=250 (needs optimization)
echo "2. Generating GOP=250 test video (H.264, 30fps, 10 seconds)..."
ffmpeg -y -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -vf "drawtext=fontsize=60:fontcolor=white:x=100:y=100:text='GOP250 Frame %{n}'" \
  -c:v libx264 -pix_fmt yuv420p \
  -g 250 -keyint_min 250 -sc_threshold 0 \
  -crf 23 -preset fast \
  -an \
  "$VIDEO_DIR/test_gop250_h264.mp4"

# Test Video 3: HEVC/H.265 with GOP=30 (needs normalization to H.264)
echo "3. Generating HEVC test video (H.265, 30fps, 5 seconds)..."
ffmpeg -y -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 \
  -vf "drawtext=fontsize=60:fontcolor=white:x=100:y=100:text='HEVC Frame %{n}'" \
  -c:v libx265 \
  -x265-params keyint=30:min-keyint=30:scenecut=0 \
  -crf 23 -preset fast \
  -an \
  "$VIDEO_DIR/test_gop30_hevc.mp4"

# Test Video 4: Variable GOP (needs optimization - max GOP matters)
echo "4. Generating variable GOP test video (H.264, 30fps, 10 seconds)..."
# Enable scene cut detection to create variable GOP
ffmpeg -y -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -vf "drawtext=fontsize=60:fontcolor=white:x=100:y=100:text='VarGOP Frame %{n}'" \
  -c:v libx264 -pix_fmt yuv420p \
  -g 120 -keyint_min 30 \
  -crf 23 -preset fast \
  -an \
  "$VIDEO_DIR/test_vargop_h264.mp4"

echo ""
echo "Verifying GOP sizes with ffprobe..."
echo ""

for video in "$VIDEO_DIR"/test_*.mp4; do
    echo "Analyzing: $(basename "$video")"

    # Get codec
    codec=$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=codec_name \
        -of default=noprint_wrappers=1:nokey=1 \
        "$video")

    # Count I-frames
    i_frames=$(ffprobe -v error -select_streams v:0 \
        -show_entries frame=pict_type \
        -of default=noprint_wrappers=1:nokey=1 \
        "$video" | grep -c "^I$" || true)

    # Count total frames
    total_frames=$(ffprobe -v error -select_streams v:0 \
        -count_frames -show_entries stream=nb_read_frames \
        -of default=noprint_wrappers=1:nokey=1 \
        "$video")

    # Calculate approximate average GOP
    if [ "$i_frames" -gt 1 ]; then
        avg_gop=$((total_frames / i_frames))
    else
        avg_gop="N/A"
    fi

    echo "  Codec: $codec"
    echo "  Total frames: $total_frames"
    echo "  I-frames (keyframes): $i_frames"
    echo "  Approximate avg GOP: $avg_gop"
    echo ""
done

echo "Test videos generated successfully in: $VIDEO_DIR"
echo ""
echo "Next steps:"
echo "1. Run unit tests: pytest backend/services/tests/"
echo "2. Test GOP detection with Python:"
echo "   python3 -c 'from backend.services import get_video_info; from pathlib import Path; print(get_video_info(Path(\"tests/fixtures/videos/test_gop250_h264.mp4\")))'"
echo "3. Test re-encoding:"
echo "   python3 -c 'from backend.services import process_uploaded_video; from pathlib import Path; process_uploaded_video(Path(\"tests/fixtures/videos/test_gop250_h264.mp4\"))'"
