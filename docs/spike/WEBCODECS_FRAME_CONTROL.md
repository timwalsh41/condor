# Precise Frame Control Analysis & WebCodecs Recommendation

**Phase 0 - Task 0.3 Implementation**

**Date**: 2025-11-18
**Status**: In Progress - Phase 2 & 2.5 Complete (MP4 Parser + Server-Side Video Optimization)
**Context**: WebCodecs implementation for exact frame accuracy (0 tolerance) with server-side video optimization (GOP=30) and simple LRU frame cache

**Completed**:

- ✅ Phase 1: Environment Setup & Dependencies (2025-11-16)
- ✅ Phase 2: MP4 Container Parser (2025-11-17)
- ✅ Phase 2.5: Backend Video Optimization (2025-11-18)

**Next**: Phase 3: VideoDecoder Integration & Frame Cache

---

## Executive Summary

The `requestVideoFrameCallback` + `video.currentTime` seeking approach (Tasks 0.2/0.2.1) cannot achieve the deterministic exact frame positioning required for dual-video synchronization. Tests passed with relaxed assertions (±1 frame tolerance) but fail with exact frame matching (0 tolerance).

**Root Cause**: HTML5 video seeking is designed for human-perceived "close enough" seeking, not frame-exact positioning. Browser video decoders optimize for smooth playback, not sample-accurate seeking.

**Recommended Solution**:

1. **Server-side video re-encoding** with GOP=30 (keyframe every 30 frames) to guarantee predictable decode performance
2. **WebCodecs API** for frame-by-frame decode with deterministic frame positioning
3. **Simple LRU cache** (60-120 frames) sufficient with GOP=30 guarantee, avoiding complex dual-cache strategies

**Architecture Benefits**:

- ✅ Exact frame accuracy (0 tolerance) for stepping and seeking
- ✅ Predictable performance: Cache miss <300ms (vs <2000ms with GOP=250)
- ✅ Simpler client code: Single LRU cache (vs adaptive/dual cache complexity)
- ✅ Consistent UX: All videos optimized to same keyframe density

---

## Overview

---

## Problem Analysis: Why requestVideoFrameCallback Failed

### Our Requirement

Single-frame accuracy across stepping and seeking/scrubbing for dual-video synchronization.

### The Critical Realization

**The current implementation cannot support dual-video sync because:**

```typescript
// Video A steps to frame 100
stepToFrame(100); // Actually lands on frame 100 ✓

// Video B steps to frame 100
stepToFrame(100); // Actually lands on frame 99 or 101 ✗

// Result: Videos are now out of sync and you have no way to fix it
```

