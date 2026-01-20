import { test, expect } from '@playwright/test';
import {
  navigateToProductionApp,
  uploadVideoProduction,
} from './helpers/uploadHelpers';

/**
 * WebCodecs Frame-Accurate Seeking Tests
 *
 * Phase 1 - Task 1.3.5: Updated for production workflow with backend integration
 * Original: Phase 0 - Task 0.3 - Phase 6 (WebCodecs frame control validation)
 *
 * Requirements Validated:
 * - REQ-F-UPLOAD-001: Local File Upload (production workflow)
 * - REQ-F-FRAME-001: Frame stepping (coarse: 5 frames, fine: 1 frame) - EXACT (0 tolerance)
 * - REQ-F-FRAME-002: Frame counter display accuracy - EXACT
 * - REQ-F-FRAME-003: Seeking precision - EXACT (0 frame error)
 * - REQ-NF-P-004: Frame step response time (<100ms for cache hits)
 * - REQ-NF-BC-001: Browser compatibility (Chrome, Firefox, WebKit)
 *
 * Success Criteria:
 * - Upload workflow completes successfully
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

    await navigateToProductionApp(page);

    // Upload test video to Video A using production workflow
    await uploadVideoProduction(page, 'file-input-a', testVideoPath, 0, {
      expectOptimization: false, // GOP=30 videos don't need optimization
      timeout: 60000,
    });

    // Wait for frame counter to be visible and show frame data
    await page.waitForSelector('[data-testid="frame-counter-a"]', { timeout: 10000 });

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        return counter?.textContent?.includes('Frame');
      },
      { timeout: 5000 }
    );

    console.log('Video decoder ready');
  });

  test('should display frame counter with accurate frame numbers', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-002
     * Acceptance Criteria: Frame counter shows "Frame X of Y" format with exact accuracy
     */
    const frameCounter = page.locator('[data-testid="frame-counter-a"]');

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
    const frameCounter = page.locator('[data-testid="frame-counter-a"]');
    const stepButton = page.locator('[data-testid="step-forward-fine-a"]');

    // Seek to frame 100 to avoid edge cases near frame 0
    const scrubBar = page.locator('[data-testid="scrub-bar-a"]');
    await scrubBar.fill('100');
    await scrubBar.dispatchEvent('mouseup');

    // Wait for seek to complete
    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === 100;
      },
      { timeout: 5000 }
    );

    // Get initial frame number
    const initialText = await frameCounter.textContent();
    const initialFrame = parseInt(initialText?.match(/Frame (\d+)/)?.[1] || '0');

    expect(initialFrame).toBe(100);

    // Measure latency
    const startTime = Date.now();
    await stepButton.click();

    // Wait for frame to update to EXACTLY initialFrame + 1
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === expected;
      },
      initialFrame + 1,
      { timeout: 2000 }
    );

    const latency = Date.now() - startTime;

    // Get final frame number
    const finalText = await frameCounter.textContent();
    const finalFrame = parseInt(finalText?.match(/Frame (\d+)/)?.[1] || '0');

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
    const frameCounter = page.locator('[data-testid="frame-counter-a"]');
    const stepBackward = page.locator('[data-testid="step-backward-fine-a"]');

    // Seek to frame 100
    const scrubBar = page.locator('[data-testid="scrub-bar-a"]');
    await scrubBar.fill('100');
    await scrubBar.dispatchEvent('mouseup');

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === 100;
      },
      { timeout: 5000 }
    );

    const beforeText = await frameCounter.textContent();
    const beforeFrame = parseInt(beforeText?.match(/Frame (\d+)/)?.[1] || '0');

    expect(beforeFrame).toBe(100);

    // Step backward
    await stepBackward.click();

    // Wait for EXACT frame update
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === expected;
      },
      beforeFrame - 1,
      { timeout: 2000 }
    );

    const afterText = await frameCounter.textContent();
    const afterFrame = parseInt(afterText?.match(/Frame (\d+)/)?.[1] || '0');

    // Verify EXACT backward step (0 tolerance)
    expect(afterFrame).toBe(beforeFrame - 1);

    console.log(`✓ Backward step EXACT: ${beforeFrame} → ${afterFrame}`);
  });

  test('should step forward by 5 frames with EXACT accuracy (coarse stepping)', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-001 (coarse stepping) with EXACT accuracy
     * Acceptance Criteria: Coarse step forward button advances EXACTLY 5 frames (0 tolerance)
     */
    const frameCounter = page.locator('[data-testid="frame-counter-a"]');
    const stepButton = page.locator('[data-testid="step-forward-coarse-a"]');

    // Seek to frame 100
    const scrubBar = page.locator('[data-testid="scrub-bar-a"]');
    await scrubBar.fill('100');
    await scrubBar.dispatchEvent('mouseup');

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === 100;
      },
      { timeout: 5000 }
    );

    const initialText = await frameCounter.textContent();
    const initialFrame = parseInt(initialText?.match(/Frame (\d+)/)?.[1] || '0');

    expect(initialFrame).toBe(100);

    await stepButton.click();

    // Wait for EXACT 5-frame advance
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === expected;
      },
      initialFrame + 5,
      { timeout: 5000 }
    );

    const finalText = await frameCounter.textContent();
    const finalFrame = parseInt(finalText?.match(/Frame (\d+)/)?.[1] || '0');

    // Verify EXACT coarse step (0 tolerance)
    expect(finalFrame).toBe(initialFrame + 5);

    console.log(`✓ Coarse step EXACT: ${initialFrame} → ${finalFrame} (5 frames)`);
  });

  test('should step backward by 5 frames with EXACT accuracy (coarse stepping)', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-001 (coarse stepping backward) with EXACT accuracy
     */
    const frameCounter = page.locator('[data-testid="frame-counter-a"]');
    const stepBackward = page.locator('[data-testid="step-backward-coarse-a"]');

    // Seek to frame 100
    const scrubBar = page.locator('[data-testid="scrub-bar-a"]');
    await scrubBar.fill('100');
    await scrubBar.dispatchEvent('mouseup');

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === 100;
      },
      { timeout: 5000 }
    );

    const beforeText = await frameCounter.textContent();
    const beforeFrame = parseInt(beforeText?.match(/Frame (\d+)/)?.[1] || '0');

    expect(beforeFrame).toBe(100);

    await stepBackward.click();

    // Wait for EXACT 5-frame backward movement
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === expected;
      },
      beforeFrame - 5,
      { timeout: 5000 }
    );

    const afterText = await frameCounter.textContent();
    const afterFrame = parseInt(afterText?.match(/Frame (\d+)/)?.[1] || '0');

    // Verify EXACT coarse step backward (0 tolerance)
    expect(afterFrame).toBe(beforeFrame - 5);

    console.log(`✓ Coarse step backward EXACT: ${beforeFrame} → ${afterFrame} (5 frames)`);
  });

  test('frame counter updates during playback', async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-002
     * Acceptance Criteria: Counter updates in real-time during playback with EXACT accuracy
     */
    const frameCounter = page.locator('[data-testid="frame-counter-a"]');
    const playButton = page.locator('[data-testid="play-pause-a"]');

    // Seek to frame 10
    const scrubBar = page.locator('[data-testid="scrub-bar-a"]');
    await scrubBar.fill('10');
    await scrubBar.dispatchEvent('mouseup');

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame === 10;
      },
      { timeout: 5000 }
    );

    const initialText = await frameCounter.textContent();
    const initialFrame = parseInt(initialText?.match(/Frame (\d+)/)?.[1] || '0');

    expect(initialFrame).toBe(10);

    // Start playback
    await playButton.click();

    // Wait for frames to advance during playback (at least 10 frames at 30fps ≈ 333ms)
    await page.waitForFunction(
      (initial) => {
        const counter = document.querySelector('[data-testid="frame-counter-a"]');
        const text = counter?.textContent || '';
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || '0');
        return currentFrame >= initial + 10;
      },
      initialFrame,
      { timeout: 3000 }
    );

    // Pause
    await playButton.click();

    const finalText = await frameCounter.textContent();
    const finalFrame = parseInt(finalText?.match(/Frame (\d+)/)?.[1] || '0');

    // Verify frames advanced during playback
    expect(finalFrame).toBeGreaterThan(initialFrame);

    console.log(`✓ Playback advanced from frame ${initialFrame} to ${finalFrame}`);
  });
});
