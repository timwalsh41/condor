# Spike Testing Strategy: Durable Automated Testing Foundation

## Overview

This document provides comprehensive guidance for implementing automated testing during Phase 0 (Spike) that establishes a durable testing foundation for the entire project lifecycle. Tests created during the spike phase serve dual purposes:

1. **Immediate**: Validate technical feasibility of high-risk features (frame-accurate video control, synchronized playback)
2. **Long-term**: Serve as regression tests and requirement validation throughout all project phases

## Philosophy: Tests as Living Documentation

**Core Principle**: Write tests that validate requirements, not implementations. Tests should persist and evolve as the application grows from spike → MVP → production.

**Benefits:**
- Tests map directly to FR/NFR requirements for traceability
- Automated VALIDATION_REPORT.md generation
- Regression prevention across all phases
- Documentation of expected behavior
- CI/CD quality gates

---

## Testing Framework Stack

### Primary Frameworks

#### 1. Playwright (E2E & Integration Testing)

**Why Playwright:**
- Built-in cross-browser support (Chromium, Firefox, WebKit/Safari)
- Handles modern web APIs (`requestVideoFrameCallback`)
- Headless execution for CI
- Auto-waiting reduces flaky tests
- TypeScript support
- Component testing capability

**Use Cases:**
- Frame-stepping accuracy validation
- Video synchronization testing
- Cross-browser compatibility
- User workflow testing (E2E)
- Performance benchmarks

**Installation:**
```bash
npm install -D @playwright/test
npx playwright install --with-deps
```

#### 2. Vitest (Unit Testing)

**Why Vitest:**
- Lightning-fast test execution
- Native TypeScript support
- Compatible with Jest API
- Hot module reload during development
- Built-in coverage reporting

**Use Cases:**
- Frame calculation algorithms
- Sync offset calculations
- Pure utility functions
- Data transformations

**Installation:**
```bash
npm install -D vitest @vitest/ui
```

#### 3. FFmpeg (Test Fixture Generation)

**Why FFmpeg:**
- Programmatic video generation
- Reproducible test fixtures
- Frame counter overlays for validation
- Multiple framerate support

**Use Cases:**
- Generate test videos with burned-in frame numbers
- Create videos at specific framerates (30fps, 60fps, 120fps)
- Produce edge-case test videos

**Installation:**
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

---

## Project Structure

```
condor/
├── tests/
│   ├── fixtures/
│   │   ├── videos/
│   │   │   ├── generated/              # FFmpeg-generated test videos
│   │   │   │   ├── 30fps-counter.mp4
│   │   │   │   ├── 60fps-counter.mp4
│   │   │   │   └── 120fps-counter.mp4
│   │   │   └── real-world/             # Real golf swing videos (added later)
│   │   └── scripts/
│   │       └── generate-test-videos.sh # Reproducible fixture generation
│   │
│   ├── unit/                           # Vitest tests (pure logic)
│   │   ├── frame-calculations.test.ts  # REQ-FR-6.1, FR-6.2
│   │   ├── sync-offset.test.ts         # REQ-FR-4.7
│   │   └── annotation-geometry.test.ts # REQ-FR-8.x (added later)
│   │
│   ├── integration/                    # Playwright integration tests
│   │   ├── video-player.spec.ts        # REQ-FR-3.x, FR-6.x
│   │   ├── dual-video-sync.spec.ts     # REQ-FR-4.x, FR-5.x
│   │   └── annotation-canvas.spec.ts   # REQ-FR-8.x (added in MVP)
│   │
│   ├── e2e/                            # Playwright E2E tests
│   │   ├── single-video-analysis.spec.ts  # UC-1
│   │   └── two-video-comparison.spec.ts   # UC-2
│   │
│   ├── performance/                    # Performance benchmarks
│   │   ├── frame-step-latency.spec.ts  # NFR-1.4
│   │   └── annotation-render.spec.ts   # NFR-1.2
│   │
│   ├── browser-compat/                 # Cross-browser tests
│   │   └── video-api-support.spec.ts   # NFR-2.x
│   │
│   ├── helpers/                        # Shared test utilities
│   │   ├── video-test-utils.ts         # loadVideo(), stepForward(), etc.
│   │   ├── page-objects/               # Page Object Model
│   │   │   ├── VideoPlayer.ts
│   │   │   ├── AnnotationTools.ts      # Added in MVP
│   │   │   └── SyncControls.ts
│   │   └── assertions/                 # Custom assertions
│   │       └── video-assertions.ts     # expect(video).toBeAtFrame(42)
│   │
│   └── reporters/                      # Custom test reporters
│       └── requirements-reporter.ts    # Auto-generate VALIDATION_REPORT.md
│
├── playwright.config.ts                # Playwright configuration
├── vitest.config.ts                    # Vitest configuration
└── VALIDATION_REPORT.md                # Auto-generated from tests
```

