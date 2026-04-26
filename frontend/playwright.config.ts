import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for spike validation tests
 * Focus on frame-accurate video control testing across browsers
 *
 * Browser Support:
 * - All browsers run in headless mode for container compatibility
 * - Tests use direct video seeking (not frame-by-frame stepping) to avoid
 *   unreliable seeking near frame 0 in headless browsers
 */

// Fetch WebSocket URL from Chrome DevTools Protocol endpoint
async function getChromeWebSocketUrl(httpUrl: string): Promise<string> {
  try {
    const response = await fetch(`${httpUrl}/json/version`);
    const data = await response.json();
    return data.webSocketDebuggerUrl;
  } catch (error) {
    throw new Error(`Failed to fetch WebSocket URL from ${httpUrl}: ${error}`);
  }
}

// Get Chrome WebSocket endpoint (supports both ws:// and http:// URLs)
async function getChromeEndpoint(): Promise<string | undefined> {
  const cdpUrl = process.env.CHROME_CDP_URL;
  if (!cdpUrl) return undefined;

  // If already a WebSocket URL, return as-is
  if (cdpUrl.startsWith("ws://") || cdpUrl.startsWith("wss://")) {
    return cdpUrl;
  }

  // If HTTP URL, fetch the WebSocket URL from /json/version
  if (cdpUrl.startsWith("http://") || cdpUrl.startsWith("https://")) {
    return await getChromeWebSocketUrl(cdpUrl);
  }

  return cdpUrl;
}

const chromeEndpoint = process.env.CHROME_CDP_URL
  ? await getChromeEndpoint()
  : undefined;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Run tests sequentially to prevent resource exhaustion
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // CRITICAL: Use only 1 worker to prevent memory exhaustion
  // Each test can use 300MB+ (120-frame cache + browser overhead)
  // With 3 browser projects, workers: 1 means max 1 test at a time across ALL browsers
  workers: 1,

  // Global timeout to prevent hung tests
  timeout: 60000, // 60 seconds per test (increased from default 30s for video tests)
  globalTimeout: 600000, // 10 minutes for entire test suite

  reporter: "html",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    video: "off", // Disable video recording to save memory (we have screenshots)
    screenshot: "only-on-failure",

    // Action timeout to prevent indefinite waits
    actionTimeout: 15000, // 15 seconds for actions like click, fill, etc.
    navigationTimeout: 30000, // 30 seconds for page navigations
  },

  projects: [
    /*
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        // Use remote Chrome if chromeEndpoint is set, otherwise use installed Google Chrome
        ...(chromeEndpoint
          ? { connectOptions: { wsEndpoint: chromeEndpoint } }
          : {
              channel: "chrome", // Use installed Google Chrome (has H.264 support)
              headless: true, // Must be headless in container environment (no X11)
              launchOptions: {
                args: [
                  "--autoplay-policy=no-user-gesture-required",
                  "--disable-blink-features=AutomationControlled",
                  "--use-fake-ui-for-media-stream",
                  "--use-fake-device-for-media-stream",
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                ],
              },
            }),
      },
    },
    */
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        headless: true, // Must be headless in container environment (no X11)
        launchOptions: {
          args: ["--no-sandbox"],
        },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        headless: true, // Must be headless in container environment (no X11)
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
