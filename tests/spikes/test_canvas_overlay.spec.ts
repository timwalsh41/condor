import { test, expect } from "@playwright/test";

/**
 * Canvas Overlay Spike Tests
 *
 * Phase 0 - Task 0.5: Validates annotation canvas overlay alignment over WebCodecs video
 *
 * Requirements Validated:
 * - REQ-F-ANNOT-002: Annotation Rendering (canvas overlay positioned exactly over video)
 * - REQ-NF-P-002: Annotation Performance (baseline - alignment validation)
 *
 * Success Criteria:
 * - Annotation canvas positioned exactly over video canvas (pixel-perfect alignment)
 * - Canvas dimensions match video display dimensions
 * - Alignment maintained on window resize
 * - Tests pass in Chrome, Firefox, WebKit
 *
 * Test Strategy:
 * - Use test_gop30_h264.mp4 (5s, 150 frames, GOP=30, 1280x720)
 * - Verify bounding box alignment (±1px tolerance for sub-pixel rendering)
 * - Test responsive behavior on resize
 */

/**
 * Helper: Navigate to dual video demo and wait for it to be ready
 */
async function navigateToDualVideoDemo(page: any) {
  await page.goto("/");

  // Click "Dual Video Sync Demo" button
  await page.click("text=Dual Video Sync Demo (Task 0.4)");

  // Wait for component to be visible
  await page.waitForSelector('[data-testid="mode-indicator"]', {
    timeout: 5000,
  });

  console.log("Dual video demo loaded");
}

/**
 * Helper: Upload video to Video A slot
 */
async function uploadVideoA(page: any, videoPath: string) {
  const fileInputA = page.locator('[data-testid="file-input-a"]');
  await fileInputA.setInputFiles(videoPath);

  // Wait for decoder to be ready
  await page.waitForSelector('[data-testid="frame-counter-a"]', {
    timeout: 10000,
  });

  // Wait for initial frame to be decoded
  await page.waitForFunction(
    () => {
      const counterA = document.querySelector('[data-testid="frame-counter-a"]');
      return counterA?.textContent?.includes("Frame");
    },
    { timeout: 5000 }
  );

  console.log("Video A loaded and decoder ready");
}

/**
 * Helper: Get bounding box for an element
 */
async function getBoundingBox(page: any, selector: string) {
  return await page.evaluate((sel: string) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
    };
  }, selector);
}

