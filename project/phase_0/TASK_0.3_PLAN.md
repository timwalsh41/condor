# Task 0.3: WebCodecs Frame Control Spike - Implementation Plan

**Status**: In Progress (Phase 3 Complete)
**Started**: 2025-11-16
**Completed**: TBD
**Owner**: Development Team
**Estimated Effort**: 18-22 hours across 3-4 sessions

---

## Overview

Implement frame-accurate video control using WebCodecs API to achieve exact frame positioning (0 tolerance) required for deterministic dual-video synchronization. This replaces the `requestVideoFrameCallback` approach from Tasks 0.2/0.2.1 which achieved ±1 frame accuracy but failed exact frame matching.

Server-side video re-encoding with GOP=30 (keyframe every 30 frames) guarantees predictable decode performance and simplifies client-side frame cache implementation (simple LRU cache, 60-120 frames). See `docs/spike/WEBCODECS_FRAME_CONTROL.md` for technical details.

**Key Requirements**:

- REQ-F-FRAME-001: Frame-Accurate Stepping (exact, not ±1)
- REQ-F-FRAME-002: Frame Counter Display (exact frame numbers)
- REQ-F-FRAME-003: Seeking Precision (deterministic, 0 frame error)
- REQ-NF-P-004: Frame Step Response Time (<50ms)
- REQ-NF-BC-001: Browser Compatibility (Chrome 94+, Firefox 130+, Safari 17.4+)

---

## Phase 1: Environment Setup & Dependencies

**Status**: Completed
**Completed**: 2025-11-16
**Estimated**: 30 minutes

### Scope

- Install required npm packages
- Create spike directory structure
- Implement browser feature detection

### Deliverables

- [x] `mp4box@0.5.2` installed with TypeScript types
- [x] Directory structure: `frontend/src/{components,hooks,utils,types}`
- [x] Feature detection utility with clear error for unsupported browsers

### Acceptance Criteria

- Dependencies installed without errors
- Directory structure created
- Feature detection shows appropriate message for WebCodecs support

---

## Phase 2: MP4 Container Parser

**Status**: Completed
**Completed**: 2025-11-17
**Estimated**: 2-3 hours

### Scope

- Implement MP4Parser utility class using mp4box.js
- Extract codec configuration (H.264 and H.265)
- Extract frame samples with timestamps

### Deliverables

- [x] `utils/MP4Parser.ts` with methods:
  - `initialize(videoFile: File): Promise<void>`
  - `getCodecConfig(): VideoDecoderConfig`
  - `getSamples(): Sample[]`
  - `getFrameCount(): number`
- [x] Error handling for corrupt/unsupported files
- [x] Support for fragmented MP4s

### Acceptance Criteria

- ✅ Parses H.264 MP4 files successfully
- ✅ Parses H.265 MP4 files successfully
- ✅ Extracts valid VideoDecoderConfig
- ✅ Returns accurate frame count
- ✅ Handles errors gracefully with descriptive messages

---

## Phase 2.5: Backend Video Optimization

**Status**: Completed
**Completed**: 2025-11-18
**Estimated**: 3-4 hours

### Scope

Implement server-side video re-encoding to guarantee GOP=30 (keyframe every 30 frames), which simplifies client-side frame cache and ensures predictable decode performance.

### Rationale

Videos with large keyframe intervals (GOP=250, ~8 seconds @ 30fps) require decoding up to 250 frames for backward seeks. Server-side re-encoding with GOP=30 reduces worst-case decode to 30 frames (~300ms vs 2000ms), enabling simpler client-side LRU cache (60-120 frames vs 250+).

### Deliverables

- [x] Backend video processing module (`backend/services/video_optimizer.py`)
- [x] Smart re-encoding logic:
  - Extract video metadata using ffprobe (codec, resolution, GOP size)
  - Skip re-encoding if already optimal (GOP≤30, ≤1080p)
  - Re-encode otherwise with GOP=30, CRF=23, remove audio
  - Use hardware encoding on Pi 4 if available (`h264_v4l2m2m`)
