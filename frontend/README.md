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

```bash
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

**Unit Tests:**

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
```

**Integration Tests (Playwright E2E):**

⚠️ **Backend Required**: Playwright tests require the backend server running at `http://localhost:8000`

```bash
# STEP 1: Start backend server (in separate terminal)
cd ../backend
python3 -m backend.main

# STEP 2: First time setup - install browser binaries
npx playwright install --with-deps

# STEP 3: Run tests
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

**Troubleshooting:**

- If tests fail with connection errors, ensure backend is running
- For debugging, use headed mode: `npm run test:e2e:headed`
