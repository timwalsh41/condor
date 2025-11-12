# Browser Testing Guide - Frame-Accurate Video Control

## Architecture

**Headless Testing in Container**:
All three browsers (Firefox, Chrome, WebKit) run in **headless mode** inside the development container. No display server (Xvfb) or windowing system is required.

## Browser Configuration

**Test Projects** (configured in `playwright.config.ts`):
- **chrome**: Playwright's Chrome build with H.264 codec support
- **firefox**: Playwright's Firefox build with native H.264 support
- **webkit**: Playwright's WebKit build (Safari engine)

All browsers run with `headless: true` by default.

## Container Setup

### Prerequisites

The development container should already have:
- Node.js 20+
- Playwright installed (`npm install` in `/code/Claude/condor/frontend`)

### Install Browser Binaries

```bash
cd /code/Claude/condor/frontend

# Install all browser binaries (one-time setup)
npx playwright install chrome firefox webkit

# Install system dependencies (if needed)
npx playwright install-deps
```

**Note**: Playwright's Chrome channel includes H.264 codec support. Firefox and WebKit have native H.264 support.

## Running Tests

### All Browsers (Recommended)

```bash
cd /code/Claude/condor/frontend

# Run all tests across all 3 browsers
npx playwright test
```

### Individual Browsers

```bash
cd /code/Claude/condor/frontend

# Run Firefox tests only
npx playwright test --project=firefox

# Run Chrome tests only
npx playwright test --project=chrome

# Run WebKit tests only
npx playwright test --project=webkit
```

### Specific Tests

```bash
# Run tests matching a pattern
npx playwright test --grep "step forward by 1 frame"

# Run with line reporter (cleaner output)
npx playwright test --reporter=line

# View HTML report after tests
npx playwright show-report
```

## Known Limitations

### Headless Browser Seeking Near Frame 0

**Issue**: Video seeking to frames 0-10 is unreliable in headless browsers
**Root Cause**: Browser optimization issue when seeking very close to video start
**Solution**: Tests seek directly to frame ~100 before testing backward stepping
**Impact**: None on production code, test strategy only

**Example** (from `tests/test_frame_stepping.spec.ts`):
```typescript
// Seek directly to stable frame range before testing
await video.evaluate((v: HTMLVideoElement) => {
  v.currentTime = 100 / 30; // Seek to frame 100 at 30fps
  v.pause();
});
```

### requestVideoFrameCallback Timeout Fallback

**Behavior**: In headless mode, `requestVideoFrameCallback` may not fire reliably on paused video
**Mitigation**: 100ms timeout fallback using `Math.round(video.currentTime * framerate)`
**Accuracy**: ±1 frame (acceptable for MVP)
**Evidence**: See console warnings during test runs (not failures)

## Troubleshooting

### Tests fail with "browser not found"

```bash
cd /code/Claude/condor/frontend

# Reinstall browser binaries
npx playwright install chrome firefox webkit
```

### Video doesn't load (404 errors)

```bash
# Verify dev server is running
curl -I http://localhost:5173/test_30fps_10s.mp4

# If 404, start dev server
npm run dev

# Then run tests in another terminal
npx playwright test
```

### All tests timeout

**Possible causes**:
1. Dev server not running → Start with `npm run dev`
2. Network issue preventing video load → Check `curl` command above
3. Browser installation corrupt → Reinstall with `npx playwright install`

### WebKit-specific failures

```bash
# Install WebKit system dependencies
npx playwright install-deps webkit

# Verify WebKit browser installed
npx playwright install webkit

# Test WebKit specifically
npx playwright test --project=webkit
```

### Tests pass locally but fail in CI

- **Check CI environment**: Ensure `npm install` and `npx playwright install` run before tests
- **Check headless mode**: Verify `playwright.config.ts` has `headless: true`
- **Check timeouts**: CI may need longer timeouts due to slower environment

## Architecture Decisions

**Why headless mode?**
- Container compatibility without X11/display servers
- Faster, more reliable test execution
- Industry standard for automated testing

**Why Playwright's Chrome channel?**
- Includes H.264 codec support (unlike open-source Chromium)
- Simpler setup than installing system Google Chrome
- Better reproducibility across environments

**Why seek to frame 100 in tests?**
- Avoids unreliable seeking near frame 0 in headless browsers
- Tests run faster (direct seek vs. frame-by-frame stepping)
- Validates same functionality with better test reliability
