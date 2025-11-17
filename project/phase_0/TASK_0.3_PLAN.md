# Task 0.3: WebCodecs Frame Control Spike - Implementation Plan

**Status**: In Progress (Phase 1 Complete)
**Started**: 2025-11-16
**Completed**: TBD
**Owner**: Development Team
**Estimated Effort**: 12-15 hours across 2-3 sessions

---

## Overview

Implement frame-accurate video control using WebCodecs API to achieve exact frame positioning (0 tolerance) required for deterministic dual-video synchronization. This replaces the `requestVideoFrameCallback` approach from Tasks 0.2/0.2.1 which achieved ±1 frame accuracy but failed exact frame matching.

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

**Status**: Not Started  
**Estimated**: 2-3 hours

### Scope

- Implement MP4Parser utility class using mp4box.js
- Extract codec configuration (H.264 and H.265)
- Extract frame samples with timestamps

### Deliverables

- [ ] `utils/MP4Parser.ts` with methods:
  - `initialize(videoFile: File): Promise<void>`
  - `getCodecConfig(): VideoDecoderConfig`
  - `getSamples(): MP4Box.Sample[]`
  - `getFrameCount(): number`
- [ ] Error handling for corrupt/unsupported files
- [ ] Support for fragmented MP4s

### Acceptance Criteria

- Parses H.264 MP4 files successfully
- Parses H.265 MP4 files successfully
- Extracts valid VideoDecoderConfig
- Returns accurate frame count
- Handles errors gracefully with descriptive messages

---

## Phase 3: VideoDecoder Integration

**Status**: Not Started  
**Estimated**: 3-4 hours

### Scope

- Implement WebCodecs VideoDecoder pipeline
- Frame-by-frame decode with canvas rendering
- Handle keyframe dependencies

### Deliverables

- [ ] `hooks/useWebCodecsDecoder.ts` hook with interface:
  - `canvasRef: RefObject<HTMLCanvasElement>`
  - `currentFrame: number`
  - `totalFrames: number`
  - `isReady: boolean`
  - `error: string | null`
  - `seekToFrame(frameIndex: number): void`
  - `stepForward(): void`
  - `stepBackward(): void`
- [ ] VideoDecoder configuration and initialization
- [ ] Frame decode pipeline with EncodedVideoChunk
- [ ] Canvas rendering of decoded VideoFrames
- [ ] Memory management (VideoFrame.close())

### Acceptance Criteria

- VideoDecoder initializes successfully with both H.264 and H.265
- Frames decode and render to canvas correctly
- Frame positioning is deterministic (frame N always shows frame N)
- Memory properly released (no leaks)
- Decode latency <50ms per frame for sequential steps

---

## Phase 4: Frame Cache Implementation

**Status**: Not Started  
**Estimated**: 1-2 hours

### Scope

- Implement LRU cache for decoded VideoFrames
- Optimize frame stepping performance

### Deliverables

- [ ] `utils/FrameCache.ts` utility class:
  - `set(frameIndex: number, frame: VideoFrame): void`
  - `get(frameIndex: number): VideoFrame | undefined`
  - `clear(): void`
  - `evictOldest(): void`
- [ ] Integration with useWebCodecsDecoder hook
- [ ] Cache size limit (~30 frames, ~30MB)

### Acceptance Criteria

- Cache hit improves frame step performance (<10ms)
- Memory usage stays bounded (~30MB per video)
- No memory leaks detected
- Cache cleared properly on unmount
- Oldest frames evicted when at capacity

---

## Phase 5: React Components & UI

**Status**: Not Started  
**Estimated**: 2-3 hours

### Scope

- Create UI components for demo/testing
- Implement playback controls
- Add seeking slider

### Deliverables

- [ ] `components/WebCodecsPlayer.tsx`:
  - File upload input
  - Canvas element for video display
  - Frame counter display
  - Loading/error states
- [ ] `components/FrameStepper.tsx`:
  - Play/Pause button
  - Fine step forward/backward (1 frame)
  - Coarse step forward/backward (5 frames)
  - Seeking slider (0 to totalFrames-1)
  - Current frame / total frames display
- [ ] Decode latency metrics display

### Acceptance Criteria

- UI loads and displays correctly
- File upload triggers decoder initialization
- All buttons functional (play/pause, step, seek)
- Frame counter shows exact values
- Seeking slider provides exact frame positioning
- Error messages display clearly for unsupported browsers

---

## Phase 6: Test Video Generation

**Status**: Not Started  
**Estimated**: 30 minutes

