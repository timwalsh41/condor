# Design Inputs: Golf Swing Analyzer

## FEATURE

### System Overview

An **open-source** golf swing video analysis tool that enables golfers and coaches to compare and annotate swing videos frame-by-frame. The system supports loading one or two videos, synchronizing them temporally, and drawing annotations to highlight swing mechanics. The platform is designed to run on a local server (initially) with future expansion to cloud hosting and mobile platforms.

**Comparable Product**: V1 Golf App - https://v1sports.com/athletes/v1-golf-app/

### Target Users

- **Primary**: Individual golfers analyzing their own swings
- **Secondary**: Golf coaches/instructors (future "coach mode" where coaches can access student videos)
- **Distribution**: Initially personal use and limited circulation among friends, with potential for broader open-source community adoption

### Success Criteria

**MVP Success Metrics:**
1. **Functional Completeness**: All core analysis workflows work smoothly (upload → sync/trim → annotate → playback)
2. **Performance**: Smooth video playback and responsive annotation drawing on target hardware (Raspberry Pi 4 8GB)
3. **Portability**: Works reliably across desktop browsers (Chrome, Firefox, Safari, Brave)
4. **Usability** (CRITICAL!): Frame-accurate synchronization and stepping work intuitively

**Long-term Success:**
- Community adoption and contributions (open-source model)
- Expansion to cloud hosting and mobile platforms (PWA initially)
- Coach mode implementation for instructor/student workflows

---

## PRODUCT SCOPE

### In-Scope for MVP

**Single Session Operation**: No data storage, no user creation, no authentication

**Core Analysis Workflow:**
1. **Video Upload**: Local file upload only (up to ~200MB, stored temporarily on disk)
2. **Video Management**: Load 1 or 2 videos per session (if two videos, they must have same framerate for MVP)
3. **Synchronization Mode**: Independent controls for each video channel to align videos frame-by-frame at user-selected sync point
4. **Playback Mode**: Unified controls for synchronized playback with maintained offset
5. **Annotation Tools**:
   - Polyline (connected line segments)
   - Oval/Circle
   - Arrow
   - Freehand drawing
   - Delete annotation
   - Single default style (no color/thickness selection)
   - Annotations are static (not time-based) and created separately for each video channel
6. **Playback Controls**:
   - Play/Pause
   - Loop
   - Speed control (0.25x, 0.5x, 1x, 2x, etc.)
   - Coarse frame stepping (~5 frames) - first-class feature
   - Fine frame stepping (single frame) - first-class feature
   - Scrubber/seek bar
   - Frame counter display
7. **Trim Functionality**: Non-destructive - set start/end points for playback region via timeline handles
8. **Error Handling**: Clear user notifications for upload failures, unsupported formats, framerate mismatch, etc.

**Platform & Deployment:**
- Desktop web browsers only (Chrome, Firefox, Safari, Brave)
- Local Linux server (Ubuntu on Raspberry Pi 4 8GB minimum spec)
- HTML5 video format support (primarily MP4/H.264, what browsers natively support)

### Explicitly Out-of-Scope for MVP

**Deferred to Later Phases:**
1. **Session Persistence**: No saving/loading of sessions (stateless analysis)
2. **Video Library**: No persistent storage of videos or metadata
3. **Database**: No database - all state lives in browser during session
4. **Video Export**: No "bake annotations into video" export functionality
5. **Annotation Editing**: No drag-to-edit control points (delete only)
6. **Annotation Styling**: No color, line thickness, or style selection
7. **Advanced Annotations**: No text labels or angle measurements
8. **Multi-Framerate Sync**: Videos must have same framerate for MVP
9. **Mobile Support**: No mobile web or mobile app (PWA deferred)
10. **Cloud Import**: No Google Photos, iCloud, etc. integration
11. **User Creation and Authentication**: No login/accounts/authorization
12. **Multi-Client Sync**: No real-time collaboration features
13. **Screenshot/Video Export**: Deferred entirely
14. **Keyboard Shortcuts** for common operations
15. **Administrator Functionality**: Superuser access to backend data, edit users, etc.
16. **Video Import** from cloud storage, e.g. Google Photos, iCloud, etc.

---

## USE CASES

### MVP User Workflows

**UC-1: Single Video Analysis**
1. Upload one swing video
2. Optional: Trim video to relevant section
3. Draw annotations (lines, arrows, ovals) to highlight positions
4. Play back video with annotations (loop, speed control, frame stepping)
5. Done (no save - ephemeral session)

**UC-2: Two-Video Comparison (Same Framerate)**
1. Upload two swing videos (same framerate)
    - Common use cases:
        - **Same person, different angles**: DTL (down-the-line) and FO (face-on) views synchronized
        - **Same person, different swings**: Compare good swing vs. bad swing from same angle
        - **Different people**: Compare student swing to instructor/pro swing
2. Enter **Sync Mode**:
   - Videos have independent controls (play/pause/step/scrub)
   - User navigates each video to sync point (typically ball impact)
   - Use coarse/fine frame stepping to find exact frame
   - Lock in sync offset by exiting to Playback Mode
3. Optional: Trim both videos to relevant sections
4. Enter **Playback Mode**:
   - Unified controls for both video channels
   - Videos maintain sync offset during playback/stepping
5. Draw annotations on each video independently
6. Toggle annotations on/off for each video
7. Play back synchronized videos with annotations
8. Done (no save - ephemeral session)