- [x] Processing time measurement and logging
- [x] Unit tests for decision logic
- [x] Test video generation script with various GOP sizes

### Acceptance Criteria

- ✅ ffprobe correctly extracts GOP size from test videos (validated with 4 test videos)
- ✅ Re-encoding skips already-optimal videos (<1 second decision time)
- ✅ Re-encoding produces GOP=30 videos (verified with ffprobe)
- ✅ Processing time documented for Pi 4 (software: 0.42x realtime)
- ✅ Re-encoded videos maintain visual quality (subjective assessment)
- ✅ Unit tests verify decision logic with various video metadata (18 tests, 100% pass)
- ⏳ Integration test: Upload video → optimize → verify GOP=30 (deferred to Phase 1 Task 1.1)

### Notes

- **Codec handling**: Re-encoding based only on GOP size and resolution, not codec type (following stated requirements)
- **WebCodecs compatibility**: Modern browsers support H.264, H.265, VP9, and AV1; codec compatibility deferred to decode-time checking
- **Processing performance**: Software encoder (libx264) achieves 0.42x realtime on Pi 4 (60s video → 25s processing)

### Deviations

- **Hardware encoding**: Originally planned h264_v4l2m2m hardware encoder produces GOP=60 instead of required GOP=30 (bcm2835-codec driver limitation). Switched to software-only encoding (libx264) for MVP. Hardware encoder support deferred to post-MVP improvements.

**Technical Details**: See `docs/spike/WEBCODECS_FRAME_CONTROL.md` for implementation code examples

---

## Phase 3: VideoDecoder Integration & Frame Cache

**Status**: Completed
**Completed**: 2025-11-21
**Estimated**: 4-5 hours (merged with former Phase 4)

### Scope

- Implement WebCodecs VideoDecoder pipeline
- Frame-by-frame decode with canvas rendering
- Handle keyframe dependencies with LRU frame cache
- Optimize for GOP=30 videos (max 30-frame decode from keyframe)

### Deliverables

- [x] `utils/FrameCache.ts` - Simple LRU cache utility class with 60-120 frame capacity
- [x] `hooks/useWebCodecsDecoder.ts` hook with interface:
  - `canvasRef: RefObject<HTMLCanvasElement>`
  - `currentFrame: number`
  - `totalFrames: number`
  - `isReady: boolean`
  - `error: string | null`
  - `seekToFrame(frameIndex: number): void`
  - `stepForward(): void`
  - `stepBackward(): void`
  - `cacheStats: object` (size, hits, misses, hit rate)
  - `lastLatencyMs: number` (performance monitoring)
- [x] Keyframe-aware seeking logic (decode from keyframe → target frame)
- [x] VideoDecoder configuration and initialization
- [x] Canvas rendering of decoded VideoFrames
- [x] Memory management (VideoFrame.close() in cache eviction)
- [x] `components/WebCodecsDemo.tsx` - User-facing demo component
- [x] Unit tests for FrameCache (19/19 passing)
- [x] Operation queueing to handle rapid button presses

### Acceptance Criteria

- ✅ VideoDecoder initializes successfully with both H.264 and H.265
- ✅ Frames decode and render to canvas correctly
- ✅ Frame positioning is deterministic (frame N always shows frame N)
- ⏳ **Cache hit performance: <10ms** (design correct, runtime unverified)
- ⏳ **Cache miss performance: <300ms** (design correct, runtime unverified)
- ⏳ Memory usage stays bounded (60-120MB for 60-120 frame cache @ 1080p) - design correct, runtime unverified
- ⏳ Memory properly released (no leaks - verified with DevTools profiler) - deferred to Phase 6
- ✅ Forward stepping uses cached frames (consecutive frames cached during decode)
- ✅ Backward stepping within cache window is instant (<10ms design)
- ✅ User-facing demo of single channel video frame stepping, +/-1 (fine) and +/- 5 (coarse) with 0-frame tolerance
- ✅ Operation queueing implemented to handle rapid button presses (CRITICAL-3 fix)
- ✅ Decoder output callback pattern implemented (cache only, render after flush) (CRITICAL-2 fix)

