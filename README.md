# The Condor: Golf Swing Analyzer

The Condor is an open-source platform for frame-accurate video analysis with dual-video synchronization and annotation tools.

## Quick Start

### Prerequisites

- **Node.js**: 18+ (for frontend development)
- **Python 3.11+**: For backend API
- **npm** or **yarn**: Package management
- **FFmpeg**: For video processing and test video generation
- **Playwright Browsers**: For cross-browser testing

### Run Full Application (Frontend + Backend)

```bash
# Terminal 1: Start backend
python3 -m backend.main
# Server starts at http://localhost:8000

# Terminal 2: Start frontend
cd frontend
npm install  # First time only
npm run dev
# Use `npm run dev -- --host` when port forwarding outside of dev container
```

Open browser to http://localhost:5173 - you'll see the upload workflow for dual-video analysis.

### Run Legacy Demo (Frontend Only, No Backend)

To use the original Phase 0 demo with local file selection (no upload required):

```bash
# Edit frontend/src/App.tsx - change line 1:
# FROM: import { DualVideoSynchronizer } from "./components/DualVideoSynchronizer";
# TO:   import { DualVideoSyncDemo } from "./components/DualVideoSyncDemo";

# And change line 22:
# FROM: <DualVideoSynchronizer />
# TO:   <DualVideoSyncDemo />

cd frontend
npm run dev
# Open demo at http://localhost:5173
# Use `npm run dev -- --host` when port forwarding outside of dev container
```

### Instructions for Use

**Upload Workflow** (full application only): Select and upload two videos with optional rotation. After upload, the app enters synchronized playback mode.

**Playback** (both modes): The application starts in SYNC mode where you can independently control each video. Use the playback controls (play/pause, scrub bar, frame stepping) to synchronize the two videos, e.g. by setting them both to the impact frame:

![alt text](image/impact.png)

Switch from sync mode to playback mode:

![alt text](image/playback-mode.png)

**Annotations** (both modes): Use the annotation tools to draw shapes representing key positions, angles, and checkpoints in the swing. For the polyline tool, each click-and-release creates a vertex; a double click places the final vertex and ends the line. All other tool drawing takes place with a single click and drag.

![alt text](image/annotations.png)

Annotations can be selected (ctrl-click to select multiple). White control points appear when selected. Click on the annotation body (not on a control point) and drag to move selected annotations. Click and drag on a control point to edit (resize/adjust) the annotation itself. Press delete to remove all selected annotations.

## Developer Setup

### Frontend Development

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
# Use `npm run dev -- --host` when port forwarding outside of dev container
```

### Backend Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run backend server
python3 -m backend.main
# Server starts at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Testing

See component-specific README files:

- **Frontend**: `frontend/README.md` - Unit tests and Playwright E2E tests
- **Backend**: `backend/README.md` - Unit tests and integration tests

### Generate Test Videos

```bash
# Navigate to test fixtures
cd tests/fixtures

# Generate test videos with frame counters
bash generate_test_videos.sh

# Output: tests/fixtures/videos/
#   - test_30fps_10s.mp4       (H.264, 30fps, 10 seconds)
#   - test_60fps_5s.mp4        (H.264, 60fps, 5 seconds)
#   - test_30fps_10s_hevc.mp4  (H.265/HEVC, 30fps, 10 seconds)
```

## Repository Structure

```
condor/
├── backend/              # Backend source & unit tests
├── docs/                 # Technical documentation
│   └── spike/            # Detailed spike documentation
├── frontend/             # Frontend source & unit tests
│   ├── src/
│   │   ├── hooks/        # Custom React hooks (useFrameCallback)
│   │   └── components/   # UI components (FrameStepper)
│   └── tests/            # Playwright E2E tests
├── image/                # Images for documentation
├── inputs/               # Design input documentation
├── project/              # Project documentation (requirements and planning)
├── PRPs/                 # Product Requirements Prompts
├── tests/                # Integration tests
│   └── fixtures/         # Test video generation scripts
└── validation/           # Validation and review artifacts
```

## Technology Stack

### Backend

- **Python 3.11+**: FastAPI, uvicorn
- **FFmpeg**: Video metadata extraction
- **Testing**: pytest

### Frontend

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **Zustand**: State management (Phase 1)
- **react-konva**: Canvas annotations (Phase 1)

### Testing

- **Playwright**: E2E cross-browser testing
- **Vitest**: Frontend unit tests (Phase 1)
- **pytest**: Backend unit tests (Phase 1)

## License

[License information to be added]

## Contact

[Contact information to be added]