---

## Test Fixture Generation with FFmpeg

### Automated Test Video Generation Script

**File: `tests/fixtures/scripts/generate-test-videos.sh`**

```bash
#!/bin/bash
# Generates reproducible test video fixtures with frame counters
# Run this script before executing tests: npm run test:fixtures

set -e

OUTPUT_DIR="tests/fixtures/videos/generated"
mkdir -p "$OUTPUT_DIR"

echo "🎬 Generating test video fixtures..."

# 30fps video with frame counter (5 seconds, 150 frames)
echo "  → 30fps-counter.mp4"
ffmpeg -y -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 \
  -vf "drawtext=text='Frame %{n}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=120:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10" \
  -c:v libx264 -preset fast -pix_fmt yuv420p -crf 23 \
  "$OUTPUT_DIR/30fps-counter.mp4"

# 60fps video with frame counter (5 seconds, 300 frames)
echo "  → 60fps-counter.mp4"
ffmpeg -y -f lavfi -i testsrc=duration=5:size=1920x1080:rate=60 \
  -vf "drawtext=text='Frame %{n}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=120:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10" \
  -c:v libx264 -preset fast -pix_fmt yuv420p -crf 23 \
  "$OUTPUT_DIR/60fps-counter.mp4"

# 120fps video with frame counter (5 seconds, 600 frames)
echo "  → 120fps-counter.mp4"
ffmpeg -y -f lavfi -i testsrc=duration=5:size=1920x1080:rate=120 \
  -vf "drawtext=text='Frame %{n}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=120:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10" \
  -c:v libx264 -preset fast -pix_fmt yuv420p -crf 23 \
  "$OUTPUT_DIR/120fps-counter.mp4"

# Added in Phase 3: Longer videos for multi-framerate sync testing
echo "  → 30fps-long.mp4 (for multi-framerate testing)"
ffmpeg -y -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -vf "drawtext=text='30fps Frame %{n}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=100:fontcolor=yellow:box=1:boxcolor=black@0.7:boxborderw=10" \
  -c:v libx264 -preset fast -pix_fmt yuv420p -crf 23 \
  "$OUTPUT_DIR/30fps-long.mp4"

echo "  → 60fps-long.mp4 (for multi-framerate testing)"
ffmpeg -y -f lavfi -i testsrc=duration=10:size=1920x1080:rate=60 \
  -vf "drawtext=text='60fps Frame %{n}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=100:fontcolor=cyan:box=1:boxcolor=black@0.7:boxborderw=10" \
  -c:v libx264 -preset fast -pix_fmt yuv420p -crf 23 \
  "$OUTPUT_DIR/60fps-long.mp4"

echo "✅ Test video fixtures generated successfully!"
echo "   Location: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"
```

**Make executable:**
```bash
chmod +x tests/fixtures/scripts/generate-test-videos.sh
```

**Add to package.json:**
```json
{
  "scripts": {
    "test:fixtures": "bash tests/fixtures/scripts/generate-test-videos.sh",
    "test:setup": "npm run test:fixtures && npx playwright install",
    "test": "npm run test:fixtures && playwright test",
    "test:unit": "vitest run",
    "test:integration": "playwright test tests/integration",
    "test:e2e": "playwright test tests/e2e",
    "test:all": "npm run test:unit && npm run test"
  }
}
```

---

## Unit Tests with Vitest

### Example: Frame Calculation Tests

**File: `tests/unit/frame-calculations.test.ts`**