### Future Use Cases (Post-MVP)

**UC-4: Session Management**
- Save session (videos, sync offset, trim points, annotations, notes)
- Load saved session for further analysis
- Delete saved session

**UC-5: Video Library Management**
- Import videos with metadata (date, club, angle, quality score, notes, labels)
- Attach supporting data (e.g. data/metrics from launch monitor, image capture from launch monitor, etc.)
- Search and filter library
- Delete videos from library

**UC-6: Coach Mode**
- Coach accesses student's videos with appropriate permissions
- Coach records video analysis commentary over annotated swing
- Student receives annotated session with coach's feedback

**UC-7: Export**
- Export side-by-side synchronized videos with annotations baked in
- Export screenshots with annotations
- Share exported content

---

## UI DESIGN CONSIDERATIONS

1. Side by side display of two video channels
2. Sync mode operation: independent control (play/pause/step frame(s) forward or backward/scrub) for each channel
3. Playback/analysis mode: single set of playback controls apply for both video channels, maintaining sync offset
4. Simple, intuitive, modern controls
5. All controls should be available on one interface (e.g. no need to go into menus, dropdowns, etc. for primary playback control)
6. Size/scale videos appropriately for display size/browser window size

---

## FUNCTIONAL REQUIREMENTS

### FR-2: Video Upload (MVP)
- System shall support local file upload from user's filesystem
- System shall accept common video formats supported by HTML5 (MP4/H.264 primarily)
- System shall store uploaded videos temporarily on server disk (not memory)
- System shall clean up temporary video files after session ends
- System shall support videos up to ~200MB (typical: 1-2 minutes, 1080p-4K, 30-240fps)
- System shall display clear error messages for unsupported formats, failed uploads, or framerate mismatch (for multiple video use case)
- System shall log upload errors on server for debugging

### FR-3: Video Playback (MVP)
- System shall support loading 1-2 videos per session
- System shall display videos side-by-side when 2 videos loaded
- System shall enforce same framerate for both videos in MVP (validation check)
- System shall provide smooth video playback at native framerate
- System shall display current frame number for each video
- System shall stream videos from server (not load entirely into memory)

### FR-4: Synchronization Mode (MVP)
- System shall provide "Sync Mode" where each video has independent controls
- In Sync Mode, each video shall have independent play/pause/step/scrub controls
- System shall allow user to navigate each video to arbitrary sync frame
- System shall provide coarse frame stepping (~5 frames) for each video independently
- System shall provide fine frame stepping (single frame) for each video independently
- System shall allow user to lock in sync offset by switching to Playback Mode
- Sync offset shall be calculated as: `position_B = sync_frame_B + (position_A - sync_frame_A)` (note this applies for MVP as framerates are required to be the same)

### FR-5: Playback Mode (MVP)
- System shall provide "Playback Mode" where unified controls apply to both videos
- In Playback Mode, all playback controls shall affect both videos
- In Playback Mode, frame stepping shall maintain sync offset between videos
- In Playback Mode, scrubbing shall maintain sync offset between videos
- System shall provide play/pause control
- System shall provide loop playback
- System shall provide playback speed control (0.1x, 0.25x, 0.5x, 0.75x, 1x, 2x minimum)
- System shall provide coarse frame stepping (5 frames) as first-class control
- System shall provide fine frame stepping (single frame) as first-class control
- System shall provide scrubber/seek bar for timeline navigation
- System shall maintain sync offset during all playback operations

### FR-6: Frame-Accurate Seeking (MVP - CRITICAL)
- System shall support frame-accurate stepping (forward/backward by exact frame count)
- System shall display accurate frame numbers
- Frame stepping precision shall be within 1 frame accuracy
- System shall handle frame seeking reliably across supported browsers

### FR-7: Video Trimming (MVP)
- System shall provide non-destructive trim (set start/end playback points)
- System shall provide draggable handles on timeline for trim points
- Trim points shall define playback region without modifying source video
- System shall display playback region visually on timeline
- System shall allow resetting trim points to full video range

### FR-8: Annotation Tools (MVP)
- System shall provide polyline drawing tool (connected line segments)
- System shall provide oval/circle drawing tool
- System shall provide arrow drawing tool
- System shall provide freehand drawing tool
- System shall allow deleting individual annotations
- Annotations shall use single default style (no color/thickness selection in MVP)
- Annotations shall be static (not time-based - appear on all frames)
- Annotations shall be drawn on specific video (not shared across both)
- System shall provide toggle to show/hide annotations per video
- System shall render annotations as overlay (not baked into video)
- Annotations should be bounded to within the extents of the video display (e.g. overlay aligns exactly with video display area)

### FR-10: Error Handling (MVP)
- System shall display user-friendly error messages for all error conditions
- System shall handle unsupported video format errors
- System shall handle oversized file errors
- System shall handle network disconnection during upload
- System shall handle video playback/decoding errors
- System shall handle framerate mismatch between two uploaded videos
- System shall log all errors on server for debugging

### FR-11: Deployment Documentation (MVP & All Phases)
- System shall include deployment instructions for fresh installation
- Documentation shall cover prerequisites (OS, dependencies, hardware)
- Documentation shall provide step-by-step setup for backend server
- Documentation shall provide step-by-step setup for frontend
- Documentation shall include instructions for starting/stopping services
- Documentation shall include troubleshooting common deployment issues
- Documentation shall be updated for each new phase/feature

