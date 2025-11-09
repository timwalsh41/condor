import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for spike validation tests
 * Focus on frame-accurate video control testing across browsers
 *
 * Browser Support:
 * - Firefox: Runs in container with native H.264 support
 * - Chrome: Runs on host (Chrome won't bind to 0.0.0.0 for remote debugging)
 * - WebKit: Runs on host (container missing GTK4 libraries)
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
  if (cdpUrl.startsWith('ws://') || cdpUrl.startsWith('wss://')) {
    return cdpUrl;
  }

  // If HTTP URL, fetch the WebSocket URL from /json/version
  if (cdpUrl.startsWith('http://') || cdpUrl.startsWith('https://')) {
    return await getChromeWebSocketUrl(cdpUrl);
  }

  return cdpUrl;
}

const chromeEndpoint = process.env.CHROME_CDP_URL ? await getChromeEndpoint() : undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use remote Chrome if chromeEndpoint is set, otherwise launch local browser
        ...(chromeEndpoint
          ? { connectOptions: { wsEndpoint: chromeEndpoint } }
          : {
              headless: false,
              launchOptions: {
                executablePath: '/usr/bin/google-chrome', // Use Google Chrome with H.264 support
                args: [
                  '--autoplay-policy=no-user-gesture-required',
                  '--disable-blink-features=AutomationControlled',
                  '--use-fake-ui-for-media-stream',
                  '--use-fake-device-for-media-stream',
                  '--no-sandbox',
                  '--disable-setuid-sandbox',
                ],
              },
            }),
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: false, // Run in headed mode for codec support
        launchOptions: {
          args: ['--no-sandbox'],
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        headless: false, // Run in headed mode for codec support
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
