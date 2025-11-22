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
**Purpose**: Component logic, cache behavior

```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:ui           # Interactive UI
```

### Browser Tests (Playwright)

**Location**: `tests/**/*.spec.ts`  
**Purpose**: Frame stepping accuracy, memory leaks, cross-browser

```bash
npm run test:e2e          # All browsers (Chrome/Firefox/WebKit)
npm run test:memory       # Memory tests only
npm run test:e2e:headed   # Visible browser (debug)

# Specific browser or test
npx playwright test --project=chrome
npx playwright test --grep "step forward"
```

## Interpreting Results

### Unit Tests

```
✓ src/utils/tests/FrameCache.test.ts (19)
Test Files: 1 passed (1)
```

**Pass**: All tests green | **Fail**: Check stack trace

### Browser Tests

```
✓ [chrome] test_memory_leaks.spec.ts:15 sequential (3.5s)
18 passed (45s)
```

**Pass**: All browsers green | **Fail**: `npx playwright show-report`

### Memory Leak Thresholds

| Test              | Threshold      | Indicates               |
| ----------------- | -------------- | ----------------------- |
| 50 frame steps    | < 10MB growth  | Cache evicting properly |
| Component unmount | > 5MB released | Cleanup working         |
| 60 frame steps    | < 15MB total   | LRU functioning         |

**GC Warnings**: "VideoFrame garbage collected" - Expected during cache hits (< 100 acceptable)

## Troubleshooting

**"Browser not found"**: `npx playwright install`  
**Tests timeout**: Ensure `npm run dev` is running in another terminal  
**Memory exceeds threshold**: Check cache size (default: 20 frames), run `npm run test:memory -- --headed`  
**Import errors**: `rm -rf node_modules/.vite && npm run test`

## Manual Verification

### Memory Leaks

```bash
npm run dev
# Chrome → DevTools → Memory → Snapshot → Step 50 frames → GC → Snapshot
# Expected: 5-10MB retained (cached frames)
```

### Frame Accuracy

```bash
npm run dev
# Upload tests/fixtures/videos/test_30fps_10s.mp4
# Step forward/backward, verify burned-in frame numbers match UI
```

## CI/CD

```bash
npm run test        # Vitest
npm run test:e2e    # Playwright (headless, 2 retries)
```

## Coverage

✅ Frame accuracy (±1) | ✅ Cache eviction | ✅ Memory leaks | ✅ Cross-browser | ✅ Lifecycle management