---

## POST-MVP FUNCTIONAL REQUIREMENTS

**Note**: The following requirements are explicitly **out of scope for MVP** but represent the complete system vision. These will be implemented in future phases as indicated.

### FR-1: User Management (Post-MVP Phase 2)
- System shall provide user selection via dropdown
- No authentication or authorization required for Phase 2

### FR-9: Keyboard Shortcuts (Post-MVP Phase 2)
- System shall provide keyboard shortcuts for common operations
- At minimum, shortcuts shall include: play/pause, frame step forward/back, coarse step forward/back
- System shall display keyboard shortcut help/legend (could be behind a menu or keyboard shortcut of its own)

### FR-12: Session Persistence (Post-MVP Phase 2)
- System shall allow users to save analysis sessions
- Saved session shall include video references, sync offset, trim points, and annotations
- Saved session shall include user notes about the session
- System shall allow users to load previously saved sessions
- System shall allow users to delete saved sessions
- System shall display list of saved sessions with metadata (date created, videos, etc.)
- System shall support naming/renaming saved sessions
- System shall support searching/filtering saved sessions by labels or text

### FR-13: Video Library Management (Post-MVP Phase 2)
- System shall maintain a persistent library of uploaded swing videos
- System shall store video metadata: date recorded, date added, club, angle (DTL/FO)
- System shall allow users to assign quality score to videos (1-10 scale)
- System shall allow users to add written notes to videos
- System shall allow users to add searchable labels/tags to videos
- System shall support uploading supplementary media (e.g., launch monitor captures)
- System shall allow users to search and filter library by metadata, tags, quality score
- System shall allow users to delete videos from library
- System shall display video thumbnails in library view
- System shall allow selecting videos from library for analysis sessions
- Users shall have their own private video library with access to their own videos only
- Users can share videos from their library with other users

### FR-14: User Authentication & Authorization (Post-MVP Phase 3)
- System shall provide user registration with email/password
- System shall provide secure login with authentication
- System shall implement authorization
- System shall isolate user data (videos, sessions) by authenticated user
- System shall provide password reset functionality
- System shall enforce secure password requirements
- System shall implement session timeout and re-authentication
- System shall log authentication events for security auditing

### FR-15: Multi-Framerate Synchronization (Post-MVP Phase 3)
- System shall support synchronizing videos with different framerates
- System shall calculate framerate ratio between two videos
- System shall implement fractional frame stepping for lower-framerate video
- System shall maintain sync offset based on framerate ratio during playback
- Sync offset formula shall be: `position_B = sync_frame_B + (position_A - sync_frame_A) * (framerate_B / framerate_A)`
- System shall display framerate information for each video

### FR-16: Advanced Annotation Tools (Post-MVP Phase 4)
- System shall provide text label annotation tool
- System shall allow editing text label content, font size, and position
- System shall provide angle measurement tool
- Angle measurement shall display angle value in degrees
- System shall allow editing annotation control points by dragging
- System shall highlight selected annotation for editing
- System shall allow copying/duplicating annotations
- System shall provide undo/redo for annotation operations

### FR-17: Annotation Styling (Post-MVP Phase 4)
- System shall allow users to select annotation color
- System shall provide color palette with common colors
- System shall allow users to select line thickness (thin, medium, thick, or custom)
- System shall allow users to select line style (solid, dashed, dotted)
- System shall display annotation style controls in UI
- System shall apply selected style to new annotations
- System shall allow changing style of existing annotations

### FR-19: Video & Screenshot Export (Post-MVP Phase 5)
- System shall allow exporting current frame as screenshot (PNG/JPEG)
- Screenshot export shall include annotations overlaid on image
- System shall allow exporting side-by-side video with annotations overlaid
- Video export shall reflect sync offset and trim points
- System shall display export progress indicator
- System shall allow selecting export video format (MP4, MOV) and quality
- System shall provide download link for exported files

### FR-20: Cloud Media Import (Post-MVP Phase 5)
- System shall support importing videos from Google Photos
- System shall support importing videos from iCloud
- System shall handle OAuth authentication for cloud services
- System shall display cloud media browser for selecting videos
- System shall download selected cloud videos to server
- System shall preserve video metadata from cloud sources
- System should support importing from other cloud services (Dropbox, OneDrive) if feasible

### FR-21: Mobile Support (Post-MVP Phase 6)
- System shall provide mobile-optimized web interface
- System shall support touch gestures for video control (swipe, pinch, tap)
- System shall support touch drawing for annotations
- System shall provide mobile-optimized UI layout (vertical orientation)
- System shall work offline (for loaded videos)
- System shall support recording video directly from mobile device camera
- System shall support mobile device file system access for uploads
- System shall be installable as app on iOS and Android devices

### FR-22: Coach Mode (Post-MVP Phase 7)
- System shall support "Coach" user role with special permissions
- Coaches shall be able to access student videos with explicit permission
- System shall allow coaches to create analysis sessions for students
- System shall allow coaches to record video commentary over annotated swings
- System shall allow coaches to share annotated sessions with students
- Students shall receive notifications of shared coach analyses
- System shall maintain audit log of coach access to student videos
- System shall allow students to grant/revoke coach access permissions

