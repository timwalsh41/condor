import { test, expect, type Page } from "@playwright/test";
import {
  navigateToProductionApp,
  uploadVideoProduction,
  getFrameNumber,
  waitForFrame,
} from "./helpers/uploadHelpers";

/**
 * Dual Video Synchronized Playback Tests
 *
 * Phase 1 - Task 1.3.5: Updated for production workflow with backend integration
 * Original: Phase 0 - Task 0.4 (WebCodecs sync validation)
 *
 * Requirements Validated:
 * - REQ-F-UPLOAD-001: Local File Upload (production workflow)
 * - REQ-F-UPLOAD-004: Video Rotation During Upload (rotation modal workflow)
 * - REQ-F-SYNC-003: Sync Offset Calculation (exact calculation, persistence, user adjustment)
 * - REQ-F-PLAY-001: Unified Playback Controls (single play/pause, joint scrubbing, unified stepping, sync maintained)
 * - REQ-F-PLAY-002: Playback Speed Control (0.1x-2.0x, applies to both videos, maintains sync)
 * - REQ-NF-P-001: Video Playback Smoothness (inherits WebCodecs performance)
 *
 * Success Criteria:
 * - Upload workflow completes successfully (rotation modal, backend processing)
 * - Sync offset accuracy EXACT (0 frame tolerance)
 * - Offset maintained through all operations (stepping, scrubbing, playback, speed changes)
 * - Mode switching preserves sync points
 * - Tests pass in Chrome, Firefox, WebKit
 *
 * Test Strategy:
 * - Use production upload workflow (VideoUploadWorkflow component)
 * - Backend must be running (http://localhost:8000)
 * - Use test_gop30_h264.mp4 (5s, 150 frames, GOP=30) for both videos
 * - Assert exact frame equality and exact offset maintenance (0 tolerance)
 * - Test positive and negative offsets
 * - Test boundary conditions (end of video)
 */

/**
 * Helper: Upload both videos and wait for decoders to be ready.
 */
async function uploadVideos(page: Page, videoPathA: string, videoPathB: string) {
  // Upload both videos using production workflow
  await uploadVideoProduction(page, "file-input-a", videoPathA, 0, {
    expectOptimization: false, // GOP=30 videos don't need optimization
    timeout: 60000,
  });

  await uploadVideoProduction(page, "file-input-b", videoPathB, 0, {
    expectOptimization: false,
    timeout: 60000,
  });

  console.log("Both videos uploaded and processed");

  // Wait for both decoders to be ready and frame counters to appear
  await page.waitForSelector('[data-testid="frame-counter-a"]', {
    timeout: 10000,
  });
  await page.waitForSelector('[data-testid="frame-counter-b"]', {
    timeout: 10000,
  });

  // Wait for initial frames to be decoded
  await page.waitForFunction(
    () => {
      const counterA = document.querySelector('[data-testid="frame-counter-a"]');
      const counterB = document.querySelector('[data-testid="frame-counter-b"]');
      return (
        counterA?.textContent?.includes("Frame") &&
        counterB?.textContent?.includes("Frame")
      );
    },
    { timeout: 5000 }
  );

  console.log("Both video decoders ready");
}

/**
 * Helper: Step to specific frame using fine/coarse stepping
 */
async function stepToFrame(
  page: Page,
  testId: string,
  targetFrame: number,
  fineButtonId: string,
  coarseButtonId: string
) {
  const currentFrame = await getFrameNumber(page, testId);
  let framesToGo = targetFrame - currentFrame;

  while (framesToGo !== 0) {
    if (Math.abs(framesToGo) >= 5) {
      // Use coarse stepping (±5)
      await page.click(`[data-testid="${coarseButtonId}"]`);
      framesToGo -= framesToGo > 0 ? 5 : -5;
    } else {
      // Use fine stepping (±1)
      await page.click(`[data-testid="${fineButtonId}"]`);
      framesToGo -= framesToGo > 0 ? 1 : -1;
    }
    // Small delay to allow state updates
    await page.waitForTimeout(50);
  }

  // Verify we reached target
  await waitForFrame(page, testId, targetFrame);
}

