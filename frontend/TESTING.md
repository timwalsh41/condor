# Frontend Testing Guide

## Test Types

### Unit Tests (Vitest)

**Location**: `src/**/*.test.{ts,tsx}`
**Purpose**: Component logic, cache behavior, utilities
**Count**: 459 tests

### Playwright Integration Tests

**Location**: `tests/**/*.spec.ts`
**Purpose**: Full-stack integration testing with backend, frame-accurate validation (exact 0-tolerance), cache performance, memory leak detection, cross-browser compatibility
**Count**: 177 tests (133 passing, 32 intentionally skipped, 12 timed out)
**Backend Required**: http://localhost:8000 must be running

**Test Coverage**:

- Upload workflow and video processing
- Frame-accurate stepping and seeking
- Cache behavior and performance
- Memory leak detection (Chrome DevTools Protocol)
- Dual-video synchronization
- Canvas overlay and annotations
- HEVC codec handling

See `frontend/README.md` for instructions on running tests.

### Manual Tests

This section provides a short summary of a basic regression test suite that can be run manually to exercise the core app sync and playback functionality.

#### Setup

Start the dev server in host mode to share outside container:

```bash
cd frontend/
npm run dev -- --host
```

Navigate a browser to `http://localhost:5173`

#### Test procedure

- Test suite - verify that the sync offset is maintained and all functions behave as expected
  - Run playback and make sure the playback stops with the videos on the correct frames
    - Repeat ~3-5x
    - Try at different playback speeds
  - Excercise step buttons (+/-1, +/-5)
    - While hitting beginning & ending limit
    - Without hitting beginning & ending limit
  - Scrub to beginning and end point
- Procedure:
  - Load two test videos with frame numbers burned in, e.g. `test_gop30_h264.mp4`
  - Advance video A by 5 frames (video A at frame 5, video B at frame 0, sync offset = -5)
  - Switch from SYNC to PLAYBACK mode
  - Run the test suite
  - Return to SYNC mode, verify that videos return to sync point (video A at frame 5, video B at frame 0)
  - Advance video B by 10 frames (video A at frame 5, video B at frame 10, sync offset = +5)
  - Switch from SYNC to PLAYBACK mode
  - Run the test suite

## Interpreting Results

### Unit Tests

```
✓ src/utils/tests/FrameCache.test.ts (19)
Test Files: 1 passed (1)
```

**Pass**: All tests green | **Fail**: Check stack trace

### Browser Tests

```
✓ [chrome] test_frame_stepping.spec.ts:60 frame stepping (2.1s)
✓ [firefox] test_frame_stepping.spec.ts:60 frame stepping (2.3s)
✓ [webkit] test_frame_stepping.spec.ts:60 frame stepping (2.5s)
18 passed (45s)
```

**Pass**: All browsers green | **Fail**: `npx playwright show-report`

### Frame Accuracy

All tests validate **exact (0 tolerance)** frame positioning:

```typescript
expect(currentFrame).toBe(expectedFrame); // NOT ±1
```

**Frame Stepping Tests** (`test_frame_stepping.spec.ts`):

- 6 tests × 3 browsers = 18 tests total
- All tests require exact frame accuracy (non-negotiable)
- Validates: fine stepping (±1 frame), coarse stepping (±5 frames), playback counter updates

**Cache Performance Tests** (`test_cache_performance.spec.ts`):

- 4 tests × 3 browsers = 12 tests total
- Validates cache miss latency <500ms (headless), <300ms target (GOP=30)
- Tests: forward seek beyond cache, backward seek with eviction, continuous playback, cache size limits

### Memory Leak Thresholds

**Memory Leak Tests** (`test_memory_leaks.spec.ts`, Chrome-only):

| Test              | Threshold      | Indicates               |
| ----------------- | -------------- | ----------------------- |
| 50 frame steps    | < 10MB growth  | Cache evicting properly |
| Component unmount | > 5MB released | Cleanup working         |
| 60 frame steps    | < 15MB total   | LRU functioning         |

**GC Warnings**: "VideoFrame garbage collected" - Expected during cache operations (< 100 acceptable)

## Test Skips and Limitations

### Skip Summary (32 total)

| Browser     | Memory Leaks | Cache Performance | Canvas Overlay | Total  |
| ----------- | ------------ | ----------------- | -------------- | ------ |
| **Chrome**  | 0            | 0                 | 5              | 5      |
| **Firefox** | 5            | 0                 | 6              | 11     |
| **WebKit**  | 5            | 1                 | 6              | 12     |
| **TOTAL**   | **10**       | **1**             | **16**         | **27** |

**Note:** Actual count is 32 skips - additional 5 from dynamic skips (cache statistics test when UI not exposed).

All skips are intentional and document legitimate testing limitations (CDP availability, browser-specific quirks, headless automation constraints).

---

### 1. Memory Leak Tests (Chrome-only, 10 skips)

**Tests:** 5 tests in `test_memory_leaks.spec.ts`

- Sequential frame stepping memory leak check
- Component unmount memory release check
- Rapid cache eviction memory leak check
- Seeking backwards memory leak check
- Cache statistics eviction reporting

**Status:**

- Chrome: All 5 tests run ✅
- Firefox: All 5 skipped ⏭️
- WebKit: All 5 skipped ⏭️

**Reason:** Tests require Chrome DevTools Protocol (`HeapProfiler.collectGarbage`, `Performance.getMetrics`) which is only available in Chromium-based browsers. Chrome-only testing is sufficient as VideoFrame memory behavior should not vary across browsers.

---

### 2. WebKit: Cache Performance Test (1 skip)

