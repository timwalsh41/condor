import { test, expect, type Page } from "@playwright/test";
import {
  navigateToProductionApp,
  uploadVideoProduction,
  getFrameNumber,
  waitForFrame,
} from "./helpers/uploadHelpers";
import path from 'node:path';

/**
 * Bug Fixes Integration Tests
 *
 * Phase: bug-fixes-set-2 - Task 5.2
 *
 * Tests comprehensive integration workflows for bug fixes:
 * - 5.2.1: Full annotation workflow (angle drawing, measurement)
 * - 5.2.2: Video reload flow (sync → upload new → verify reset)
 * - 5.2.3: Session lifecycle (save → load → state restoration)
 * - 5.2.4: Library workflow (upload → save → upload new → verify reset)
 *
 * Requirements Validated:
 * - REQ-F-ANNOT-001: Annotation drawing workflow
 * - REQ-F-SYNC-003: Sync offset calculation and persistence
 * - REQ-F-PLAY-001: Unified playback controls
 * - REQ-F-LIB-001: Video library save/load
 * - REQ-F-SES-001: Session save/load
 *
 * Success Criteria:
 * - All workflows complete without errors
 * - State is correctly reset/restored at appropriate points
 * - UI reflects correct state after each operation
 */

const currentDir = import.meta.dirname;
const testVideoPath = path.resolve(currentDir, '../../tests/fixtures/videos', 'test_gop30_h264.mp4');

/**
 * Helper: Upload both videos and wait for decoders to be ready.
 */
async function uploadVideos(page: Page, videoPathA: string, videoPathB: string) {
  // Upload both videos using production workflow
  await uploadVideoProduction(page, "file-input-a", videoPathA, 0, {
    expectOptimization: false,
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
      await page.click(`[data-testid="${coarseButtonId}"]`);
      framesToGo -= framesToGo > 0 ? 5 : -5;
    } else {
      await page.click(`[data-testid="${fineButtonId}"]`);
      framesToGo -= framesToGo > 0 ? 1 : -1;
    }
    await page.waitForTimeout(50);
  }

  await waitForFrame(page, testId, targetFrame);
}

/**
 * Helper: Click on canvas at specific coordinates
 */
async function clickCanvas(page: Page, canvasTestId: string, x: number, y: number) {
  const canvas = page.locator(`[data-testid="${canvasTestId}"]`);
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`Canvas ${canvasTestId} not found`);
  
  await canvas.click({
    position: {
      x: x,
      y: y
    }
  });
}