### FR-23: Real-Time Collaboration (Post-MVP Phase 7)
- System shall support multiple users viewing same session simultaneously
- System shall synchronize video playback position across all viewers in real-time
- System shall synchronize annotation drawing across all viewers in real-time
- System shall display user cursors/indicators for all active viewers
- System shall handle viewer disconnection/reconnection gracefully
- System shall allow session owner to control who can join session
- System shall allow designating annotation permissions per viewer

### FR-24: Cloud Deployment (Post-MVP Phase 8)
- System shall be deployable to cloud platforms (AWS, GCP, or self-hosted VPS)
- System shall support horizontal scaling for multiple concurrent users
- System shall use cloud object storage for video storage
- System shall implement auto-scaling based on load
- System shall provide health check endpoints for load balancers
- System shall implement proper user isolation and resource quotas

### FR-25: Advanced Analysis Features (Post-MVP Phase 9)
- System should support automatic sync point detection using ML (ball impact detection)
- System should calculate swing analysis metrics from annotations (e.g., swing plane angle)
- System shall display calculated metrics overlaid on video or in panel
- System should support swing path trace overlays (graphical representation of club path)
- System should support comparison overlays (ghost/overlay of one swing on another)
- System should provide analytics dashboard for tracking swing improvements over time
- System shall export swing metrics data for external analysis

---

## NON-FUNCTIONAL REQUIREMENTS

### NFR-1: Performance
- Video playback shall be smooth (acceptable frame drops during playback if necessary - primary use is frame-by-frame)
- Annotation drawing shall be responsive (≤16ms latency for 60fps feel)
- Video load time shall be ≤5 seconds for 200MB file over local network
- Frame stepping shall respond within 100ms
- UI interactions shall feel instantaneous (≤100ms response time)

### NFR-2: Browser Compatibility
- System shall support desktop browsers: Chrome, Firefox, Safari, Brave
- System shall target modern browser versions supporting frame-accurate video control
- System shall detect unsupported browsers and display compatibility message

### NFR-3: Scalability
- MVP shall support single concurrent user (local server model)
- Architecture shall be designed to support multiple concurrent users in future (cloud deployment)

### NFR-4: Reliability
- System shall handle video format variations gracefully (different codecs, framerates, resolutions)
- System shall clean up temporary files even if browser/session crashes
- System shall prevent memory leaks during long sessions

### NFR-5: Usability
- UI shall be intuitive for non-technical golf enthusiasts
- Sync workflow shall be discoverable and easy to execute
- Annotation tools shall be responsive and easy to use with mouse

### NFR-6: Maintainability
- Code shall follow clean architecture with clear separation: frontend, backend, video logic, annotation logic
- System shall be documented for open-source contributions
- System shall use standard libraries and frameworks

### NFR-7: Portability
- System shall run on Ubuntu Linux (Raspberry Pi 4 8GB minimum)
- System shall not have hard dependencies on proprietary services
- Architecture shall support future migration to cloud hosting
- Frontend shall be designed to support future mobile conversion

---

## ARCHITECTURE

### System Architecture (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser (Frontend)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React + TypeScript Application           │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Video Player Components                        │  │  │
│  │  │  - HTML5 <video> elements (1-2)                 │  │  │
│  │  │  - requestVideoFrameCallback for frame control  │  │  │
│  │  │  - Sync offset management                       │  │  │
│  │  │  - Playback controls                            │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Annotation Canvas (react-konva)                │  │  │
│  │  │  - Overlaid on each video                       │  │  │
│  │  │  - Drawing tools: polyline, oval, arrow, free   │  │  │
│  │  │  - Annotation state management                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  State Management (Redux/Zustand)               │  │  │
│  │  │  - Video sync offset                            │  │  │
│  │  │  - Annotation data                              │  │  │
│  │  │  - UI mode (sync/playback)                      │  │  │
│  │  │  - Trim points                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │ Video Streaming
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server (FastAPI)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  API Endpoints                                        │  │
│  │  - POST /api/upload (video file upload)               │  │
│  │  - GET /api/video/{id} (stream video)                 │  │
│  │  - DELETE /api/session (cleanup temp files)           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Video Upload Handler                                 │  │
│  │  - Accepts UploadFile (multipart form)                │  │
│  │  - Writes to /tmp/<session_id>/<video_id>.mp4         │  │
│  │  - Returns video ID and metadata (framerate, etc.)    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Video Streaming                                      │  │
│  │  - Streams video files from temp storage              │  │
│  │  - Supports HTTP range requests (seeking)             │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Session Cleanup                                      │  │
│  │  - Deletes temp files on explicit cleanup call        │  │
│  │  - Background job cleans up old sessions (>1 hour)    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Filesystem
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Temporary Video Storage (/tmp)                 │
│  /tmp/<session_id>/<video_id>.mp4                           │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- **Framework**: FastAPI (Python)
  - Modern async support for video streaming
  - Automatic OpenAPI docs
  - Type hints for better code quality
  - WebSocket support for future features
- **Video Upload**: FastAPI `UploadFile` (multipart form data)
- **Video Streaming**: FastAPI streaming response with range request support
- **Temporary Storage**: Local filesystem `/tmp` directory
- **Deployment**: Uvicorn ASGI server