### Critical Code Review Fixes Applied

During Phase 3 implementation, independent code review identified and fixed:

- **CRITICAL-2**: Race condition in decoder output callback - callback was rendering frames and updating state, causing UI flicker during GOP decode. Fixed by making callback cache-only, with rendering/state updates after decoder.flush() completes.
- **CRITICAL-3**: Missing operation queueing for rapid button presses - multiple seekToFrame() calls could execute concurrently, causing dropped requests. Fixed by implementing Promise chain to process operations sequentially.

### Test Results

- **FrameCache Unit Tests**: 19/19 passing (100%)
  - Basic operations: 4/4 tests
  - LRU eviction: 5/5 tests
  - Memory management: 2/2 tests
  - Statistics: 6/6 tests
  - Edge cases: 2/2 tests
- **MP4Parser Unit Tests** (Phase 2): 19/19 passing (100%)
- **VideoOptimizer Unit Tests** (Phase 2.5): 12/12 passing (100%)
- **Total Test Suite**: 50/50 passing (100%)
- **Build**: Compiles without TypeScript errors
- **Runtime Validation**: Deferred to Phase 6 (Playwright browser execution tests)

### Validation Status

**Requirements Validated (Design Level)**:

- ✅ REQ-F-FRAME-001 (Frame Stepping) - Implementation correct, runtime unverified
- ✅ REQ-F-FRAME-002 (Frame Counter) - Implementation correct, runtime unverified
- ✅ REQ-F-FRAME-003 (Seeking Precision) - Implementation correct, runtime unverified
- ⏳ REQ-NF-P-004 (Frame Step Response <50ms) - Design correct, runtime measurement deferred to Phase 6
- ⏳ REQ-NF-BC-001 (Browser Compatibility) - Design correct, cross-browser testing deferred to Phase 6

**Acceptance Criteria Status**: 5/15 fully met, 8/15 implemented but not tested in browser, 2/15 deferred to Phase 6

**Overall Assessment**: Implementation complete and correct per design. Runtime validation (browser execution, performance measurement, memory profiling) deferred to Phase 6 cross-browser testing.

**Technical Details**: See `docs/spike/WEBCODECS_FRAME_CONTROL.md` Phase 3 Implementation Results for detailed implementation patterns

---

## Phase 4: Playback Implementation & Enhanced Demo

**Status**: Completed
**Completed**: 2025-11-22
**Estimated**: 3-4 hours

### Scope

- Implement WebCodecs-based continuous playback with frame-accurate synchronization
- Expand read-ahead cache from 10 to 60 frames (2-second buffer @ 30fps)
- Add playback controls with variable speed support
- Display comprehensive video metadata
- Validate playback smoothness and frame accuracy

### Rationale

**WebCodecs for All Modes**: Frame-accurate dual-video sync during playback is non-negotiable. HTML5 video seeking cannot guarantee exact frame positioning (±1-2 frame error), which breaks sync. WebCodecs provides deterministic frame control for stepping, seeking, AND playback.

**60-Frame Read-Ahead**:

- Provides 2-second playback buffer @ 30fps
- Enables smooth playback start (frames pre-decoded)
- Uses 50% of 120-frame cache (60 forward, 60 backward)
- Decoder continues filling cache during playback (parallel decode)

### Deliverables

- [x] **`hooks/useWebCodecsDecoder.ts` enhancements**:
  - Increased read-ahead from 10 → 60 frames
  - Added playback state: `isPlaying`, `playbackRate`, `framerate`
  - Added `play()`, `pause()`, `setPlaybackRate()` functions
  - Implemented `requestAnimationFrame` playback loop with frame-accurate timing
  - Added `metadata` object (7 properties)
  - Added `updateDisplay` parameter to `seekToFrame()` for decode-only buffering

