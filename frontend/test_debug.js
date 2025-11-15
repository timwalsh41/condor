// Quick debug test to understand the frame stepping issue
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
  
  await page.goto('http://localhost:5173');
  await page.waitForSelector('[data-testid="video-element"]');
  
  const video = page.locator('[data-testid="video-element"]');
  
  // Wait for metadata
  await video.evaluate((v) => {
    v.load();
    return new Promise((resolve) => {
      if (v.readyState >= 2) resolve();
      else v.addEventListener('loadedmetadata', resolve, { once: true });
    });
  });
  
  await video.evaluate((v) => v.pause());
  
  // Seek to frame 100
  await video.evaluate((v) => {
    v.currentTime = 100 / 30;
    v.pause();
  });
  
  await page.waitForTimeout(500);
  
  const frameCounter = page.locator('[data-testid="frame-counter"]');
  const initialText = await frameCounter.textContent();
  console.log('Initial:', initialText);
  
  // Click step forward
  await page.locator('[data-testid="step-forward-fine"]').click();
  
  await page.waitForTimeout(1000);
  
  const finalText = await frameCounter.textContent();
  console.log('Final:', finalText);
  
  await page.waitForTimeout(5000);
  await browser.close();
})();
