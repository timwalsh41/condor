## Background

We now have the Condor MVP up and running! We can load videos, reoptimize and rotate as needed, and conduct basic analysis with single-frame accurate stepping and customizable annotation overlays. It's time to take this system to the next level with a combination of production-grade workflow enhancements and AI/CV-based analysis tools. Our goal today is to extend our existing design and project documentation to set us up to execute on these exciting new features in phase 2 of the project.

## Scope of new features

The features we'll add refer to functional requirements from `docs/inputs/INITIAL.md`:

- FR-1 User management (no authentication for now)
- FR-9 Keyboard shortcuts
- FR-12 Session persistence
- FR-13 Video library management
- FR-16 Advanced annotation tools
- FR-20 Cloud media import
- (New) Dockerize for deployment
  - Raspberry Pi 4

## Phase 2 specification and design decisions

### Product and UX direction

- The application moves from a single analysis page to a multi-view app shell.
- Primary navigation targets:
  - Analyze
  - Library
  - Sessions
  - Import (or equivalent entry points within Analyze/Library)
- Phase 2 maintains no authentication. User context is modeled as a single default user.

### User workflows (outcome-focused)

1. Manage video library
   - User adds videos from local upload or Google Photos import.
   - User reviews and edits video metadata.
   - User can select library videos later for analysis sessions.
2. Start new analysis session
   - User enters Analyze view and loads one or two videos.
   - User synchronizes videos, annotates frames, and adjusts playback/trim.
3. Save analysis session
   - User manually saves a named session with notes.
   - Saved state includes selected videos, sync points, trim/playback state, and annotations.
4. Load analysis session
   - User opens Sessions view and loads a previously saved session.
   - System restores session state for continued analysis.
5. Continue analysis and persist changes
   - User modifies loaded session and saves updates (or saves as a new session).

### Metadata model expectations

- Video metadata (minimum):
  - golfer name
  - capture/recorded date
  - club
  - user-editable notes
  - quality score (1-10)
- Session metadata (minimum):
  - session name
  - session notes
  - references to selected videos
  - saved sync/trim/playback/annotation state

### Integration scope decisions

- Cloud media import in Phase 2 is Google Photos only.
- iCloud import is explicitly deferred beyond Phase 2.

### Data and deployment decisions

- Phase 2 persistent system-of-record database: PostgreSQL.
- Dockerized deployment is in scope for Raspberry Pi 4.

### Execution and validation rule

- Per `CLAUDE.md`, each plan step/story must produce documented user-exercisable output
  demonstrating acceptance criteria have been met.

## Documentation updates:

- Project Plan
  - Update `Beyond MVP` section
  - Create sections for new phases as needed
    - Populate tasks to address the above requirements
    - Start with technical spike tasks as needed to prove out designs and finalize the approach

- Requirements
  - Add/align Phase 2 requirements and acceptance criteria with these decisions

- Technical docs
  - Update `docs/design/SYSTEM_ARCHITECTURE.md`, `docs/design/BACKEND_DESIGN.md`, and
    `docs/design/FRONTEND_DESIGN.md` to reflect the agreed Phase 2 target state
  - Include a dedicated UX/workflow specification from the user perspective
  - Follow `docs/style/TECHNICAL_DOCUMENTATION.md` and
    `docs/style/MARKDOWN.md`
    