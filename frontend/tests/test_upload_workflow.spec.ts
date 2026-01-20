import { test, expect } from "@playwright/test";
import {
  navigateToProductionApp,
  uploadVideoProduction,
  waitForUploadState,
  verifyAnalyzingProgress,
  cancelRotationModal,
} from "./helpers/uploadHelpers";

/**
 * Video Upload Workflow Tests
 *
 * Phase 1 - Task 1.3.5: Production upload workflow E2E tests
 *
 * Requirements Validated:
 * - REQ-F-UPLOAD-001: Local File Upload (file selection, validation, backend processing)
 * - REQ-F-UPLOAD-004: Video Rotation During Upload (rotation modal workflow)
 * - Task 1.3.4: Async GOP detection with progress reporting
 *
 * Success Criteria:
 * - Upload workflow completes successfully for GOP=30 videos (analyzing → complete)
 * - Upload workflow completes successfully for GOP>30 videos (analyzing → processing → complete)
 * - Rotation triggers optimization even for GOP=30 videos
 * - GOP detection progress reporting works (intermediate values visible)
 * - State transitions are correct
 * - Rotation modal can be accepted or canceled
 *
 * Test Strategy:
 * - Use production upload workflow (VideoUploadWorkflow component)
 * - Backend must be running (http://localhost:8000)
 * - Test various video types: GOP=30 H.264, GOP>30 H.264, HEVC
 * - Verify state transitions and progress reporting
 */

test.describe("Upload Workflow - GOP Detection Progress", () => {
  test.beforeEach(async ({ page }) => {
    // Listen to console messages for debugging
    page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`PAGE ERROR: ${err.message}`));

    await navigateToProductionApp(page);
  });

  test("GOP=30 video: analyzing → complete (no processing)", async ({ page }) => {
    /**
     * Validates: GOP detection correctly identifies optimized videos
     * Acceptance Criteria: GOP=30 videos skip processing phase
     */
    const videoPath = "../tests/fixtures/videos/test_gop30_h264.mp4";

    await uploadVideoProduction(page, "file-input-a", videoPath, 0, {
      expectOptimization: false, // GOP=30 should not need optimization
      timeout: 60000,
    });

    // Verify video metadata is displayed (signals completion)
    const metadata = page.locator('[data-testid="video-metadata-a"]');
    await expect(metadata).toBeVisible({ timeout: 5000 });

    // Verify metadata contains expected info
    const metadataText = await metadata.textContent();
    expect(metadataText).toContain("fps");
    expect(metadataText).toContain("Codec");

    console.log("✓ GOP=30 video completed without processing");
  });

  test("GOP>30 video: analyzing → processing → complete", async ({ page }) => {
    /**
     * Validates: GOP detection triggers optimization for videos needing it
     * Acceptance Criteria: GOP>30 videos go through processing phase
     */
    const videoPath = "../tests/fixtures/videos/test_gop250_h264.mp4";

    await uploadVideoProduction(page, "file-input-a", videoPath, 0, {
      expectOptimization: true, // GOP=250 needs optimization
      timeout: 90000, // Longer timeout for processing
    });

    // Verify completion
    const metadata = page.locator('[data-testid="video-metadata-a"]');
    await expect(metadata).toBeVisible({ timeout: 5000 });

    console.log("✓ GOP=250 video completed with processing");
  });

  test("HEVC video: analyzing → processing → complete", async ({ page }) => {
    /**
     * Validates: HEVC videos are converted to H.264
     * Acceptance Criteria: HEVC videos go through processing phase
     */
    const videoPath = "../tests/fixtures/videos/test_gop30_hevc.mp4";

    await uploadVideoProduction(page, "file-input-a", videoPath, 0, {
      expectOptimization: true, // HEVC needs transcoding to H.264
      timeout: 90000,
    });

    // Verify completion
    const metadata = page.locator('[data-testid="video-metadata-a"]');
    await expect(metadata).toBeVisible({ timeout: 5000 });

    // Verify codec is now H.264 (transcoded from HEVC)
    const metadataText = await metadata.textContent();
    expect(metadataText?.toLowerCase()).toContain("h264");

    console.log("✓ HEVC video transcoded to H.264");
  });

  test("verifies analyzing progress reporting", async ({ page }) => {
    /**
     * Validates: Task 1.3.4 - GOP detection progress reporting
     * Acceptance Criteria: Can observe intermediate progress values during analyzing state
     */
    const videoPath = "../tests/fixtures/videos/test_gop250_h264.mp4";

    // Start upload
    const fileInput = page.locator('[data-testid="file-input-a"]');
    await fileInput.setInputFiles(videoPath);

    // Wait for rotation modal and accept
    await page.waitForSelector('[data-testid="rotation-modal-content"]', { timeout: 5000 });
    await page.click('[data-testid="rotation-confirm-button"]');

    // Verify analyzing progress
    await verifyAnalyzingProgress(page, "A");

    console.log("✓ GOP detection progress reporting verified");

    // Wait for upload to complete
    await waitForUploadState(page, "A", "complete", 90000);
  });
});