```typescript
/**
 * Unit tests for frame calculation utilities
 * Validates: REQ-FR-6.1, REQ-FR-6.2
 * Phase: Spike (Phase 0) - foundational logic that persists
 */

import { describe, it, expect } from 'vitest';
import { calculateFrameFromTime, calculateTimeFromFrame } from '@/utils/frameUtils';

describe('Frame calculation utilities (FR-6.1, FR-6.2)', () => {
  describe('calculateFrameFromTime', () => {
    it('calculates correct frame number from timestamp at 30fps', () => {
      expect(calculateFrameFromTime(0.0, 30)).toBe(0);
      expect(calculateFrameFromTime(1.0, 30)).toBe(30);
      expect(calculateFrameFromTime(0.5, 30)).toBe(15);
      expect(calculateFrameFromTime(0.033333, 30)).toBe(1); // ~1 frame at 30fps
    });

    it('calculates correct frame number from timestamp at 60fps', () => {
      expect(calculateFrameFromTime(0.0, 60)).toBe(0);
      expect(calculateFrameFromTime(1.0, 60)).toBe(60);
      expect(calculateFrameFromTime(0.5, 60)).toBe(30);
      expect(calculateFrameFromTime(0.016667, 60)).toBe(1); // ~1 frame at 60fps
    });

    it('calculates correct frame number from timestamp at 120fps', () => {
      expect(calculateFrameFromTime(0.0, 120)).toBe(0);
      expect(calculateFrameFromTime(1.0, 120)).toBe(120);
      expect(calculateFrameFromTime(0.5, 120)).toBe(60);
    });

    it('handles edge case of negative timestamp', () => {
      expect(calculateFrameFromTime(-1.0, 30)).toBe(0);
    });

    it('rounds to nearest frame', () => {
      // At 30fps, frame duration is ~0.033333s
      expect(calculateFrameFromTime(0.049999, 30)).toBe(1); // Closer to frame 1
      expect(calculateFrameFromTime(0.017, 30)).toBe(1);    // Closer to frame 1
    });
  });

  describe('calculateTimeFromFrame', () => {
    it('calculates correct timestamp from frame at 30fps', () => {
      expect(calculateTimeFromFrame(0, 30)).toBeCloseTo(0.0);
      expect(calculateTimeFromFrame(30, 30)).toBeCloseTo(1.0);
      expect(calculateTimeFromFrame(15, 30)).toBeCloseTo(0.5);
    });

    it('calculates correct timestamp from frame at 60fps', () => {
      expect(calculateTimeFromFrame(0, 60)).toBeCloseTo(0.0);
      expect(calculateTimeFromFrame(60, 60)).toBeCloseTo(1.0);
      expect(calculateTimeFromFrame(30, 60)).toBeCloseTo(0.5);
    });

    it('calculates correct timestamp from frame at 120fps', () => {
      expect(calculateTimeFromFrame(0, 120)).toBeCloseTo(0.0);
      expect(calculateTimeFromFrame(120, 120)).toBeCloseTo(1.0);
      expect(calculateTimeFromFrame(60, 120)).toBeCloseTo(0.5);
    });
  });

  describe('round-trip conversion', () => {
    it('maintains accuracy through frame → time → frame conversion', () => {
      const framerates = [30, 60, 120];
      const testFrames = [0, 1, 5, 10, 42, 100];

      for (const fps of framerates) {
        for (const frame of testFrames) {
          const time = calculateTimeFromFrame(frame, fps);
          const backToFrame = calculateFrameFromTime(time, fps);
          expect(backToFrame).toBe(frame);
        }
      }
    });
  });
});
```

### Example: Sync Offset Calculation Tests

**File: `tests/unit/sync-offset.test.ts`**

