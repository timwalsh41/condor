#!/bin/bash
# Generate reproducible test videos with frame counters for spike validation
# Usage: ./generate_test_videos.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/videos"

mkdir -p "$OUTPUT_DIR"

echo "Generating test videos with frame counters..."

# 30fps, 10 second test video with frame counter (H.264)
echo "  Creating test_30fps_10s.mp4 (H.264)..."
ffmpeg -y -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=100:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2:text='Frame %{n}'" \
  -c:v libx264 -pix_fmt yuv420p -preset fast \
  "$OUTPUT_DIR/test_30fps_10s.mp4" \
  -loglevel error

# 60fps, 5 second test video with frame counter (H.264)
echo "  Creating test_60fps_5s.mp4 (H.264)..."
ffmpeg -y -f lavfi -i testsrc=duration=5:size=1920x1080:rate=60 \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=100:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2:text='Frame %{n}'" \
  -c:v libx264 -pix_fmt yuv420p -preset fast \
  "$OUTPUT_DIR/test_60fps_5s.mp4" \
  -loglevel error

# 30fps, 10 second test video with frame counter (H.265/HEVC)
echo "  Creating test_30fps_10s_hevc.mp4 (H.265/HEVC)..."
ffmpeg -y -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=100:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2:text='Frame %{n}'" \
  -c:v libx265 -pix_fmt yuv420p -preset fast \
  "$OUTPUT_DIR/test_30fps_10s_hevc.mp4" \
  -loglevel error

echo "✓ Test videos generated successfully in $OUTPUT_DIR"
echo ""
echo "Generated videos:"
ls -lh "$OUTPUT_DIR"/*.mp4