**Frontend:**
- **Framework**: React 18+ with TypeScript
- **State Management**: Redux or Zustand (TBD based on complexity)
- **Video Player**: HTML5 `<video>` element with `requestVideoFrameCallback` API
- **Annotation Canvas**: react-konva (React wrapper for Konva.js)
- **HTTP Client**: Axios or fetch API
- **Build Tool**: Vite (modern, fast)
- **Styling**: CSS Modules or Tailwind CSS (TBD)

**No Database for MVP** - All state lives in browser during session

**Deployment:**
- **Platform**: Ubuntu Linux on Raspberry Pi 4 (8GB RAM minimum)
- **Backend**: Uvicorn server
- **Frontend**: Static files served by FastAPI or Nginx
- **Process Management**: systemd or Docker (TBD)

### Data Flow

**Video Upload Flow:**
1. User selects local video file in browser
2. Frontend sends multipart/form-data POST to `/api/upload`
3. Backend writes to `/tmp/<session_id>/<video_id>.mp4`
4. Backend returns video metadata (ID, framerate, duration, resolution)
5. Frontend stores video ID and metadata in state

**Video Playback Flow:**
1. Frontend requests video via `<video src="/api/video/{id}">`
2. Backend streams video file from temp storage
3. Browser decodes and displays video
4. Frontend uses `requestVideoFrameCallback` for frame control

**Synchronization Flow:**
1. User enters Sync Mode
2. User navigates each video to sync point independently
3. Frontend calculates sync offset: `offset = video2_frame - video1_frame`
4. User exits to Playback Mode
5. During playback, when video1 is at frame `f`, video2 is at frame `f + offset`

**Annotation Flow:**
1. User selects annotation tool
2. User draws on canvas overlay
3. Frontend stores annotation data in state (shape type, coordinates, etc.)
4. Frontend renders annotations via react-konva
5. Annotations redraw on every frame (static overlay)

---

## EXAMPLES

*Note: This is a new project with no existing codebase. No code examples available yet.*

**Reference Implementations to Study:**
- V1 Golf App (commercial product for comparison): https://v1sports.com/athletes/v1-golf-app/
- Video.js overlay plugins for canvas overlay patterns
- GitHub examples of `requestVideoFrameCallback` usage for frame-accurate control

---

## DOCUMENTATION

### Essential Technical Documentation

**Video Frame Control:**
- **MDN: HTMLVideoElement.requestVideoFrameCallback()**
  - URL: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
  - Key Topics: Frame callback API, metadata object, browser support
  - Usage: Primary API for frame-accurate video control

- **Web.dev: requestVideoFrameCallback()**
  - URL: https://web.dev/articles/requestvideoframecallback-rvfc
  - Key Topics: Performance, use cases, best practices

- **WICG Spec: Video requestVideoFrameCallback()**
  - URL: https://wicg.github.io/video-rvfc/
  - Key Topics: Specification details, callback timing

- **GitHub: requestVideoFrameCallback prev-next example**
  - URL: https://github.com/angrycoding/requestVideoFrameCallback-prev-next
  - Key Topics: Frame stepping implementation example

**Video Synchronization:**
- **Stack Overflow: Synchronizing multiple HTML5 videos**
  - URL: https://stackoverflow.com/questions/36374924/synchronizing-multiple-html5-videos
  - Key Topics: Sync strategies, timeupdate event limitations

- **Bocoup: HTML5 Video Synchronization**
  - URL: https://www.bocoup.com/blog/html5-video-synchronizing-playback-of-two-videos
  - Key Topics: Event-based sync, requestAnimationFrame approach

**React Canvas Drawing:**
- **Konva.js React Documentation**
  - URL: https://konvajs.org/docs/react/index.html
  - Key Topics: React-konva basics, shapes, events, dragging

- **Konva.js Arrow Documentation**
  - URL: https://konvajs.org/docs/shapes/Arrow.html
  - Key Topics: Arrow shape properties (points, pointerLength, etc.)

- **Konva.js Line/Polygon Documentation**
  - URL: https://konvajs.org/docs/shapes/Line_-_Polygon.html
  - Key Topics: Polyline drawing, closed shapes

- **Konva.js Video on Canvas**
  - URL: https://konvajs.org/docs/sandbox/Video_On_Canvas.html
  - Key Topics: Rendering video on canvas with Konva.Animation

- **MDN: Manipulating video using canvas**
  - URL: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Manipulating_video_using_canvas
  - Key Topics: Canvas-based video manipulation techniques

**FastAPI File Upload:**
- **FastAPI: Request Files Documentation**
  - URL: https://fastapi.tiangolo.com/tutorial/request-files/
  - Key Topics: UploadFile, File(), multiple files, async file operations

- **Better Stack: Uploading Files Using FastAPI**
  - URL: https://betterstack.com/community/guides/scaling-python/uploading-files-using-fastapi/
  - Key Topics: Security, validation, large file handling

- **Stack Overflow: Large file upload to FastAPI**
  - URL: https://stackoverflow.com/questions/73442335/how-to-upload-a-large-file-%E2%89%A53gb-to-fastapi-backend
  - Key Topics: request.stream() for very large files, memory management

**React + TypeScript:**
- **React Documentation**
  - URL: https://react.dev/
  - Key Topics: Components, hooks, state management

- **TypeScript Handbook**
  - URL: https://www.typescriptlang.org/docs/handbook/intro.html
  - Key Topics: Type system, React integration

---

## OTHER CONSIDERATIONS

### Technical Challenges & Mitigations

