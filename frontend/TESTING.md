# Frontend Testing Guide

## Test Types

### Unit Tests (Vitest)

**Location**: `src/**/*.test.{ts,tsx}`
**Purpose**: Component logic, cache behavior, utilities
**Count**: 459 tests

### Playwright Integration Tests

**Location**: `tests/**/*.spec.ts`
**Purpose**: Full-stack integration testing with backend, frame-accurate validation (exact 0-tolerance), cache performance, memory leak detection, cross-browser compatibility
**Count**: ~70 tests (varies by browser; Chrome project currently disabled in config)
**Backend Required**: http://localhost:8000 must be running

**Test Coverage**:

- Local upload workflow (GOP detection, rotation modal, HEVC transcoding, dual upload)
- Frame-accurate stepping and seeking (fine ±1, coarse ±5)
- Cache behavior and performance (forward/backward seeks, continuous playback)
- Memory leak detection (Chrome DevTools Protocol, Chrome-only)
- Dual-video synchronization (sync/playback mode, offset maintenance, speed control)
- Canvas overlay and annotations (4 drawing tools, alignment, dual-video independence, HEVC blocking)
- Session lifecycle (save → load → restore → re-save)
- Library save workflow (save-to-library button state management)
- Bug fix integration (annotation workflow, video reload, session switching)

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
✓ [firefox] test_frame_stepping.spec.ts:60 frame stepping (2.3s)
✓ [webkit] test_frame_stepping.spec.ts:60 frame stepping (2.5s)
12 passed (38s)
```

**Pass**: All browsers green | **Fail**: `npx playwright show-report`

**Note**: Chrome project is currently disabled in `playwright.config.ts`. The example output above reflects the current Firefox/WebKit-only configuration. See "Browser Coverage" section above for details.

### Frame Accuracy

All tests validate **exact (0 tolerance)** frame positioning:

```typescript
expect(currentFrame).toBe(expectedFrame); // NOT ±1
```

**Frame Stepping Tests** (`test_frame_stepping.spec.ts`, `test_webcodecs_frame_stepping.spec.ts`):

- 12 tests total (6 per file) × 2 browsers (Firefox, WebKit) = 24 test runs
- Chrome project is disabled; these tests do not execute on Chrome currently
- All tests require exact frame accuracy (non-negotiable)
- Validates: fine stepping (±1 frame), coarse stepping (±5 frames), playback counter updates

**Cache Performance Tests** (`test_cache_performance.spec.ts`):

- 4 tests × 2 browsers (Firefox, WebKit) = 8 test runs
- WebKit: 1 test skipped ("multiple random seeks" — decoder stalls on large seek sequences)
- Validates cache miss latency <500ms (headless), <300ms target (GOP=30)
- Tests: forward seek beyond cache, backward seek with eviction, continuous playback, multiple random seeks

### Memory Leak Thresholds

**Memory Leak Tests** (`test_memory_leaks.spec.ts`, Chrome-only):

| Test              | Threshold      | Indicates               |
| ----------------- | -------------- | ----------------------- |
| 50 frame steps    | < 10MB growth  | Cache evicting properly |
| Component unmount | > 5MB released | Cleanup working         |
| 60 frame steps    | < 15MB total   | LRU functioning         |

**GC Warnings**: "VideoFrame garbage collected" - Expected during cache operations (< 100 acceptable)

## Browser Coverage

**Current State**:

| Browser   | Project Status | Notes |
|-----------|---------------|-------|
| **Chrome**  | ❌ **Disabled** (commented out in `playwright.config.ts`) | Most users' primary browser; provides native H.264 support via `channel: "chrome"`. Needs to be re-enabled. |
| **Firefox** | ✅ Active | All test files run |
| **WebKit**  | ✅ Active | All test files run (some tests have browser-specific skips) |

**This is a significant gap.** Chrome is the primary browser for most users and provides native H.264 support. Running E2E tests without Chrome means no automated validation for the most common user environment.

---

## Test Skips and Limitations

### Skip Summary

| Browser     | Memory Leaks | Cache Performance | Canvas Overlay | Total per Browser |
|-------------|--------------|-------------------|----------------|-------------------|
| **Firefox** | 5            | 0                 | 6              | 11                |
| **WebKit**  | 5            | 1                 | 6              | 12                |
| **TOTAL**   | **10**       | **1**             | **12**         | **23**            |

Chrome skip counts are excluded — the Chrome project is disabled and no tests execute on it.

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

✅ **Exact frame accuracy (0 tolerance)** | ✅ Cache eviction | ✅ Memory leaks (CDP profiling, Chrome-only) | ✅ Cache performance (<300ms GOP=30) | ✅ Continuous playback (variable speed 0.1x-2.0x) | ✅ Dual-video synchronization | ✅ Annotation drawing (freehand, oval, arrow) | ✅ Session save/load lifecycle | ✅ Library save workflow

⚠️ **Chrome disabled** — Cross-browser coverage is Firefox/WebKit only. Chrome project is commented out in `playwright.config.ts` and must be re-enabled.

---

## Test Coverage by Workflow

This section maps the integration test suite to the user workflows defined in `docs/UX_WORKFLOW_SPEC.md` (Google Photos import excluded per scope decision).

### Workflow 1: Manage Video Library

| Sub-workflow | Coverage | Test File |
|---|---|---|
| List/edit metadata/delete/select videos | ❌ Not tested | — |
| Video preview & playback in Library | ❌ Not tested | — |
| Save videos to library from Analyze | ✅ Partial | `test_bug_fixes_integration.spec.ts` (5.2.3, 5.2.4) |

**Gaps**: No tests for the Library view navigation, video list rendering, metadata editing (golfer name, capture date, club, notes, quality score), or the Library→Analyze selection flow.

### Workflow 1B: Local Upload to Library

| Sub-workflow | Coverage | Test File |
|---|---|---|
| File selection & validation | ✅ | `test_upload_workflow.spec.ts` |
| GOP detection (optimized/non-optimized) | ✅ | `test_upload_workflow.spec.ts` |
| Rotation modal (accept/cancel) | ✅ | `test_upload_workflow.spec.ts` |
| HEVC transcoding | ✅ | `test_upload_workflow.spec.ts` |
| Dual video upload | ✅ | `test_upload_workflow.spec.ts` |

### Workflow 2: Start Analysis (Analyze View)

| Sub-workflow | Coverage | Test File |
|---|---|---|
| Frame stepping (fine ±1) | ✅ | `test_frame_stepping.spec.ts`, `test_webcodecs_frame_stepping.spec.ts` |
| Frame stepping (coarse ±5) | ✅ | `test_frame_stepping.spec.ts`, `test_webcodecs_frame_stepping.spec.ts` |
| Frame counter accuracy | ✅ | `test_frame_stepping.spec.ts`, `test_webcodecs_frame_stepping.spec.ts` |
| Playback with counter updates | ✅ | `test_frame_stepping.spec.ts`, `test_webcodecs_frame_stepping.spec.ts` |
| Sync/Playback mode switching | ✅ | `test_dual_video_sync.spec.ts` |
| Sync offset calculation & persistence | ✅ | `test_dual_video_sync.spec.ts` |
| Negative sync offset | ✅ | `test_dual_video_sync.spec.ts` |
| Speed control (both videos) | ✅ | `test_dual_video_sync.spec.ts` |
| Joint scrub bar | ✅ | `test_dual_video_sync.spec.ts` |
| Canvas overlay alignment | ✅ | `test_canvas_overlay.spec.ts` |
| Annotation tools (freehand, oval, arrow) | ✅ | `test_canvas_overlay.spec.ts` |
| Annotation playback persistence | ✅ | `test_canvas_overlay.spec.ts` |
| Annotation Clear All | ✅ | `test_canvas_overlay.spec.ts` |
| Dual-video annotation independence | ✅ | `test_canvas_overlay.spec.ts` |
| Polyline (Enter, double-click) | ⏭️ Skipped | Headless limitation (see §4 below) |
| Annotation selection/clicking | ⏭️ Skipped | Headless limitation (see §4 below) |
| Annotation deletion (Delete key) | ⏭️ Skipped | Depends on selection (see §4) |
| Trim state / trim bounds | ❌ Not tested | — |

### Workflow 3: Save Session

| Sub-workflow | Coverage | Test File |
|---|---|---|
| Save session with sync/playback/annotation state | ✅ | `test_bug_fixes_integration.spec.ts` (5.2.3) |
| Save session requires library videos | ✅ | `test_bug_fixes_integration.spec.ts` (5.2.3) |
| Save button disabled/enabled states | ✅ | `test_bug_fixes_integration.spec.ts` (5.2.4) |
| Save without videos (error state) | ❌ Not tested | — |

### Workflow 4: Load Session

| Sub-workflow | Coverage | Test File |
|---|---|---|
| Load session from Sessions view | ✅ | `test_bug_fixes_integration.spec.ts` (5.2.3) |
| Full state restoration (mode, sync, speed, loop) | ✅ | `test_bug_fixes_integration.spec.ts` (5.2.3) |
| Session switching with annotation hydration | ✅ | `test_bug_fixes_integration.spec.ts` (5.2.5) |
| Session not found / empty sessions list | ❌ Not tested | — |

### Workflow 5: Continue and Re-save

| Sub-workflow | Coverage | Test File |
|---|---|---|
| Load → modify → re-save session | ❌ **Not tested** | — |
| Load → modify → save new variant | ❌ **Not tested** | — |

### Workflow 6: Google Photos Import

Excluded per scope decision.

---

## Error and Failure Path Coverage

| Scenario | Covered | Test File |
|---|---|---|
| Invalid file type upload | ❌ Not tested | — |
| Upload failure (network/processing) | ❌ Not tested | — |
| HEVC codec warning display | ✅ | `test_canvas_overlay.spec.ts` (HEVC codec blocking section) |
| Session save without library videos | ❌ Not tested | — |
| Session load failure | ❌ Not tested | — |
| Empty library / no sessions states | ❌ Not tested | — |
| Decoder failure during playback | ❌ Not tested | — |
| Loading state feedback | ❌ Not tested | — |

---

## Keyboard Shortcuts

The UX spec states keyboard shortcuts operate in Analyze for playback and stepping. No integration tests verify this behavior.

---

## Recommended Plan for Improving Coverage

### Immediate Priority

1. **Enable Chrome browser project** in `playwright.config.ts` — restore the commented-out Chrome project. This is the single highest-impact gap; Chrome is the primary user browser and provides native H.264 support.

2. **Add Workflow 5 tests** (load → modify → re-save session) — the entire cycle of loading a session, making modifications (changing sync points, adding annotations, adjusting trim, changing speed), and saving (either updating or creating a variant) has zero test coverage.

3. **Add error path tests** — upload failure (invalid file, network error), session save failure (no videos in library), and empty state navigation.

4. **Add keyboard shortcut tests** — verify at least play/pause and frame stepping keyboard shortcuts work correctly in Analyze view.

5. **Per DeepSeek, 10 e2e tests fail due to waitForFunction timeouts** — the decoder's seekToFrame doesn't reliably update currentFrame React state in headless Firefox

### Medium Priority

5. **Add Library view tests** — navigate to Library, render video list, select video, edit metadata fields, select one/two videos for Analyze.

6. **Add trim workflow tests** — set trim bounds, verify trim state in session save/load.

7. **Address skipped annotation tests** — consider running in headed mode or using alternative interaction patterns to work around the React+Konva headless event coordination limitation.

### Low Priority

8. **Add loading state tests** — verify deterministic success/failure feedback during async operations (per Cross-Workflow UX Rule 3).

9. **Add performance regression tests** — frame step latency under sustained use, cache hit/miss rate tracking.

10. **Add memory leak tests for Firefox/WebKit** — the current tests are Chrome-only due to CDP dependency. Consider using Playwright's built-in memory metrics (`page.context().cookies()` as proxy, or browser DevTools Protocol equivalents) for non-Chromium browsers.
