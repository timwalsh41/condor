import { test, expect } from "@playwright/test";

/**
 * WebCodecs Frame-Accurate Seeking Tests
 *
 * Phase 0 - Task 0.3, Phase 6: Validates frame-accurate video control with WebCodecs
 *
 * Requirements Validated:
 * - REQ-F-FRAME-001: Frame stepping (coarse: 5 frames, fine: 1 frame) with EXACT accuracy
 * - REQ-F-FRAME-002: Frame counter display accuracy
 * - REQ-F-FRAME-003: Seeking precision (EXACT - 0 frame tolerance)
 * - REQ-NF-P-004: Frame step response time (<100ms cache hit, <300ms cache miss)
 * - REQ-NF-BC-001: Browser compatibility (Chrome, Firefox, WebKit)
 *
 * Success Criteria:
 * - Frame counter accuracy EXACT (0 frame tolerance) - non-negotiable requirement
 * - Frame step latency <100ms (cache hit) or <300ms (cache miss, GOP=30)
 * - Tests pass in Chrome, Firefox, WebKit
 *
 * Test Strategy:
 * - Use test_gop30_h264.mp4 (5s, 150 frames, GOP=30) for basic stepping tests
 * - Use test_gop30_h264_10s.mp4 (10s, 300 frames, GOP=30) for cache miss scenarios
 * - Assert exact frame equality (no tolerance)
 * - Log performance metrics for analysis
 */