If `stepToFrame()` is non-deterministic (sometimes hits the target, sometimes doesn't), your sync maintenance becomes **impossible**.

### The Test Failures Are Actually Revealing Sync-Breaking Behavior

Looking at the failure pattern differently now:

```
Expected: 1 frame step
Received: 0 frame step (stuck at same frame)
```

This isn't just "imprecise seeking" - this is **a complete failure to move**. In a dual-video context:

- Video A: Frame 100 → step forward → stays at 100
- Video B: Frame 100 → step forward → moves to 101
- **Result: Videos diverge by 1 frame and can never re-sync**

### Why Browser Video Seeking Won't Work for Your Use Case

The HTML5 `video.currentTime` API is designed for:

- Human-perceived "close enough" seeking
- Efficient codec-based seeking (keyframe jumps)
- Smooth playback experience

It is **NOT designed for**:

- Frame-exact positioning
- Deterministic seeking
- Sample-accurate synchronization

### The Real Architecture You Need

Given your dual-video sync requirement, you have only **two viable approaches**:

#### **Option 1: Server-Side Frame Extraction + Canvas Rendering** (Recommended)

This is how professional video editing tools (Adobe Premiere, DaVinci Resolve) work:

```typescript
// Pre-process videos server-side
// Extract all frames as individual images
POST /api/videos/extract-frames
{
  "videoId": "video1.mp4",
  "framerate": 30
}

// Returns:
// - frames/video1/frame_000000.jpg
// - frames/video1/frame_000001.jpg
// - ... frame_000299.jpg

// Client-side: Display specific frame via Canvas
const displayFrame = (videoId: string, frameNum: number) => {
  const img = new Image();
  img.src = `/api/frames/${videoId}/frame_${frameNum.toString().padStart(6, '0')}.jpg`;
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    setCurrentFrame(frameNum);
  };
};

// Sync is trivial:
const syncVideos = (frameNum: number) => {
  displayFrame('video1', frameNum);  // Always exact
  displayFrame('video2', frameNum);  // Always exact
};
```

**Pros:**

- ✅ Perfect frame accuracy (guaranteed)
- ✅ Instant seeking to any frame
- ✅ Perfect sync between videos
- ✅ No browser video API limitations
- ✅ Works across all browsers identically

**Cons:**

- Storage: 10s video @ 30fps = 300 JPEGs (~500KB compressed)
- Server processing time on upload
- No native video playback (must implement frame-by-frame display)

#### **Option 2: WebCodecs API** (Modern, but limited browser support)

Use the newer [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) for precise frame control:

```typescript
const decoder = new VideoDecoder({
  output: (frame) => {
    // You now have exact decoded frame
    ctx.drawImage(frame, 0, 0);
    frame.close();
  },
  error: (e) => console.error(e),
});

// Configure with video metadata
decoder.configure({
  codec: "avc1.42E01E", // H.264
  codedWidth: 640,
  codedHeight: 480,
});

// Decode specific frame by timestamp
const chunk = new EncodedVideoChunk({
  type: "key",
  timestamp: frameNum * (1000000 / framerate), // microseconds
  data: videoData,
});
decoder.decode(chunk);
```

**Pros:**

- ✅ Frame-accurate decoding
- ✅ Deterministic behavior
- ✅ Can achieve perfect sync

**Cons:**

- ❌ Browser support: Chrome ✓, Firefox ✓, Safari ✗ (as of late 2024)
- ❌ Complex implementation
- ❌ Requires understanding video codec internals
- ❌ Need to handle video container parsing

### Why Your Current Approach is Fundamentally Flawed

The `requestVideoFrameCallback` API is excellent for:

- Detecting which frame is currently displayed
- Synchronizing animations with video playback
- Measuring actual displayed frames

But it **cannot control** which frame gets displayed. It's read-only feedback, not write control.

```typescript
// Current approach:
video.currentTime = 100 / 30; // Request time 3.333s
video.requestVideoFrameCallback((metadata) => {
  // Browser tells you: "I showed you frame 99" or "I showed you frame 101"
  // You have no control over which one it picks
});
```

### The Smoking Gun in Your Code

Look at this pattern in `stepToFrame()`:

```typescript
const handleSeeked = () => {
  // ... force frame rendering ...
  video.requestVideoFrameCallback((_now, metadata) => {
    const actualFrame = calculateFrameNumber(metadata.mediaTime, framerate);

    if (actualFrame === clampedTarget) {
      setCurrentFrame(actualFrame); // Success!
    } else {
      // We missed! Try again...
      const frameDelta = clampedTarget - actualFrame;
      video.currentTime += frameDelta / framerate;
      video.addEventListener("seeked", handleSeeked, { once: true });
    }
  });
};
```

This is **a retry loop admitting the approach doesn't work**. With `MAX_ATTEMPTS = 10`, you're hoping that one of 10 tries will randomly hit the target. This is not a foundation for deterministic dual-video sync.

### Diagnostic Question That Will Prove This

Run this test:

```typescript
// Seek to frame 100 ten times in a row
for (let i = 0; i < 10; i++) {
  video.currentTime = 100 / 30;
  await waitForSeek();
  const frame = await getCurrentFrame();
  console.log(`Attempt ${i}: Landed on frame ${frame}`);
}
```

**If you see:**

```
Attempt 0: Landed on frame 100
Attempt 1: Landed on frame 100
Attempt 2: Landed on frame 100
...
```

Then maybe the current approach can work (with fixes).

**If you see:**

```
Attempt 0: Landed on frame 99
Attempt 1: Landed on frame 100
Attempt 2: Landed on frame 101
Attempt 3: Landed on frame 100
...
```

Then the browser's video seeking is **non-deterministic** and you need a different architecture.

### My Revised Recommendation

**Immediate Action Plan:**

1. **Run the determinism test above** - This is the critical diagnostic

   - If non-deterministic → Current architecture is impossible, need Option 1 or 2
   - If deterministic → Current architecture might work with fixes

2. **Check your test video keyframe structure:**

   ```bash
   ffprobe -select_streams v -show_frames public/test_30fps_10s.mp4 2>&1 | grep "pict_type=I" | wc -l
   ```

   - If `< 300` → Generate I-frame-only test video and retest
   - If `= 300` → Video encoding is not the issue

3. **Based on results, choose path:**
   - **Path A** (Non-deterministic seeking): Pivot to server-side frame extraction
   - **Path B** (Deterministic seeking, wrong keyframes): Fix test video encoding
   - **Path C** (Deterministic seeking, keyframes OK): Fix implementation bugs

### The Hard Truth

Given that you're building a **video sync/comparison tool** (implied by "CloudSwingAnalyzer" and dual-video requirements), you're essentially building a lightweight video editor. Professional video editors don't rely on browser video seeking for frame accuracy - they decode frames to canvas/memory.

You may need to accept that:

- The current `requestVideoFrameCallback` approach is a proof-of-concept
- Production implementation needs server-side frame extraction
- The spike validated the API exists, but not that it solves your problem

**The dual-video sync requirement makes frame-exact deterministic seeking non-negotiable**, and browser video APIs were not designed for this use case.

---

## Recommended Solution: WebCodecs API for Frame-Accurate Control

### Why WebCodecs for Stepping/Seeking

WebCodecs provides **direct access to decoded video frames** via the VideoDecoder interface. Instead of seeking within a video element, we decode specific frames by index and render them to canvas.

**Key Advantages**:

- ✅ **Deterministic**: Frame N is always frame N (no seeking ambiguity)
- ✅ **Exact positioning**: Frame index = exact frame number
- ✅ **Perfect sync**: `displayFrame(decoderA, N); displayFrame(decoderB, N + offset);`
- ✅ **Modern browser support**: Chrome 94+, Firefox 130+, Safari 17.4+ (95% market coverage)
- ✅ **Hardware accelerated**: Uses GPU decode on supported devices

### WebCodecs Architecture (Task 0.3 Scope)

```typescript
// 1. Parse MP4 container to extract codec config and frame data
const mp4Parser = new MP4Parser(videoFile);
await mp4Parser.initialize();
const { codecConfig, samples } = mp4Parser.getVideoTrack();

// 2. Initialize VideoDecoder
const decoder = new VideoDecoder({
  output: (videoFrame) => {
    // Render frame to canvas
    canvasContext.drawImage(videoFrame, 0, 0, canvas.width, canvas.height);
    videoFrame.close(); // Critical: release memory
    setCurrentFrame(videoFrame.frameIndex);
  },
  error: (e) => console.error("Decode error:", e),
});

decoder.configure(codecConfig);

// 3. Decode specific frame by index
function seekToFrame(frameIndex: number) {
  const sample = samples[frameIndex];
  const chunk = new EncodedVideoChunk({
    type: sample.is_sync ? "key" : "delta",
    timestamp: sample.cts,
    duration: sample.duration,
    data: sample.data,
  });
  decoder.decode(chunk);
}

// 4. Frame stepping
function stepForward() {
  seekToFrame(currentFrame + 1);
}

function stepBackward() {
  seekToFrame(currentFrame - 1);
}
```

**Task 0.3 Focus**: Validate exact frame-accurate stepping and seeking with WebCodecs. Continuous playback deferred to Task 0.4 hybrid approach.

---

## Server-Side Video Optimization Strategy

### Why Server-Side Re-encoding with GOP=30

**The Problem**: Videos with large keyframe intervals (GOP=250 frames @ 30fps = ~8 seconds) create severe performance issues:

```typescript
// Worst case: Seek backward from frame 250 to frame 249
// Must decode from keyframe 0 → frame 249
// GOP=250: Decode 250 frames × 10ms = 2500ms (2.5 seconds!) ❌
// GOP=30:  Decode 30 frames × 10ms = 300ms (acceptable) ✅
```

**The Solution**: Re-encode all uploaded videos with guaranteed GOP=30 on the server:

- Reduces max decode latency from 2500ms → 300ms (8x improvement)
- Simplifies client frame cache (60-120 frames vs 250+ frames)
- Eliminates need for complex adaptive caching strategies
- Provides consistent UX across all videos

### Architecture Overview

```
User uploads video → Backend analyzes GOP → Re-encode if needed → Store optimized → Client decodes with simple LRU cache
```

### Smart Re-encoding Implementation

```python
# backend/services/video_optimizer.py
import subprocess
import json
import numpy as np
from pathlib import Path

def get_video_info(video_path: Path) -> dict:
    """Extract video metadata using ffprobe."""
    result = subprocess.run([
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
        '-show_entries', 'frame=pict_type',
        '-of', 'json',
        str(video_path)
    ], capture_output=True, text=True, check=True)

    data = json.loads(result.stdout)

    # Calculate average GOP size from I-frame positions
    frames = data.get('frames', [])
    i_frame_indices = [i for i, f in enumerate(frames) if f.get('pict_type') == 'I']

    if len(i_frame_indices) > 1:
        gop_sizes = np.diff(i_frame_indices)
        avg_gop = int(np.mean(gop_sizes))
    else:
        avg_gop = 999  # Unknown or single keyframe

    stream = data['streams'][0]
    return {
        'codec': stream['codec_name'],
        'width': stream['width'],
        'height': stream['height'],
        'gop_size': avg_gop,
        'framerate': eval(stream['r_frame_rate'])  # e.g., "30/1" → 30.0
    }

def needs_optimization(video_info: dict) -> bool:
    """Determine if video needs re-encoding."""
    return (
        video_info['gop_size'] > 30 or
        video_info['codec'] not in ['h264', 'hevc'] or
        video_info['width'] > 1920 or
        video_info['height'] > 1080
    )

async def optimize_video(input_path: Path, output_path: Path) -> dict:
    """
    Re-encode video with optimal settings for frame-accurate seeking.
    Returns processing stats.
    """
    import time
    start_time = time.time()

    # Try hardware encoding first (Raspberry Pi 4 has h264_v4l2m2m)
    hw_encoder = 'h264_v4l2m2m'
    try:
        result = subprocess.run([
            'ffmpeg', '-y',
            '-i', str(input_path),
            '-c:v', hw_encoder,
            '-g', '30',              # GOP size = 30 frames
            '-b:v', '5M',            # Bitrate for hardware encoder
            '-maxrate', '8M',
            '-bufsize', '10M',
            '-an',                   # Remove audio (not needed for analysis)
            '-movflags', '+faststart',  # Web-optimized
            str(output_path)
        ], capture_output=True, timeout=300)

        if result.returncode == 0:
            elapsed = time.time() - start_time
            return {
                'success': True,
                'method': 'hardware',
                'encoder': hw_encoder,
                'processing_time': elapsed,
                'realtime_factor': elapsed / get_video_duration(input_path)
            }
    except (subprocess.TimeoutExpired, Exception) as e:
        # Hardware encoding failed, fallback to software
        pass

    # Fallback to software encoding
    result = subprocess.run([
        'ffmpeg', '-y',
        '-i', str(input_path),
        '-c:v', 'libx264',
        '-g', '30',                  # GOP size = 30 frames
        '-keyint_min', '30',         # Minimum GOP size
        '-sc_threshold', '0',        # Disable scene cut detection (consistent GOP)
        '-crf', '23',                # Quality (18=visually lossless, 23=high quality)
        '-preset', 'ultrafast',      # Encoding speed (ultrafast for Pi 4)
        '-an',
        '-movflags', '+faststart',
        str(output_path)
    ], capture_output=True, timeout=300, check=True)

    elapsed = time.time() - start_time
    return {
        'success': True,
        'method': 'software',
        'encoder': 'libx264',
        'processing_time': elapsed,
        'realtime_factor': elapsed / get_video_duration(input_path)
    }

def get_video_duration(video_path: Path) -> float:
    """Get video duration in seconds."""
    result = subprocess.run([
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        str(video_path)
    ], capture_output=True, text=True, check=True)
    return float(result.stdout.strip())

async def process_uploaded_video(video_file: Path) -> Path:
    """
    Main entry point for video processing.
    Returns path to optimized video.
    """
    import logging
    logger = logging.getLogger(__name__)

    # Step 1: Analyze video
    logger.info(f"Analyzing video: {video_file.name}")
    info = get_video_info(video_file)
    logger.info(f"Video info: codec={info['codec']}, GOP={info['gop_size']}, "
                f"resolution={info['width']}x{info['height']}")

    # Step 2: Check if optimization needed
    if not needs_optimization(info):
        logger.info("Video already optimized, skipping re-encoding")
        return video_file

    # Step 3: Re-encode
    logger.info(f"Re-encoding video (GOP {info['gop_size']} → 30)")
    output_file = video_file.with_suffix('.optimized.mp4')

    stats = await optimize_video(video_file, output_file)

    logger.info(f"Re-encoding complete: method={stats['method']}, "
                f"time={stats['processing_time']:.1f}s, "
                f"realtime_factor={stats['realtime_factor']:.2f}x")

    # Step 4: Replace original with optimized
    video_file.unlink()
    output_file.rename(video_file)

    return video_file
```

### Performance Results (Raspberry Pi 4)

**Hardware Encoding (h264_v4l2m2m)** - Tested but NOT used:

- Processing speed: 0.27x realtime (faster than software)
- **Issue**: Produces GOP=60 instead of GOP=30 (driver limitation)
- Status: Deferred to post-MVP

**Software Encoding (libx264 ultrafast)** - Used for MVP:

- Processing speed: 0.42x realtime
- 10-second video: ~4.2 seconds processing
- 60-second video: ~25 seconds processing
- Quality: Excellent (CRF-based control)
- **GOP accuracy**: Guaranteed GOP=30 (meets requirement)

**Storage Impact**:

- Typical phone video (1080p30, 10s): 15-30MB original
- Re-encoded (GOP=30, CRF=23): 8-15MB
- Net: Often smaller than original due to optimized encoding

### Integration with Upload Flow

```python
# backend/api/videos.py
from fastapi import FastAPI, UploadFile, BackgroundTasks
from pathlib import Path
import uuid

app = FastAPI()

@app.post("/api/videos/upload")
async def upload_video(
    file: UploadFile,
    background_tasks: BackgroundTasks
):
    # Save uploaded file
    video_id = str(uuid.uuid4())
    upload_path = Path(f"/tmp/videos/{video_id}.mp4")
    upload_path.parent.mkdir(parents=True, exist_ok=True)

    with upload_path.open('wb') as f:
        content = await file.read()
        f.write(content)

    # Process in background (or synchronously for MVP)
    optimized_path = await process_uploaded_video(upload_path)

    return {
        "video_id": video_id,
        "status": "ready",
        "path": str(optimized_path)
    }
```

### Validation & Testing

```python
# tests/test_video_optimizer.py
import pytest
from pathlib import Path

def test_get_video_info():
    """Test GOP size extraction from test video."""
    info = get_video_info(Path('tests/fixtures/videos/test_gop250.mp4'))
    assert info['gop_size'] == 250
    assert info['codec'] == 'h264'

def test_needs_optimization_large_gop():
    """Videos with GOP >30 need optimization."""
    info = {'gop_size': 250, 'codec': 'h264', 'width': 1920, 'height': 1080}
    assert needs_optimization(info) == True

def test_needs_optimization_already_optimal():
    """Videos with GOP ≤30 don't need optimization."""
    info = {'gop_size': 30, 'codec': 'h264', 'width': 1920, 'height': 1080}
    assert needs_optimization(info) == False

@pytest.mark.asyncio
async def test_optimize_video_produces_gop30():
    """Re-encoded video has GOP=30."""
    input_path = Path('tests/fixtures/videos/test_gop250.mp4')
    output_path = Path('/tmp/test_output.mp4')

    stats = await optimize_video(input_path, output_path)

    assert stats['success'] == True
    assert output_path.exists()

    # Verify GOP size
    info = get_video_info(output_path)
    assert info['gop_size'] == 30

    output_path.unlink()
```

---

## Phase 2.5 Implementation Results (Backend Video Optimization)

**Date**: 2025-11-18
**Status**: ✅ Complete - Validated and tested

### Implementation Summary

Successfully implemented server-side video optimization with GOP=30 re-encoding as a standalone module (`backend/services/video_optimizer.py`) with comprehensive unit tests and test video generation.

**Files Created**:

- `backend/services/video_optimizer.py` (288 lines)
- `backend/services/tests/test_video_optimizer.py` (186 lines, 18 tests)
- `tests/fixtures/generate_gop_test_videos.sh` (test video generation)

### Codec Handling Approach

**Decision**: Re-encode based **only** on GOP size and resolution, **not** on codec type.

**Rationale**:

- **Requirement**: "Re-encode if GOP > 30" (no codec normalization specified)
- **WebCodecs Support**: Modern browsers support H.264, H.265 (HEVC), VP9, and AV1
- **Deferred Handling**: If codec compatibility issues arise, handle at decode time with `VideoDecoder.isConfigSupported()`

**Optimization Criteria** (Implemented):

1. GOP size > 30 → Re-encode to H.264 with GOP=30
2. Resolution > 1080p → Re-encode with downscaling

**Explicitly NOT Optimized**:

- ✗ Codec type (HEVC, VP9, AV1, etc. are NOT re-encoded unless GOP > 30)
- ✗ Framerate (preserved as-is)
- ✗ Bitrate (only optimized during re-encoding, not a trigger)

**Future Consideration**: If users upload videos with unsupported codecs or codec compatibility becomes an issue, we can add codec-based re-encoding at that time with evidence-based requirements.

### GOP Detection Validation

**Validation Method**: Generated 4 test videos with known GOP sizes and validated detection accuracy.

**Test Videos Generated**:

| Video                | Codec | GOP  | Duration | Purpose                                       | Detection Result |
| -------------------- | ----- | ---- | -------- | --------------------------------------------- | ---------------- |
| test_gop30_h264.mp4  | H.264 | 30   | 5s       | Already optimal (should skip re-encoding)     | ✅ Detected: 30  |
| test_gop250_h264.mp4 | H.264 | 250  | 10s      | Needs re-encoding (large GOP)                 | ✅ Detected: 250 |
| test_gop30_hevc.mp4  | HEVC  | 30   | 5s       | Optimal GOP, different codec (skip re-encode) | ✅ Detected: 30  |
| test_vargop_h264.mp4 | H.264 | ~120 | 10s      | Variable GOP (max detection validation)       | ✅ Detected: 120 |

**GOP Detection Implementation**:

```python
# CRITICAL: Use MAX not MEAN to catch worst-case GOP
# Reason: Variable GOP videos might average 30 but have max 250
if len(i_frame_indices) > 1:
    gop_sizes = [i_frame_indices[i+1] - i_frame_indices[i]
                for i in range(len(i_frame_indices) - 1)]
    max_gop = int(max(gop_sizes))  # ← MAX ensures worst-case detection
else:
    max_gop = 999  # Unknown - assume needs optimization
```

**Result**: 100% accurate GOP detection on all test cases. Using `max(gop_sizes)` correctly identifies worst-case keyframe intervals.

### Decision Logic Validation

**Test Coverage**: 18 unit tests covering all optimization decision paths.

**Decision Matrix Results**:

| Test Case                | GOP | Codec | Resolution | Expected  | Result  |
| ------------------------ | --- | ----- | ---------- | --------- | ------- |
| Large GOP                | 250 | h264  | 1920x1080  | Re-encode | ✅ Pass |
| Already optimal          | 30  | h264  | 1920x1080  | Skip      | ✅ Pass |
| Small GOP                | 15  | h264  | 1920x1080  | Skip      | ✅ Pass |
| HEVC codec (optimal GOP) | 30  | hevc  | 1920x1080  | Skip      | ✅ Pass |
| HEVC codec (small GOP)   | 15  | hevc  | 1920x1080  | Skip      | ✅ Pass |
| Other codec (VP9)        | 30  | vp9   | 1920x1080  | Skip      | ✅ Pass |
| Large resolution (4K)    | 30  | h264  | 3840x2160  | Re-encode | ✅ Pass |
| All optimal              | 25  | h264  | 1280x720   | Skip      | ✅ Pass |
| Edge: GOP exactly 30     | 30  | h264  | 1920x1080  | Skip      | ✅ Pass |
| Edge: GOP 31             | 31  | h264  | 1920x1080  | Re-encode | ✅ Pass |
| Edge: 1080p (1920x1080)  | 30  | h264  | 1920x1080  | Skip      | ✅ Pass |
| Edge: Width 1921         | 30  | h264  | 1921x1080  | Re-encode | ✅ Pass |

**Result**: 100% test pass rate. Decision logic correctly identifies all optimization scenarios including edge cases.

### Re-encoding Validation

**Test Method**: Re-encoded test videos and verified GOP=30 output with ffprobe.

**Re-encoding Results**:

| Input Video          | Input GOP | Output GOP | Processing Time | Method   | Encoder | Result  |
| -------------------- | --------- | ---------- | --------------- | -------- | ------- | ------- |
| test_gop250_h264.mp4 | 250       | 30         | 0.8s            | Software | libx264 | ✅ Pass |
| test_vargop_h264.mp4 | 120       | 30         | 0.8s            | Software | libx264 | ✅ Pass |

**ffprobe Verification Command**:

```bash
# Verify GOP=30 in re-encoded video
ffprobe -v error -select_streams v:0 -show_entries frame=pict_type \
  -of default=noprint_wrappers=1:nokey=1 test_gop250_h264.mp4 | grep -n "^I$"

# Output for GOP=30 video (30fps, 10s = 300 frames):
# 1:I    ← Frame 0
# 31:I   ← Frame 30
# 61:I   ← Frame 60
# 91:I   ← Frame 90
# ...
# 271:I  ← Frame 270
# 301:I  ← Frame 300 (final)
```

**Result**: All re-encoded videos verified to have exact GOP=30 structure (keyframe every 30 frames).

### Processing Performance (Software Encoder)

**Environment**: Development container (amd64, no hardware encoder)
**Encoder**: libx264 with preset=ultrafast
**Test Videos**: 5-10 second clips @ 30fps, 1280x720

**Performance Metrics**:

| Video Duration | Processing Time | Realtime Factor | Notes                    |
| -------------- | --------------- | --------------- | ------------------------ |
| 5s             | 0.6s            | 0.12x           | 1280x720, 30fps          |
| 10s            | 0.8s            | 0.08x           | GOP 250 → 30 re-encoding |

**Realtime Factor**: Processing time / video duration

- 0.08-0.12x = Processing is **8-12x faster** than video duration
- Example: 60-second video processes in ~5-7 seconds

**Hardware Encoder Test (Raspberry Pi 4)**:

- ✅ **Tested**: `h264_v4l2m2m` hardware encoder on Raspberry Pi 4
- **Result**: Encoder produces GOP=60 instead of GOP=30 (known bcm2835-codec driver limitation)
- **Decision**: Software encoder (libx264) used for MVP
  - Performance: 0.42x realtime (60s video → 25s processing)
  - GOP accuracy: Guaranteed GOP=30 (meets requirement)

**Attempted Fixes**:
- V4L2 control (`h264_i_frame_period=30`) - Failed
- Bitstream filter (`dump_extra`) - Failed
- Root cause: h264_v4l2m2m ignores `-g` parameter, hardcoded GOP=60

**Conclusion**: GOP=30 is non-negotiable for WebCodecs architecture. Hardware encoder deferred to post-MVP.

### Visual Quality Assessment

**Test Method**: Subjective visual inspection of re-encoded videos.

**Observations**:

- CRF=23 maintains excellent visual quality
- No noticeable compression artifacts at scene boundaries
- Frame content (test pattern with frame numbers) clearly visible
- Golf swing footage expected to have smooth gradual motion (low artifact risk)

**Scene Cut Artifacts**: None observed in test videos. Scene cut detection disabled (`-sc_threshold 0`) to maintain consistent GOP=30. This is acceptable for golf swing videos which have gradual motion, not abrupt scene changes.

**Recommendation**: Monitor for scene cut artifacts during Phase 1 integration. If artifacts appear, adjust CRF (23 → 18) or re-enable scene cut detection with threshold (`-sc_threshold 40`) and implement adaptive client cache.

### Phase 2.5 Acceptance Criteria Status

**From TASK_0.3_PLAN.md Phase 2.5**:

- ✅ ffprobe correctly extracts GOP size from test videos (validated with 4 test videos)
- ✅ Re-encoding skips already-optimal videos (<1 second decision time)
- ✅ Re-encoding produces GOP=30 videos (verified with ffprobe)
- ✅ Processing time documented for Pi 4 (software: 0.42x realtime)
- ✅ Re-encoded videos maintain visual quality (subjective - appears excellent)
- ✅ Unit tests verify decision logic with various video metadata (18 tests, 100% pass)
- ⏳ Integration test: Upload video → optimize → verify GOP=30 (deferred to Phase 1 Task 1.1)

**Overall Status**: 6/7 complete (86%), with 1 deferred to Phase 1 integration.

### Lessons Learned & Recommendations

**1. Use max(gop_sizes) not mean(gop_sizes)**:

- Variable GOP videos can have average GOP=30 but max GOP=250
- Using max ensures worst-case detection
- Critical for performance predictability

**2. Codec compatibility handled at decode time**:

- Re-encoding based only on GOP size and resolution
- WebCodecs supports H.264, H.265 (HEVC), VP9, and AV1
- If unsupported codec encountered, client checks with `VideoDecoder.isConfigSupported()`

**3. Hardware encoder tested but produces incorrect GOP**:

- Tested h264_v4l2m2m on Raspberry Pi 4: produces GOP=60 instead of GOP=30
- Root cause: bcm2835-codec driver ignores `-g` parameter (hardcoded GOP=60)
- Attempted fixes (V4L2 controls, bitstream filters) failed
- Decision: Software encoder (libx264) used for MVP
- Hardware encoder support deferred to post-MVP improvements

**4. Software encoder performance acceptable for MVP**:

- Raspberry Pi 4: 0.42x realtime (60s video → 25s processing)
- Development container: 0.08-0.12x realtime (60s video → 5-7s processing)
- Processing time acceptable with progress feedback (Phase 1 Task 1.1)
- GOP=30 accuracy guaranteed (non-negotiable for WebCodecs architecture)

**5. Storage impact is minimal**:

- Re-encoded videos often smaller than originals (better encoding efficiency)
- No additional storage concerns

### Integration Recommendations for Phase 1

**Task 1.1: Video Upload & Storage** (see `PROJECT_PLAN.md` lines 416-417):

1. **Upload Flow Integration**:

   ```python
   # backend/api/videos.py
   @app.post("/api/videos/upload")
   async def upload_video(file: UploadFile):
       # Save uploaded file
       video_path = save_uploaded_file(file)

       # Analyze and optimize (Phase 0 Task 0.3 Phase 2.5)
       optimized_path = process_uploaded_video(video_path)

       # Store in database
       video_id = store_video_metadata(optimized_path)

       return {"video_id": video_id, "status": "ready"}
   ```

2. **Progress Feedback Mechanism** (added to Task 1.1):

   - Option A: WebSocket for real-time progress
   - Option B: Polling endpoint `/api/videos/{id}/status`
   - Recommended: WebSocket for better UX (see Risk 8 mitigation)

3. **Video Processing Status**:

   ```python
   # Database schema addition
   video_processing_status: enum ['uploading', 'analyzing', 'optimizing', 'ready', 'failed']
   processing_progress: float  # 0.0 to 1.0
   processing_start_time: datetime
   processing_end_time: datetime
   encoder: str  # 'libx264' (software encoding)
   ```

4. **Error Handling**:
   - Catch ffprobe/ffmpeg errors gracefully
   - Store original video if re-encoding fails
   - Log processing stats for monitoring

### Known Limitations & Future Work

**Current Limitations**:

1. **Hardware encoder not supported**:

   - Tested `h264_v4l2m2m` on Raspberry Pi 4: produces GOP=60 (not GOP=30)
   - Software encoder (libx264) used for MVP with 0.42x realtime performance
   - Hardware encoder support deferred to post-MVP improvements

2. **No progress feedback during re-encoding**:

   - Deferred to Phase 1 Task 1.1
   - Can use ffmpeg progress output for accurate progress bars

3. **Single-threaded processing**:

   - MVP is single-user (no concurrency concerns)
   - Future: Add job queue (Celery/RQ) for multi-user

4. **No automatic cleanup of original videos**:
   - Handled by Task 1.8 (Storage Management)
   - Keep originals for re-processing if needed

**Future Enhancements** (Post-MVP):

- Parallel video processing (job queue)
- Adaptive bitrate encoding (multiple quality levels)
- GPU-accelerated encoding (NVENC, QuickSync)
- Video thumbnail generation
- Automatic video rotation correction
- Audio track preservation (currently stripped with `-an`)

### Manual Testing on Raspberry Pi 4

**Prerequisites**:

```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg python3

# Verify hardware encoder availability
ffmpeg -encoders 2>/dev/null | grep h264_v4l2m2m
# Should show: V..... h264_v4l2m2m
```

**Setup**:

```bash
# 1. Copy required files to Pi
scp backend/services/video_optimizer.py pi@raspberrypi:~/
scp tests/fixtures/videos/test_gop250_h264.mp4 pi@raspberrypi:~/

# 2. SSH to Pi
ssh pi@raspberrypi

# 3. Create empty __init__.py for imports
mkdir -p backend/services
touch backend/services/__init__.py
mv video_optimizer.py backend/services/
```

**Execute Tests**:

```bash
# Test 1: Analyze video (verify GOP detection)
python3 << 'EOF'
from pathlib import Path
from backend.services.video_optimizer import get_video_info

info = get_video_info(Path("test_gop250_h264.mp4"))
print(f"GOP Size: {info['gop_size']}")
print(f"Codec: {info['codec']}")
print(f"Resolution: {info['width']}x{info['height']}")
print(f"Framerate: {info['framerate']:.2f}")
EOF

# Test 2: Re-encode video (test hardware encoder)
python3 << 'EOF'
from pathlib import Path
from backend.services.video_optimizer import process_uploaded_video

input_file = Path("test_gop250_h264.mp4")
result = process_uploaded_video(input_file)
print(f"Optimization complete: {result}")
EOF
```

**Validate Output**:

```bash
# Verify GOP=30 in re-encoded video
ffprobe -v error -select_streams v:0 -show_entries frame=pict_type \
  -of default=noprint_wrappers=1:nokey=1 test_gop250_h264.mp4 | \
  grep -n "^I$" | head -10

# Expected output (I-frames every 30 frames):
# 1:I
# 31:I
# 61:I
# 91:I
# ...

# Check encoder used (look for "h264_v4l2m2m" = hardware)
# Review console output from Test 2 above

# Measure processing time
time python3 << 'EOF'
from pathlib import Path
from backend.services.video_optimizer import optimize_video

input_path = Path("test_gop250_h264.mp4")
output_path = Path("output.mp4")
stats = optimize_video(input_path, output_path)
print(f"Method: {stats['method']}")
print(f"Encoder: {stats['encoder']}")
print(f"Processing time: {stats['processing_time']:.2f}s")
print(f"Realtime factor: {stats['realtime_factor']:.2f}x")
EOF
```

**Expected Results**:

- **GOP detection**: Reports GOP=250 for test video
- **Hardware encoder**: Method='hardware', Encoder='h264_v4l2m2m'
- **Processing time**: ~2-3x realtime (10s video → 3-5s processing)
- **Fallback**: If hardware fails, Method='software', Encoder='libx264'
- **Output validation**: I-frames at positions 1, 31, 61, 91... (GOP=30)

### Files & References

**Implementation**:

- `backend/services/video_optimizer.py:1-288`
- `backend/services/tests/test_video_optimizer.py:1-186`
- `tests/fixtures/generate_gop_test_videos.sh:1-103`

**Documentation**:

- `project/PROJECT_PLAN.md:416-417` (Task 1.1 acceptance criteria updates)
- `project/PROJECT_PLAN.md:843-848` (Risk 8: Scene cut artifacts)

**Test Execution**:

```bash
# Run unit tests
pytest backend/services/tests/test_video_optimizer.py -v

# Generate test videos
bash tests/fixtures/generate_gop_test_videos.sh

# Manual validation
python3 -c 'from backend.services.video_optimizer import get_video_info; \
from pathlib import Path; \
print(get_video_info(Path("tests/fixtures/videos/test_gop250_h264.mp4")))'
```

**Phase 2.5 Complete**: ✅ Ready for Phase 3 (VideoDecoder Integration)

---

## Recommended Solution: Hybrid Approach (WebCodecs + HTML5 Video)

### Why Hybrid Architecture

**The Challenge**: WebCodecs provides exact frame positioning but lacks native continuous playback support, while HTML5 video provides smooth playback but lacks exact frame accuracy.

**The Solution**: Use each technology for its strength:

- **WebCodecs**: Frame-accurate stepping and seeking (0 tolerance)
- **HTML5 Video**: Smooth continuous playback with variable speed

### Key Insight: Frame Accuracy Requirements Differ by Use Case

**During Analysis (Paused/Stepping)**:

- Requirement: **Exact frame positioning** (0 tolerance)
- User is examining static frame details
- Dual-video sync must be perfect (same exact frame shown)
- Solution: **WebCodecs decoder**

**During Continuous Playback**:

- Requirement: **Smooth motion** with maintained sync
- User is viewing motion at various speeds (0.25x to 2x)
- **Caveat**: ±1 frame drift becomes perceptible at slow-motion speeds (0.25x-0.5x), especially with high-framerate video (60fps+)
  - 30fps at 0.25x: 1 frame = 133ms (noticeable)
  - 60fps at 0.25x: 1 frame = 67ms (noticeable)
  - 120fps at 0.5x: 1 frame = 17ms (imperceptible)
- Solution: **HTML5 video element + active drift correction**

### Architecture Overview

```typescript
// Hybrid player with mode switching
function DualVideoHybridPlayer({ videoFileA, videoFileB, syncOffset }) {
  const [mode, setMode] = useState<"stepping" | "playback">("stepping");

  // WebCodecs decoders for exact frame control
  const webCodecsA = useWebCodecsDecoder(videoFileA);
  const webCodecsB = useWebCodecsDecoder(videoFileB);

  // HTML5 video refs for continuous playback
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  // Switch to playback: WebCodecs → HTML5
  function handlePlay() {
    setMode("playback");
    videoRefA.current!.currentTime = webCodecsA.currentFrame / framerate;
    videoRefB.current!.currentTime = webCodecsB.currentFrame / framerate;
    videoRefA.current!.playbackRate = playbackSpeed;
    videoRefB.current!.playbackRate = playbackSpeed;
    videoRefA.current!.play();
    videoRefB.current!.play();
  }

  // Switch to stepping: HTML5 → WebCodecs (with sync correction)
  function handlePause() {
    videoRefA.current!.pause();
    videoRefB.current!.pause();

    setMode("stepping");

    // Sync-back: Restore exact offset (corrects any ±1 frame drift)
    const frameA = Math.round(videoRefA.current!.currentTime * framerate);
    const frameB = frameA + syncOffset; // ← Exact offset recalculated

    webCodecsA.seekToFrame(frameA);
    webCodecsB.seekToFrame(frameB);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* WebCodecs canvas - visible during stepping */}
      <canvas
        ref={webCodecsA.canvasRef}
        style={{ display: mode === "stepping" ? "block" : "none" }}
      />

      {/* HTML5 video - visible during playback */}
      <video
        ref={videoRefA}
        src={videoUrlA}
        style={{ display: mode === "playback" ? "block" : "none" }}
      />
    </div>
  );
}
```

### Active Drift Correction During Playback

**The Problem**: During HTML5 playback at slow-motion speeds (0.25x-0.5x), ±1 frame drift becomes perceptible, especially with high-framerate video (60fps, 120fps+). Golf swing analysis often uses 120fps+ slow-motion footage, making drift correction critical.

**The Solution**: Actively monitor and correct drift during playback using `requestAnimationFrame`:

```typescript
function useDriftCorrection(
  videoRefA: RefObject<HTMLVideoElement>,
  videoRefB: RefObject<HTMLVideoElement>,
  syncOffset: number,
  framerate: number,
  enabled: boolean // Only during playback mode
) {
  const rafRef = useRef<number | null>(null);
  const lastCorrectionRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    function checkAndCorrectDrift() {
      const videoA = videoRefA.current;
      const videoB = videoRefB.current;
      if (!videoA || !videoB) return;

      // Get current frame positions
      const frameA = Math.round(videoA.currentTime * framerate);
      const frameB = Math.round(videoB.currentTime * framerate);

      // Calculate expected vs actual
      const expectedFrameB = frameA + syncOffset;
      const drift = frameB - expectedFrameB;

      // If drift exceeds threshold, correct it
      if (Math.abs(drift) >= 1) {
        const now = performance.now();

        // Throttle corrections (max once per second to prevent stuttering)
        if (now - lastCorrectionRef.current > 1000) {
          console.log(`Drift detected: ${drift} frames. Correcting Video B.`);

          // Micro-correction: Adjust Video B's currentTime
          const correction = drift / framerate;
          videoB.currentTime -= correction;

          lastCorrectionRef.current = now;
        }
      }

      rafRef.current = requestAnimationFrame(checkAndCorrectDrift);
    }

    rafRef.current = requestAnimationFrame(checkAndCorrectDrift);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled, syncOffset, framerate]);
}

// Usage in DualVideoHybrid component:
function DualVideoHybrid({ videoFileA, videoFileB, syncOffset }) {
  const [mode, setMode] = useState<"stepping" | "playback">("stepping");

  // ... WebCodecs decoders, HTML5 refs ...

  // Enable drift correction during playback
  useDriftCorrection(
    videoRefA,
    videoRefB,
    syncOffset,
    framerate,
    mode === "playback" // Active only during playback
  );

  // ... rest of component
}
```

**How It Works**:

1. Monitor frame positions every frame via `requestAnimationFrame`
2. Detect when drift ≥1 frame between videos
3. Apply micro-correction to Video B's `currentTime`
4. **Throttle corrections** to once per second maximum (prevents stuttering)
5. Maintains sync continuously during slow-motion playback

**Performance Impact**:

- Monitoring: <1ms per frame (negligible)
- Correction: Brief micro-stutter (~50ms) once per second maximum
- Trade-off: Occasional stutter vs visible sync drift

### Sync-Back Pattern: Correcting Drift on Pause

**The Problem**: When pausing during playback, any accumulated drift must be corrected before switching to WebCodecs stepping mode.

**The Solution**: On pause, recalculate exact Video B position from Video A + offset:

```typescript
function handlePause() {
  // 1. Stop HTML5 videos
  videoRefA.current!.pause();
  videoRefB.current!.pause();

  // 2. Get approximate frame from Video A
  const approxFrameA = Math.round(videoRefA.current!.currentTime * framerate);

  // 3. Calculate exact frame B from sync offset (corrects any drift)
  const exactFrameB = approxFrameA + syncOffset;

  // 4. Bounds check
  const clampedFrameB = Math.max(0, Math.min(exactFrameB, totalFramesB - 1));

  // 5. Switch to WebCodecs with exact positions
  setMode("stepping");
  webCodecsDecoderA.seekToFrame(approxFrameA);
  webCodecsDecoderB.seekToFrame(clampedFrameB); // ← Drift corrected
}
```

**Why This Works**:

- WebCodecs uses integer frame indices (no ambiguity)
- Formula: `frameB = frameA + offset` is exact
- Any HTML5 drift (e.g., Video B at frame 124.7 instead of 125) is corrected by recalculation
- User sees perfectly synced frames when paused

### Implementation Components

#### 1. Mode Switching Logic

```typescript
type PlaybackMode = "stepping" | "playback";

interface ModeState {
  mode: PlaybackMode;
  currentFrameA: number;
  currentFrameB: number;
  playbackRate: number;
}

function useModeSwitch(
  webCodecsA: WebCodecsDecoder,
  webCodecsB: WebCodecsDecoder,
  videoRefA: RefObject<HTMLVideoElement>,
  videoRefB: RefObject<HTMLVideoElement>,
  syncOffset: number
) {
  const [mode, setMode] = useState<PlaybackMode>("stepping");
  const [playbackRate, setPlaybackRate] = useState(1.0);

  function switchToPlayback() {
    // Transfer positions from WebCodecs to HTML5
    const videoA = videoRefA.current!;
    const videoB = videoRefB.current!;

    videoA.currentTime = webCodecsA.currentFrame / webCodecsA.framerate;
    videoB.currentTime = webCodecsB.currentFrame / webCodecsB.framerate;

    videoA.playbackRate = playbackRate;
    videoB.playbackRate = playbackRate;

    setMode("playback");
    videoA.play();
    videoB.play();
  }

  async function switchToStepping() {
    const videoA = videoRefA.current!;
    const videoB = videoRefB.current!;

    videoA.pause();
    videoB.pause();

    // Wait for seeks to complete if mid-seek
    if (videoA.seeking) {
      await new Promise((r) =>
        videoA.addEventListener("seeked", r, { once: true })
      );
    }
    if (videoB.seeking) {
      await new Promise((r) =>
        videoB.addEventListener("seeked", r, { once: true })
      );
    }

    // Sync-back with exact offset
    const frameA = Math.round(videoA.currentTime * webCodecsA.framerate);
    const frameB = Math.max(
      0,
      Math.min(frameA + syncOffset, webCodecsB.totalFrames - 1)
    );

    setMode("stepping");
    webCodecsA.seekToFrame(frameA);
    webCodecsB.seekToFrame(frameB);
  }

  return {
    mode,
    playbackRate,
    setPlaybackRate,
    switchToPlayback,
    switchToStepping,
  };
}

// Active drift correction hook (see "Active Drift Correction" section above)
// This runs continuously during playback mode to maintain sync
```

#### 2. Dual Video Component

```typescript
interface DualVideoHybridProps {
  videoFileA: File;
  videoFileB: File;
  syncOffset: number;
}

function DualVideoHybrid({
  videoFileA,
  videoFileB,
  syncOffset,
}: DualVideoHybridProps) {
  // WebCodecs decoders
  const webCodecsA = useWebCodecsDecoder(videoFileA);
  const webCodecsB = useWebCodecsDecoder(videoFileB);

  // HTML5 video refs
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  // Mode switching
  const {
    mode,
    playbackRate,
    setPlaybackRate,
    switchToPlayback,
    switchToStepping,
  } = useModeSwitch(webCodecsA, webCodecsB, videoRefA, videoRefB, syncOffset);

  // Active drift correction during playback
  useDriftCorrection(
    videoRefA,
    videoRefB,
    syncOffset,
    webCodecsA.framerate,
    mode === "playback"
  );

  return (
    <div className="dual-video-container">
      {/* Video A */}
      <div className="video-wrapper">
        <canvas
          ref={webCodecsA.canvasRef}
          className={mode === "stepping" ? "visible" : "hidden"}
        />
        <video
          ref={videoRefA}
          src={videoUrlA}
          className={mode === "playback" ? "visible" : "hidden"}
        />
      </div>

      {/* Video B */}
      <div className="video-wrapper">
        <canvas
          ref={webCodecsB.canvasRef}
          className={mode === "stepping" ? "visible" : "hidden"}
        />
        <video
          ref={videoRefB}
          src={videoUrlB}
          className={mode === "playback" ? "visible" : "hidden"}
        />
      </div>

      {/* Controls */}
      <div className="controls">
        {mode === "stepping" ? (
          <>
            <button onClick={switchToPlayback}>Play</button>
            <button
              onClick={() => {
                webCodecsA.stepForward();
                webCodecsB.seekToFrame(
                  webCodecsA.currentFrame + 1 + syncOffset
                );
              }}
            >
              Step Forward
            </button>
          </>
        ) : (
          <>
            <button onClick={switchToStepping}>Pause</button>
            <select
              value={playbackRate}
              onChange={(e) => {
                const rate = parseFloat(e.target.value);
                setPlaybackRate(rate);
                videoRefA.current!.playbackRate = rate;
                videoRefB.current!.playbackRate = rate;
              }}
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
            </select>
          </>
        )}
      </div>
    </div>
  );
}
```

### Implementation Components

#### 1. MP4 Container Parser (`mp4box.js`)

```typescript
import MP4Box from "mp4box";

export class MP4Parser {
  private file: MP4Box.MP4File;
  private videoTrack: MP4Box.Track | null = null;

  constructor(private videoFile: File) {
    this.file = MP4Box.createFile();
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.file.onReady = (info: MP4Box.Info) => {
        // Find video track
        this.videoTrack = info.videoTracks[0];

        // Extract all samples (frames)
        this.file.setExtractionOptions(this.videoTrack.id, "video", {
          nbSamples: Infinity,
        });

        resolve();
      };

      this.file.onError = reject;

      // Feed file data to parser
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        arrayBuffer.fileStart = 0;
        this.file.appendBuffer(arrayBuffer);
        this.file.flush();
      };
      reader.readAsArrayBuffer(this.videoFile);
    });
  }

  getCodecConfig(): VideoDecoderConfig {
    if (!this.videoTrack) throw new Error("No video track");

    // Extract codec configuration from track
    return {
      codec: this.videoTrack.codec,
      codedWidth: this.videoTrack.video.width,
      codedHeight: this.videoTrack.video.height,
      description: this.getAVCDecoderConfig(),
    };
  }

  *iterateSamples(): Generator<MP4Box.Sample> {
    // Yield samples (frames) one by one
    const samples = this.file.getSamples(this.videoTrack!.id);
    for (const sample of samples) {
      yield sample;
    }
  }
}
```

#### 2. Frame Cache (LRU)

**Simple LRU Cache for GOP=30 Videos**

With server-side GOP=30 guarantee, a simple LRU cache (60-120 frames) is sufficient. No need for complex dual-cache or adaptive strategies.

```typescript
// frontend/src/utils/FrameCache.ts

export class FrameCache {
  private cache = new Map<number, VideoFrame>();
  private maxSize: number;

  constructor(maxSize: number = 120) {
    // 120 frames @ 30fps = 4 seconds of video
    // ~120MB memory @ 1080p (~1MB per frame)
    this.maxSize = maxSize;
  }

  get(frameIndex: number): VideoFrame | undefined {
    const frame = this.cache.get(frameIndex);

    if (frame) {
      // Move to end (most recently used)
      // JavaScript Map maintains insertion order
      this.cache.delete(frameIndex);
      this.cache.set(frameIndex, frame);
    }

    return frame;
  }

  set(frameIndex: number, frame: VideoFrame): void {
    // Remove if already exists (to re-insert at end)
    if (this.cache.has(frameIndex)) {
      this.cache.delete(frameIndex);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      const oldestFrame = this.cache.get(oldestKey)!;

      // CRITICAL: Release VideoFrame memory
      oldestFrame.close();

      this.cache.delete(oldestKey);
    }

    // Add to end (most recently used)
    this.cache.set(frameIndex, frame);
  }

  has(frameIndex: number): boolean {
    return this.cache.has(frameIndex);
  }

  clear(): void {
    // Release all VideoFrame memory
    for (const frame of this.cache.values()) {
      frame.close();
    }
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; utilizationPercent: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: (this.cache.size / this.maxSize) * 100,
    };
  }
}
```

**Why This Simple Approach Works with GOP=30:**

```typescript
// User at frame 100, cache has frames 70-129 (60 frames)

// Forward step to 101: In cache ✅ <10ms
// Forward step to 102: In cache ✅ <10ms
// ...continue to 129: All in cache ✅

// Backward step to 100: In cache ✅ <10ms
// Backward step to 99: In cache ✅ <10ms
// ...continue to 70: All in cache ✅

// Large jump to frame 200:
// - Find keyframe: frame 180 (200 // 30 * 30)
// - Decode 180→200: 21 frames × 10ms = 210ms ✅
// - Cache now has frames 180-200 + some older frames

// Typical usage: Cache hit rate >80%
```

**Memory Usage:**

- 60 frames: ~60MB @ 1080p
- 120 frames: ~120MB @ 1080p
- Bounded and predictable

**Performance:**

- Cache hit: <10ms (instant)
- Cache miss: <300ms (max 30 frames from keyframe)
- No complex logic, easy to debug

#### 3. React Integration Hook

**WebCodecs Decoder with Keyframe-Aware Seeking**

```typescript
// frontend/src/hooks/useWebCodecsDecoder.ts

export function useWebCodecsDecoder(videoFile: File, framerate: number) {
  const decoderRef = useRef<VideoDecoder | null>(null);
  const parserRef = useRef<MP4Parser | null>(null);
  const cacheRef = useRef<FrameCache>(new FrameCache(120)); // 120-frame cache
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const samplesRef = useRef<MP4Box.Sample[]>([]);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Initialize decoder
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Parse MP4
        const parser = new MP4Parser(videoFile);
        await parser.initialize();
        parserRef.current = parser;

        const codecConfig = parser.getCodecConfig();
        const samples = Array.from(parser.iterateSamples());
        samplesRef.current = samples;
        setTotalFrames(samples.length);

        // Initialize VideoDecoder
        const decoder = new VideoDecoder({
          output: (frame: VideoFrame) => {
            if (cancelled) {
              frame.close();
              return;
            }

            // Cache decoded frame
            const frameIndex = Math.round(
              (frame.timestamp / 1000000) * framerate
            );
            cacheRef.current.set(frameIndex, frame.clone());

            // Render to canvas
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
            }

            setCurrentFrame(frameIndex);
            frame.close();
          },
          error: (e) => console.error("Decode error:", e),
        });

        await decoder.configure(codecConfig);
        decoderRef.current = decoder;

        if (!cancelled) setIsReady(true);
      } catch (error) {
        console.error("Decoder initialization failed:", error);
      }
    })();

    return () => {
      cancelled = true;
      decoderRef.current?.close();
      cacheRef.current.clear();
    };
  }, [videoFile, framerate]);

  // Seek to specific frame with keyframe-aware decoding
  const seekToFrame = useCallback(
    async (targetFrame: number) => {
      const decoder = decoderRef.current;
      const samples = samplesRef.current;
      const cache = cacheRef.current;

      if (!decoder || samples.length === 0) return;

      // Clamp to valid range
      const clampedTarget = Math.max(
        0,
        Math.min(targetFrame, samples.length - 1)
      );

      // Check cache first (FAST PATH)
      if (cache.has(clampedTarget)) {
        const cachedFrame = cache.get(clampedTarget)!;

        // Render cached frame
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(cachedFrame, 0, 0, canvas.width, canvas.height);
        }

        setCurrentFrame(clampedTarget);
        return; // <10ms - instant!
      }

      // Cache miss - decode from nearest keyframe (SLOW PATH)
      // With GOP=30, max 30 frames to decode (~300ms)
      const keyframeIndex = Math.floor(clampedTarget / 30) * 30;

      // Decode from keyframe to target
      for (let i = keyframeIndex; i <= clampedTarget; i++) {
        const sample = samples[i];

        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: sample.cts,
          duration: sample.duration,
          data: sample.data,
        });

        decoder.decode(chunk);

        // Frames are cached in decoder.output callback
      }

      // Wait for decoding to complete
      await decoder.flush();
    },
    [framerate]
  );

  return {
    canvasRef,
    currentFrame,
    totalFrames,
    isReady,
    seekToFrame,
    stepForward: () => seekToFrame(currentFrame + 1),
    stepBackward: () => seekToFrame(currentFrame - 1),
    cacheStats: cacheRef.current?.getStats(),
  };
}
```

**Performance Characteristics:**

| Operation                     | Cache State | Performance | Notes                                       |
| ----------------------------- | ----------- | ----------- | ------------------------------------------- |
| Step forward (sequential)     | Hit         | <10ms       | Next frame decoded with previous, cached    |
| Step backward (within cache)  | Hit         | <10ms       | Frame in 120-frame window                   |
| Step backward (outside cache) | Miss        | <300ms      | Decode max 30 frames from keyframe (GOP=30) |
| Large jump (scrub)            | Miss        | <300ms      | Same as backward outside cache              |
| Typical cache hit rate        | N/A         | >80%        | During local frame stepping                 |

      setCurrentFrame(frameIndex);
      return;
    }

    // Decode frame
    const samples = Array.from(parser.iterateSamples());
    const sample = samples[frameIndex];

    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? "key" : "delta",
      timestamp: sample.cts,
      duration: sample.duration,
      data: sample.data,
    });

    decoder.decode(chunk);

}, []);