```typescript
/**
 * Unit tests for sync offset calculation
 * Validates: REQ-FR-4.7 (MVP), REQ-FR-15.5 (Phase 3)
 * Phase: Spike (Phase 0) - evolves to support multi-framerate in Phase 3
 */

import { describe, it, expect } from 'vitest';
import { calculateSyncOffset } from '@/utils/syncUtils';

describe('Sync offset calculation', () => {
  describe('FR-4.7: Same framerate sync (MVP)', () => {
    it('calculates offset when video B is ahead of video A', () => {
      const syncPointA = 10; // Video A synced at frame 10
      const syncPointB = 25; // Video B synced at frame 25
      const framerateA = 30;
      const framerateB = 30;

      const offset = calculateSyncOffset(syncPointA, syncPointB, framerateA, framerateB);

      expect(offset).toBe(15); // Video B is 15 frames ahead
    });

    it('calculates offset when video A is ahead of video B', () => {
      const syncPointA = 50;
      const syncPointB = 20;
      const framerateA = 60;
      const framerateB = 60;

      const offset = calculateSyncOffset(syncPointA, syncPointB, framerateA, framerateB);

      expect(offset).toBe(-30); // Video B is 30 frames behind
    });

    it('calculates zero offset when sync points are equal', () => {
      const syncPointA = 42;
      const syncPointB = 42;
      const framerateA = 30;
      const framerateB = 30;

      const offset = calculateSyncOffset(syncPointA, syncPointB, framerateA, framerateB);

      expect(offset).toBe(0);
    });
  });

  describe('FR-15.5: Multi-framerate sync (Phase 3)', () => {
    it('calculates offset for 30fps vs 60fps videos', () => {
      // Video A (30fps) synced at frame 10 = 0.333s
      // Video B (60fps) synced at frame 40 = 0.666s
      const syncPointA = 10;
      const syncPointB = 40;
      const framerateA = 30;
      const framerateB = 60;

      const offset = calculateSyncOffset(syncPointA, syncPointB, framerateA, framerateB);

      // Expected: (40 - 10 * (60/30)) = 40 - 20 = 20 frames
      expect(offset).toBe(20);
    });

    it('calculates offset for 60fps vs 120fps videos', () => {
      const syncPointA = 30; // 60fps at frame 30 = 0.5s
      const syncPointB = 60; // 120fps at frame 60 = 0.5s
      const framerateA = 60;
      const framerateB = 120;

      const offset = calculateSyncOffset(syncPointA, syncPointB, framerateA, framerateB);

      // Expected: (60 - 30 * (120/60)) = 60 - 60 = 0 frames (same time)
      expect(offset).toBe(0);
    });

    it('handles fractional frame offsets', () => {
      const syncPointA = 15; // 30fps
      const syncPointB = 40; // 60fps
      const framerateA = 30;
      const framerateB = 60;

      const offset = calculateSyncOffset(syncPointA, syncPointB, framerateA, framerateB);

      // Expected: (40 - 15 * (60/30)) = 40 - 30 = 10 frames
      expect(offset).toBe(10);
    });
  });
});
```

---

## Integration Tests with Playwright

### Test Utilities (Reusable Helpers)

**File: `tests/helpers/video-test-utils.ts`**

```typescript
/**
 * Shared video testing utilities
 * Created: Phase 0 (Spike)
 * Evolution: Grows with feature additions
 */

import { Page, expect } from '@playwright/test';

/**
 * Loads a video into the player and waits for it to be ready
 * @phase Spike (Phase 0) - foundational utility
 */
export async function loadVideo(
  page: Page,
  videoPath: string,
  playerId: string = 'video-player'
): Promise<void> {
  await page.evaluate(({ path, id }) => {
    const video = document.querySelector(`[data-testid="${id}"]`) as HTMLVideoElement;
    video.src = path;
    return new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });
  }, { path: videoPath, id: playerId });
}

/**
 * Steps video forward by N frames
 * @phase Spike (Phase 0) - core functionality
 */
export async function stepForward(
  page: Page,
  steps: number = 1,
  videoId: string = 'video-player'
): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await page.click(`[data-testid="${videoId}-step-forward"]`);
    await page.waitForTimeout(50); // Brief wait for frame update
  }
}

/**
 * Steps video backward by N frames
 */
export async function stepBackward(
  page: Page,
  steps: number = 1,
  videoId: string = 'video-player'
): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await page.click(`[data-testid="${videoId}-step-backward"]`);
    await page.waitForTimeout(50);
  }
}

/**
 * Gets current frame number for a video
 * @phase Spike (Phase 0)
 */
export async function getCurrentFrame(
  page: Page,
  videoId: string = 'video-player'
): Promise<number> {
  return page.evaluate(({ id }) => {
    const player = (window as any).getVideoPlayer(id);
    return player.getCurrentFrame();
  }, { id: videoId });
}

/**
 * Waits for video to be at specific frame
 */
export async function waitForFrame(
  page: Page,
  expectedFrame: number,
  videoId: string = 'video-player',
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ id, frame }) => {
      const player = (window as any).getVideoPlayer(id);
      return player.getCurrentFrame() === frame;
    },
    { id: videoId, frame: expectedFrame },
    { timeout }
  );
}

/**
 * Uploads a video via the UI
 * @phase MVP (Phase 1) - added when UI implemented
 */
export async function uploadVideo(
  page: Page,
  videoPath: string,
  uploadSlot: 'a' | 'b' = 'a'
): Promise<void> {
  await page.setInputFiles(`[data-testid="upload-video-${uploadSlot}"]`, videoPath);
  await page.waitForSelector(`[data-testid="video-${uploadSlot}-loaded"]`);
}

/**
 * Enters sync mode
 * @phase MVP (Phase 1)
 */
export async function enterSyncMode(page: Page): Promise<void> {
  await page.click('[data-testid="enter-sync-mode"]');
  await page.waitForSelector('[data-testid="sync-mode-active"]');
}

/**
 * Locks sync at current video positions
 * @phase MVP (Phase 1)
 */
export async function lockSync(page: Page): Promise<void> {
  await page.click('[data-testid="lock-sync"]');
  await page.waitForSelector('[data-testid="sync-locked"]');
}
```