**HIGH RISK: Frame-Accurate Video Seeking**
- **Challenge**: HTML5 video seeking is time-based, not frame-based; browsers may not seek to exact frame boundaries
- **Mitigation**:
  - Use `requestVideoFrameCallback()` API (Chrome 83+, Safari 15.4+, Firefox polyfill)
  - Calculate frame numbers from timestamps and framerate
  - Implement stepping by incrementing currentTime until metadata.mediaTime changes
  - Consider WebCodecs API as fallback if HTML5 video insufficient
- **MVP Approach**: Single framerate only to simplify calculations
- **Testing**: Validate frame-accurate stepping across all supported browsers early
- **Spike Recommendation**: Prototype frame stepping before full implementation

**HIGH RISK: Synchronized Video Playback**
- **Challenge**: Keeping two videos in perfect sync during playback; timeupdate event is unreliable (15-250ms)
- **Mitigation**:
  - Use `requestAnimationFrame` to check sync every frame (~16ms @ 60fps)
  - Detect drift and adjust `currentTime` to maintain offset
  - Pause both videos if one buffers
  - Handle different video lengths gracefully
- **MVP Simplification**: Same framerate only, same playback duration recommended
- **Spike Recommendation**: Prototype sync mechanism before full implementation

**MEDIUM RISK: Large File Upload/Streaming**
- **Challenge**: 200MB video uploads; memory exhaustion; streaming to browser
- **Mitigation**:
  - Use FastAPI `UploadFile` (spools to disk after 1MB)
  - Store directly to temp disk location (not in-memory)
  - Enable HTTP range requests for seeking in browser
  - Implement upload progress indicator (optional for MVP)
  - Set appropriate timeouts for upload endpoint
- **Best Practice**: Use `request.stream()` for >1GB files in future phases

**MEDIUM RISK: Canvas Overlay Performance**
- **Challenge**: Redrawing annotations on every video frame; performance with complex annotations
- **Mitigation**:
  - Use react-konva for optimized canvas rendering
  - Limit annotation complexity (reasonable polygon point counts)
  - Consider Layer caching in Konva if performance issues arise
  - Profile rendering performance on target hardware (RPi 4)
- **MVP Simplification**: Limited annotation types, single style reduces rendering complexity

### Architectural Considerations

**Separation of Concerns:**
- Video playback logic separate from annotation logic
- Sync mode vs. playback mode as distinct state machines
- Backend only handles file I/O and streaming (no video processing)
- Frontend handles all video control, sync calculations, annotation rendering

**Leakage-Free Interfaces:**
- **Backend API**: RESTful, videos identified by opaque IDs, no frontend knowledge of temp file paths
- **Video Player Component**: Exposes frame number, playback state; hides HTML5 video internals
- **Annotation Canvas**: Exposes drawing tools, annotation data; hides Konva details
- **State Management**: Centralized state, components consume via selectors

**Extensibility for Future Phases:**
- Architecture supports adding database without frontend changes (API stays same, backend adds persistence layer)
- Frontend state structure designed to serialize for session save/load
- Video player abstraction allows adding multi-framerate sync logic later
- Annotation data structure extensible (add color, thickness properties later)

### Security Considerations

**MVP (Local Server, Trusted Users):**
- No authentication
- Basic input validation (file size, file type)
- No sensitive data stored

**Future (Cloud Deployment):**
- Implement authentication/authorization (JWT tokens)
- Secure video storage (private per-user)
- HTTPS required
- CORS configuration
- Rate limiting on upload endpoints
- Content-type validation beyond extension checking
- Malware scanning for uploaded files

### Performance Considerations

**Raspberry Pi 4 Constraints:**
- **CPU**: Quad-core ARM Cortex-A72 @ 1.5GHz
- **RAM**: 8GB (MVP minimum)
- **Storage**: Assume SSD (fast I/O)
- **Network**: Gigabit Ethernet (local network, low latency)

**Optimizations:**
- Avoid server-side video processing for MVP (CPU intensive)
- Stream videos efficiently (use HTTP range requests)
- Clean up temp files aggressively
- Profile memory usage during multi-video sessions
- Consider video transcoding to optimized formats in future phases

**Browser Performance:**
- Modern desktop browsers handle HTML5 video well
- Canvas rendering is GPU-accelerated
- requestAnimationFrame ties to browser refresh rate (~60fps)
- React rendering optimized with memo/useMemo where needed

### Error Handling & Logging

**User-Facing Errors:**
- Video format not supported → "This video format is not compatible. Please use MP4 (H.264) format."
- File too large → "Video file exceeds maximum size (200MB). Please use a shorter or lower resolution video."
- Upload failed → "Video upload failed. Please check your connection and try again."
- Different framerates → "Videos must have the same framerate for MVP. Video A: 30fps, Video B: 60fps."
- Browser incompatible → "Your browser does not support required features. Please use Chrome 83+, Safari 15.4+, or Firefox."

**Server-Side Logging:**
- Upload failures (with file size, format, error details)
- Video streaming errors
- Session cleanup events
- Uncaught exceptions with stack traces
- Log to file on server for debugging

### Testing Strategy

**Philosophy: Durable Testing Foundation from Phase 0**

Establish automated testing infrastructure during the spike phase that evolves throughout the project lifecycle. Tests created in Phase 0 serve as both spike validation and long-term regression prevention, growing alongside the application from prototype through production.