return {
canvasRef,
currentFrame,
totalFrames,
isReady,
seekToFrame,
stepForward: () => seekToFrame(currentFrame + 1),
stepBackward: () => seekToFrame(currentFrame - 1),
};
}

````

### Browser Support & Fallback Strategy

**Supported Browsers (November 2025)**:

- Chrome 94+ ✅ (October 2021)
- Firefox 130+ ✅ (September 2024)
- Safari 17.4+ ✅ Desktop & Mobile (March 2024)
- Edge 94+ ✅ (Chromium-based)
- Opera 80+ ✅

**Market Coverage**: ~95% of active browsers

**For MVP**: Show clear error message for unsupported browsers:

```typescript
if (typeof VideoDecoder === "undefined") {
  return (
    <ErrorMessage>
      Your browser doesn't support required video features. Please update to
      Chrome 94+, Firefox 130+, or Safari 17.4+.
    </ErrorMessage>
  );
}
````

**Future Enhancement** (post-MVP): Implement server-side full frame extraction (all video frames) fallback for older browsers.

### Performance Characteristics

**Decode Performance (with GOP=30 guarantee)**:

- H.264 decode: 5-15ms per frame (hardware accelerated)
- H.265 decode: 10-25ms per frame (hardware accelerated)
- Target: <50ms per step (REQ-NF-P-004) ✅ Easily met
- Cache hit: <10ms (instant)
- Cache miss worst case: <300ms (30 frames from keyframe)

**Memory Usage (with 120-frame cache)**:

- Compressed video in memory: ~5-10MB (original file)
- Decoded frame cache (120 frames @ 1080p): ~120MB
- Total: ~130MB per video (acceptable for MVP, bounded)

**Sync Accuracy**:

- Frame positioning: 0 frame error (perfect)
- Dual-video sync: 0 frame drift (deterministic)

**Performance Impact of Server-Side GOP=30 Optimization:**

| Metric                   | GOP=250 (unoptimized)        | GOP=30 (optimized)                 | Improvement          |
| ------------------------ | ---------------------------- | ---------------------------------- | -------------------- |
| Worst-case backward seek | 2500ms (250 frames)          | 300ms (30 frames)                  | **8.3x faster**      |
| Required cache size      | 250+ frames (~250MB)         | 60-120 frames (~60-120MB)          | **2-4x less memory** |
| Cache hit rate           | ~60% (large window needed)   | >80% (typical usage)               | **Better**           |
| Client code complexity   | High (adaptive strategies)   | Low (simple LRU)                   | **Much simpler**     |
| UX consistency           | Variable (depends on source) | Predictable (all videos optimized) | **Consistent**       |

### Task 0.3 Acceptance Criteria

**Implementation**:

- [ ] WebCodecs VideoDecoder successfully decodes H.264 MP4 files
- [ ] WebCodecs VideoDecoder successfully decodes H.265 MP4 files
- [ ] MP4 container parsed using mp4box.js for codec configuration
- [ ] Frame-by-frame stepping with exact frame accuracy (0 frame tolerance)
- [ ] Frame counter displays exact frame numbers with perfect accuracy
- [ ] Decode latency measured and <50ms per frame
- [ ] Canvas rendering displays decoded VideoFrame objects correctly
- [ ] Memory management with LRU cache for decoded frames

**Testing**:

- [ ] Tests pass with **exact frame assertions** (0 tolerance, not ±1) in Chrome
- [ ] Tests pass with **exact frame assertions** (0 tolerance, not ±1) in Firefox
- [ ] Tests pass with **exact frame assertions** (0 tolerance, not ±1) in Safari
- [ ] Feature detection shows clear error for unsupported browsers

**Documentation**:

- [ ] Spike documentation created (`docs/spike/WEBCODECS_FRAME_CONTROL.md`)
- [ ] WebCodecs patterns documented (decoder config, frame decode, memory management)
- [ ] Known limitations documented (browser requirements, memory usage)
- [ ] Performance metrics captured (decode latency, memory usage)

### Known Limitations & Gotchas

**1. Memory Management (CRITICAL)**:

```typescript
// CRITICAL: Always call videoFrame.close() to release memory
decoder.output = (frame) => {
  processFrame(frame);
  frame.close(); // Essential - prevents memory leak!
};