### Page Object Model

**File: `tests/helpers/page-objects/VideoPlayer.ts`**

```typescript
/**
 * Page Object for Video Player component
 * @phase Spike (Phase 0) - minimal interface
 * @evolution Grows as features added, but core API stable
 */

import { Page, Locator } from '@playwright/test';

export class VideoPlayerPage {
  readonly page: Page;
  readonly playerId: string;
  readonly videoElement: Locator;
  readonly stepForwardButton: Locator;
  readonly stepBackwardButton: Locator;
  readonly stepForward5Button: Locator;  // Coarse stepping
  readonly stepBackward5Button: Locator;
  readonly frameCounter: Locator;

  // Added in MVP Phase 1
  readonly playButton: Locator;
  readonly pauseButton: Locator;
  readonly speedControl: Locator;
  readonly loopToggle: Locator;

  constructor(page: Page, playerId: string = 'video-player') {
    this.page = page;
    this.playerId = playerId;

    // Core controls (Phase 0)
    this.videoElement = page.locator(`[data-testid="${playerId}"]`);
    this.stepForwardButton = page.locator(`[data-testid="${playerId}-step-forward"]`);
    this.stepBackwardButton = page.locator(`[data-testid="${playerId}-step-backward"]`);
    this.stepForward5Button = page.locator(`[data-testid="${playerId}-step-forward-5"]`);
    this.stepBackward5Button = page.locator(`[data-testid="${playerId}-step-backward-5"]`);
    this.frameCounter = page.locator(`[data-testid="${playerId}-frame-counter"]`);

    // MVP additions
    this.playButton = page.locator(`[data-testid="${playerId}-play"]`);
    this.pauseButton = page.locator(`[data-testid="${playerId}-pause"]`);
    this.speedControl = page.locator(`[data-testid="${playerId}-speed"]`);
    this.loopToggle = page.locator(`[data-testid="${playerId}-loop"]`);
  }

  async stepForward(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.stepForwardButton.click();
      await this.page.waitForTimeout(50);
    }
  }

  async stepBackward(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.stepBackwardButton.click();
      await this.page.waitForTimeout(50);
    }
  }

  async coarseStepForward(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.stepForward5Button.click();
      await this.page.waitForTimeout(100);
    }
  }

  async coarseStepBackward(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.stepBackward5Button.click();
      await this.page.waitForTimeout(100);
    }
  }

  async getCurrentFrame(): Promise<number> {
    const frameText = await this.frameCounter.textContent();
    return parseInt(frameText || '0', 10);
  }

  async waitForFrame(expectedFrame: number, timeout: number = 5000): Promise<void> {
    await this.page.waitForFunction(
      ({ id, frame }) => {
        const counter = document.querySelector(`[data-testid="${id}-frame-counter"]`);
        return counter && parseInt(counter.textContent || '0', 10) === frame;
      },
      { id: this.playerId, frame: expectedFrame },
      { timeout }
    );
  }

  // MVP additions
  async play(): Promise<void> {
    await this.playButton.click();
  }

  async pause(): Promise<void> {
    await this.pauseButton.click();
  }

  async setSpeed(speed: number): Promise<void> {
    await this.speedControl.selectOption({ value: speed.toString() });
  }

  async enableLoop(): Promise<void> {
    await this.loopToggle.check();
  }

  async disableLoop(): Promise<void> {
    await this.loopToggle.uncheck();
  }
}
```

