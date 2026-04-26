# The Condor - Golf Swing Video Analysis

Frontend for dual-video synchronized playback with frame-accurate control and annotation tools.

## Architecture

**DualVideoSyncDemo** (`/dual-video-sync` route)

- Phase 0 standalone proof-of-concept
- Client-side only, no backend integration
- Used for frame-accurate sync validation

**DualVideoSynchronizer** (main app)

- Production application with backend integration
- Video upload workflow with rotation controls
- WebCodecs-based frame-accurate playback
- Synchronized dual-video analysis with annotations

## Development

> All commands must be run from the `frontend/` directory.

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
# Use `npm run dev -- --host` when port forwarding outside of dev container
```

## Build

```bash
npm run build
```

## Testing

> All commands must be run from the `frontend/` directory.

**Unit Tests:**

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
```

**Integration Tests (Playwright E2E):**

⚠️ **Backend Required**: Playwright tests require the backend server running at `http://localhost:8000`

```bash
# STEP 1: Start backend server (in a separate terminal, from project root)
uv run python3 -m backend.main

# STEP 2: First time setup - install browser binaries (from frontend/)
npx playwright install firefox webkit    # as node user - install user copy in /home/node/.cache/ms-playwright

# Optional - install chrome to run all tests (x86/amd64 only); NOTE THIS IS NOT POSSIBLE IN A CONTAINER WTIHOUT PROPER PRIVILEGES
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb

# STEP 3: Run tests (from frontend/)
npm run test:e2e              # Headless mode (all browsers)
npm run test:e2e:headed       # Headed mode (visible browser)
npm run test:e2e:ui           # Interactive UI mode

# Run specific test file
npx playwright test tests/test_upload_workflow.spec.ts

# Run tests in specific browser
npx playwright test --project=chrome
npx playwright test --project=firefox
npx playwright test --project=webkit
```

**Test Coverage:**

- Upload Workflow, Frame Control, Dual Video Sync, Annotations, Performance

**Manual Tests:**

Some session-load behaviors require user verification because they depend on visual state of the Konva annotation canvas, which is not queryable by automated tests.

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Session restore — annotations on both channels | 1. Upload two videos, draw at least one annotation on each channel. 2. Save both videos to library. 3. Save the session. 4. Reload the app. 5. Load the saved session. | Both Video A and Video B annotation canvases show the saved annotations after the session finishes loading. Neither channel is blank. |

**Troubleshooting:**

- If tests fail with connection errors, ensure backend is running
- For debugging, use headed mode: `npm run test:e2e:headed`