// In cache eviction:
if (this.cache.size >= this.maxSize) {
  const oldestFrame = this.cache.get(oldestKey)!;
  oldestFrame.close(); // Must close before evicting
  this.cache.delete(oldestKey);
}
```

**2. Codec Support**:

- H.264 (AVC): Universal support ✅
- H.265 (HEVC): Widely supported (check via `VideoDecoder.isConfigSupported()`)
- VP9/AV1: Not required for MVP

**3. MP4 Container Parsing**:

- Use mp4box.js library (proven, maintained)
- Extract codec configuration bytes from MP4 'avcC' or 'hvcC' box
- Handle fragmented MP4s (common in streaming)

**4. Keyframe Dependencies (CRITICAL with GOP=30)**:

```typescript
// Seeking to frame 105 with GOP=30:
// 1. Find nearest keyframe: Math.floor(105 / 30) * 30 = 90
// 2. Decode frames 90 → 91 → 92 → ... → 105
// 3. Each P/B-frame depends on previous frames in decoder state

// With GOP=30: Max 30 frames to decode (~300ms)
// With GOP=250: Max 250 frames to decode (~2500ms) ❌ Too slow!
```

**5. Hardware Decode**:

- Automatically used when available
- Fallback to software decode if hardware unavailable
- No API to force hardware decode
- Both meet <50ms requirement for sequential steps

**6. Server-Side Video Optimization (Architecture Decision)**:

```python
# Backend MUST re-encode videos with GOP=30 before serving to client
# This is NOT optional - it's required for acceptable performance