### Example Integration Tests

**File: `tests/integration/video-player.spec.ts`**

```typescript
/**
 * Integration tests for Video Player component
 * Validates: REQ-FR-6.1, FR-6.2, FR-6.3, FR-6.4
 * Phase: Spike (Phase 0) - foundational tests that persist
 */

import { test, expect } from '@playwright/test';
import { VideoPlayerPage } from '../helpers/page-objects/VideoPlayer';
import { loadVideo } from '../helpers/video-test-utils';

test.describe('Frame-accurate stepping (FR-6.1)', () => {
  test('step forward increments frame by exactly 1', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/30fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    const initialFrame = await player.getCurrentFrame();
    await player.stepForward();
    const newFrame = await player.getCurrentFrame();

    expect(newFrame).toBe(initialFrame + 1);
  });

  test('step backward decrements frame by exactly 1', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/30fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    // Seek to middle of video first
    await player.stepForward(50);

    const initialFrame = await player.getCurrentFrame();
    await player.stepBackward();
    const newFrame = await player.getCurrentFrame();

    expect(newFrame).toBe(initialFrame - 1);
  });

  test('100 consecutive forward steps results in +100 frame offset', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/60fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    const initialFrame = await player.getCurrentFrame();

    // Step forward 100 times
    await player.stepForward(100);

    const finalFrame = await player.getCurrentFrame();
    expect(finalFrame).toBe(initialFrame + 100);
  });

  test('coarse stepping increments by 5 frames', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/30fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    const initialFrame = await player.getCurrentFrame();
    await player.coarseStepForward();
    const newFrame = await player.getCurrentFrame();

    expect(newFrame).toBe(initialFrame + 5);
  });
});

test.describe('Frame counter display (FR-6.2)', () => {
  test('displays correct frame number after stepping', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/60fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    await player.stepForward(42);

    const displayedFrame = await player.getCurrentFrame();
    expect(displayedFrame).toBe(42);
  });

  test('frame counter updates in real-time during stepping', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/30fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    for (let i = 1; i <= 10; i++) {
      await player.stepForward();
      const frame = await player.getCurrentFrame();
      expect(frame).toBe(i);
    }
  });
});

test.describe('Frame stepping precision (FR-6.3)', () => {
  test('maintains precision within 1 frame across different framerates', async ({ page }) => {
    const testCases = [
      { file: '30fps-counter.mp4', framerate: 30, steps: 10 },
      { file: '60fps-counter.mp4', framerate: 60, steps: 10 },
      { file: '120fps-counter.mp4', framerate: 120, steps: 10 }
    ];

    for (const { file, steps } of testCases) {
      await page.goto('/spike');
      await loadVideo(page, `tests/fixtures/videos/generated/${file}`);

      const player = new VideoPlayerPage(page);

      await player.stepForward(steps);

      const frame = await player.getCurrentFrame();
      const expectedFrame = steps;

      // Allow ±1 frame tolerance (FR-6.3)
      expect(Math.abs(frame - expectedFrame)).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('Cross-browser reliability (FR-6.4)', () => {
  test('frame stepping works consistently across browsers', async ({ page, browserName }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/30fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    await player.stepForward(25);
    const frame = await player.getCurrentFrame();

    // Frame stepping should work identically in all browsers
    expect(frame).toBe(25);

    // Log browser for debugging
    console.log(`✅ ${browserName}: Frame stepping accurate`);
  });
});
```

---

## Performance Testing

**File: `tests/performance/frame-step-latency.spec.ts`**