**Testing Frameworks:**
- **Playwright**: Cross-browser E2E and integration testing (Chrome, Firefox, Safari/WebKit)
- **Vitest**: Fast unit testing for pure logic (frame calculations, sync offset algorithms)
- **FFmpeg**: Programmatic generation of reproducible test video fixtures

**Phase 0 (Spike) Testing Approach:**
- **Automated testing from day 1**: Validate technical spikes (frame-stepping accuracy, video sync) with automated browser tests
- **Requirement traceability**: Map tests directly to FR/NFR IDs for validation tracking
- **Cross-browser validation**: Run tests across all target browsers in CI (GitHub Actions)
- **Test fixtures**: Generate reproducible test videos with frame counters using FFmpeg
- **Performance benchmarks**: Automated measurement of frame-step latency (NFR-1.4), annotation rendering (NFR-1.2)
- **Success criteria**: All automated tests pass with <100ms frame-step latency across browsers

**Test Evolution Strategy:**
- **Phase 0**: Core video player tests, sync offset calculations, frame-stepping accuracy
- **MVP (Phase 1)**: Add E2E workflow tests, API endpoint tests, UI component tests
- **Post-MVP**: Extend tests for new features (session persistence, mobile support, etc.)
- **Continuous**: Maintain requirement validation report (VALIDATION_REPORT.md) auto-generated from test results

**Architecture Benefits:**
- Page Object Model (POM) abstracts UI changes from test logic
- Shared test utilities grow with feature set
- CI pipeline enforces quality gates on every commit
- Test fixtures versioned and reproducible

**Manual Testing (Supplementary):**
- User experience validation for workflow intuitiveness
- Visual quality assessment of annotations
- Real-world video compatibility testing

**Detailed Documentation:** See `SPIKE_TESTING_STRATEGY.md` for comprehensive examples, CI configuration, fixture generation scripts, and test patterns.

### Development Approach: Phased Implementation

**Phase 0: Technical Spike (2-3 sessions)**
1. **Spike 1: Frame-accurate seeking**
   - Build minimal prototype with single video
   - Test `requestVideoFrameCallback()` across browsers
   - Validate frame number accuracy
   - Implement single-frame step forward/back
   - Success criteria: Reliable frame stepping, accurate frame counter
2. **Spike 2: Synchronized playback**
   - Build minimal prototype with two videos
   - Implement offset calculation and maintenance
   - Test sync during playback, seeking, stepping
   - Measure drift and implement correction
   - Success criteria: Videos stay in sync within 1 frame during playback
3. **Spike 3: Canvas overlay drawing**
   - Build minimal react-konva canvas over video
   - Implement basic line drawing
   - Test performance with video playing underneath
   - Success criteria: Smooth drawing, no video playback interference

**Phase 1: MVP Core Features**
Once spikes validate technical feasibility:
1. Backend skeleton (FastAPI, upload endpoint, video streaming)
2. Frontend skeleton (React app, routing, layout)
3. Video upload UI and backend integration
4. Single video player with controls
5. Dual video player layout
6. Sync mode implementation
7. Playback mode implementation
8. Frame stepping (coarse & fine)
9. Trim functionality
10. Annotation tools (polyline, oval, arrow, freehand)
11. Annotation delete
12. Error handling and polish
13. Deployment on Raspberry Pi

### Gotchas & Common Pitfalls

**Video Seeking Precision:**
- `video.currentTime` is a double (seconds), not frame number
- Seeking may land on nearby keyframe, not exact frame
- Different codecs handle seeking differently (H.264 vs. H.265)
- Solution: Use `requestVideoFrameCallback` metadata, not just currentTime

**Video Synchronization Drift:**
- Videos can drift out of sync due to buffering, decode delays
- `timeupdate` event is too coarse for frame-level sync
- Solution: Use `requestAnimationFrame` to check sync every frame, adjust as needed

**Canvas Coordinate Mapping:**
- Canvas size vs. display size (CSS) vs. video resolution can cause annotation misalignment
- Solution: Ensure canvas dimensions match video display dimensions exactly

**Browser Inconsistencies:**
- Safari handles video seeking differently than Chrome
- Firefox may require polyfill for `requestVideoFrameCallback`
- Solution: Test across all target browsers early and often

**Memory Leaks:**
- React components with video refs can leak if not cleaned up
- Konva layers can leak if not destroyed
- requestVideoFrameCallback callbacks must be cancelled on unmount
- Solution: Proper cleanup in useEffect return functions

**File Upload Timeouts:**
- Large video uploads can timeout with default settings
- Solution: Increase FastAPI timeout, show upload progress

**Raspberry Pi Performance:**
- Multiple high-res videos may strain CPU/RAM
- Solution: Profile early, optimize (or document minimum specs as RPi 4 8GB)
- (Note: Raspberry Pi is only for MVP barebones solution, not a long-term consideration; if Raspberry Pi proved insufficient we can migrate to a system with more resources; this should be a risk that we track in the project)

**Video Format Compatibility:**
- Not all MP4 files are equal (different codecs within container)
- Some phones encode with HEVC/H.265 (not universally supported in browsers)
- Solution: Validate browser support, provide clear error messages, consider server-side transcoding in future

### Open Questions for Implementation

