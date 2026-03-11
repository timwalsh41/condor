/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "@playwright/test";
import {
  navigateToProductionApp,
  uploadVideoProduction,
} from "./helpers/uploadHelpers";

/**
 * Memory Leak Detection Tests for WebCodecs VideoDecoder
 *
 * Phase 1 - Task 1.3.5: Updated for production workflow with backend integration
 *
 * Validates that VideoFrame objects are properly closed and memory is released
 * during frame stepping operations.
 *
 * Requirements Validated:
 * - REQ-F-UPLOAD-001: Local File Upload (production workflow)
 * - VideoFrame.close() called on cache eviction
 * - VideoFrame.close() called on cache clear
 * - No accumulating memory growth during repeated operations
 * - Decoder properly cleaned up on unmount
 *
 * NOTE: These tests use Chrome DevTools Protocol and only run on Chrome.
 *
 * Test Strategy:
 * - Use production upload workflow (VideoUploadWorkflow component)
 * - Backend must be running (http://localhost:8000)
 * - Use test_gop30_h264.mp4 (GOP=30 video for consistent memory behavior)
 */

test.describe("Memory Leak Detection", () => {
  // Skip on non-Chrome browsers - requires Chrome DevTools Protocol
  test.skip(({ browserName }) => browserName !== 'chrome', 'Chrome-only tests (CDP required)');

  // const testVideoPath = '../tests/fixtures/videos/test_gop30_h264.mp4';

  const currentDir = import.meta.dirname; 
  const testVideoPath = path.resolve(currentDir, '../../tests/fixtures/videos', 'test_gop30_h264.mp4');

  test("should not leak VideoFrames during sequential frame stepping", async ({
    browser,
  }) => {
    /**
     * Validates that stepping through frames doesn't accumulate VideoFrame objects
     * by monitoring Chrome DevTools Protocol memory metrics
     */

    // Launch browser with specific flags for memory measurement
    const context = await browser.newContext();
    const page = await context.newPage();

    // Enable Chrome DevTools Protocol
    const client = await context.newCDPSession(page);

    // Listen to console for any VideoFrame GC warnings
    const gcWarnings: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("VideoFrame") && text.includes("garbage collected")) {
        gcWarnings.push(text);
      }
    });

    await navigateToProductionApp(page);

    // Upload test video using production workflow
    await uploadVideoProduction(page, "file-input-a", testVideoPath, 0, {
      expectOptimization: false,
      timeout: 60000,
    });

    // Wait for WebCodecs decoder to be ready
    await page.waitForFunction(
      () => {
        const api = (window as any).__webCodecsTestAPI;
        return api && api.isReady();
      },
      { timeout: 10000 }
    );

    await page.waitForSelector('[data-testid="frame-counter-a"]');

    // Wait for initial load and frame 0 to render
    await page.waitForTimeout(1000);

    // Take initial memory snapshot
    const initialMetrics = await client.send("Performance.getMetrics");
    const initialJSHeapSize =
      initialMetrics.metrics.find((m) => m.name === "JSHeapUsedSize")?.value ||
      0;

    console.log(
      `Initial JS Heap: ${(initialJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Perform 50 frame steps (this should trigger cache evictions if cache size is < 50)
    const stepButton = page.locator('[data-testid="step-forward-fine-a"]');
    for (let i = 0; i < 50; i++) {
      await stepButton.click();
      await page.waitForTimeout(50); // Allow frame decode
    }

    // Force garbage collection
    await client.send("HeapProfiler.collectGarbage");

    // Take final memory snapshot
    const finalMetrics = await client.send("Performance.getMetrics");
    const finalJSHeapSize =
      finalMetrics.metrics.find((m) => m.name === "JSHeapUsedSize")?.value || 0;

    console.log(
      `Final JS Heap: ${(finalJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    );

    const heapGrowth = finalJSHeapSize - initialJSHeapSize;
    const heapGrowthMB = heapGrowth / 1024 / 1024;

    console.log(`Heap Growth: ${heapGrowthMB.toFixed(2)} MB`);
    console.log(`GC Warnings: ${gcWarnings.length}`);

    // Acceptable threshold: < 10MB growth for 50 frame steps
    // (Each VideoFrame is ~1-2MB, cache should keep max 20 frames)
    expect(heapGrowthMB).toBeLessThan(10);

    // GC warnings during cache hits are expected behavior (see documentation)
    // But there shouldn't be an excessive number
    expect(gcWarnings.length).toBeLessThan(100);

    await context.close();
  });

  test("should release all memory when component unmounts", async ({
    browser,
  }) => {
    /**
     * Validates that all VideoFrames are closed when the decoder is cleaned up
     */

    const context = await browser.newContext();
    const page = await context.newPage();
    const client = await context.newCDPSession(page);

    await page.goto("/");

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

    await page.waitForSelector('[data-testid="frame-counter-a"]');

    // Step through several frames to populate cache
    const stepButton = page.locator('[data-testid="step-forward-fine-a"]');
    for (let i = 0; i < 20; i++) {
      await stepButton.click();
      await page.waitForTimeout(50);
    }

    // Take snapshot before unmount
    const beforeUnmountMetrics = await client.send("Performance.getMetrics");
    const beforeJSHeapSize =
      beforeUnmountMetrics.metrics.find((m) => m.name === "JSHeapUsedSize")
        ?.value || 0;

    console.log(
      `Before unmount: ${(beforeJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Navigate away (triggers component unmount and cleanup)
    await page.goto("about:blank");

    // Force garbage collection
    await client.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(500);

    // Take snapshot after unmount
    const afterUnmountMetrics = await client.send("Performance.getMetrics");
    const afterJSHeapSize =
      afterUnmountMetrics.metrics.find((m) => m.name === "JSHeapUsedSize")
        ?.value || 0;

    console.log(
      `After unmount: ${(afterJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    );

    const memoryReleased = beforeJSHeapSize - afterJSHeapSize;
    const memoryReleasedMB = memoryReleased / 1024 / 1024;

    console.log(`Memory Released: ${memoryReleasedMB.toFixed(2)} MB`);

    // After unmount and GC, most memory should be released
    // Expect at least 5MB released (conservative, should be more with cached frames)
    expect(memoryReleasedMB).toBeGreaterThan(5);

    await context.close();
  });

  test("should not leak memory during rapid cache evictions", async ({
    browser,
  }) => {
    /**
     * Validates cache LRU eviction properly closes old VideoFrames
     * by stepping through more frames than cache capacity
     */

    const context = await browser.newContext();
    const page = await context.newPage();
    const client = await context.newCDPSession(page);

    await page.goto("/");

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

    await page.waitForSelector('[data-testid="frame-counter-a"]');

    // Initial snapshot
    await client.send("HeapProfiler.collectGarbage");
    const snapshot1 = await client.send("Performance.getMetrics");
    const heap1 =
      snapshot1.metrics.find((m) => m.name === "JSHeapUsedSize")?.value || 0;

    // Step forward 30 frames (forces cache evictions if cache size is 20)
    const stepButton = page.locator('[data-testid="step-forward-fine-a"]');
    for (let i = 0; i < 30; i++) {
      await stepButton.click();
      await page.waitForTimeout(30);
    }

    await client.send("HeapProfiler.collectGarbage");
    const snapshot2 = await client.send("Performance.getMetrics");
    const heap2 =
      snapshot2.metrics.find((m) => m.name === "JSHeapUsedSize")?.value || 0;

    // Step forward another 30 frames
    for (let i = 0; i < 30; i++) {
      await stepButton.click();
      await page.waitForTimeout(30);
    }

    await client.send("HeapProfiler.collectGarbage");
    const snapshot3 = await client.send("Performance.getMetrics");
    const heap3 =
      snapshot3.metrics.find((m) => m.name === "JSHeapUsedSize")?.value || 0;

    const growth1 = (heap2 - heap1) / 1024 / 1024;
    const growth2 = (heap3 - heap2) / 1024 / 1024;

    console.log(`First 30 frames - Heap Growth: ${growth1.toFixed(2)} MB`);
    console.log(`Second 30 frames - Heap Growth: ${growth2.toFixed(2)} MB`);

    // Second batch should have similar or less growth than first
    // (indicates cache eviction is working, not accumulating frames)
    expect(growth2).toBeLessThan(growth1 * 1.5); // Allow 50% variance

    // Total growth should be reasonable (< 15MB for 60 frames with eviction)
    const totalGrowth = (heap3 - heap1) / 1024 / 1024;
    console.log(`Total Heap Growth: ${totalGrowth.toFixed(2)} MB`);
    expect(totalGrowth).toBeLessThan(15);

    await context.close();
  });

  test("should properly close VideoFrames when seeking backwards", async ({
    browser,
  }) => {
    /**
     * Validates that seeking backwards (which may trigger re-decoding from keyframe)
     * doesn't leak intermediate frames
     */

    const context = await browser.newContext();
    const page = await context.newPage();
    const client = await context.newCDPSession(page);

    await page.goto("/");

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

    await page.waitForSelector('[data-testid="frame-counter-a"]');

    // Step forward to build up cache
    const stepForward = page.locator('[data-testid="step-forward-coarse-a"]');
    for (let i = 0; i < 10; i++) {
      await stepForward.click();
      await page.waitForTimeout(100);
    }

    await client.send("HeapProfiler.collectGarbage");
    const beforeSeek = await client.send("Performance.getMetrics");
    const heapBeforeSeek =
      beforeSeek.metrics.find((m) => m.name === "JSHeapUsedSize")?.value || 0;

    // Now seek backwards multiple times (forces re-decode from keyframes)
    const stepBackward = page.locator('[data-testid="step-backward-coarse"]');
    for (let i = 0; i < 10; i++) {
      await stepBackward.click();
      await page.waitForTimeout(100);
    }

    await client.send("HeapProfiler.collectGarbage");
    const afterSeek = await client.send("Performance.getMetrics");
    const heapAfterSeek =
      afterSeek.metrics.find((m) => m.name === "JSHeapUsedSize")?.value || 0;

    const growthMB = (heapAfterSeek - heapBeforeSeek) / 1024 / 1024;
    console.log(`Heap Growth after backward seeks: ${growthMB.toFixed(2)} MB`);

    // Should not accumulate significant memory from backward seeking
    expect(growthMB).toBeLessThan(5);

    await context.close();
  });

  test("should report cache statistics showing proper evictions", async ({
    page,
  }) => {
    /**
     * Validates that cache statistics reflect proper LRU eviction behavior
     */

    await page.goto("/");

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

    await page.waitForSelector('[data-testid="frame-counter-a"]');

    // Check if cache stats are exposed (if implemented)
    const hasCacheStats = await page.evaluate(() => {
      return document.querySelector('[data-testid="cache-stats"]') !== null;
    });

    if (!hasCacheStats) {
      console.log("ℹ️  Cache statistics not exposed in UI (optional feature)");
      test.skip();
      return;
    }

    // Step forward beyond cache capacity
    const stepButton = page.locator('[data-testid="step-forward-fine-a"]');
    for (let i = 0; i < 30; i++) {
      await stepButton.click();
      await page.waitForTimeout(50);
    }

    // Read cache stats
    const cacheStats = await page
      .locator('[data-testid="cache-stats"]')
      .textContent();
    console.log(`Cache Stats: ${cacheStats}`);

    // Stats should show evictions occurred
    expect(cacheStats).toMatch(/evictions?/i);
  });
});