```typescript
/**
 * Performance benchmark tests
 * Validates: NFR-1.4 (Frame stepping shall respond within 100ms)
 * Phase: Spike (Phase 0)
 */

import { test, expect } from '@playwright/test';
import { VideoPlayerPage } from '../helpers/page-objects/VideoPlayer';
import { loadVideo } from '../helpers/video-test-utils';

test.describe('Frame step latency (NFR-1.4)', () => {
  test('single frame step completes within 100ms', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/60fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    const startTime = Date.now();
    await player.stepForward();
    await player.waitForFrame(1);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
    console.log(`⏱️  Frame step latency: ${duration}ms`);
  });

  test('coarse frame step (5 frames) completes within 200ms', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/30fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    const startTime = Date.now();
    await player.coarseStepForward();
    await player.waitForFrame(5);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200);
    console.log(`⏱️  Coarse step latency: ${duration}ms`);
  });

  test('100 consecutive steps maintain acceptable latency', async ({ page }) => {
    await page.goto('/spike');
    await loadVideo(page, 'tests/fixtures/videos/generated/120fps-counter.mp4');

    const player = new VideoPlayerPage(page);

    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const startTime = Date.now();
      await player.stepForward();
      const duration = Date.now() - startTime;
      latencies.push(duration);
    }

    const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
    const maxLatency = Math.max(...latencies);

    console.log(`⏱️  Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`⏱️  Max latency: ${maxLatency}ms`);

    expect(avgLatency).toBeLessThan(100);
    expect(maxLatency).toBeLessThan(150); // Allow some variance
  });
});
```

---

## Playwright Configuration

**File: `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Timeout per test
  timeout: 30 * 1000,

  // Run tests in parallel
  fullyParallel: true,

  // Retry on CI
  retries: process.env.CI ? 2 : 0,

  // Limit workers on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'], // Console output
    // Custom reporter for VALIDATION_REPORT.md (add in MVP)
    // ['./tests/reporters/requirements-reporter.ts']
  ],

  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    // Trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport
    viewport: { width: 1920, height: 1080 },
  },

  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Vitest Configuration

**File: `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## CI/CD Pipeline (GitHub Actions)

**File: `.github/workflows/test.yml`**

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop, 'feature/*' ]
  pull_request:
    branches: [ main, develop ]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    name: Integration Tests (${{ matrix.browser }})
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install FFmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Generate test fixtures
        run: npm run test:fixtures

      - name: Install Playwright browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run integration tests
        run: npx playwright test --project=${{ matrix.browser }} tests/integration

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.browser }}
          path: test-results/
          retention-days: 30

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install FFmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Generate test fixtures
        run: npm run test:fixtures

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload E2E results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-results
          path: test-results/

  performance-tests:
    name: Performance Benchmarks
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install FFmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Generate test fixtures
        run: npm run test:fixtures

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run performance tests
        run: npx playwright test tests/performance

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: test-results/performance/
```

---

## Custom Requirements Reporter (Auto-generate VALIDATION_REPORT.md)

**File: `tests/reporters/requirements-reporter.ts`**

```typescript
/**
 * Custom Playwright reporter that auto-generates VALIDATION_REPORT.md
 * Maps test results to requirement IDs for traceability
 * Phase: MVP (Phase 1) - added when requirement tracking becomes critical
 */

import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import * as fs from 'fs';

interface RequirementData {
  tests: string[];
  passed: number;
  failed: number;
  status: 'pass' | 'fail';
}

class RequirementsReporter implements Reporter {
  private requirements: Map<string, RequirementData> = new Map();

  onTestEnd(test: TestCase, result: TestResult) {
    // Extract requirement IDs from test titles (e.g., "FR-6.1: step forward...")
    const reqMatches = test.title.match(/([A-Z]+-[A-Z]+-\d+\.\d+|[A-Z]+-\d+\.\d+)/g);

    if (reqMatches) {
      for (const reqId of reqMatches) {
        if (!this.requirements.has(reqId)) {
          this.requirements.set(reqId, {
            tests: [],
            passed: 0,
            failed: 0,
            status: 'pass'
          });
        }

        const req = this.requirements.get(reqId)!;
        req.tests.push(test.title);

        if (result.status === 'passed') {
          req.passed++;
        } else {
          req.failed++;
          req.status = 'fail';
        }
      }
    }
  }

  onEnd(result: FullResult) {
    this.generateValidationReport();
  }

  private generateValidationReport() {
    let report = '# Validation Report\n\n';
    report += `**Generated**: ${new Date().toISOString()}\n\n`;
    report += '---\n\n';
    report += '## Requirement Validation Status\n\n';
    report += '| Requirement | Status | Tests Passed | Tests Failed | Total Tests |\n';
    report += '|-------------|--------|--------------|--------------|-------------|\n';

    // Sort by requirement ID
    const sortedReqs = Array.from(this.requirements.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    for (const [reqId, data] of sortedReqs) {
      const status = data.status === 'pass' ? '✅ PASS' : '❌ FAIL';
      const total = data.passed + data.failed;
      report += `| ${reqId} | ${status} | ${data.passed} | ${data.failed} | ${total} |\n`;
    }

    report += '\n---\n\n';
    report += '## Detailed Test Coverage\n\n';

    for (const [reqId, data] of sortedReqs) {
      report += `### ${reqId}\n\n`;
      report += `**Status**: ${data.status === 'pass' ? '✅ Validated' : '❌ Failed'}\n\n`;
      report += `**Tests** (${data.tests.length}):\n`;
      for (const test of data.tests) {
        report += `- ${test}\n`;
      }
      report += '\n';
    }

    // Write to file
    fs.writeFileSync('VALIDATION_REPORT.md', report);
    console.log('\n✅ VALIDATION_REPORT.md generated\n');
  }
}

