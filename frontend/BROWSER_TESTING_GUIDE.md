# Browser Testing Guide - Frame-Accurate Video Control

## Architecture

**Container-Only Testing**:
All three browsers (Firefox, Chrome, WebKit) run inside the development container with tests.

**Test Setup**:
- **Firefox**: Native H.264 support (no additional setup)
- **Chrome**: Requires Google Chrome installation (H.264 codec support)
- **WebKit**: Requires GTK4 libraries (Debian 12 compatibility)

**Display**:
- **Xvfb**: Virtual display server (`:99`) for headful browser testing in container

## Container Setup

### Prerequisites

The development container should already have:
- Node.js 20+
- Playwright installed (`npm install` in `/code/Claude/condor/frontend`)
- Firefox browser installed (`npx playwright install firefox`)

### Install Google Chrome (for Chrome Tests)

**Why Google Chrome?** Chromium in Debian repositories doesn't include H.264 codecs. Google Chrome includes proprietary codecs required for our test videos.

```bash
# Run from container
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /tmp/google-chrome.gpg
sudo mv /tmp/google-chrome.gpg /etc/apt/trusted.gpg.d/
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | \
  sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install Chrome browser for Playwright
npx playwright install chromium
```

### Install WebKit Dependencies (for WebKit Tests)

**Why GTK4?** WebKit on Debian 12 requires GTK4 libraries which aren't installed by default.

```bash
# Run from container
sudo apt-get update
sudo apt-get install -y libgtk-4-1

# Install WebKit browser
npx playwright install webkit

# Install WebKit system dependencies
sudo npx playwright install-deps webkit
```

## Running Tests

### Start Xvfb (Virtual Display)

All browser tests require Xvfb running in the container:

```bash
# Start Xvfb on display :99 (run once per container session)
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 &
sleep 2
```

**Note**: You only need to start Xvfb once. It will keep running in the background for all subsequent test runs.

### Firefox

```bash
cd /code/Claude/condor/frontend

# Ensure DISPLAY is set (if not already exported)
export DISPLAY=:99

# Run Firefox tests
npx playwright test --project=firefox
```

### Chrome

```bash
cd /code/Claude/condor/frontend

# Ensure DISPLAY is set (if not already exported)
export DISPLAY=:99

# Run Chrome tests
npx playwright test --project=chromium
```

### WebKit

```bash
cd /code/Claude/condor/frontend

# Ensure DISPLAY is set (if not already exported)
export DISPLAY=:99

# Run WebKit tests
npx playwright test --project=webkit
```

### All Browsers

Run all browser tests in sequence:

```bash
cd /code/Claude/condor/frontend

# Ensure DISPLAY is set
export DISPLAY=:99

# Run all browsers
npx playwright test --project=firefox
npx playwright test --project=chromium
npx playwright test --project=webkit
```

Or run in parallel using Playwright's built-in parallelization:

```bash
npx playwright test  # Runs all projects configured in playwright.config.ts
```

## Interpreting Results

### Success Criteria

**Frame Control Tests** (REQ-F-FRAME-001, REQ-F-FRAME-002, REQ-F-FRAME-003):
- Frame counter displays "Frame X of Y" format
- Fine stepping: ±1 frame accuracy
- Coarse stepping: ~5 frames (3-7 range acceptable)
- `requestVideoFrameCallback` API available
- Frame counter updates during playback

**Performance** (REQ-NF-P-004):
- Frame step latency target: <100ms
- Tests log latency but don't fail (container overhead expected)

**Known Issues**:
- **WebKit callback limitation**: `requestVideoFrameCallback` may not fire reliably on paused video in containerized WebKit
- **Workaround**: 100ms timeout fallback to `currentTime`-based calculation (±1 frame accuracy)
- **Impact**: One test may fail intermittently in WebKit (~95% pass rate expected)
- **TODO**: Manual validation required on macOS/Safari to confirm native behavior

### Troubleshooting

**Tests fail with "browser not found"**:
```bash
cd /code/Claude/condor/frontend

# Install browser binaries
npx playwright install firefox
npx playwright install chromium
npx playwright install webkit
```

**Chrome tests fail with codec errors**:
```bash
# Ensure Google Chrome (not Chromium) is installed
google-chrome --version

# If not installed, follow "Install Google Chrome" setup section above
```

**WebKit tests fail with GTK errors**:
```bash
# Ensure GTK4 libraries are installed
dpkg -l | grep libgtk-4

# If not installed, follow "Install WebKit Dependencies" setup section above
```

**Video doesn't load**:
```bash
# Verify dev server is running and video is accessible
curl -I http://localhost:5173/test_30fps_10s.mp4

# Should return HTTP 200 with video/mp4 content type
# If 404: ensure Vite dev server is running (npm run dev)
```

**Xvfb errors**:
```bash
# Kill existing Xvfb processes
pkill Xvfb

# Restart Xvfb
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 &
sleep 2
```

**Tests timeout in WebKit**:
- Expected behavior due to callback limitation
- Timeout fallback ensures tests eventually pass
- If all tests timeout: verify Xvfb is running and DISPLAY=:99 is set

## Quick Reference

All commands run from container:

```bash
cd /code/Claude/condor/frontend

# Ensure Xvfb is running (run once per container session)
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 &
sleep 2

# Run Firefox tests
DISPLAY=:99 npx playwright test --project=firefox

# Run Chrome tests
DISPLAY=:99 npx playwright test --project=chromium

# Run WebKit tests
DISPLAY=:99 npx playwright test --project=webkit

# Run all browsers
DISPLAY=:99 npx playwright test

# Run specific test
DISPLAY=:99 npx playwright test --grep "step forward by 1 frame"

# View HTML report
npx playwright show-report
```