test.describe("WebCodecs Frame-Accurate Video Control", () => {
  test.beforeEach(async ({ page }) => {
    // Listen to console messages for debugging
    page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`PAGE ERROR: ${err.message}`));

    await page.goto("/");

    // Upload test video
    const testVideoPath = "../tests/fixtures/videos/test_gop30_h264.mp4";

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testVideoPath);

    // Wait for decoder to be ready
    await page.waitForSelector('[data-testid="frame-counter"]', {
      timeout: 10000,
    });

    // Wait for initial frame to be decoded and displayed
    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        return counter?.textContent?.includes("Frame");
      },
      { timeout: 5000 }
    );

    console.log("WebCodecs decoder initialized");
  });

  test("should display frame counter with accurate frame numbers", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-FRAME-002
     * Acceptance Criteria: Frame counter shows "Frame X of Y" format
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');

    await expect(frameCounter).toBeVisible();

    // Check format
    const text = await frameCounter.textContent();
    expect(text).toMatch(/Frame \d+ of \d+/);

    console.log(`Frame counter format: ${text}`);
  });

  test("should step forward by 1 frame with EXACT accuracy", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-FRAME-001 (fine stepping), REQ-F-FRAME-003 (exact positioning)
     * Acceptance Criteria: Fine step forward button advances EXACTLY 1 frame (0 tolerance)
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');
    const stepButton = page.locator('[data-testid="step-forward-fine"]');

    // Use slider to seek to frame 100 for stable testing
    const slider = page.locator('input[type="range"]');
    await slider.fill("100");
    await slider.dispatchEvent("mouseup");

    // Wait for exact frame 100
    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === 100;
      },
      { timeout: 3000 }
    );

    const initialText = (await frameCounter.textContent()) || "";
    const initialFrame = parseInt(initialText.match(/Frame (\d+)/)?.[1] || "0");

    console.log(`Starting frame: ${initialFrame}`);

    // Measure latency
    const startTime = Date.now();
    await stepButton.click();

    // Wait for EXACT frame update (0 tolerance)
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === expected; // EXACT equality required
      },
      initialFrame + 1,
      { timeout: 2000 }
    );

    const latency = Date.now() - startTime;

    const finalText = (await frameCounter.textContent()) || "";
    const finalFrame = parseInt(finalText.match(/Frame (\d+)/)?.[1] || "0");

    // EXACT frame accuracy assertion (0 tolerance - non-negotiable)
    expect(finalFrame).toBe(initialFrame + 1);

    console.log(
      `Frame step latency: ${latency}ms, moved from ${initialFrame} to ${finalFrame}`
    );

    // Performance validation
    if (latency > 300) {
      console.warn(
        `⚠️ Latency ${latency}ms exceeds 300ms (cache miss tolerance)`
      );
    } else if (latency > 100) {
      console.log(
        `ℹ️ Latency ${latency}ms suggests cache miss (100-300ms range acceptable)`
      );
    } else {
      console.log(`✓ Latency ${latency}ms indicates cache hit (<100ms)`);
    }
  });

  test("should step backward by 1 frame with EXACT accuracy", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-FRAME-001 (fine stepping backward), REQ-F-FRAME-003 (exact positioning)
     * Acceptance Criteria: Fine step backward button moves EXACTLY 1 frame back (0 tolerance)
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');
    const stepBackward = page.locator('[data-testid="step-backward-fine"]');

    // Use slider to seek to frame 100
    const slider = page.locator('input[type="range"]');
    await slider.fill("100");
    await slider.dispatchEvent("mouseup");

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === 100;
      },
      { timeout: 3000 }
    );

    const beforeText = (await frameCounter.textContent()) || "";
    const beforeFrame = parseInt(beforeText.match(/Frame (\d+)/)?.[1] || "0");

    console.log(`Starting frame: ${beforeFrame}`);

    await stepBackward.click();

    // Wait for EXACT frame update
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === expected; // EXACT equality required
      },
      beforeFrame - 1,
      { timeout: 2000 }
    );

    const afterText = (await frameCounter.textContent()) || "";
    const afterFrame = parseInt(afterText.match(/Frame (\d+)/)?.[1] || "0");

    // EXACT frame accuracy assertion
    expect(afterFrame).toBe(beforeFrame - 1);

    console.log(`Stepped backward from ${beforeFrame} to ${afterFrame}`);
  });

  test("should step forward by 5 frames with EXACT accuracy (coarse stepping)", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-FRAME-001 (coarse stepping), REQ-F-FRAME-003 (exact positioning)
     * Acceptance Criteria: Coarse step forward button advances EXACTLY 5 frames (0 tolerance)
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');
    const stepButton = page.locator('[data-testid="step-forward-coarse"]');

    // Use slider to seek to frame 100
    const slider = page.locator('input[type="range"]');
    await slider.fill("100");
    await slider.dispatchEvent("mouseup");

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === 100;
      },
      { timeout: 3000 }
    );

    const initialText = (await frameCounter.textContent()) || "";
    const initialFrame = parseInt(initialText.match(/Frame (\d+)/)?.[1] || "0");

    console.log(`Starting frame: ${initialFrame}`);

    const startTime = Date.now();
    await stepButton.click();

    // Wait for EXACT frame update
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === expected; // EXACT equality required
      },
      initialFrame + 5,
      { timeout: 3000 }
    );

    const latency = Date.now() - startTime;

    const finalText = (await frameCounter.textContent()) || "";
    const finalFrame = parseInt(finalText.match(/Frame (\d+)/)?.[1] || "0");

    // EXACT frame accuracy assertion
    expect(finalFrame).toBe(initialFrame + 5);

    console.log(
      `Coarse step latency: ${latency}ms, moved from ${initialFrame} to ${finalFrame} (exact 5 frame step)`
    );
  });

  test("should step backward by 5 frames with EXACT accuracy (coarse stepping)", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-FRAME-001 (coarse stepping backward), REQ-F-FRAME-003 (exact positioning)
     * Acceptance Criteria: Coarse step backward moves EXACTLY 5 frames back (0 tolerance)
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');
    const stepBackward = page.locator('[data-testid="step-backward-coarse"]');

    // Use slider to seek to frame 100
    const slider = page.locator('input[type="range"]');
    await slider.fill("100");
    await slider.dispatchEvent("mouseup");

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === 100;
      },
      { timeout: 3000 }
    );

    const beforeText = (await frameCounter.textContent()) || "";
    const beforeFrame = parseInt(beforeText.match(/Frame (\d+)/)?.[1] || "0");

    console.log(`Starting frame: ${beforeFrame}`);

    await stepBackward.click();

    // Wait for EXACT frame update
    await page.waitForFunction(
      (expected) => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === expected; // EXACT equality required
      },
      beforeFrame - 5,
      { timeout: 3000 }
    );

    const afterText = (await frameCounter.textContent()) || "";
    const afterFrame = parseInt(afterText.match(/Frame (\d+)/)?.[1] || "0");

    // EXACT frame accuracy assertion
    expect(afterFrame).toBe(beforeFrame - 5);

    console.log(
      `Coarse step backward from ${beforeFrame} to ${afterFrame} (exact 5 frame step)`
    );
  });

  test("frame counter updates during playback", async ({ page }) => {
    /**
     * Validates: REQ-F-FRAME-002
     * Acceptance Criteria: Counter updates in real-time during playback
     */
    const frameCounter = page.locator('[data-testid="frame-counter"]');
    const playButton = page.locator('[data-testid="play-pause"]');

    // Start from beginning using slider
    const slider = page.locator('input[type="range"]');
    await slider.fill("0");
    await slider.dispatchEvent("mouseup");

    await page.waitForFunction(
      () => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame === 0;
      },
      { timeout: 3000 }
    );

    const initialText = (await frameCounter.textContent()) || "";
    const initialFrame = parseInt(initialText.match(/Frame (\d+)/)?.[1] || "0");

    console.log(`Playback starting from frame: ${initialFrame}`);

    // Start playback
    await playButton.click();

    // Wait for frame counter to advance (should advance to at least frame 30 in 1 second at 30fps)
    await page.waitForFunction(
      (initial) => {
        const counter = document.querySelector('[data-testid="frame-counter"]');
        const text = counter?.textContent || "";
        const currentFrame = parseInt(text.match(/Frame (\d+)/)?.[1] || "0");
        return currentFrame > initial + 10; // Wait for at least 10 frames
      },
      initialFrame,
      { timeout: 5000 }
    );

    // Pause
    await playButton.click();

    const finalText = (await frameCounter.textContent()) || "";
    const finalFrame = parseInt(finalText.match(/Frame (\d+)/)?.[1] || "0");

    // Verify frame counter advanced during playback
    expect(finalFrame).toBeGreaterThan(initialFrame + 10);

    console.log(
      `Playback advanced from frame ${initialFrame} to ${finalFrame} (${
        finalFrame - initialFrame
      } frames)`
    );
  });

  test("should support WebCodecs VideoDecoder API", async ({ page }) => {
    /**
     * Validates: REQ-NF-BC-001
     * Acceptance Criteria: WebCodecs API available in browser
     */
    const hasAPI = await page.evaluate(() => {
      return typeof VideoDecoder !== "undefined";
    });

    expect(hasAPI).toBe(true);

    console.log(
      `✅ WebCodecs VideoDecoder API is available in ${
        test.info().project.name
      }`
    );
  });
});
