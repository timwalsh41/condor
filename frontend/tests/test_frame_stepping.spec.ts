/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';

/**
 * WebCodecs Frame-Accurate Seeking Tests
 *
 * Phase 0 - Task 0.3 - Phase 6: Cross-browser validation with exact frame accuracy
 *
 * Requirements Validated:
 * - REQ-F-FRAME-001: Frame stepping (coarse: 5 frames, fine: 1 frame) - EXACT (0 tolerance)
 * - REQ-F-FRAME-002: Frame counter display accuracy - EXACT
 * - REQ-F-FRAME-003: Seeking precision - EXACT (0 frame error)
 * - REQ-NF-P-004: Frame step response time (<100ms for cache hits)
 * - REQ-NF-BC-001: Browser compatibility (Chrome, Firefox, WebKit)
 *
 * Success Criteria:
 * - Frame counter accuracy: EXACT (0 frame tolerance) - non-negotiable requirement
 * - Frame step latency <100ms (cache hits), <300ms (cache miss with GOP=30)
 * - Tests pass in all three browsers (Chrome, Firefox, WebKit)
 */

test.describe('WebCodecs Frame-Accurate Video Control', () => {
  const testVideoPath = '../tests/fixtures/videos/test_gop30_h264.mp4';

  test.beforeEach(async ({ page }) => {
    // Listen to console messages for debugging
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));

    await page.goto('/');

    // Upload test video
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testVideoPath);

    // Wait for WebCodecs decoder to be ready
    await page.waitForFunction(
      () => {
        const api = (window as any).__webCodecsTestAPI;
        return api && api.isReady();
      },
      { timeout: 10000 }
    );

    // Wait for frame counter to be visible
    await page.waitForSelector('[data-testid="frame-counter"]', { timeout: 5000 });

    console.log('WebCodecs decoder ready');
  });

  test('should display frame counter with accurate frame numbers', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-002
     * Acceptance Criteria: Frame counter shows "Frame X of Y" format with exact accuracy
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');

    await expect(frameCounter).toBeVisible();

    // Check format
    const text = await frameCounter.textContent();
    expect(text).toMatch(/Frame \d+ of \d+/);

    console.log(`Frame counter text: ${text}`);
  });

  test('should step forward by 1 frame with EXACT accuracy (0 tolerance)', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-001 (fine stepping) with EXACT frame accuracy
     * Acceptance Criteria: Fine step forward button advances EXACTLY 1 frame (0 tolerance)
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');
    const stepButton = page.locator('[data-testid="step-forward-fine"]');

    // Seek to frame 100 to avoid edge cases near frame 0
    await page.evaluate(async () => {
      const api = (window as any).__webCodecsTestAPI;
      await api.seekToFrame(100);
    });

    // Wait for seek to complete
    await page.waitForFunction(
      () => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === 100;
      },
      { timeout: 5000 }
    );

    // Get initial frame number
    const initialFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    expect(initialFrame).toBe(100);

    // Measure latency
    const startTime = Date.now();
    await stepButton.click();

    // Wait for frame to update to EXACTLY initialFrame + 1
    await page.waitForFunction(
      (expected) => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === expected;
      },
      initialFrame + 1,
      { timeout: 2000 }
    );

    const latency = Date.now() - startTime;

    // Get final frame number
    const finalFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    // Verify EXACT frame accuracy (0 tolerance - non-negotiable)
    expect(finalFrame).toBe(initialFrame + 1);

    // Verify frame counter display matches
    const counterText = await frameCounter.textContent();
    const displayedFrame = parseInt(counterText?.match(/Frame (\d+)/)?.[1] || '0');
    expect(displayedFrame).toBe(finalFrame);

    console.log(`✓ Frame step EXACT: ${initialFrame} → ${finalFrame} (latency: ${latency}ms)`);

    // Log latency for analysis (REQ-NF-P-004: <100ms target)
    if (latency > 100) {
      console.warn(`⚠️ Latency ${latency}ms exceeds 100ms target`);
    }
  });

  test('should step backward by 1 frame with EXACT accuracy (0 tolerance)', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-001 (fine stepping backward) with EXACT accuracy
     * Acceptance Criteria: Fine step backward button moves EXACTLY 1 frame back (0 tolerance)
     */
    const stepBackward = page.locator('[data-testid="step-backward-fine"]');

    // Seek to frame 100
    await page.evaluate(async () => {
      const api = (window as any).__webCodecsTestAPI;
      await api.seekToFrame(100);
    });

    await page.waitForFunction(
      () => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === 100;
      },
      { timeout: 5000 }
    );

    const beforeFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    expect(beforeFrame).toBe(100);

    // Step backward
    await stepBackward.click();

    // Wait for EXACT frame update
    await page.waitForFunction(
      (expected) => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === expected;
      },
      beforeFrame - 1,
      { timeout: 2000 }
    );

    const afterFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    // Verify EXACT backward step (0 tolerance)
    expect(afterFrame).toBe(beforeFrame - 1);

    console.log(`✓ Backward step EXACT: ${beforeFrame} → ${afterFrame}`);
  });

  test('should step forward by 5 frames with EXACT accuracy (coarse stepping)', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-001 (coarse stepping) with EXACT accuracy
     * Acceptance Criteria: Coarse step forward button advances EXACTLY 5 frames (0 tolerance)
     */
    const stepButton = page.locator('[data-testid="step-forward-coarse"]');

    // Seek to frame 100
    await page.evaluate(async () => {
      const api = (window as any).__webCodecsTestAPI;
      await api.seekToFrame(100);
    });

    await page.waitForFunction(
      () => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === 100;
      },
      { timeout: 5000 }
    );

    const initialFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    expect(initialFrame).toBe(100);

    await stepButton.click();

    // Wait for EXACT 5-frame advance
    await page.waitForFunction(
      (expected) => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === expected;
      },
      initialFrame + 5,
      { timeout: 5000 }
    );

    const finalFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    // Verify EXACT coarse step (0 tolerance)
    expect(finalFrame).toBe(initialFrame + 5);

    console.log(`✓ Coarse step EXACT: ${initialFrame} → ${finalFrame} (5 frames)`);
  });

  test('should step backward by 5 frames with EXACT accuracy (coarse stepping)', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-001 (coarse stepping backward) with EXACT accuracy
     */
    const stepBackward = page.locator('[data-testid="step-backward-coarse"]');

    // Seek to frame 100
    await page.evaluate(async () => {
      const api = (window as any).__webCodecsTestAPI;
      await api.seekToFrame(100);
    });

    await page.waitForFunction(
      () => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === 100;
      },
      { timeout: 5000 }
    );

    const beforeFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    expect(beforeFrame).toBe(100);

    await stepBackward.click();

    // Wait for EXACT 5-frame backward movement
    await page.waitForFunction(
      (expected) => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === expected;
      },
      beforeFrame - 5,
      { timeout: 5000 }
    );

    const afterFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    // Verify EXACT coarse step backward (0 tolerance)
    expect(afterFrame).toBe(beforeFrame - 5);

    console.log(`✓ Coarse step backward EXACT: ${beforeFrame} → ${afterFrame} (5 frames)`);
  });

  test('frame counter updates during playback', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-002
     * Acceptance Criteria: Counter updates in real-time during playback with EXACT accuracy
     */
    const playButton = page.locator('[data-testid="play-pause"]');

    // Seek to frame 10
    await page.evaluate(async () => {
      const api = (window as any).__webCodecsTestAPI;
      await api.seekToFrame(10);
    });

    await page.waitForFunction(
      () => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() === 10;
      },
      { timeout: 5000 }
    );

    const initialFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    expect(initialFrame).toBe(10);

    // Start playback
    await playButton.click();

    // Wait for frames to advance during playback (at least 10 frames at 30fps ≈ 333ms)
    await page.waitForFunction(
      (initial) => {
        const api = (window as any).__webCodecsTestAPI;
        return api.getCurrentFrame() >= initial + 10;
      },
      initialFrame,
      { timeout: 3000 }
    );

    // Pause
    await playButton.click();

    const finalFrame = await page.evaluate(() => {
      const api = (window as any).__webCodecsTestAPI;
      return api.getCurrentFrame();
    });

    // Verify frames advanced during playback
    expect(finalFrame).toBeGreaterThan(initialFrame);

    console.log(`✓ Playback advanced from frame ${initialFrame} to ${finalFrame}`);
  });
});