export default RequirementsReporter;
```

---

## Test Execution Commands

### Local Development

```bash
# Generate test fixtures
npm run test:fixtures

# Run all unit tests
npm run test:unit

# Run all unit tests with coverage
npm run test:unit -- --coverage

# Run unit tests in watch mode
npm run test:unit -- --watch

# Run all integration tests (all browsers)
npm run test:integration

# Run integration tests for specific browser
npx playwright test --project=chromium tests/integration

# Run E2E tests
npm run test:e2e

# Run performance tests
npx playwright test tests/performance

# Run ALL tests
npm run test:all

# Open Playwright UI for debugging
npx playwright test --ui

# Show test report
npx playwright show-report test-results/html-report
```

### CI/CD

```bash
# Full test suite (CI mode)
npm run test:fixtures && npm run test:unit && npm run test

# With coverage
npm run test:unit -- --coverage && npm run test
```

---

## Best Practices for Durable Tests

### 1. Test the Contract, Not the Implementation

✅ **Good:**
```typescript
test('step forward increments frame by 1', async ({ page }) => {
  const initialFrame = await player.getCurrentFrame();
  await player.stepForward();
  const newFrame = await player.getCurrentFrame();
  expect(newFrame).toBe(initialFrame + 1);
});
```

❌ **Bad:**
```typescript
test('step forward calls requestVideoFrameCallback', async ({ page }) => {
  // Testing implementation details - brittle!
  const callbackCalled = await page.evaluate(() => {
    return window.videoCallbackWasCalled;
  });
  expect(callbackCalled).toBe(true);
});
```

### 2. Use Stable Test IDs

Always use `data-testid` attributes, never CSS classes or DOM structure:

```tsx
// In component
<button data-testid="video-player-step-forward">Step Forward</button>

// In test
await page.click('[data-testid="video-player-step-forward"]');
```

### 3. Document Test Evolution

```typescript
/**
 * Validates: REQ-FR-6.1
 * Created: Phase 0 (Spike)
 * Modified: Phase 3 (added multi-framerate support)
 * Status: Stable - foundational test
 */
test('step forward increments frame by 1', async ({ page }) => {
  // ...
});
```

### 4. Isolate Tests

Each test should be completely independent:

```typescript
test.beforeEach(async ({ page }) => {
  // Reset state before each test
  await page.goto('/spike');
  await loadVideo(page, 'tests/fixtures/videos/generated/30fps-counter.mp4');
});
```

### 5. Use Page Object Model

Abstract UI details:

```typescript
// Good - survives UI changes
const player = new VideoPlayerPage(page);
await player.stepForward();

// Bad - breaks when UI changes
await page.click('button.step-forward');
```

---

## Summary

This spike testing strategy establishes a **durable, evolving testing foundation** that:

✅ **Validates technical feasibility** during Phase 0 spikes
✅ **Prevents regressions** throughout all project phases
✅ **Maps to requirements** for traceability (VALIDATION_REPORT.md)
✅ **Runs automatically** in CI on every commit
✅ **Supports cross-browser testing** (Chrome, Firefox, Safari)
✅ **Grows with the application** through Page Objects and utilities
✅ **Provides performance benchmarks** to catch degradation

**Tests created in Phase 0 remain relevant through production**, evolving alongside feature development while maintaining their core validation purpose.