test.describe("Upload Workflow - Rotation", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
    await navigateToProductionApp(page);
  });

  test("rotation modal appears and can be accepted", async ({ page }) => {
    /**
     * Validates: REQ-F-UPLOAD-004 (rotation modal workflow)
     * Acceptance Criteria: Rotation modal appears, can select rotation, and accept
     */
    const videoPath = "../tests/fixtures/videos/test_gop30_h264.mp4";

    // Select file
    const fileInput = page.locator('[data-testid="file-input-a"]');
    await fileInput.setInputFiles(videoPath);

    // Wait for rotation modal
    await page.waitForSelector('[data-testid="rotation-modal-content"]', { timeout: 5000 });

    // Verify modal is visible
    const modal = page.locator('[data-testid="rotation-modal-content"]');
    await expect(modal).toBeVisible();

    // Verify rotation controls are present (using aria-labels since no test-ids)
    await expect(page.locator('[aria-label="No rotation (0 degrees)"]')).toBeVisible();
    await expect(page.locator('[aria-label="Rotate 90 degrees"]')).toBeVisible();
    await expect(page.locator('[aria-label="Rotate 180 degrees"]')).toBeVisible();
    await expect(page.locator('[aria-label="Rotate 270 degrees"]')).toBeVisible();
    await expect(page.locator('[data-testid="rotation-confirm-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="rotation-cancel-button"]')).toBeVisible();

    // Accept without rotation
    await page.click('[data-testid="rotation-confirm-button"]');

    // Verify modal disappears
    await expect(modal).not.toBeVisible({ timeout: 2000 });

    console.log("✓ Rotation modal workflow works");

    // Wait for upload to complete
    await waitForUploadState(page, "A", "complete", 60000);
  });

  test("rotation modal can be canceled", async ({ page }) => {
    /**
     * Validates: REQ-F-UPLOAD-004 (rotation modal can be canceled)
     * Acceptance Criteria: Clicking cancel aborts upload
     */
    const videoPath = "../tests/fixtures/videos/test_gop30_h264.mp4";

    // Select file
    const fileInput = page.locator('[data-testid="file-input-a"]');
    await fileInput.setInputFiles(videoPath);

    // Wait for rotation modal
    await page.waitForSelector('[data-testid="rotation-modal-content"]', { timeout: 5000 });

    // Cancel modal
    await cancelRotationModal(page);

    // Verify upload did not proceed (file input should still be visible and idle)
    await expect(fileInput).toBeVisible({ timeout: 2000 });

    console.log("✓ Rotation modal can be canceled");
  });

  test("rotation triggers optimization even for GOP=30 videos", async ({ page }) => {
    /**
     * Validates: Rotation request triggers processing
     * Acceptance Criteria: GOP=30 video with rotation goes through processing phase
     */
    const videoPath = "../tests/fixtures/videos/test_gop30_h264.mp4";

    // Upload with 90° rotation
    await uploadVideoProduction(page, "file-input-a", videoPath, 90, {
      expectOptimization: true, // Rotation triggers processing
      timeout: 90000,
    });

    // Verify completion
    const metadata = page.locator('[data-testid="video-metadata-a"]');
    await expect(metadata).toBeVisible({ timeout: 5000 });

    console.log("✓ Rotation triggered processing for GOP=30 video");
  });
});

test.describe("Upload Workflow - Dual Video", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
    await navigateToProductionApp(page);
  });

  test("can upload two videos independently", async ({ page }) => {
    /**
     * Validates: Dual video upload workflow
     * Acceptance Criteria: Can upload to both slots A and B
     */
    const videoPathA = "../tests/fixtures/videos/test_gop30_h264.mp4";
    const videoPathB = "../tests/fixtures/videos/test_gop30_h264_10s.mp4";

    // Upload video A
    await uploadVideoProduction(page, "file-input-a", videoPathA, 0, {
      expectOptimization: false,
      timeout: 60000,
    });

    // Upload video B
    await uploadVideoProduction(page, "file-input-b", videoPathB, 0, {
      expectOptimization: false,
      timeout: 60000,
    });

    // Verify both videos are loaded
    const metadataA = page.locator('[data-testid="video-metadata-a"]');
    const metadataB = page.locator('[data-testid="video-metadata-b"]');

    await expect(metadataA).toBeVisible();
    await expect(metadataB).toBeVisible();

    // Verify frame counters are visible
    await expect(page.locator('[data-testid="frame-counter-a"]')).toBeVisible();
    await expect(page.locator('[data-testid="frame-counter-b"]')).toBeVisible();

    console.log("✓ Both videos uploaded successfully");
  });
});