# Without GOP=30 guarantee:
# - Need adaptive cache sizing (complex)
# - Need dual cache strategy (complex)
# - Unpredictable UX (2500ms seeks possible)

# With GOP=30 guarantee:
# - Simple 60-120 frame LRU cache (simple)
# - Predictable 300ms worst case (acceptable)
# - Consistent UX across all videos
```

### Comparison: Approaches for Frame-Accurate Video Control

| Aspect                        | requestVideoFrameCallback             | WebCodecs (No Optimization)            | **WebCodecs + GOP=30 (Recommended)**   | Hybrid (WebCodecs+HTML5)                     |
| ----------------------------- | ------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------------- |
| **Frame Accuracy (Stepping)** | ±1 frame (best case)                  | Exact (0 frame error)                  | ✅ Exact (0 frame error)               | ✅ Exact (0 frame error)                     |
| **Frame Accuracy (Playback)** | ±1 frame (acceptable during motion)   | N/A (complex to implement)             | N/A (complex to implement)             | ✅ ±1 frame (acceptable, smooth)             |
| **Deterministic**             | ❌ No (browser-dependent seeking)     | ✅ Yes (frame index)                   | ✅ Yes (frame index)                   | ✅ Yes (stepping), ⚠️ Approximate (playback) |
| **Dual-Video Sync**           | ❌ Impossible (drift inevitable)      | ✅ Perfect (0 drift)                   | ✅ Perfect (0 drift)                   | ✅ Perfect when paused, ±1 during playback   |
| **Seek Performance**          | Variable (browser-dependent)          | <2500ms worst case (GOP=250)           | ✅ <300ms worst case (GOP=30)          | <300ms stepping                              |
| **Cache Complexity**          | N/A                                   | ❌ High (adaptive/dual cache)          | ✅ Low (simple LRU)                    | Low (simple LRU)                             |
| **Memory Usage**              | Low (browser manages)                 | High (~250MB for GOP=250)              | ✅ Medium (~60-120MB)                  | Medium (~60-120MB)                           |
| **Continuous Playback**       | ✅ Native, smooth                     | ⚠️ Complex (manual buffering)          | ⚠️ Complex (manual buffering)          | ✅ Native HTML5, smooth                      |
| **Variable Speed**            | ✅ Simple (playbackRate)              | ❌ Complex (manual timing)             | ❌ Complex (manual timing)             | ✅ Simple (playbackRate)                     |
| **Backend Processing**        | None                                  | None                                   | ⚠️ Required (30-60s per video)         | Required (30-60s per video)                  |
| **Implementation Complexity** | Low                                   | Medium-High                            | ✅ Medium (simple cache)               | Medium-High (mode switching)                 |
| **Browser Support**           | Chrome 83+, Firefox 77+, Safari 15.4+ | Chrome 94+, Firefox 130+, Safari 17.4+ | Chrome 94+, Firefox 130+, Safari 17.4+ | Chrome 94+, Firefox 130+, Safari 17.4+       |
| **Recommended For**           | ❌ Not viable for exact sync          | Research/experimentation               | ✅ **MVP Production Use**              | Phase 1+ (adds playback)                     |

**Conclusion**: WebCodecs + Server-side GOP=30 optimization is the optimal solution for Task 0.3, providing exact frame accuracy with simple client implementation and predictable performance.

---

## Confidence Assessment

**Confidence Level: 9/10** for WebCodecs + Server-Side GOP=30 Optimization

**High Confidence Because**:

- ✅ WebCodecs is mature (3+ years since Chrome release, 1+ years in Firefox/Safari)
- ✅ Designed exactly for frame-accurate video manipulation
- ✅ 95% browser coverage (acceptable for MVP)
- ✅ Hardware decode provides excellent performance (<50ms per frame)
- ✅ Deterministic behavior solves core sync requirement
- ✅ Server-side GOP=30 optimization is proven technique (used in professional video editors)
- ✅ FFmpeg is mature, well-documented, available on all platforms
- ✅ Raspberry Pi 4 hardware encoding validated (h264_v4l2m2m)
- ✅ Simple LRU cache (60-120 frames) eliminates complex adaptive strategies

**Remaining 1 Uncertainty**:

- MP4 container parsing complexity with mp4box.js (mitigated: proven library, good documentation)
- Backend processing time on Pi 4 (mitigated: hardware encoding ~2-3x realtime, acceptable)
- Memory usage on lower-end devices (mitigated: bounded 60-120MB cache with eviction)

**Risk Level**: Low

**Key Architecture Decision Validated**:
The combination of server-side GOP=30 optimization + simple client-side LRU cache is superior to client-only adaptive caching strategies. It trades 30-60 seconds of upload processing for:

- 8x faster worst-case seeking (300ms vs 2500ms)
- 50-60% less memory usage (60-120MB vs 250MB+)
- Dramatically simpler client code (single LRU cache vs dual adaptive cache)
- Consistent, predictable UX across all videos

---

## References

### WebCodecs API Documentation

- [MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [MDN: VideoDecoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder)
- [W3C WebCodecs Specification](https://w3c.github.io/webcodecs/)
- [Web.dev: Video processing with WebCodecs](https://web.dev/articles/webcodecs)

### MP4 Container Parsing

- [mp4box.js GitHub](https://github.com/gpac/mp4box.js/)
- [MP4 File Format Specification (ISO/IEC 14496-12)](https://www.iso.org/standard/68960.html)
- [Understanding MP4 Container Structure](https://developer.apple.com/documentation/quicktime-file-format)

### Browser Support

- [Can I Use: WebCodecs](https://caniuse.com/webcodecs)
- [Chrome Platform Status: WebCodecs](https://chromestatus.com/feature/5669293909868544)

---

**Document Status**: Analysis Complete - WebCodecs + Server-Side GOP=30 Optimization Recommended \
**Next Action**: Implement Task 0.3 (WebCodecs Frame Control + Backend Video Optimization) \
**Owner**: Development Team \
**Date**: 2025-11-18
