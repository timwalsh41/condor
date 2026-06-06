# The Condor — Frontend

React SPA for dual-video synchronized playback with frame-accurate control and annotation tools.

## Architecture

The app is a single-page application with three views navigated via a top nav bar:

| View | Component | Description |
|------|-----------|-------------|
| **Analyze** | `DualVideoSynchronizer` | Video upload, WebCodecs playback, sync/playback modes, annotation canvas |
| **Library** | `LibraryView` | Browse, edit metadata, and load saved videos |
| **Sessions** | `SessionsView` | List, load, and delete saved analysis sessions |

**Future**: `GooglePhotosImport` and `GooglePhotosImport.css` exist as stubs for a planned Google Photos integration. The backend endpoints are mocked (see `docs/API/BACKEND_API.md`).

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

⚠️ **Backend Required**: Playwright tests require the backend server running at `http://localhost:8000`. The Vite dev server is started automatically by Playwright's `webServer` config — you do NOT need to start it manually.

```bash
# STEP 1: Start backend server (in a separate terminal, from project root)
uv run python -m backend.main

# STEP 2: First time setup — install browser binaries (from frontend/)
npx playwright install firefox webkit

# STEP 3: Run tests (from frontend/)
npm run test:e2e              # Headless mode (all browsers)
npm run test:e2e:headed       # Headed mode (visible browser)
npm run test:e2e:ui           # Interactive UI mode

# Run specific test file
npx playwright test tests/test_upload_workflow.spec.ts

# Run tests in specific browser
npx playwright test --project=firefox
npx playwright test --project=webkit
```

> **Note**: The Chrome project is currently **disabled** in `playwright.config.ts`. Cross-browser coverage is Firefox/WebKit only.

**Test Coverage:**

See `docs/TESTING.md` for a detailed test coverage map by workflow, browser coverage status, known skips and their reasons, and a coverage improvement plan.

**Manual Tests:**

See `docs/TESTING.md` (§ Manual Tests) for a regression-test procedure and `docs/TESTING.md` (§ Manual Verification) for frame-accuracy and memory-leak checklists.

**Troubleshooting:**

- If tests fail with connection errors, ensure backend is running
- For debugging, use headed mode: `npm run test:e2e:headed`
- See `docs/TESTING.md` (§ Troubleshooting) for more issues
