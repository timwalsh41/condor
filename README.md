# Condor: Golf Swing Analyzer

Frame-accurate golf swing video analysis tool with dual-video synchronization and annotation capabilities.

## Project Status

- **Phase**: Phase 0 - Technical Spikes (In Progress)
- **Current Session**: Frame-Accurate Video Control Spike
  - Implementation: ✅ Complete
  - Testing: ⚠️ Partial (Chrome validated, Firefox/WebKit deferred)
- **Next Priority**: Complete cross-browser testing and proceed to Dual Video Sync Spike

## Overview

The Golf Swing Analyzer is an open-source platform for frame-accurate video analysis with dual-video synchronization and annotation tools.

## Quick Start

### Prerequisites

- **Node.js**: 18+ (for frontend development)
- **npm** or **yarn**: Package management
- **FFmpeg**: For generating test videos
- **Playwright Browsers**: For cross-browser testing

### Frontend Spike Environment

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# Opens at http://localhost:5173
# Use `npm run dev -- --host` when port forwarding outside of dev container

# Run Playwright tests
npx playwright test

# Build for production
npm run build
```

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

## Documentation

### Project Planning

- **[Requirements](project/REQUIREMENTS.md)** - 46 formal MVP requirements with acceptance criteria
- **[Project Plan](project/PROJECT_PLAN.md)** - Phased task breakdown (Phase 0: Spikes, Phase 1: MVP Implementation)
- **[MVP Product Requirements Prompt](PRPs/MVP_PRP.md)** - Comprehensive implementation guide with patterns and gotchas

### Technical Spikes

- **[Frame Control Spike Results](docs/spike/FRAME_CONTROL.md)** - Phase 0 Task 0.2 findings and recommendations

## Repository Structure

```
condor/
├── frontend/              # Vite + React + TypeScript spike environment
│   ├── src/
│   │   ├── hooks/        # Custom React hooks (useFrameCallback)
│   │   └── components/   # UI components (FrameStepper)
│   └── tests/            # Playwright E2E tests
├── docs/
│   └── spike/            # Technical spike documentation
│       └── FRAME_CONTROL.md
├── project/              # Requirements and planning artifacts
│   ├── REQUIREMENTS.md   # Formal requirements (46 MVP requirements)
│   └── PROJECT_PLAN.md   # Phased task breakdown and tracking
├── PRPs/                 # Product Requirements Prompts
│   └── MVP_PRP.md        # Comprehensive MVP implementation guide
├── tests/
│   └── fixtures/         # Test video generation scripts
└── validation/           # Validation and review artifacts
```

## Phase 0: Technical Spikes Status

**Goal**: Validate HIGH RISK technical challenges before full MVP implementation.

| Task                            | Status         | Confidence | Notes                                                   |
| ------------------------------- | -------------- | ---------- | ------------------------------------------------------- |
| **0.1** Setup Spike Environment | ✅ Complete    | 95%        | Vite + React + TypeScript + Playwright configured       |
| **0.2** Frame-Accurate Seeking  | ⚠️ Partial     | 75%        | Implementation complete, cross-browser testing deferred |
| **0.3** Dual Video Sync         | 🔲 Not Started | -          | Next priority after 0.2 completion                      |
| **0.4** Canvas Overlay          | 🔲 Not Started | -          | Annotations performance validation                      |
| **0.5** CI Setup                | 🔲 Not Started | -          | GitHub Actions cross-browser testing                    |
| **0.6** Raspberry Pi Validation | 🔲 Not Started | -          | Target hardware performance testing                     |

### Integration Checkpoint 1 (Phase 0 Completion)

Before proceeding to Phase 1, must validate:

- All spike tests pass in Chrome, Firefox, WebKit
- Frame stepping accuracy within 1 frame
- Video sync drift <1 frame over 10 seconds
- Canvas overlay latency ≤16ms
- Raspberry Pi 4 performance acceptable (dual 1080p/30fps)
- Confidence level 8+/10 for Phase 1 implementation

## Technology Stack

### Backend (Phase 1)

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

### Deployment

- **Docker**: Containerization
- **Raspberry Pi 4**: 8GB RAM, Ubuntu 22.04 LTS (ARM64)

## Development Workflow

This project follows a **requirements-driven development** approach with formal requirements, phased implementation, and comprehensive validation.

### Key Artifacts

- **Requirements** (`REQUIREMENTS.md`) - Source of truth for what to build
- **PRPs** - Implementation guides with patterns and gotchas
- **Project Plan** (`PROJECT_PLAN.md`) - Task tracking and coordination
- **Validation Report** - Ongoing requirement validation status

## Contributing

This project is developed using an AI-assisted workflow. See **[CLAUDE.md](CLAUDE.md)** for:

- Development philosophy (KISS, YAGNI, design principles)
- Agent coordination workflow
- Requirements-driven development process
- Testing standards
- Git workflow and commit message format

## License

[License information to be added]

## Contact

[Contact information to be added]

---

**Last Updated**: 2025-10-29