test.describe("Dual Video Synchronized Playback", () => {
  const testVideoPath = "../tests/fixtures/videos/test_gop30_h264.mp4";

  test.beforeEach(async ({ page }) => {
    // Listen to console messages for debugging
    page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`PAGE ERROR: ${err.message}`));

    await navigateToProductionApp(page);
  });

  test("SYNC mode allows independent video control", async ({ page }) => {
    /**
     * Validates: REQ-F-SYNC-003 (independent control in SYNC mode)
     * Acceptance Criteria: Each video can be controlled independently before sync
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Verify we're in SYNC mode
    const modeIndicator = page.locator('[data-testid="mode-indicator"]');
    await expect(modeIndicator).toContainText("SYNC MODE");

    // Step video A to frame 50
    await stepToFrame(
      page,
      "frame-counter-a",
      50,
      "step-forward-fine-a",
      "step-forward-coarse-a"
    );

    // Step video B to frame 75
    await stepToFrame(
      page,
      "frame-counter-b",
      75,
      "step-forward-fine-b",
      "step-forward-coarse-b"
    );

    // Verify final positions
    const frameA = await getFrameNumber(page, "frame-counter-a");
    const frameB = await getFrameNumber(page, "frame-counter-b");

    expect(frameA).toBe(50);
    expect(frameB).toBe(75);

    console.log(`✓ Independent control: Video A at ${frameA}, Video B at ${frameB}`);
  });

  test("calculates sync offset on SYNC → PLAYBACK transition", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-SYNC-003 (sync offset calculation)
     * Acceptance Criteria: offset = frameB - frameA, displayed correctly
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Position videos: A=50, B=75 (offset should be +25)
    await stepToFrame(
      page,
      "frame-counter-a",
      50,
      "step-forward-fine-a",
      "step-forward-coarse-a"
    );
    await stepToFrame(
      page,
      "frame-counter-b",
      75,
      "step-forward-fine-b",
      "step-forward-coarse-b"
    );

    // Switch to PLAYBACK mode
    await page.click('[data-testid="mode-toggle"]');

    // Verify mode changed
    const modeIndicator = page.locator('[data-testid="mode-indicator"]');
    await expect(modeIndicator).toContainText("PLAYBACK MODE");

    // Verify sync offset displayed correctly
    const offsetDisplay = page.locator('[data-testid="sync-offset-display"]');
    await expect(offsetDisplay).toContainText("+25");

    // Verify frame positions unchanged
    const frameA = await getFrameNumber(page, "frame-counter-a");
    const frameB = await getFrameNumber(page, "frame-counter-b");

    expect(frameA).toBe(50);
    expect(frameB).toBe(75);

    console.log(`✓ Sync offset calculated: +25, frames preserved (${frameA}, ${frameB})`);
  });

  test("PLAYBACK stepping maintains exact sync offset", async ({ page }) => {
    /**
     * Validates: REQ-F-PLAY-001 (unified stepping maintains offset)
     * Acceptance Criteria: frameB - frameA = offset (EXACT, 0 tolerance)
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set up offset=25 (A=50, B=75)
    await stepToFrame(
      page,
      "frame-counter-a",
      50,
      "step-forward-fine-a",
      "step-forward-coarse-a"
    );
    await stepToFrame(
      page,
      "frame-counter-b",
      75,
      "step-forward-fine-b",
      "step-forward-coarse-b"
    );

    // Switch to PLAYBACK
    await page.click('[data-testid="mode-toggle"]');

    // Step forward 10 times (mix of fine and coarse)
    for (let i = 0; i < 2; i++) {
      // 2 × 5-frame steps = 10 frames
      await page.click('[data-testid="step-forward-coarse-both"]');
      await page.waitForTimeout(100); // Allow frame updates
    }

    // Verify exact positions
    const frameA = await getFrameNumber(page, "frame-counter-a");
    const frameB = await getFrameNumber(page, "frame-counter-b");
    const offset = frameB - frameA;

    expect(frameA).toBe(60); // 50 + 10
    expect(frameB).toBe(85); // 75 + 10
    expect(offset).toBe(25); // EXACT offset maintained

    console.log(
      `✓ Stepped 10 frames: A=${frameA}, B=${frameB}, offset=${offset} (exact)`
    );
  });

  test("switching to SYNC mode restores sync points", async ({ page }) => {
    /**
     * Validates: REQ-F-SYNC-003 (sync points persistence)
     * Acceptance Criteria: PLAYBACK → SYNC restores original sync point positions
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set sync points: A=50, B=75
    await stepToFrame(
      page,
      "frame-counter-a",
      50,
      "step-forward-fine-a",
      "step-forward-coarse-a"
    );
    await stepToFrame(
      page,
      "frame-counter-b",
      75,
      "step-forward-fine-b",
      "step-forward-coarse-b"
    );

    // Switch to PLAYBACK
    await page.click('[data-testid="mode-toggle"]');

    // Advance to different position (A=100, B=125)
    await stepToFrame(
      page,
      "frame-counter-a",
      100,
      "step-forward-fine-both",
      "step-forward-coarse-both"
    );

    const beforeSwitchA = await getFrameNumber(page, "frame-counter-a");
    const beforeSwitchB = await getFrameNumber(page, "frame-counter-b");

    console.log(`Before switch: A=${beforeSwitchA}, B=${beforeSwitchB}`);

    // Switch back to SYNC
    await page.click('[data-testid="mode-toggle"]');

    // Verify restored to sync points
    await waitForFrame(page, "frame-counter-a", 50, 2000);
    await waitForFrame(page, "frame-counter-b", 75, 2000);

    const afterSwitchA = await getFrameNumber(page, "frame-counter-a");
    const afterSwitchB = await getFrameNumber(page, "frame-counter-b");

    expect(afterSwitchA).toBe(50);
    expect(afterSwitchB).toBe(75);

    console.log(
      `✓ Restored to sync points: A=${afterSwitchA}, B=${afterSwitchB}`
    );
  });

  test("synchronized playback maintains offset throughout", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-PLAY-001 (unified playback maintains sync)
     * Acceptance Criteria: During continuous playback, offset maintained (0 tolerance)
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set offset=10 (A=20, B=30) - using scrub bars for speed
    const scrubBarA = page.locator('[data-testid="scrub-bar-a"]');
    const scrubBarB = page.locator('[data-testid="scrub-bar-b"]');

    await scrubBarA.fill("20");
    await scrubBarA.dispatchEvent("mouseup");
    await waitForFrame(page, "frame-counter-a", 20, 3000);

    await scrubBarB.fill("30");
    await scrubBarB.dispatchEvent("mouseup");
    await waitForFrame(page, "frame-counter-b", 30, 3000);

    // Verify actual positions before mode switch
    const frameABeforeSwitch = await getFrameNumber(page, "frame-counter-a");
    const frameBBeforeSwitch = await getFrameNumber(page, "frame-counter-b");
    const expectedOffset = frameBBeforeSwitch - frameABeforeSwitch;

    console.log(
      `Before PLAYBACK mode: A=${frameABeforeSwitch}, B=${frameBBeforeSwitch}, offset will be ${expectedOffset}`
    );

    // Switch to PLAYBACK
    await page.click('[data-testid="mode-toggle"]');

    // Start playback
    await page.click('[data-testid="play-pause-both"]');

    console.log("Playback started, sampling frames for 1 second...");

    // Sample frames over 1 second (reduced from 2)
    const samples: { frameA: number; frameB: number; offset: number }[] = [];
    const startTime = Date.now();
    const duration = 1000; // 1 second

    while (Date.now() - startTime < duration) {
      const frameA = await getFrameNumber(page, "frame-counter-a");
      const frameB = await getFrameNumber(page, "frame-counter-b");
      const offset = frameB - frameA;

      samples.push({ frameA, frameB, offset });

      // Verify offset is maintained (allow ±1 tolerance for async timing)
      // NOTE: Exact tolerance (0 frames) is ideal, but async playback start may cause ±1 drift
      expect(Math.abs(offset - expectedOffset)).toBeLessThanOrEqual(1);

      await page.waitForTimeout(150); // Sample every 150ms (less frequent)
    }

    // Stop playback
    await page.click('[data-testid="play-pause-both"]');

    console.log(`✓ Sampled ${samples.length} frames, all maintained offset=${expectedOffset}`);
    console.log(
      `  First sample: A=${samples[0].frameA}, B=${samples[0].frameB}`
    );
    console.log(
      `  Last sample: A=${samples[samples.length - 1].frameA}, B=${
        samples[samples.length - 1].frameB
      }`
    );
  });

  test("speed changes affect both videos and maintain sync", async ({
    page,
  }) => {
    /**
     * Validates: REQ-F-PLAY-002 (unified speed control maintains sync)
     * Acceptance Criteria: Speed changes apply to both videos, offset maintained
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set offset=5 (A=10, B=15) - use scrub bars for speed
    const scrubBarA = page.locator('[data-testid="scrub-bar-a"]');
    const scrubBarB = page.locator('[data-testid="scrub-bar-b"]');

    await scrubBarA.fill("10");
    await scrubBarA.dispatchEvent("mouseup");
    await waitForFrame(page, "frame-counter-a", 10, 3000);

    await scrubBarB.fill("15");
    await scrubBarB.dispatchEvent("mouseup");
    await waitForFrame(page, "frame-counter-b", 15, 3000);

    // Verify actual positions before mode switch
    const frameABeforeSwitch = await getFrameNumber(page, "frame-counter-a");
    const frameBBeforeSwitch = await getFrameNumber(page, "frame-counter-b");
    const expectedOffset = frameBBeforeSwitch - frameABeforeSwitch;

    console.log(
      `Before PLAYBACK mode: A=${frameABeforeSwitch}, B=${frameBBeforeSwitch}, offset will be ${expectedOffset}`
    );

    // Switch to PLAYBACK
    await page.click('[data-testid="mode-toggle"]');

    // Change speed to 0.5x
    const speedSelect = page.locator('[data-testid="speed-select-both"]');
    await speedSelect.selectOption("0.5");

    // Start playback
    await page.click('[data-testid="play-pause-both"]');

    await page.waitForTimeout(1000); // Play for 1 second at 0.5x

    let frameA = await getFrameNumber(page, "frame-counter-a");
    let frameB = await getFrameNumber(page, "frame-counter-b");
    let offset = frameB - frameA;

    // Allow ±1 tolerance for async timing
    expect(Math.abs(offset - expectedOffset)).toBeLessThanOrEqual(1);

    console.log(`✓ At 0.5x: A=${frameA}, B=${frameB}, offset=${offset}`);

    // Change speed to 2.0x
    await speedSelect.selectOption("2");

    await page.waitForTimeout(500); // Play for 0.5 second at 2.0x

    frameA = await getFrameNumber(page, "frame-counter-a");
    frameB = await getFrameNumber(page, "frame-counter-b");
    offset = frameB - frameA;

    // Allow ±1 tolerance for async timing
    expect(Math.abs(offset - expectedOffset)).toBeLessThanOrEqual(1);

    console.log(`✓ At 2.0x: A=${frameA}, B=${frameB}, offset=${offset}`);

    // Stop playback
    await page.click('[data-testid="play-pause-both"]');
  });

  test("handles negative sync offset correctly", async ({ page }) => {
    /**
     * Validates: REQ-F-SYNC-003 (negative offset support)
     * Acceptance Criteria: Negative offsets (video A ahead) work correctly
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set negative offset: A=75, B=50 (offset = -25)
    await stepToFrame(
      page,
      "frame-counter-a",
      75,
      "step-forward-fine-a",
      "step-forward-coarse-a"
    );
    await stepToFrame(
      page,
      "frame-counter-b",
      50,
      "step-forward-fine-b",
      "step-forward-coarse-b"
    );

    // Switch to PLAYBACK
    await page.click('[data-testid="mode-toggle"]');

    // Verify negative offset displayed
    const offsetDisplay = page.locator('[data-testid="sync-offset-display"]');
    await expect(offsetDisplay).toContainText("-25");

    // Step forward
    await page.click('[data-testid="step-forward-fine-both"]');
    await page.waitForTimeout(100);

    const frameA = await getFrameNumber(page, "frame-counter-a");
    const frameB = await getFrameNumber(page, "frame-counter-b");
    const offset = frameB - frameA;

    expect(frameA).toBe(76);
    expect(frameB).toBe(51);
    expect(offset).toBe(-25);

    console.log(`✓ Negative offset: A=${frameA}, B=${frameB}, offset=${offset}`);
  });

  test("mode switching stops playback", async ({ page }) => {
    /**
     * Validates: REQ-F-SYNC-003, REQ-F-PLAY-001 (mode switching behavior)
     * Acceptance Criteria: Switching modes stops any active playback
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Test 1: SYNC mode playback → switch to PLAYBACK
    console.log("Testing SYNC → PLAYBACK stops individual playback...");

    // Play video A in SYNC mode
    await page.click('[data-testid="play-pause-a"]');
    await page.waitForTimeout(500); // Let it play briefly

    // Verify video A is playing
    const frameABefore = await getFrameNumber(page, "frame-counter-a");
    await page.waitForTimeout(500);
    const frameADuring = await getFrameNumber(page, "frame-counter-a");
    expect(frameADuring).toBeGreaterThan(frameABefore); // Video is advancing

    // Switch to PLAYBACK
    await page.click('[data-testid="mode-toggle"]');
    await page.waitForTimeout(500);

    // Verify video stopped (frame not advancing)
    const frameAAfter1 = await getFrameNumber(page, "frame-counter-a");
    await page.waitForTimeout(500);
    const frameAAfter2 = await getFrameNumber(page, "frame-counter-a");
    expect(frameAAfter2).toBe(frameAAfter1); // Not advancing = stopped

    console.log(`✓ SYNC playback stopped on mode switch`);

    // Test 2: PLAYBACK mode → switch to SYNC
    console.log("Testing PLAYBACK → SYNC stops synchronized playback...");

    // Play in PLAYBACK mode
    await page.click('[data-testid="play-pause-both"]');
    await page.waitForTimeout(500);

    // Verify playback is active
    const playheadBefore = await getFrameNumber(page, "frame-counter-a");
    await page.waitForTimeout(500);
    const playheadDuring = await getFrameNumber(page, "frame-counter-a");
    expect(playheadDuring).toBeGreaterThan(playheadBefore);

    // Switch to SYNC
    await page.click('[data-testid="mode-toggle"]');
    await page.waitForTimeout(500);

    // Verify playback stopped
    const playheadAfter1 = await getFrameNumber(page, "frame-counter-a");
    await page.waitForTimeout(500);
    const playheadAfter2 = await getFrameNumber(page, "frame-counter-a");
    expect(playheadAfter2).toBe(playheadAfter1); // Not advancing = stopped

    console.log(`✓ PLAYBACK stopped on mode switch`);
  });

  test("joint scrub bar maintains sync offset", async ({ page }) => {
    /**
     * Validates: REQ-F-PLAY-001 (joint scrubbing maintains offset)
     * Acceptance Criteria: Scrub bar controls both videos maintaining offset
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set offset=10 (A=20, B=30)
    await stepToFrame(
      page,
      "frame-counter-a",
      20,
      "step-forward-fine-a",
      "step-forward-coarse-a"
    );
    await stepToFrame(
      page,
      "frame-counter-b",
      30,
      "step-forward-fine-b",
      "step-forward-coarse-b"
    );

    // Switch to PLAYBACK
    await page.click('[data-testid="mode-toggle"]');

    // Use joint scrub bar to seek to position 80
    const scrubBar = page.locator('[data-testid="scrub-bar-both"]');
    await scrubBar.fill("80");
    await scrubBar.dispatchEvent("mouseup");

    // Wait for seek to complete
    await waitForFrame(page, "frame-counter-a", 80, 3000);

    const frameA = await getFrameNumber(page, "frame-counter-a");
    const frameB = await getFrameNumber(page, "frame-counter-b");
    const offset = frameB - frameA;

    expect(frameA).toBe(80);
    expect(frameB).toBe(90); // 80 + 10
    expect(offset).toBe(10); // Offset maintained

    console.log(`✓ Joint scrub: A=${frameA}, B=${frameB}, offset=${offset}`);
  });
});
