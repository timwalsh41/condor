# Frontend Testing Guide

## Quick Start

```bash
cd frontend
npm install                              # Install dependencies
npx playwright install                   # Install browsers (one-time)

npm run test                             # Unit tests (Vitest)
npm run test:e2e                         # Browser tests (Playwright)
npm run test:memory                      # Memory leak tests
```

## Test Types

### Unit Tests (Vitest)

**Location**: `src/**/*.test.{ts,tsx}`  
**Purpose**: Component logic, cache behavior, utilities

```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:ui           # Interactive UI
```

### Browser Tests (Playwright)

**Location**: `tests/**/*.spec.ts`  
**Purpose**: Frame stepping accuracy (exact 0-tolerance), cache performance, memory validation, cross-browser compatibility

**Test Files**:

- `test_frame_stepping.spec.ts` - Frame-accurate stepping and seeking (6 tests)
- `test_cache_performance.spec.ts` - Cache behavior and performance (4 tests)
- `test_memory_leaks.spec.ts` - Memory leak detection with CDP (5 tests, Chrome-only)

```bash
npm run test:e2e          # All browsers (Chrome/Firefox/WebKit)
npm run test:memory       # Memory tests only
npm run test:e2e:headed   # Visible browser (debug)

# Specific browser or test
npx playwright test --project=chrome
npx playwright test test_frame_stepping.spec.ts
npx playwright test --grep "step forward"
```

### Manual Tests

#### Setup

Start the dev server in host mode to share outside container:

```bash
cd frontend/
npm run dev -- --host
```

Navigate a browser to `http://localhost:5173`

#### Test procedure

- Test suite - verify that the sync offset is maintained and all functions behave as expected
  - Run playback and make sure the playback stops with the videos on the correct frames (repeat ~3-5x)
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

**Note**: Memory tests use Chrome DevTools Protocol. Chrome-only testing is sufficient as memory behavior should not vary across browsers.

## Known Issues

### WebKit: Cache Size Limitation Test Skipped

**Test:** `test_cache_performance.spec.ts:319` - "cache size limitation (300-frame video, 120-frame cache)"
**Status:** Skipped on WebKit (Chrome/Firefox only)

**Issue:** WebKit's headless WebCodecs decoder occasionally stalls during large seek sequences (200+ frame jumps). The decoder stops processing frames mid-seek, causing timeouts even with 30s limits.

**Root Cause:** WebKit WebCodecs implementation issue in headless mode, not a bug in our code. Chrome and Firefox pass this test consistently.

**Evidence:**

- Decoder gets stuck early (e.g., frame 31 of 300) and stops outputting frames
- Only occurs in WebKit headless mode
- Chrome/Firefox complete same 7-seek sequence in ~5-10 seconds
- All other WebKit tests pass (cache hits, frame stepping, etc.)

**Conclusion:** This is a WebKit platform limitation, not an implementation bug. Test validates cache eviction behavior which is already proven on Chrome/Firefox.

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
npm run dev
# Upload tests/fixtures/videos/test_gop30_h264.mp4
# Step forward/backward, verify burned-in frame numbers match UI exactly
# Expected: 0-tolerance accuracy (exact frame match)
```

### Memory Leaks

```bash
npm run dev
# Chrome → DevTools → Memory → Snapshot → Step 50 frames → GC → Snapshot
# Expected: 10-20MB retained (cached VideoFrames, 120-frame cache)
```

### Cache Performance

```bash
npm run dev
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