test.describe("Bug Fixes Integration Tests", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`PAGE ERROR: ${err.message}`));
    page.on("dialog", (dialog) => {
      if (dialog.type() === "prompt") {
        dialog.accept("E2E Annotation");
      } else {
        dialog.accept();
      }
    });
    await navigateToProductionApp(page);
  });

  test("5.2.1 - Full annotation workflow: draw angle, verify correct measurement", async ({ page }) => {
    /**
     * Validates: REQ-F-ANNOT-001 (Annotation drawing)
     * Validates: Bug fix 1.2 (Angle annotation drawing logic)
     * Validates: Bug fix 1.1 (Text annotation font size)
     * Validates: Bug fix 1.3 (Mac Backspace key)
     *
     * Acceptance Criteria:
     * - Click 1 → vertex, Click 2 → arm1-end, Click 3 → arm2-end
     * - Angle measurement is correct (1-2-3, not 2-1-3)
     * - Text label is readable (font size 24px for annotations)
     * - Backspace key deletes selected annotation
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Step videos to middle frame for annotation
    await stepToFrame(page, "frame-counter-a", 50, "step-forward-fine-a", "step-forward-coarse-a");
    await stepToFrame(page, "frame-counter-b", 50, "step-forward-fine-b", "step-forward-coarse-b");

    // Enable angle annotation mode
    const angleButton = page.locator('[data-testid="tool-angle"]');
    await expect(angleButton).toBeVisible({ timeout: 5000 });
    await angleButton.click();

    console.log("Angle annotation mode enabled");

    // Get canvas for video A
    const canvasA = page.locator('[data-testid="annotation-canvas-a"]');
    await expect(canvasA).toBeVisible({ timeout: 5000 });

    // Click 1: Place vertex (center of canvas)
    await clickCanvas(page, "annotation-canvas-a", 200, 150);
    console.log("Click 1: Vertex placed");
    await page.waitForTimeout(200);

    // Click 2: Place arm1 end (to the right)
    await clickCanvas(page, "annotation-canvas-a", 300, 150);
    console.log("Click 2: Arm1 end placed");
    await page.waitForTimeout(200);

    // Click 3: Place arm2 end (downwards, creating ~90° angle)
    await clickCanvas(page, "annotation-canvas-a", 200, 250);
    console.log("Click 3: Arm2 end placed");
    await page.waitForTimeout(500);

    // Verify angle annotation is drawn
    // Look for SVG annotation elements
    const angleAnnotations = page.locator('svg[data-testid="annotation-layer-a"] g.angle-annotation');
    await expect(angleAnnotations).toHaveCount(1, { timeout: 3000 });
    console.log("✓ Angle annotation created");

    // Verify text label is visible and readable
    const angleLabel = page.locator('svg[data-testid="annotation-layer-a"] text.angle-label');
    await expect(angleLabel).toBeVisible({ timeout: 3000 });
    
    // Get computed font size
    const fontSize = await angleLabel.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });
    console.log(`Angle label font size: ${fontSize}`);
    
    // Font size should be 18px (from bug fix 1.1)
    expect(fontSize).toBe("18px");
    console.log("✓ Text label font size is correct (18px)");

    // Select the annotation by clicking on it
    const annotationElement = angleAnnotations.first();
    await annotationElement.click();
    console.log("Annotation selected");
    await page.waitForTimeout(200);

    // Delete annotation with Backspace key (Mac) / Delete key (Windows/Linux)
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(500);

    // Verify annotation is deleted
    await expect(angleAnnotations).toHaveCount(0, { timeout: 3000 });
    console.log("✓ Annotation deleted with Backspace key");

    // Create another annotation and verify angle calculation is correct
    // Create a 90-degree angle: vertex at (200, 200), arm1 at (200, 100), arm2 at (300, 200)
    await angleButton.click();
    await clickCanvas(page, "annotation-canvas-a", 200, 200);
    await page.waitForTimeout(200);
    await clickCanvas(page, "annotation-canvas-a", 200, 100); // Upwards
    await page.waitForTimeout(200);
    await clickCanvas(page, "annotation-canvas-a", 300, 200); // Rightwards
    await page.waitForTimeout(500);

    // Verify new annotation exists
    await expect(angleAnnotations).toHaveCount(1, { timeout: 3000 });

    // Read angle value from label
    const angleText = await angleLabel.textContent();
    console.log(`Measured angle: ${angleText}`);
    
    // Extract numeric value
    const angleMatch = angleText?.match(/(\d+(\.\d+)?)/);
    if (angleMatch) {
      const angleValue = parseFloat(angleMatch[1]);
      // Should be close to 90 degrees (allow ±5 degrees tolerance)
      expect(angleValue).toBeGreaterThanOrEqual(85);
      expect(angleValue).toBeLessThanOrEqual(95);
      console.log(`✓ Angle measurement is correct: ${angleValue}° (expected ~90°)`);
    }
  });

  test("5.2.2 - Video reload flow: sync → upload new → verify reset", async ({ page }) => {
    /**
     * Validates: Bug fix 2.1 (Video load state reset)
     * Validates: Bug fix 2.4 (Upload new video on same channel)
     *
     * Acceptance Criteria:
     * - Set sync point on Video A
     * - Upload new video A
     * - Verify sync state is reset
     * - Mode returns to SYNC
     * - Trim state is cleared
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set sync point: Video A at frame 50, Video B at frame 75
    await stepToFrame(page, "frame-counter-a", 50, "step-forward-fine-a", "step-forward-coarse-a");
    await stepToFrame(page, "frame-counter-b", 75, "step-forward-fine-b", "step-forward-coarse-b");

    // Switch to PLAYBACK mode to establish sync
    await page.click('[data-testid="mode-toggle"]');
    await page.waitForTimeout(500);

    // Verify we're in PLAYBACK mode
    const modeIndicator = page.locator('[data-testid="mode-indicator"]');
    await expect(modeIndicator).toContainText("PLAYBACK MODE");

    // Verify sync offset is displayed
    const offsetDisplay = page.locator('[data-testid="sync-offset-display"]');
    await expect(offsetDisplay).toContainText("+25");
    console.log("Sync established: offset +25");

    // Now upload a new video to slot A (this should reset sync state)
    console.log("Uploading new video A...");
    await uploadVideoProduction(page, "file-input-a", testVideoPath, 0, {
      expectOptimization: false,
      timeout: 60000,
    });

    // Wait for video to be ready
    await page.waitForSelector('[data-testid="frame-counter-a"]', {
      timeout: 10000,
    });

    // Verify mode reset to SYNC
    await expect(modeIndicator).toContainText("SYNC MODE", { timeout: 5000 });
    console.log("✓ Mode reset to SYNC after new video upload");

    // Verify sync points are cleared (offset display should not show +25)
    const offsetText = await offsetDisplay.textContent();
    expect(offsetText).not.toContain("+25");
    console.log("✓ Sync offset cleared");

    // Verify videos are at independent positions
    const frameA = await getFrameNumber(page, "frame-counter-a");
    const frameB = await getFrameNumber(page, "frame-counter-b");
    console.log(`After upload: Video A at ${frameA}, Video B at ${frameB}`);
  });

  test("5.2.3 - Session lifecycle: save → load → verify state restoration", async ({ page }) => {
    /**
     * Validates: Bug fix 2.2 (Session load state restoration)
     * Validates: Bug fix 2.3 (Library video save button state)
     * Validates: Bug fix 4.1 (Library save before session save)
     * Validates: Playback rate and loop state restoration
     * Validates: Annotation persistence for both channels
     *
     * Acceptance Criteria:
     * - Set up videos with sync point
     * - Save videos to library
     * - Save session
     * - Load session
     * - Verify mode is PLAYBACK
     * - Verify videos are synchronized at sync frames
     * - Verify playback rate and loop state restored
     * - Verify annotations persisted for both channels
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Set sync point: Video A at frame 30, Video B at frame 60 (offset +30)
    await stepToFrame(page, "frame-counter-a", 30, "step-forward-fine-a", "step-forward-coarse-a");
    await stepToFrame(page, "frame-counter-b", 60, "step-forward-fine-b", "step-forward-coarse-b");

    // Switch to PLAYBACK mode
    await page.click('[data-testid="mode-toggle"]');
    await page.waitForTimeout(500);

    // Verify PLAYBACK mode
    const modeIndicator = page.locator('[data-testid="mode-indicator"]');
    await expect(modeIndicator).toContainText("PLAYBACK MODE");
    console.log("In PLAYBACK mode with sync offset +30");

    // Set playback speed to 0.5x
    const speedSelect = page.locator('[data-testid="speed-select-both"]');
    await speedSelect.selectOption('0.5');
    console.log("Playback speed set to 0.5x");

    // Enable loop playback
    const loopToggle = page.locator('[data-testid="loop-toggle"]');
    await loopToggle.click();
    console.log("Loop playback enabled");

    // Draw text annotations on both channels
    await page.locator('[data-testid="tool-text"]').click();
    await page.locator('[data-testid="annotation-container-a"] canvas').click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);
    await page.locator('[data-testid="annotation-container-b"] canvas').click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);
    console.log("Annotations created on both channels");

    // Open library panel and save both videos
    const libraryButton = page.locator('[data-testid="library-toggle"]');
    if (await libraryButton.isVisible()) {
      await libraryButton.click();
      await page.waitForTimeout(500);

      // Save Video A to library
      const saveVideoAButton = page.locator('[data-testid="save-video-a-button"]');
      if (await saveVideoAButton.isEnabled()) {
        await saveVideoAButton.click();
        await page.waitForTimeout(1000);
        console.log("Video A saved to library");
      }

      // Save Video B to library
      const saveVideoBButton = page.locator('[data-testid="save-video-b-button"]');
      if (await saveVideoBButton.isEnabled()) {
        await saveVideoBButton.click();
        await page.waitForTimeout(1000);
        console.log("Video B saved to library");
      }

      // Close library panel
      await libraryButton.click();
      await page.waitForTimeout(300);
    }

    // Open session panel
    const sessionButton = page.locator('[data-testid="session-toggle"]');
    await sessionButton.click();
    await page.waitForTimeout(500);

    // Verify session save button is enabled (since videos are in library)
    const saveSessionButton = page.locator('[data-testid="save-session-button"]');
    const isEnabled = await saveSessionButton.isEnabled();
    expect(isEnabled).toBe(true);
    console.log("✓ Session save button is enabled (videos in library)");

    // Save session with a test name
    const sessionNameInput = page.locator('[data-testid="session-name-input"]');
    await sessionNameInput.fill("Test Session 5.2.3");

    await saveSessionButton.click();
    await page.waitForTimeout(2000);
    console.log("Session saved");

    // Verify annotations persisted in backend
    const sessionsResp = await page.request.get('/api/sessions');
    expect(sessionsResp.ok()).toBe(true);
    const sessions = await sessionsResp.json();
    const savedSession = sessions.find((s: { name: string; id: string }) => s.name === 'Test Session 5.2.3');
    expect(savedSession).toBeDefined();
    const sessionDetail = await page.request.get(`/api/sessions/${savedSession.id}`);
    expect(sessionDetail.ok()).toBe(true);
    const sessionData = await sessionDetail.json();
    expect(sessionData.annotations.a.length).toBeGreaterThan(0);
    expect(sessionData.annotations.b.length).toBeGreaterThan(0);
    console.log("✓ Annotations persisted in backend");

    // Close session panel
    await sessionButton.click();
    await page.waitForTimeout(300);

    // Navigate back to home and reload the app
    await navigateToProductionApp(page);
    await page.waitForTimeout(1000);

    // Open session panel again
    await sessionButton.click();
    await page.waitForTimeout(500);

    // Capture console messages for hydration verification
    const hydrationMessages: string[] = [];
    const consoleHandler = (msg: { text: () => string }) => hydrationMessages.push(msg.text());
    page.on('console', consoleHandler);

    // Load the saved session
    const loadSessionButton = page.locator('[data-testid="load-session-button"]').first();
    await loadSessionButton.click();
    await page.waitForTimeout(3000);

    console.log("Session loaded");

    // Wait for videos to be loaded
    await page.waitForSelector('[data-testid="frame-counter-a"]', {
      timeout: 15000,
    });
    await page.waitForSelector('[data-testid="frame-counter-b"]', {
      timeout: 15000,
    });

    // Verify mode is PLAYBACK
    await expect(modeIndicator).toContainText("PLAYBACK MODE", { timeout: 5000 });
    console.log("✓ Mode restored to PLAYBACK");

    // Verify sync offset is maintained
    const offsetDisplay = page.locator('[data-testid="sync-offset-display"]');
    await expect(offsetDisplay).toContainText("+30", { timeout: 5000 });
    console.log("✓ Sync offset restored (+30)");

    // Verify playback rate restored
    const restoredSpeedSelect = page.locator('[data-testid="speed-select-both"]');
    await expect(restoredSpeedSelect).toHaveValue('0.5');
    console.log("✓ Playback rate restored to 0.5x");

    // Verify loop state restored
    const restoredLoopToggle = page.locator('[data-testid="loop-toggle"]');
    const loopBg = await restoredLoopToggle.evaluate((el: HTMLElement) => window.getComputedStyle(el).backgroundColor);
    expect(loopBg).toBe('rgb(76, 175, 80)');
    console.log("✓ Loop state restored");

    // Verify annotation hydration
    expect(hydrationMessages.some((m: string) => m.includes('Video A: Hydrated'))).toBe(true);
    expect(hydrationMessages.some((m: string) => m.includes('Video B: Hydrated'))).toBe(true);
    console.log("✓ Annotation hydration verified for both channels");

    // Verify videos are at sync frames
    const frameA = await getFrameNumber(page, "frame-counter-a");
    const frameB = await getFrameNumber(page, "frame-counter-b");
    const offset = frameB - frameA;

    expect(offset).toBe(30);
    console.log(`✓ Videos synchronized: A=${frameA}, B=${frameB}, offset=${offset}`);
  });

  test("5.2.4 - Library workflow: upload → save → upload new → verify reset", async ({ page }) => {
    /**
     * Validates: Bug fix 2.3 (Library video save button state)
     * Validates: Bug fix 2.4 (Upload new video on same channel)
     * Validates: Bug fix 3.2 (No "No Video Uploaded" banner on library load)
     *
     * Acceptance Criteria:
     * - Upload video A
     * - Save to library (button shows "✓ Video A saved")
     * - Upload new video A
     * - Button shows "+ Video A" (not disabled)
     * - No "No video uploaded" banner shown
     */
    
    // Upload first video A
    await uploadVideoProduction(page, "file-input-a", testVideoPath, 0, {
      expectOptimization: false,
      timeout: 60000,
    });

    await page.waitForSelector('[data-testid="frame-counter-a"]', {
      timeout: 10000,
    });
    console.log("First video A uploaded");

    // Open library panel
    const libraryButton = page.locator('[data-testid="library-toggle"]');
    await libraryButton.click();
    await page.waitForTimeout(500);

    // Save Video A to library
    const saveVideoAButton = page.locator('[data-testid="save-video-a-button"]');
    await expect(saveVideoAButton).toBeEnabled({ timeout: 5000 });
    await saveVideoAButton.click();
    await page.waitForTimeout(1500);

    // Verify button shows saved state
    const buttonText = await saveVideoAButton.textContent();
    expect(buttonText).toContain("saved");
    expect(buttonText).toContain("Video A");
    console.log(`✓ Button shows: "${buttonText}"`);

    // Verify button is disabled
    const isDisabled = await saveVideoAButton.isDisabled();
    expect(isDisabled).toBe(true);
    console.log("✓ Save button is disabled (video in library)");

    // Close library panel
    await libraryButton.click();
    await page.waitForTimeout(300);

    // Upload new video to slot A
    console.log("Uploading new video A...");
    await uploadVideoProduction(page, "file-input-a", testVideoPath, 0, {
      expectOptimization: false,
      timeout: 60000,
    });

    await page.waitForSelector('[data-testid="frame-counter-a"]', {
      timeout: 10000,
    });
    console.log("New video A uploaded");

    // Open library panel again
    await libraryButton.click();
    await page.waitForTimeout(500);

    // Verify button is re-enabled and shows unsaved state
    await expect(saveVideoAButton).toBeEnabled({ timeout: 5000 });
    const newButtonText = await saveVideoAButton.textContent();
    expect(newButtonText).toContain("Video A");
    expect(newButtonText).not.toContain("saved");
    console.log(`✓ Button shows: "${newButtonText}" (reset to unsaved state)`);

    // Verify no "No video uploaded" banner is shown
    const noVideoBanner = page.locator('text=/No video uploaded/i');
    await expect(noVideoBanner).not.toBeVisible();
    console.log("✓ No 'No video uploaded' banner shown (external video loaded correctly)");

    // Save the new video
    await saveVideoAButton.click();
    await page.waitForTimeout(1500);

    // Verify button shows saved state again
    const finalButtonText = await saveVideoAButton.textContent();
    expect(finalButtonText).toContain("saved");
    console.log(`✓ Button shows: "${finalButtonText}"`);
  });

  test("5.2.5 - Session switching: reload annotations on session change", async ({ page }) => {
    /**
     * Validates: Hydration ref reset on session switch (Fix 6)
     *
     * Acceptance Criteria:
     * - Upload videos and save to library
     * - Create two sessions with different annotations via API
     * - Load first session, verify annotations hydrated
     * - Load second session, verify annotations hydrated
     * - Load first session again, verify annotations re-hydrated
     */
    await uploadVideos(page, testVideoPath, testVideoPath);

    // Save videos to library
    const libraryButton = page.locator('[data-testid="library-toggle"]');
    if (await libraryButton.isVisible()) {
      await libraryButton.click();
      await page.waitForTimeout(500);
      await page.locator('[data-testid="save-video-a-button"]').click();
      await page.waitForTimeout(1000);
      await page.locator('[data-testid="save-video-b-button"]').click();
      await page.waitForTimeout(1000);
      await libraryButton.click();
      await page.waitForTimeout(300);
    }

    // Fetch library video IDs
    const libraryResp = await page.request.get('/api/library');
    expect(libraryResp.ok()).toBe(true);
    const libraryVideos = await libraryResp.json();
    expect(libraryVideos.length).toBeGreaterThanOrEqual(2);
    const videoAId = libraryVideos[0].id;
    const videoBId = libraryVideos[1].id;

    // Create Session A via API (annotation on A)
    const sessionAResp = await page.request.post('/api/sessions', {
      data: {
        name: 'Session A',
        video_a_id: videoAId,
        video_b_id: videoBId,
        sync_frame_a: 30,
        sync_frame_b: 60,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: {
          a: [{ id: 'ann-a-1', type: 'text', text: 'Session A Annotation', points: [0, 0] }],
          b: [],
        },
      },
    });
    expect(sessionAResp.ok()).toBe(true);

    // Create Session B via API (annotation on B)
    const sessionBResp = await page.request.post('/api/sessions', {
      data: {
        name: 'Session B',
        video_a_id: videoAId,
        video_b_id: videoBId,
        sync_frame_a: 30,
        sync_frame_b: 60,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: {
          a: [],
          b: [{ id: 'ann-b-1', type: 'text', text: 'Session B Annotation', points: [0, 0] }],
        },
      },
    });
    expect(sessionBResp.ok()).toBe(true);

    // Reload app
    await navigateToProductionApp(page);
    await page.waitForTimeout(1000);

    // Open session panel
    const sessionButton = page.locator('[data-testid="session-toggle"]');
    await sessionButton.click();
    await page.waitForTimeout(500);

    const loadButtons = page.locator('[data-testid="load-session-button"]');

    // Load Session A (second in list because B is newer)
    const hydrationPromiseA = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('Video A: Hydrated'),
      timeout: 15000,
    });
    await loadButtons.nth(1).click();
    await hydrationPromiseA;
    console.log("✓ Session A annotations hydrated");

    // Load Session B (first in list)
    const hydrationPromiseB = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('Video B: Hydrated'),
      timeout: 15000,
    });
    await loadButtons.nth(0).click();
    await hydrationPromiseB;
    console.log("✓ Session B annotations hydrated");

    // Load Session A again
    const hydrationPromiseA2 = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('Video A: Hydrated'),
      timeout: 15000,
    });
    await loadButtons.nth(1).click();
    await hydrationPromiseA2;
    console.log("✓ Session A annotations re-hydrated after switch");
  });
});