### Scope

- Generate H.265/HEVC test video to complement existing H.264 videos

### Deliverables

- [ ] `tests/fixtures/generate_test_videos.sh` updated with H.265 generation
- [ ] `test_30fps_10s_hevc.mp4` generated with burned-in frame counter

### Command

```bash
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -vf "drawtext=fontsize=100:fontcolor=white:x=100:y=100:text='Frame %{n}'" \
  -c:v libx265 -preset fast \
  tests/fixtures/videos/test_30fps_10s_hevc.mp4
```

### Acceptance Criteria

- H.265 video generated successfully
- Frame counter visible and accurate
- Video plays in supported browsers

---

## Phase 7: Cross-Browser Testing

**Status**: Not Started  
**Estimated**: 3-4 hours

### Scope

- Create Playwright test suite with exact frame assertions
- Validate across Chrome, Firefox, Safari
- Measure and document performance

### Deliverables

- [ ] `tests/spikes/test_webcodecs_frame_control.spec.ts` with tests:
  - Decoder initialization (H.264 and H.265)
  - Single frame step forward (exact)
  - Single frame step backward (exact)
  - Coarse step (5 frames, exact)
  - Seeking to arbitrary frame (exact)
  - Play/Pause functionality
  - Decode latency measurement (<50ms)
  - Memory leak detection
- [ ] Tests pass with **exact assertions** (no ±1 tolerance)
- [ ] Performance metrics documented

### Test Pattern (CRITICAL)

```typescript
// EXACT assertions - no tolerance
expect(actualFrame).toBe(expectedFrame); // NOT ±1
```

### Acceptance Criteria

- All tests pass in Chrome, Firefox, Safari
- Tests use exact frame assertions (0 tolerance)
- Decode latency consistently <50ms for cached frames
- No memory leaks detected over extended use
- Feature detection works correctly
- Performance metrics captured and documented

---

## Phase 8: Documentation

**Status**: Not Started  
**Estimated**: 1-2 hours

### Scope

- Document implementation patterns, gotchas, and recommendations
- Update spike documentation with findings

### Deliverables

- [ ] Update `docs/spike/WEBCODECS_FRAME_CONTROL.md` with:
  - Implementation summary
  - API patterns (VideoDecoder setup, frame decode, memory management)
  - Gotchas and pitfalls discovered
  - Performance metrics (decode latency, memory usage, browser differences)
  - Browser compatibility matrix
  - Recommendations for Phase 1 integration
  - Code examples with annotations
  - Test results summary

### Acceptance Criteria

- Documentation is concise with no redundancy
- All implementation patterns documented
- Known limitations clearly stated
- Performance metrics included
- Browser compatibility matrix complete
- Clear recommendations for Phase 1

---

## Success Criteria (Task 0.3 Complete)

**Must Have**:

- [ ] WebCodecs VideoDecoder decodes H.264 MP4 files successfully
- [ ] WebCodecs VideoDecoder decodes H.265 MP4 files successfully
- [ ] Frame stepping with **exact frame accuracy (0 tolerance)**
- [ ] Play/Pause functionality works correctly
- [ ] Seeking slider provides exact frame positioning
- [ ] Frame counter displays exact frame numbers
- [ ] Tests pass with exact assertions in Chrome, Firefox, Safari
- [ ] Decode latency <50ms for cached frames, measured and documented
- [ ] Memory management verified (no leaks)
- [ ] Clear error screen for unsupported browsers

**Should Have**:

- [ ] Decode latency documented by scenario (cache hit/miss, codec, resolution)
- [ ] LRU cache measurably improves performance
- [ ] Documentation captures all learnings and browser compatibility

---

## Risk Mitigation

| Risk                                      | Mitigation                                                          |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Browser support gaps                      | Feature detection + clear error message with upgrade guidance       |
| Codec configuration extraction complexity | Use mp4box.js (proven library)                                      |
| Memory leaks from VideoFrame              | Strict cleanup patterns, verify with tests                          |
| Decode latency >50ms                      | LRU cache for sequential steps, accept higher latency for far seeks |
| H.265 decode performance                  | Document differences, acceptable if <100ms                          |

---

## Next Steps After Completion

1. **Task 0.4** (Dual Video Sync) - Simplified with deterministic frame control
2. **Phase 1 Integration** - Migrate patterns into main application
3. **Update PROJECT_PLAN.md** - Mark Task 0.3 complete, update requirements status

---

**Last Updated**: 2025-11-15  
**Confidence Level**: 9/10