**Test:** `test_cache_performance.spec.ts:280` - "should handle multiple random seeks with exact frame accuracy"

**Status:** Skipped on WebKit (Chrome/Firefox pass)

**Issue:** WebKit's headless WebCodecs decoder stalls during large seek sequences (200+ frame jumps). The decoder stops processing frames mid-seek, causing timeouts even with 30s limits.

**Root Cause:** WebKit WebCodecs implementation issue in headless mode, not a bug in our code. Chrome and Firefox pass this test consistently.

**Evidence:**

- Decoder gets stuck early (e.g., frame 31 of 300) and stops outputting frames
- Only occurs in WebKit headless mode
- Chrome/Firefox complete same 7-seek sequence in ~5-10 seconds
- All other WebKit tests pass (cache hits, frame stepping, etc.)

**Conclusion:** This is a WebKit platform limitation, not an implementation bug. Test validates cache eviction behavior which is already proven on Chrome/Firefox.

---

### 3. WebKit: Canvas Internal Dimensions (1 skip)

**Test:** `test_canvas_overlay.spec.ts:615` - "annotation canvas has correct internal dimensions"

**Status:** Skipped on WebKit (Chrome/Firefox pass)

**Issue:** WebKit headless reports unexpected canvas internal dimensions (2560px width instead of expected 1280px or 640px). This appears to be a rendering scale quirk in WebKit's headless mode.

**Root Cause:** WebKit headless canvas dimension reporting differs from Chrome/Firefox. The test expects annotation canvas width to be either 1280px (normal) or 640px (2x DPR scaling), but WebKit returns 2560px.

**Evidence:**

- Chrome and Firefox consistently pass (report 1280px or 640px as expected)
- WebKit's canvas alignment tests pass (positioning is correct)
- WebKit's display dimensions match correctly (clientWidth/clientHeight)
- Only internal dimension reporting (canvas.width property) differs

**Conclusion:** This is a WebKit platform quirk in headless mode, not an implementation bug. Canvas positioning and alignment are validated correctly on WebKit. Internal dimension validation is proven on Chrome/Firefox.

---

### 4. React+Konva: Annotation Interaction Tests (15 skips)

**Tests:** 5 tests in `test_canvas_overlay.spec.ts`, skipped on all 3 browsers (5 × 3 = 15 skips)

- Polyline tool finalization (Enter key, double-click)
- Annotation selection (clicking shapes)
- Annotation deletion (Delete key)
- Tool switching (depends on polyline)

**Status:** Skipped in headless Playwright (all browsers)

**Issue:** These annotation interactions cannot be reliably automated in headless Playwright due to React+Konva event coordination requirements. The `activeVideo` state must be set by React event handlers before keyboard shortcuts work, but dispatching synthetic DOM events to the Konva canvas triggers Konva's internal event system without properly invoking React's synthetic event handlers.

**Coverage:**

- ✅ **Unit tests**: 175 tests cover all AnnotationManager business logic and hook integration
- ✅ **Integration tests**: 44 tests validate real user interactions for core features
- ✅ **Drawing tools**: Freehand, Oval, Arrow fully validated end-to-end
- ✅ **Critical requirements**: Canvas alignment, HEVC blocking, dual-video independence

**Why Not Use Test Hooks?** Adding test-specific APIs (e.g., `window.__setActiveVideo()`) would bypass the actual user interaction path (DOM → React → Konva event chain) and only test internal methods already covered by 175 unit tests.

**Full Details:** See `docs/spike/ANNOTATIONS.md` "Testing Limitations" section for complete technical analysis.

## Troubleshooting

**"Browser not found"**: `npx playwright install`
**Tests timeout**: Playwright auto-starts dev server via `webServer` config. Check if port 5173 is blocked or if server fails to start (check stderr in test output)
**Memory exceeds threshold**: Check cache size (default: 120 frames), run `npm run test:memory -- --headed`
**WebKit slow seeks**: Expected, timeouts adjusted (15s for complex seeks)
**Import errors**: `rm -rf node_modules/.vite && npm run test`

**Note**: The `webServer` configuration in `playwright.config.ts` automatically starts `npm run dev` before running tests. You do NOT need to manually run the dev server in a separate terminal. If already running, Playwright will reuse it (`reuseExistingServer: true` in local dev).

## Manual Verification

### Frame Accuracy

```bash
npm run dev -- --host
# Upload tests/fixtures/videos/test_gop30_h264.mp4
# Step forward/backward, verify burned-in frame numbers match UI exactly
# Expected: 0-tolerance accuracy (exact frame match)
```

### Memory Leaks

```bash
npm run dev -- --host
# Chrome → DevTools → Memory → Snapshot → Step 50 frames → GC → Snapshot
# Expected: 10-20MB retained (cached VideoFrames, 120-frame cache)
```

### Cache Performance

```bash
npm run dev -- --host
# Upload tests/fixtures/videos/test_gop30_h264_10s.mp4 (300 frames)
# Seek frame 10 → 250 (beyond cache capacity)
# Expected: <300ms latency, cache stats show evictions
```

## CI/CD

```bash
npm run test        # Vitest
npm run test:e2e    # Playwright (headless, 2 retries)
```

## Coverage

✅ **Exact frame accuracy (0 tolerance)** | ✅ Cache eviction | ✅ Memory leaks (CDP profiling) | ✅ Cross-browser (Chrome/Firefox/WebKit) | ✅ Lifecycle management | ✅ Cache performance (<300ms GOP=30) | ✅ Continuous playback (variable speed 0.1x-2.0x)