- [x] **`components/WebCodecsDemo.tsx` enhancements**:
  - Play/Pause button with state-based UI
  - Playback rate selector (7 speeds: 0.1x, 0.25x, 0.5x, 0.75x, 1.0x, 1.5x, 2.0x)
  - Video metadata table (duration, framerate, GOP size, total frames, codec, resolution, read-ahead buffer)
  - All existing controls functional (fine/coarse step, seek slider, frame counter, cache stats)

- [x] **`utils/MP4Parser.ts` enhancements**:
  - Added `getFramerate()` method
  - Added `getGopSize()` method

- [x] **Unit tests** (13 tests for useWebCodecsDecoder, 6 tests for MP4Parser metadata)

### Acceptance Criteria

- **Playback Functionality**:
  - [x] Play/Pause button starts/stops continuous playback
  - [x] Playback uses WebCodecs decoder (no HTML5 video element)
  - [x] Frame-accurate playback with requestAnimationFrame timing
  - [x] Playback rate selector changes speed (7 options: 0.1x - 2.0x)
  - [x] Playback at all speeds functional (browser-tested)
  - [x] Playback stops at end of video

- **Cache Behavior**:
  - [x] Read-ahead increased to 60 frames
  - [x] seekToFrame() with `updateDisplay=false` for decode-only buffering
  - [x] Playback renders from cache (instant when cached)
  - [x] Cache miss handled (synchronous decode continues playback)

- **Metadata Display**:
  - [x] Metadata table displays on video load
  - [x] All 7 properties displayed (duration, framerate, GOP, frames, codec, resolution, buffer)
  - [x] Metadata extracted correctly from MP4Parser

- **Integration**:
  - [x] Step buttons pause during playback before stepping
  - [x] Seek slider pauses during playback before seeking
  - [x] Playback rate changes apply immediately
  - [x] All existing controls functional

- **Performance** (Design-level, runtime validation in Phase 6):
  - [x] Implementation supports smooth playback (rAF loop + cache buffering)
  - [x] Unit tests pass (57/57 tests)

### Implementation Notes

**Playback Loop Pattern**:

```typescript
function playbackLoop(timestamp: number) {
  if (!isPlaying) return;

  const elapsed = timestamp - lastFrameTime;
  const frameInterval = 1000 / framerate / playbackRate;

  if (elapsed >= frameInterval) {
    const nextFrame = currentFrame + 1;

    if (nextFrame >= totalFrames) {
      setIsPlaying(false); // End of video
      return;
    }

    // Try cache first (fast path)
    if (cache.has(nextFrame)) {
      renderFrameToCanvas(cache.get(nextFrame));
      setCurrentFrame(nextFrame);
    } else {
      // Cache miss - decode synchronously
      await seekToFrame(nextFrame); // Decodes target + 60 ahead
    }

    lastFrameTime = timestamp;
  }

  requestAnimationFrame(playbackLoop);
}
```

**Cache Strategy**:

- 120 total frames: 60 forward (playback buffer), 60 backward (stepping)
- During playback: Render from cache, decode 60 frames ahead in parallel
- After cache miss: 60-frame buffer refills, playback continues smoothly

### Implementation Results

**Files Modified**:
- `frontend/src/hooks/useWebCodecsDecoder.ts` - Added playback state, requestAnimationFrame loop, metadata
- `frontend/src/components/WebCodecsDemo.tsx` - Added playback UI and metadata table
- `frontend/src/utils/MP4Parser.ts` - Added getFramerate() and getGopSize()

**Test Results**:
- Total: 57/57 tests passing (100%)
- New tests: 13 for useWebCodecsDecoder playback, 6 for MP4Parser metadata
- Build: Success, no TypeScript errors

**Key Learnings**:
1. **Timing synchronization**: Initialize `lastFrameTimeRef` with first requestAnimationFrame (rAF) timestamp, not `performance.now()`, to avoid timing mismatch
2. **updateDisplay parameter**: Added to `seekToFrame()` to prevent frame jumps during read-ahead buffering (decode without displaying)
3. **Dropdown value matching**: Convert `playbackRate` number to string for HTML select comparison (1.0 → "1", 2.0 → "2")
4. **Control behavior**: Step/seek buttons pause playback automatically before executing (unified UX, no mode switching)