test.describe("Canvas Overlay Alignment", () => {
  const TEST_VIDEO_PATH = "tests/fixtures/videos/test_gop30_h264.mp4";

  test("annotation canvas exists over video A", async ({ page }) => {
    await navigateToDualVideoDemo(page);
    await uploadVideoA(page, TEST_VIDEO_PATH);

    // Check that we have exactly 2 canvases in Video A section
    const canvasCount = await page.evaluate(() => {
      const videoCanvas = document.querySelector('[data-testid="video-canvas-a"]');
      if (!videoCanvas) return 0;

      const container = videoCanvas.parentElement;
      if (!container) return 0;

      const canvases = container.querySelectorAll('canvas');
      return canvases.length;
    });

    expect(canvasCount).toBe(2);
    console.log("✓ Video A has 2 canvases (video + annotation overlay)");
  });

  test("annotation canvas aligns exactly with video canvas", async ({ page }) => {
    await navigateToDualVideoDemo(page);
    await uploadVideoA(page, TEST_VIDEO_PATH);

    // Get bounding boxes for both canvases
    const result = await page.evaluate(() => {
      const videoCanvas = document.querySelector('[data-testid="video-canvas-a"]') as HTMLCanvasElement;
      const container = videoCanvas?.parentElement;
      const canvases = container?.querySelectorAll('canvas');
      const annotationCanvas = canvases?.[1] as HTMLCanvasElement;

      if (!videoCanvas || !annotationCanvas) {
        return { error: "Canvases not found" };
      }

      const videoBox = videoCanvas.getBoundingClientRect();
      const annotationBox = annotationCanvas.getBoundingClientRect();

      return {
        video: {
          top: videoBox.top,
          left: videoBox.left,
          width: videoBox.width,
          height: videoBox.height,
        },
        annotation: {
          top: annotationBox.top,
          left: annotationBox.left,
          width: annotationBox.width,
          height: annotationBox.height,
        },
      };
    });

    expect(result).not.toHaveProperty("error");

    // Allow ±1px tolerance for sub-pixel rendering
    const tolerance = 1;

    expect(Math.abs(result.video.top - result.annotation.top)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(result.video.left - result.annotation.left)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(result.video.width - result.annotation.width)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(result.video.height - result.annotation.height)).toBeLessThanOrEqual(tolerance);

    console.log("✓ Canvas alignment verified:");
    console.log(`  Video:      ${Math.round(result.video.width)}x${Math.round(result.video.height)} at (${Math.round(result.video.left)}, ${Math.round(result.video.top)})`);
    console.log(`  Annotation: ${Math.round(result.annotation.width)}x${Math.round(result.annotation.height)} at (${Math.round(result.annotation.left)}, ${Math.round(result.annotation.top)})`);
  });

  test("annotation canvas has correct internal dimensions", async ({ page }) => {
    await navigateToDualVideoDemo(page);
    await uploadVideoA(page, TEST_VIDEO_PATH);

    const dimensions = await page.evaluate(() => {
      const videoCanvas = document.querySelector('[data-testid="video-canvas-a"]') as HTMLCanvasElement;
      const container = videoCanvas?.parentElement;
      const canvases = container?.querySelectorAll('canvas');
      const annotationCanvas = canvases?.[1] as HTMLCanvasElement;

      if (!videoCanvas || !annotationCanvas) {
        return { error: "Canvases not found" };
      }

      return {
        video: {
          internal: { width: videoCanvas.width, height: videoCanvas.height },
          display: { width: videoCanvas.clientWidth, height: videoCanvas.clientHeight },
        },
        annotation: {
          internal: { width: annotationCanvas.width, height: annotationCanvas.height },
          display: { width: annotationCanvas.clientWidth, height: annotationCanvas.clientHeight },
        },
      };
    });

    expect(dimensions).not.toHaveProperty("error");

    // Video internal dimensions should be 1280x720 for test video
    expect(dimensions.video.internal.width).toBe(1280);
    expect(dimensions.video.internal.height).toBe(720);

    // Annotation internal dimensions should match video metadata (not necessarily same as video canvas due to HiDPI)
    // But should be either 1280x720 or scaled version (640x360 for 2x DPR)
    const annotationWidth = dimensions.annotation.internal.width;
    const annotationHeight = dimensions.annotation.internal.height;

    // Accept either full resolution or half resolution (HiDPI scaling)
    const validWidths = [1280, 640];
    const validHeights = [720, 360];

    expect(validWidths).toContain(annotationWidth);
    expect(validHeights).toContain(annotationHeight);

    // Display dimensions should match exactly (±1px tolerance)
    expect(Math.abs(dimensions.video.display.width - dimensions.annotation.display.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(dimensions.video.display.height - dimensions.annotation.display.height)).toBeLessThanOrEqual(1);

    console.log("✓ Canvas dimensions verified:");
    console.log(`  Video internal:      ${dimensions.video.internal.width}x${dimensions.video.internal.height}`);
    console.log(`  Video display:       ${Math.round(dimensions.video.display.width)}x${Math.round(dimensions.video.display.height)}`);
    console.log(`  Annotation internal: ${dimensions.annotation.internal.width}x${dimensions.annotation.internal.height}`);
    console.log(`  Annotation display:  ${Math.round(dimensions.annotation.display.width)}x${Math.round(dimensions.annotation.display.height)}`);
  });

  test("annotation canvas maintains alignment on window resize", async ({ page }) => {
    await navigateToDualVideoDemo(page);
    await uploadVideoA(page, TEST_VIDEO_PATH);

    // Get initial alignment
    const getAlignment = async () => {
      return await page.evaluate(() => {
        const videoCanvas = document.querySelector('[data-testid="video-canvas-a"]') as HTMLCanvasElement;
        const container = videoCanvas?.parentElement;
        const canvases = container?.querySelectorAll('canvas');
        const annotationCanvas = canvases?.[1] as HTMLCanvasElement;

        if (!videoCanvas || !annotationCanvas) return null;

        const videoBox = videoCanvas.getBoundingClientRect();
        const annotationBox = annotationCanvas.getBoundingClientRect();

        return {
          widthDiff: Math.abs(videoBox.width - annotationBox.width),
          heightDiff: Math.abs(videoBox.height - annotationBox.height),
          topDiff: Math.abs(videoBox.top - annotationBox.top),
          leftDiff: Math.abs(videoBox.left - annotationBox.left),
        };
      });
    };

    // Check initial alignment
    const initialAlignment = await getAlignment();
    expect(initialAlignment).not.toBeNull();
    expect(initialAlignment!.widthDiff).toBeLessThanOrEqual(1);
    expect(initialAlignment!.heightDiff).toBeLessThanOrEqual(1);

    // Resize viewport to trigger responsive scaling
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(100); // Allow resize event to propagate

    // Check alignment after resize
    const resizedAlignment = await getAlignment();
    expect(resizedAlignment).not.toBeNull();
    expect(resizedAlignment!.widthDiff).toBeLessThanOrEqual(1);
    expect(resizedAlignment!.heightDiff).toBeLessThanOrEqual(1);
    expect(resizedAlignment!.topDiff).toBeLessThanOrEqual(1);
    expect(resizedAlignment!.leftDiff).toBeLessThanOrEqual(1);

    // Resize to a different size
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(100);

    // Check alignment after second resize
    const finalAlignment = await getAlignment();
    expect(finalAlignment).not.toBeNull();
    expect(finalAlignment!.widthDiff).toBeLessThanOrEqual(1);
    expect(finalAlignment!.heightDiff).toBeLessThanOrEqual(1);
    expect(finalAlignment!.topDiff).toBeLessThanOrEqual(1);
    expect(finalAlignment!.leftDiff).toBeLessThanOrEqual(1);

    console.log("✓ Canvas alignment maintained through window resize");
  });

  test("annotation canvas has pointer-events disabled (initially)", async ({ page }) => {
    await navigateToDualVideoDemo(page);
    await uploadVideoA(page, TEST_VIDEO_PATH);

    const pointerEvents = await page.evaluate(() => {
      const videoCanvas = document.querySelector('[data-testid="video-canvas-a"]') as HTMLCanvasElement;
      const container = videoCanvas?.parentElement;
      const wrapper = container?.querySelector('div[style*="position: absolute"]') as HTMLElement;

      if (!wrapper) return null;

      return window.getComputedStyle(wrapper).pointerEvents;
    });

    expect(pointerEvents).toBe("none");
    console.log("✓ Annotation canvas has pointer-events: none (will be enabled in subtask 0.5.2)");
  });
});
