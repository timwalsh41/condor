# Task 0.3: WebCodecs Frame Control Spike - Implementation Plan

**Status**: In Progress (Phase 2.5 Complete)
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

**Status**: Not Started  
**Estimated**: 4-5 hours (merged with former Phase 4)

### Scope

- Implement WebCodecs VideoDecoder pipeline
- Frame-by-frame decode with canvas rendering
- Handle keyframe dependencies with LRU frame cache
- Optimize for GOP=30 videos (max 30-frame decode from keyframe)

### Deliverables

- [ ] `utils/FrameCache.ts` - Simple LRU cache utility class with 60-120 frame capacity
- [ ] `hooks/useWebCodecsDecoder.ts` hook with interface:
  - `canvasRef: RefObject<HTMLCanvasElement>`
  - `currentFrame: number`
  - `totalFrames: number`
  - `isReady: boolean`
  - `error: string | null`
  - `seekToFrame(frameIndex: number): void`
  - `stepForward(): void`
  - `stepBackward(): void`
- [ ] Keyframe-aware seeking logic (decode from keyframe → target frame)
- [ ] VideoDecoder configuration and initialization
- [ ] Canvas rendering of decoded VideoFrames
- [ ] Memory management (VideoFrame.close() in cache eviction)

### Acceptance Criteria

- VideoDecoder initializes successfully with both H.264 and H.265
- Frames decode and render to canvas correctly
- Frame positioning is deterministic (frame N always shows frame N)
- **Cache hit performance: <10ms** (instant for cached frames)
- **Cache miss performance: <300ms** (worst case, 30-frame decode from keyframe)
- Memory usage stays bounded (60-120MB for 60-120 frame cache @ 1080p)
- Memory properly released (no leaks - verified with DevTools profiler)
- Forward stepping uses cached frames (consecutive frames cached during decode)
- Backward stepping within cache window is instant (<10ms)

**Technical Details**: See `docs/spike/WEBCODECS_FRAME_CONTROL.md` for LRU cache implementation and keyframe-aware seeking algorithm

---

## Phase 4: React Components & UI

**Status**: Not Started  
**Estimated**: 2-3 hours

### Scope

- Create UI components for demo/testing
- Integrate WebCodecs decoder for frame stepping/seeking (exact positioning)
- Integrate HTML5 video element for continuous playback (smooth motion)
- Implement smooth mode switching (stepping ↔ playback) with state synchronization

### Deliverables

- [ ] `components/WebCodecsPlayer.tsx`:
  - Canvas element for WebCodecs frame display (stepping/seeking mode)
  - HTML5 video element for continuous playback (playback mode)
  - Mode switching logic (show canvas when stepping, video when playing)
  - File upload input
  - Frame counter display (Frame X / Total)
  - Loading/error states
  - Decode latency display (last operation ms)
  - Cache hit/miss statistics
- [ ] `components/FrameStepper.tsx`:
  - Play/Pause button
  - Fine step forward/backward (1 frame)
  - Coarse step forward/backward (5 frames)
  - Seeking slider (0 to totalFrames-1)
  - Current frame / total frames display
- [ ] User-facing demo (`npm run dev` from frontend/)

### Acceptance Criteria

- UI loads and displays correctly
- File upload triggers decoder initialization
- WebCodecs canvas visible during stepping/seeking, HTML5 video visible during playback
- Smooth transition between modes (position synchronized on mode switch)
- All buttons functional (play/pause, step, seek)
- Frame counter shows exact values
- Seeking slider provides exact frame positioning
- Decode latency displayed for each operation
- Cache statistics visible (hit rate %)
- Error messages display clearly for unsupported browsers
- Demo is intuitive and demonstrates exact frame accuracy

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
  - Play/Pause functionality
  - Decode latency measurement by scenario
  - Memory leak detection (cache eviction working)
  - Cache hit/miss rate measurement
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
  - Server-side video optimization strategy (GOP=30 rationale)
  - Simple LRU cache approach (vs complex dual cache)
  - Implementation summary
  - API patterns (VideoDecoder setup, frame decode, memory management)
  - Keyframe-aware seeking algorithm
  - Gotchas and pitfalls discovered
  - Performance metrics by scenario:
    - Cache hit: <10ms
    - Cache miss (forward): <300ms
    - Cache miss (backward, large jump): <300ms
  - Memory usage: 60-120MB (cache size dependent)
  - Browser compatibility matrix
  - Recommendations for Phase 1 integration
  - Code examples with annotations
  - Test results summary

### Acceptance Criteria

- Documentation is concise with no redundancy
- Server-side optimization strategy clearly explained
- All implementation patterns documented
- Known limitations clearly stated (GOP dependency, memory usage)
- Performance metrics included with GOP=30 context
- Browser compatibility matrix complete
- Clear recommendations for Phase 1
- Backend re-encoding documented for Phase 1 implementation

---

## Success Criteria (Task 0.3 Complete)

**Must Have**:

- [ ] Backend video optimization validates GOP analysis and re-encoding
- [ ] WebCodecs VideoDecoder decodes GOP=30 H.264 MP4 files successfully
- [ ] WebCodecs VideoDecoder decodes GOP=30 H.265 MP4 files successfully
- [ ] Frame stepping with **exact frame accuracy (0 tolerance)**
- [ ] Simple LRU cache (60-120 frames) implemented and tested
- [ ] Seeking slider provides exact frame positioning
- [ ] Frame counter displays exact frame numbers
- [ ] User-facing demo working (`npm run dev`)
- [ ] Tests pass with exact assertions in Chrome, Firefox, Safari
- [ ] Cache hit latency <10ms, miss latency <300ms (GOP=30 videos)
- [ ] Memory management verified (no leaks, cache eviction working)
- [ ] Clear error screen for unsupported browsers

**Should Have**:

- [ ] Decode latency documented by scenario (cache hit/miss, codec, resolution)
- [ ] Cache hit rate measured (target: >80% for typical usage)
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