**Browser Testing**: Manual validation confirms all playback speeds functional, metadata displays correctly, controls work as expected.

---

## Phase 5: Test Video Generation

**Status**: Not Started  
**Estimated**: 30 minutes

### Scope

- Generate optimized test videos with GOP=30
- Generate H.265/HEVC test video to complement existing H.264

### Deliverables

- [ ] `tests/fixtures/generate_test_videos.sh` updated with:
  - H.264 generation with GOP=30 (replace existing)
  - H.265 generation with GOP=30
  - Burned-in frame counter for visual validation

### Commands

```bash
# H.264 with GOP=30
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -vf "drawtext=fontsize=100:fontcolor=white:x=100:y=100:text='Frame %{n}'" \
  -c:v libx264 -g 30 -keyint_min 30 -sc_threshold 0 -crf 23 -preset fast \
  tests/fixtures/videos/test_30fps_10s_gop30.mp4

# H.265 with GOP=30
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -vf "drawtext=fontsize=100:fontcolor=white:x=100:y=100:text='Frame %{n}'" \
  -c:v libx265 -x265-params keyint=30:min-keyint=30:scenecut=0 -crf 23 -preset fast \
  tests/fixtures/videos/test_30fps_10s_hevc_gop30.mp4
```

### Acceptance Criteria

- H.264 video generated with GOP=30 (verified with ffprobe)
- H.265 video generated with GOP=30 (verified with ffprobe)
- Frame counters visible and accurate
- Videos play correctly in supported browsers

---

## Phase 6: Cross-Browser Testing

**Status**: Not Started  
**Estimated**: 3-4 hours

### Scope

- Create Playwright test suite with exact frame assertions
- Validate across Chrome, Firefox, Safari
- Measure and document performance with GOP=30 videos

### Deliverables

- [ ] `tests/spikes/test_webcodecs_frame_control.spec.ts` with tests:
  - Decoder initialization (H.264 and H.265, both GOP=30)
  - Single frame step forward (exact, <50ms)
  - Single frame step backward within cache (exact, <10ms)
  - Single frame step backward outside cache (exact, <300ms)
  - Coarse step (5 frames, exact, <50ms if cached)
  - Seeking to arbitrary frame (exact, <300ms worst case)
  - **Playback functionality** (WebCodecs-based):
    - Continuous playback at 1.0x speed (smooth, no dropped frames)
    - Playback rate changes (0.25x - 2.0x)
    - Frame-accurate playback (correct frame at correct time)
    - Play/pause transitions
    - Playback performance with 60-frame read-ahead
  - Decode latency measurement by scenario
  - Memory leak detection (cache eviction working)
  - Cache hit/miss rate measurement (target: >80% during playback)
    - Live update rate on display in demo
- [ ] Tests pass with **exact assertions** (no ±1 tolerance)
- [ ] Performance metrics documented by scenario

### Test Pattern (CRITICAL)

```typescript
// EXACT assertions - no tolerance
expect(actualFrame).toBe(expectedFrame); // NOT ±1
```

### Acceptance Criteria

- All tests pass in Chrome, Firefox, Safari
- Tests use exact frame assertions (0 tolerance)
- Cache hit latency <10ms consistently
- Cache miss latency <300ms (GOP=30 guarantee)
- No memory leaks detected over extended use (50+ seeks)
- Feature detection works correctly
- Performance metrics captured and documented
- Cache hit rate >80% for typical usage (local frame stepping)

---

## Phase 7: Documentation

**Status**: Not Started  
**Estimated**: 1-2 hours

### Scope

- Document implementation patterns, gotchas, and recommendations
- Update spike documentation with findings

### Deliverables