1. **State Management Library**: Redux vs. Zustand - evaluate complexity and choose
2. **Styling Approach**: CSS Modules vs. Tailwind - decide in future based on further input
3. **Keyboard Shortcut Library**: Use existing lib (e.g., react-hotkeys-hook) or custom implementation
4. **Video Player Wrapper**: Build custom or use library like react-player (likely custom for frame control)
5. **Frontend Build Tool**: Vite vs. Create-React-App (lean toward Vite for modern, fast builds)
6. **Deployment**: Bare metal vs. Docker - decide based on ease of deployment/updates
7. **Process Management**: systemd vs. Docker Compose vs. simple script
8. **Frontend Routing**: React Router vs. none (likely single-page, minimal routing)

### Future Enhancements (Post-MVP Roadmap)

**Phase 2: Persistence & Library**
- Add PostgreSQL database
- Implement session save/load
- Implement video library with metadata, search, filtering
- User authentication/authorization

**Phase 3: Multi-Framerate Support**
- Implement fractional frame stepping for different framerates
- Enhance sync algorithm to handle framerate ratios
- Test with common framerate combinations (30/60, 30/120, 60/120)

**Phase 4: Advanced Annotations**
- Editable annotations (drag control points)
- Color, thickness, line style selection
- Text labels
- Angle measurement tool
- Time-based annotations (appear/disappear at specific frames)

**Phase 5: Export**
- Screenshot export with annotations
- Video export with annotations baked in (FFmpeg on backend)
- Share/collaboration features

**Phase 6: Mobile Support**
- Convert to PWA (Progressive Web App)
- Touch-optimized UI
- Mobile browser testing
- Consider native app wrappers (Capacitor)

**Phase 7: Coach Mode**
- Coach access to student videos with permissions
- Video commentary recording
- Annotation sharing
- Session sharing

**Phase 8: Cloud Deployment**
- Migrate to cloud hosting (AWS, GCP, or self-hosted VPS)
- Implement auto-scaling
- CDN for video delivery
- Multi-user support with proper isolation

**Phase 9: Advanced Features (EXPERIMENTAL)**
- Automatic sync point detection (ML-based ball impact detection)
- Swing analysis metrics (calculated from annotations, e.g., swing plane angle)
- Overlay graphics (swing path traces, comparison overlays)

---

## TECHNOLOGY-SPECIFIC NOTES

### FastAPI Best Practices
- Use `async def` for all endpoints (non-blocking I/O)
- Use `UploadFile` for video uploads (spooled temporary files)
- Enable CORS for development (restrict in production)
- Use Pydantic models for request/response validation
- Implement proper exception handlers
- Use dependency injection for shared resources
- Serve frontend static files via StaticFiles mount

### React + TypeScript Best Practices
- Use functional components with hooks (no class components)
- Use TypeScript strict mode
- Leverage `useMemo` and `useCallback` for performance
- Clean up effects properly (cancel callbacks, clear timers)
- Use ref forwarding for video elements
- Consider React Suspense for lazy loading if needed
- Use error boundaries for graceful error handling

### react-konva Best Practices
- Use `Stage` and `Layer` components properly
- Avoid re-creating shapes on every render (use React state)
- Use `onClick`, `onMouseDown`, `onMouseMove` for drawing interactions
- Implement custom hooks for drawing tools
- Cache layers if performance issues arise
- Clean up Konva resources on unmount

### requestVideoFrameCallback Best Practices
- Always cancel callback on component unmount
- Store callback ID in ref (not state) to avoid re-renders
- Use metadata.mediaTime for frame calculations, not metadata.presentationTime
- Be aware of browser support (Chrome 83+, Safari 15.4+, Firefox needs polyfill)
- Test across browsers for consistency

---

## GLOSSARY

- **DTL**: Down-the-line view (camera behind golfer looking toward target)
- **FO**: Face-on view (camera in front of golfer)
- **Framerate**: Number of frames per second (fps) in video (e.g., 30fps, 60fps, 120fps)
- **Sync Point**: The frame in each video that represents the same moment in time (typically ball impact)
- **Sync Offset**: The frame difference between two videos at their sync points
- **Trim Points**: Start and end frames/times that define the playback region
- **Annotation**: Graphical overlay drawn on video (line, arrow, circle, etc.)
- **Session**: A single analysis workflow (upload → sync → annotate → playback)
- **MVP**: Minimum Viable Product - first functional release with core features only
- **PWA**: Progressive Web App - web app that behaves like native mobile app
- **Spike**: Time-boxed technical investigation to validate feasibility

---

## SUMMARY

This design inputs document captures a comprehensive golf swing analyzer MVP with:

**Core Value Proposition:**
- Open-source platform for frame-accurate golf swing video analysis
- Supports single or dual video comparison with synchronized playback
- Drawing annotations to highlight swing mechanics
- Desktop web-based for MVP, expandable to mobile and cloud

**Technical Approach:**
- FastAPI (Python) backend for video upload/streaming
- React + TypeScript frontend with HTML5 video
- react-konva for canvas-based annotations
- requestVideoFrameCallback for frame-accurate control
- No database/persistence for MVP (stateless sessions)

**Key Challenges Identified:**
- Frame-accurate seeking (mitigated with requestVideoFrameCallback)
- Synchronized playback (mitigated with requestAnimationFrame)
- Large file handling (mitigated with FastAPI streaming)

**Recommended Approach:**
- Spike risky technical challenges first (frame accuracy, sync)
- Iterate on MVP core features after validation
- Phased rollout of future enhancements (persistence, mobile, cloud)
