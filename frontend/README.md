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

**End-to-End Tests (Playwright):**
```bash
# First time setup - install browser binaries
npx playwright install --with-deps

# Run tests
npm run test:e2e              # Headless mode
npm run test:e2e:headed       # Headed mode (visible browser)
npm run test:e2e:ui           # Interactive UI mode
```