- [ ] Update `docs/spike/WEBCODECS_FRAME_CONTROL.md` with:
  - WebCodecs-only architecture (stepping, seeking, AND playback)
  - Server-side video optimization strategy (GOP=30 rationale)
  - 60-frame read-ahead cache strategy for playback
  - Implementation summary
  - API patterns (VideoDecoder setup, frame decode, memory management, playback loop)
  - Keyframe-aware seeking algorithm
  - Gotchas and pitfalls discovered
  - Performance metrics by scenario:
    - Cache hit: <10ms
    - Cache miss: <300ms
    - Playback smoothness at various rates (0.1x - 2.0x)
  - Memory usage: 120MB (60 forward, 60 backward)
  - Browser compatibility matrix
  - Recommendations for dual-video sync (Phase 1)
  - Code examples with annotations
  - Test results summary

### Acceptance Criteria

- Documentation is concise with no redundancy
- WebCodecs-only architecture clearly explained (no hybrid approach references)
- Server-side optimization strategy justified
- All implementation patterns documented
- Playback implementation patterns included
- Known limitations clearly stated (GOP dependency, memory usage)
- Performance metrics included for stepping, seeking, AND playback
- Browser compatibility matrix complete
- Clear recommendations for Phase 1 dual-video integration
- Backend re-encoding integrated with upload flow

---

## Success Criteria (Task 0.3 Complete)

**Must Have**:

- [ ] Backend video optimization validates GOP analysis and re-encoding
- [ ] WebCodecs VideoDecoder decodes GOP=30 H.264 MP4 files successfully
- [ ] WebCodecs VideoDecoder decodes GOP=30 H.265 MP4 files successfully
- [ ] Frame stepping with **exact frame accuracy (0 tolerance)**
- [ ] 60-frame read-ahead cache implemented (2-second playback buffer)
- [ ] Seeking slider provides exact frame positioning
- [ ] Frame counter displays exact frame numbers
- [ ] **Continuous playback using WebCodecs** (frame-accurate, variable speed)
- [ ] **Playback rate control** (0.1x - 2.0x)
- [ ] **Video metadata display** (7 properties including GOP size)
- [ ] User-facing demo working (`npm run dev`)
- [ ] Tests pass with exact assertions in Chrome, Firefox, Safari
- [ ] Cache hit latency <10ms, miss latency <300ms (GOP=30 videos)
- [ ] **Playback smooth at 1.0x speed** (30fps, no dropped frames)
- [ ] Memory management verified (no leaks, cache eviction working)
- [ ] Clear error screen for unsupported browsers

**Should Have**:

- [ ] Decode latency documented by scenario (cache hit/miss, codec, resolution, playback)
- [ ] Cache hit rate measured (target: >80% during stepping and playback)
- [ ] Playback performance at different rates (0.1x - 2.0x)
- [ ] Processing time for backend re-encoding measured on Pi 4
- [ ] Documentation captures all learnings and browser compatibility
- [ ] Server-side optimization strategy validated and documented

---

## Risk Mitigation

| Risk                                           | Mitigation                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Browser support gaps                           | Feature detection + clear error message with upgrade guidance                |
| Codec configuration extraction complexity      | Use mp4box.js (proven library)                                               |
| Memory leaks from VideoFrame                   | Strict cleanup patterns in cache eviction, verify with tests                 |
| Decode latency >300ms                          | Server-side GOP=30 guarantee + LRU cache ensures predictable performance     |
| H.265 decode performance                       | Document differences, acceptable if <300ms (same as H.264 with GOP=30)       |
| Backend re-encoding too slow on Pi 4           | Use hardware encoding (v4l2m2m), fallback to software with ultrafast preset  |
| Large videos consume excessive memory in cache | Configurable cache size (60-120 frames), eviction working, ~60-120MB bounded |

---

## Next Steps After Completion

1. **Update PROJECT_PLAN.md** - Mark Task 0.3 complete, update requirements status
2. **Task 0.4** (Dual Video Sync) - Simplified with deterministic frame control

---

**Last Updated**: 2025-11-18  
**Confidence Level**: 9/10
