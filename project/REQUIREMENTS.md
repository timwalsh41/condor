# Product Requirements: Golf Swing Analyzer

## Document Control

- **Version**: 1.0
- **Last Updated**: 2025-10-22
- **Status**: Active
- **Project Phase**: Phase 0 (Technical Spikes)

## Product Vision

### Overview

An open-source golf swing video analysis tool that enables golfers and coaches to compare and annotate swing videos frame-by-frame. The system supports loading one or two videos, synchronizing them temporally, and drawing annotations to highlight swing mechanics. The platform is designed to run on a local server (initially) with future expansion to cloud hosting and mobile platforms.

**Comparable Product**: V1 Golf App - https://v1sports.com/athletes/v1-golf-app/

### Goals & Objectives

- Enable precise frame-by-frame analysis of golf swings
- Support side-by-side video comparison with temporal synchronization
- Provide intuitive annotation tools for swing analysis
- Deliver smooth playback and responsive controls on target hardware (Raspberry Pi 4 8GB)
- Create maintainable, extensible open-source platform

### Stakeholders & Users

| Stakeholder            | Role                     | Primary Needs                                                      |
| ---------------------- | ------------------------ | ------------------------------------------------------------------ |
| Individual Golfers     | Primary Users            | Personal swing analysis, frame-accurate playback, annotation tools |
| Golf Coaches           | Secondary Users (Future) | Student video access, annotation sharing, feedback delivery        |
| Developers             | Maintainers              | Clear architecture, comprehensive tests, good documentation        |
| Community Contributors | Open Source              | Easy setup, clear contribution guidelines, modular design          |

## Functional Requirements

### Video Upload (REQ-F-UPLOAD)

#### REQ-F-UPLOAD-001: Local File Upload

- **Description**: System shall support local file upload from user's filesystem
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want to upload swing videos from my device so that I can analyze them
- **Acceptance Criteria**:
  - [ ] User can select video file from local filesystem
  - [ ] System accepts MP4 format with H.264 or H.265/HEVC codec (HTML5-compatible)
  - [ ] Upload supports files up to 200MB
  - [ ] Upload progress indicator displayed
  - [ ] Video metadata extracted (framerate, duration, resolution)
- **Dependencies**: None
- **Implementation Notes**:
  - Backend: FastAPI with `UploadFile` (multipart form data)
  - Frontend: HTML file input with drag-and-drop support
  - Storage: Temporary disk storage (not memory)

#### REQ-F-UPLOAD-002: Temporary Storage Management

- **Description**: System shall store uploaded videos temporarily on server disk
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a user, I want my videos stored temporarily so the system doesn't run out of memory
- **Acceptance Criteria**:
  - [ ] Videos stored in `/tmp/<session_id>/` directory structure
  - [ ] Each video has unique ID
  - [ ] Storage location not exposed to frontend
  - [ ] Automatic cleanup of files >1 hour old (background job)
  - [ ] Explicit cleanup on session end
- **Dependencies**: REQ-F-UPLOAD-001
- **Implementation Notes**:
  - Use session-based directory organization
  - Implement cleanup cron/background task (part of setup scripts/tools)

#### REQ-F-UPLOAD-003: Framerate Validation (MVP)

- **Description**: System shall validate that both uploaded videos have matching framerates
- **Priority**: High
- **Status**: Planned
- **User Story**: As a user, I want clear error messages if my videos have different framerates
- **Acceptance Criteria**:
  - [ ] System extracts framerate from each uploaded video
  - [ ] System compares framerates when 2 videos loaded
  - [ ] Clear error message displayed if framerates mismatch
  - [ ] Error message includes framerate values for each video
  - [ ] User can still use single-video mode if framerates differ
- **Dependencies**: REQ-F-UPLOAD-001
- **Implementation Notes**:
  - MVP constraint - multi-framerate support deferred to Phase 3
  - In future phases, framerate of videos should be displayed or available for review

### Video Playback (REQ-F-PLAYBACK)

#### REQ-F-PLAYBACK-001: Single Video Playback

- **Description**: System shall support loading and playing a single video
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want to play back my swing video so I can analyze it
- **Acceptance Criteria**:
  - [ ] Video loads and displays in browser
  - [ ] Smooth playback at native framerate
  - [ ] Current frame number displayed
  - [ ] Video resolution displayed
  - [ ] Video duration displayed
- **Dependencies**: REQ-F-UPLOAD-001
- **Implementation Notes**: HTML5 `<video>` element with `requestVideoFrameCallback`

#### REQ-F-PLAYBACK-002: Dual Video Display

- **Description**: System shall support side-by-side display of two videos
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want to compare two swing videos side-by-side so I can compare them
- **Acceptance Criteria**:
  - [ ] Two videos displayed side-by-side when loaded
  - [ ] Each video shows independent frame counter
  - [ ] Videos scale appropriately to browser window
  - [ ] Aspect ratios preserved
  - [ ] Equal height allocation for both videos
- **Dependencies**: REQ-F-UPLOAD-001, REQ-F-PLAYBACK-001
- **Implementation Notes**: Responsive CSS Grid or Flexbox layout

#### REQ-F-PLAYBACK-003: Video Streaming

- **Description**: System shall stream videos efficiently from server
- **Priority**: High
- **Status**: Planned
- **User Story**: As a user, I want videos to stream smoothly without loading entirely into memory
- **Acceptance Criteria**:
  - [ ] HTTP range requests supported for seeking
  - [ ] Video streams from backend endpoint
  - [ ] Browser handles buffering automatically
  - [ ] No memory issues with large video files
  - [ ] Seeking works smoothly
- **Dependencies**: REQ-F-UPLOAD-002
- **Implementation Notes**: FastAPI streaming response with range request support

### Synchronization Mode (REQ-F-SYNC)

#### REQ-F-SYNC-001: Independent Video Controls

- **Description**: System shall provide Sync Mode where each video has independent controls
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want to navigate each video independently to find the exact sync point so I can visualize the swing mechanical positions in the two videos simultaneously
- **Acceptance Criteria**:
  - [ ] "Sync Mode" button toggles independent control mode
  - [ ] Each video has its own play/pause button in Sync Mode
  - [ ] Each video has its own frame step forward/back buttons in Sync Mode
  - [ ] Each video has its own scrubber/seek bar in Sync Mode
  - [ ] Frame counters update independently in Sync Mode
  - [ ] Common playback speed controls
- **Dependencies**: REQ-F-PLAYBACK-002
- **Implementation Notes**:
  - Requires state management to track mode (sync vs. playback)
  - When handling videos at different framerates, playback rates should be modified for one video so that the relative progress of the videos is the same during simultaneous playback

#### REQ-F-SYNC-002: Sync Point Selection

- **Description**: System shall allow users to select sync frames for each video
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want to align my videos at ball impact so they play in sync
- **Acceptance Criteria**:
  - [ ] User can navigate each video to desired frame in Sync Mode
  - [ ] Coarse frame stepping (~5 frames) available for each video
  - [ ] Fine frame stepping (1 frame) available for each video
  - [ ] Current frame highlighted or marked as sync point
  - [ ] Visual indicator shows sync point set
- **Dependencies**: REQ-F-SYNC-001, REQ-F-FRAME-001
- **Implementation Notes**: Store sync frame number for each video on switch to Playback mode

#### REQ-F-SYNC-003: Sync Offset Calculation

- **Description**: System shall calculate and store sync offset between videos
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a user, I want my sync point preserved when switching to Playback Mode
- **Acceptance Criteria**:
  - [ ] Sync offset calculated: `offset = video2_sync_frame - video1_sync_frame`
  - [ ] Offset persists across mode switches
  - [ ] Offset applied correctly in Playback Mode
  - [ ] User can re-enter Sync Mode to adjust offset
  - [ ] Offset reset when new videos loaded
- **Dependencies**: REQ-F-SYNC-002
- **Implementation Notes**: For MVP with same framerate: `position_B = sync_frame_B + (position_A - sync_frame_A)`

#### REQ-F-SYNC-004: Playback Duration Equalization

- **Description**: System shall calculate and adjust effective playback start/end points to ensure both videos play for equal durations in Playback Mode
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a user, I want both videos to play for the same duration in Playback Mode so that neither video runs out before the other
- **Acceptance Criteria**:
  - [ ] System calculates pre-sync duration for each video (time between trim start and sync point)
  - [ ] System calculates post-sync duration for each video (time between sync point and trim end)
  - [ ] Effective start point adjusted: video with longer pre-sync duration shortened to match shorter video
  - [ ] Effective end point adjusted: video with longer post-sync duration shortened to match shorter video
  - [ ] Adjusted start/end points calculated when entering Playback Mode
  - [ ] Adjusted start/end points recalculated when sync point or trim points change
  - [ ] Both videos play for exactly the same total duration in Playback Mode
  - [ ] User-selected trim points preserved (not overwritten), only effective playback positions adjusted
  - [ ] Algorithm works correctly regardless of whether videos have same or different framerates
- **Dependencies**: REQ-F-SYNC-002, REQ-F-SYNC-003, REQ-F-TRIM-001
- **Implementation Notes**:
  - **Pre-sync adjustment algorithm (time-based):**
    - `pre_sync_time_A = (sync_frame_A - trim_start_A) / framerate_A`
    - `pre_sync_time_B = (sync_frame_B - trim_start_B) / framerate_B`
    - `min_pre_sync_time = min(pre_sync_time_A, pre_sync_time_B)`
    - `effective_start_frame_A = sync_frame_A - (min_pre_sync_time * framerate_A)`
    - `effective_start_frame_B = sync_frame_B - (min_pre_sync_time * framerate_B)`
  - **Post-sync adjustment algorithm (time-based):**
    - `post_sync_time_A = (trim_end_A - sync_frame_A) / framerate_A`
    - `post_sync_time_B = (trim_end_B - sync_frame_B) / framerate_B`
    - `min_post_sync_time = min(post_sync_time_A, post_sync_time_B)`
    - `effective_end_frame_A = sync_frame_A + (min_post_sync_time * framerate_A)`
    - `effective_end_frame_B = sync_frame_B + (min_post_sync_time * framerate_B)`
  - **Total playback duration:** `total_duration = min_pre_sync_time + min_post_sync_time` (same for both videos in seconds)
  - **MVP simplification:** When framerates are equal, time-based and frame-based calculations are equivalent
  - Trigger recalculation on: sync point change, trim boundary change, mode switch to Playback
  - Store both user-selected trim points AND calculated effective playback positions
  - Consider visual indicator showing effective playback region vs user-selected trim region

### Playback Mode (REQ-F-PLAY)

#### REQ-F-PLAY-001: Unified Playback Controls

- **Description**: System shall provide Playback Mode with unified controls for both videos
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want both videos to play in sync using one set of controls so I can analyze the videos
- **Acceptance Criteria**:
  - [ ] "Playback Mode" button toggles unified control mode
  - [ ] Single play/pause button controls both videos
  - [ ] Single scrubber controls both videos with offset maintained
  - [ ] Single set of frame step buttons (coarse and fine)
  - [ ] Single speed control slider/dropdown
  - [ ] Sync offset maintained during all operations
- **Dependencies**: REQ-F-SYNC-003, REQ-F-SYNC-004
- **Implementation Notes**:
  - Apply sync offset to video B position based on video A current position
  - Apply effective playback boundaries from REQ-F-SYNC-004 calculation
  - Playback constrained to effective start/end positions (not user-selected trim points)

#### REQ-F-PLAY-002: Playback Speed Control

- **Description**: System shall provide variable playback speed
- **Priority**: High
- **Status**: Planned
- **User Story**: As a golfer, I want to slow down or speed up playback for detailed analysis
- **Acceptance Criteria**:
  - [ ] Speed options: 0.1x, 0.25x, 0.5x, 0.75x, 1x, 2x (minimum)
  - [ ] Speed control accessible in Playback Mode
  - [ ] Speed change applies to both videos simultaneously
  - [ ] Sync maintained at all speeds
  - [ ] Current speed visually indicated
- **Dependencies**: REQ-F-PLAY-001
- **Implementation Notes**: HTML5 video `playbackRate` property

#### REQ-F-PLAY-003: Loop Playback

- **Description**: System shall support loop playback
- **Priority**: Medium
- **Status**: Planned
- **User Story**: As a golfer, I want videos to loop automatically so I can watch repeatedly
- **Acceptance Criteria**:
  - [ ] Loop toggle button available
  - [ ] When enabled, playback repeats from start after reaching end
  - [ ] Loop applies to both videos with sync maintained
  - [ ] Loop state visually indicated
  - [ ] Loop works with trim points (if set)
- **Dependencies**: REQ-F-PLAY-001
- **Implementation Notes**: HTML5 video loop attribute plus sync logic

### Frame-Accurate Seeking (REQ-F-FRAME)

#### REQ-F-FRAME-001: Frame Stepping

- **Description**: System shall support frame-accurate forward/backward stepping with exact frame accuracy (0 frame tolerance)
- **Priority**: Critical
- **Status**: In Progress (WebCodecs spike)
- **User Story**: As a golfer, I want to step through my swing frame-by-frame for detailed analysis
- **Acceptance Criteria**:
  - [ ] Coarse step forward button (5 frames exactly, 0 frame error)
  - [ ] Coarse step backward button (5 frames exactly, 0 frame error)
  - [ ] Fine step forward button (1 frame exactly, 0 frame error)
  - [ ] Fine step backward button (1 frame exactly, 0 frame error)
  - [ ] Frame counter updates accurately with each step (0 frame error)
  - [ ] Stepping maintains sync offset in Playback Mode (deferred to Phase 1)
  - [ ] Stepping works independently in Sync Mode (deferred to Phase 1)
- **Dependencies**: REQ-F-PLAYBACK-001
- **Implementation Notes**: WebCodecs API (VideoDecoder) provides deterministic frame-by-frame decode. Previous `requestVideoFrameCallback` approach achieved ±1 frame accuracy but failed to meet exact frame requirement (see Task 0.2 outcome).

#### REQ-F-FRAME-002: Frame Counter Display

- **Description**: System shall display exact frame numbers with 0 frame error
- **Priority**: High
- **Status**: In Progress (WebCodecs spike)
- **User Story**: As a golfer, I want to see exact frame numbers to reference specific positions
- **Acceptance Criteria**:
  - [ ] Frame counter displayed for each video
  - [ ] Counter updates in real-time during playback
  - [ ] Counter updates immediately on seek/step
  - [ ] Counter shows format: "Frame X of Y"
  - [ ] Counter accuracy: 0 frame error (exact frame number)
- **Dependencies**: REQ-F-FRAME-001
- **Implementation Notes**: Frame index from VideoDecoder provides exact frame numbers. Previous approach calculated from `currentTime` which introduced rounding errors.

#### REQ-F-FRAME-003: Seeking Precision

- **Description**: System shall provide exact frame-accurate seeking with deterministic behavior across browsers
- **Priority**: Critical
- **Status**: In Progress (WebCodecs spike)
- **User Story**: As a user, I want seeking to be exact and deterministic regardless of which browser I use
- **Acceptance Criteria**:
  - [ ] Scrubber/seek bar targets specific frame index
  - [ ] Seeking lands on exact target frame (0 frame error)
  - [ ] Works consistently in Chrome 94+, Firefox 130+, Safari 17.4+
  - [ ] No drift after multiple seek operations (0 frame cumulative error)
  - [ ] Deterministic behavior: seeking to frame N always displays frame N
- **Dependencies**: REQ-F-FRAME-001
- **Implementation Notes**: WebCodecs VideoDecoder provides deterministic frame-by-frame decode. Keyframe dependencies handled by decoding from nearest keyframe. Previous approach using `video.currentTime` was non-deterministic.

### Video Trimming (REQ-F-TRIM)

#### REQ-F-TRIM-001: Non-Destructive Trim

- **Description**: System shall support setting playback start/end points without modifying source video
- **Priority**: High
- **Status**: Planned
- **User Story**: As a golfer, I want to focus playback on relevant video portions without editing the file
- **Acceptance Criteria**:
  - [ ] Draggable handles on timeline for start/end points
  - [ ] Trim region visually highlighted on timeline
  - [ ] Source video file unchanged
  - [ ] User-selected trim points stored and preserved
  - [ ] Trim adjustment can be made in Sync Mode or Playback Mode
  - [ ] Trim adjustment does not change sync point or sync offset
  - [ ] Effective playback region recalculated when trim points change (see REQ-F-SYNC-004)
  - [ ] Frame counter relative to effective playback region
  - [ ] Scrubbing confined to effective playback region
- **Dependencies**: REQ-F-PLAYBACK-001
- **Implementation Notes**:
  - Store trim_start_frame and trim_end_frame per video (user-selected boundaries)
  - In Playback Mode, effective playback positions calculated per REQ-F-SYNC-004
  - In Sync Mode, playback uses user-selected trim points directly (no adjustment)
  - Trim points default to full video range (frame 0 to total_frames) if not set

#### REQ-F-TRIM-002: Trim Point Reset

- **Description**: System shall allow resetting trim points to full video range
- **Priority**: Medium
- **Status**: Planned
- **User Story**: As a user, I want to easily restore the full video range
- **Acceptance Criteria**:
  - [ ] "Reset Trim" button available
  - [ ] Button resets start to frame 0
  - [ ] Button resets end to final frame
  - [ ] Visual indicators update immediately
  - [ ] Works for both videos independently
- **Dependencies**: REQ-F-TRIM-001
- **Implementation Notes**: Simple state reset to null/default values

### Annotation Tools (REQ-F-ANNOT)

#### REQ-F-ANNOT-001: Drawing Tools

- **Description**: System shall provide annotation drawing tools over video
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want to draw lines and shapes on my swing video to highlight positions
- **Acceptance Criteria**:
  - [ ] Polyline tool (connected line segments)
  - [ ] Oval/circle tool
  - [ ] Arrow tool
  - [ ] Freehand drawing tool
  - [ ] Tool selection UI (buttons/icons)
  - [ ] Active tool visually indicated
- **Dependencies**: REQ-F-PLAYBACK-001
- **Implementation Notes**: react-konva for canvas-based drawing

#### REQ-F-ANNOT-002: Annotation Rendering

- **Description**: System shall render annotations as overlays on video
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a golfer, I want to see my annotations on top of the video
- **Acceptance Criteria**:
  - [ ] Annotations rendered on transparent canvas layer
  - [ ] Canvas precisely aligned with video display area
  - [ ] Annotations visible during playback
  - [ ] Annotations visible when paused
  - [ ] No performance degradation during playback
- **Dependencies**: REQ-F-ANNOT-001
- **Implementation Notes**: Canvas overlay with exact video dimensions, react-konva Stage/Layer

#### REQ-F-ANNOT-003: Annotation Management

- **Description**: System shall support managing annotations per video
- **Priority**: High
- **Status**: Planned
- **User Story**: As a user, I want to delete annotations and toggle visibility
- **Acceptance Criteria**:
  - [ ] Delete annotation button/control
  - [ ] Clicking annotation selects it
  - [ ] Selected annotation can be deleted
  - [ ] Toggle button to show/hide all annotations per video
  - [ ] Annotations independent between two videos
  - [ ] Annotation count indicator
- **Dependencies**: REQ-F-ANNOT-002
- **Implementation Notes**: State management for annotation data array per video

#### REQ-F-ANNOT-004: Annotation Style (MVP - Fixed)

- **Description**: Annotations shall use single default style in MVP
- **Priority**: Medium
- **Status**: Planned
- **User Story**: As a user, I want consistent annotation appearance (MVP simplification)
- **Acceptance Criteria**:
  - [ ] Single color for all annotations (e.g., red or yellow)
  - [ ] Single line thickness (e.g., 2px)
  - [ ] No color picker in MVP
  - [ ] No thickness selector in MVP
  - [ ] Style customization deferred to Phase 4
- **Dependencies**: REQ-F-ANNOT-001
- **Implementation Notes**: Hardcoded style constants, extensible for future

#### REQ-F-ANNOT-005: Static Annotations

- **Description**: Annotations shall be static (not time-based)
- **Priority**: High
- **Status**: Planned
- **User Story**: As a user, my annotations appear on all frames
- **Acceptance Criteria**:
  - [ ] Annotations drawn once appear on all frames
  - [ ] Annotations persist across playback/seek
        **Dependencies**: REQ-F-ANNOT-002
- **Implementation Notes**: Single annotation array, not per-frame

### Error Handling (REQ-F-ERROR)

#### REQ-F-ERROR-001: User-Facing Error Messages

- **Description**: System shall display clear, actionable error messages
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a user, I want to understand what went wrong and how to fix it
- **Acceptance Criteria**:
  - [ ] Unsupported format: "This video format is not compatible. Please use MP4 with H.264 or H.265/HEVC codec."
  - [ ] File too large: "Video file exceeds maximum size (200MB). Please use a shorter or lower resolution video."
  - [ ] Upload failed: "Video upload failed. Please check your connection and try again."
  - [ ] Framerate mismatch: "Videos must have the same framerate for MVP. Video A: X fps, Video B: Y fps."
  - [ ] Browser incompatible: "Your browser does not support required features. Please use Chrome 83+, Safari 15.4+, or Firefox."
- **Dependencies**: All upload/playback requirements
- **Implementation Notes**: Toast notifications or modal dialogs with friendly messages

#### REQ-F-ERROR-002: Server-Side Logging

- **Description**: System shall log errors on server for debugging
- **Priority**: High
- **Status**: Planned
- **User Story**: As a developer, I want detailed error logs to diagnose issues
- **Acceptance Criteria**:
  - [ ] Upload failures logged with file size, format, error details
  - [ ] Video streaming errors logged
  - [ ] Session cleanup events logged
  - [ ] Uncaught exceptions logged with stack traces
  - [ ] Logs written to `/var/log/condor/` or similar
  - [ ] Log rotation configured
- **Dependencies**: All functional requirements
- **Implementation Notes**: Python logging module with rotating file handler

### Deployment Documentation (REQ-F-DOC)

#### REQ-F-DOC-001: Installation Instructions

- **Description**: System shall include comprehensive deployment documentation
- **Priority**: Critical
- **Status**: Planned
- **User Story**: As a user, I want clear instructions to deploy the application on my host system
- **Acceptance Criteria**:
  - [ ] README.md with prerequisites (OS, dependencies, hardware)
  - [ ] Step-by-step backend setup instructions
  - [ ] Step-by-step frontend setup instructions
  - [ ] Instructions for starting/stopping services
  - [ ] Troubleshooting section for common issues
  - [ ] Example configuration files included
- **Dependencies**: All implementation requirements
- **Implementation Notes**:
  - Maintain README.md throughout development
  - Installation instructions should be concise:
    - Limit to the relevant information to setup, deploy, and verify installation
    - Avoid redundancy

---

## Non-Functional Requirements

### Performance (REQ-NF-P)

#### REQ-NF-P-001: Video Playback Smoothness

- **Description**: Video playback shall be smooth on target hardware for typical analysis workflows
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Frame stepping (primary use case) responds within 100ms (see REQ-NF-P-004)
  - [ ] Continuous playback at 1x speed: ≤5% dropped frames over 10-second test period
  - [ ] Slow-motion playback (0.25x-0.5x): ≤5% dropped frames over 10-second test period
  - [ ] Frame timing variance (jitter): standard deviation ≤10ms during continuous playback
  - [ ] Dual 1080p/30fps video playback on Raspberry Pi 4 8GB achieves >25fps average during continuous playback
  - [ ] CPU usage remains <80% during dual video playback on Raspberry Pi 4 8GB
- **Measurement Method**:
  - Automated Playwright tests measure dropped frame count using `requestVideoFrameCallback` timestamps
  - Frame timing variance calculated from timestamp deltas (expected ~33.3ms for 30fps)
  - Browser Performance API used to track actual vs expected frame delivery
  - System monitoring (htop/top) for CPU usage on Raspberry Pi 4
- **Implementation Notes**:
  - Use `requestVideoFrameCallback` to measure actual frame presentation times
  - Compare expected frame interval (1/framerate) against actual intervals
  - Dropped frame detected when time delta exceeds 1.5x expected interval
  - Calculate standard deviation of frame intervals to measure jitter
  - Test harness runs 10-second playback segments and reports metrics
- **Dependencies**: REQ-F-PLAYBACK-002, REQ-F-PLAY-001

#### REQ-NF-P-002: Annotation Rendering Performance

- **Description**: Annotation drawing and rendering shall be responsive
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Mouse event to canvas update latency: ≤16ms (measured at 95th percentile)
  - [ ] Drawing operation frame rate: ≥55fps during active annotation drawing
  - [ ] Annotation rendering during video playback: ≤5% dropped frames with 10 annotations present
  - [ ] Complex annotations (50+ points): render operation completes in ≤33ms (30fps target)
  - [ ] Canvas layer compositing overhead: ≤2ms per frame during playback
- **Measurement Method**:
  - Automated Playwright tests simulate mouse drawing events
  - Browser Performance API (`performance.now()`) measures event handler to render delta
  - `requestAnimationFrame` callback timing tracks drawing framerate
  - Konva `Stage.toCanvas()` timing for complex annotation render performance
  - Chrome DevTools Performance profiling for layer compositing overhead
- **Implementation Notes**:
  - Measure event-to-render latency: timestamp at `mousedown`/`mousemove` to next paint
  - Drawing FPS: count `requestAnimationFrame` callbacks during 1-second drawing session
  - Test with representative annotation complexity (freehand = 50+ points, geometric = 4-8 points)
  - Automated tests draw polyline with 50 points and measure render time
  - Test annotation overlay performance with video playback simultaneously active
- **Dependencies**: REQ-F-ANNOT-002

#### REQ-NF-P-003: Video Load Time

- **Description**: Video load time shall be reasonable over local network
- **Priority**: Medium
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] 200MB video loads in ≤5 seconds over gigabit Ethernet
  - [ ] Loading indicator displayed during upload
  - [ ] Streaming starts before full download complete
- **Measurement Method**: Network timing with target hardware
- **Dependencies**: REQ-F-UPLOAD-001

#### REQ-NF-P-004: Frame Stepping Response Time

- **Description**: Frame stepping shall respond quickly
- **Priority**: High
- **Status**: In Progress (WebCodecs spike)
- **Acceptance Criteria**:
  - [ ] Frame decode + render latency ≤50ms (cached frames ≤10ms)
  - [ ] No lag accumulation after multiple steps
  - [ ] Works consistently across Chrome 94+, Firefox 130+, Safari 17.4+
  - [ ] Hardware-accelerated decode utilized when available
- **Measurement Method**: Performance.now() timing of VideoDecoder output callback to canvas render. Automated Playwright tests validate latency across browsers.
- **Dependencies**: REQ-F-FRAME-001

#### REQ-NF-P-005: UI Interaction Response

- **Description**: UI interactions shall feel instantaneous
- **Priority**: Medium
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Button clicks respond in ≤100ms
  - [ ] Mode switching (Sync/Playback) ≤200ms
  - [ ] Tool selection immediate feedback (<50 ms)
- **Measurement Method**: Browser performance profiling
- **Dependencies**: All UI requirements

### Browser Compatibility (REQ-NF-BC)

#### REQ-NF-BC-001: Desktop Browser Support

- **Description**: System shall support modern desktop browsers
- **Priority**: Critical
- **Status**: Planned (WebCodecs browser validation pending)
- **Acceptance Criteria**:
  - [ ] Chrome 94+: WebCodecs frame control features functional
  - [ ] Firefox 130+: WebCodecs frame control features functional
  - [ ] Safari 17.4+: WebCodecs frame control features functional
  - [ ] Edge 94+ (Chromium): WebCodecs frame control features functional
  - [ ] Cross-browser consistency for frame stepping: 0 frame difference (exact frame accuracy)
  - [ ] WebCodecs API (VideoDecoder, VideoFrame, EncodedVideoChunk) available and functional
  - [ ] All core features (upload, dual video, sync, annotations) validated across browsers (pending Phase 1 implementation)
- **Measurement Method**:
  - Playwright automated test suite runs against all target browsers
  - Test suite covers: video upload, playback, sync workflow, frame stepping, annotation tools
  - Frame-accuracy tests verify exact frame positions across browsers (0 frame tolerance)
  - Visual regression tests compare screenshots across browsers (pixel diff ≤2px)
  - Feature detection tests verify WebCodecs API availability (VideoDecoder.isConfigSupported())
- **Implementation Notes**:
  - Test cross-browser during Phase 0 Task 0.3 (WebCodecs spike)
  - Core features = upload, dual video playback, sync mode, frame stepping, annotations, playback controls
  - Minimum browser versions: Chrome 94+, Firefox 130+, Safari 17.4+ (WebCodecs support)
  - Show clear error message for unsupported browsers (see REQ-F-ERROR-001)
  - CI/CD pipeline runs tests on all target browsers before merge
- **Dependencies**: All functional requirements

#### REQ-NF-BC-002: Browser Feature Detection

- **Description**: System shall detect and handle unsupported browsers
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] `requestVideoFrameCallback` availability checked
  - [ ] HTML5 video support checked
  - [ ] Canvas API support checked
  - [ ] User notified if browser unsupported
  - [ ] Clear upgrade message provided
- **Dependencies**: REQ-F-ERROR-001
- **Implementation Notes**: Feature detection in app bootstrap

### Scalability (REQ-NF-SC)

#### REQ-NF-SC-001: Single User Operation (MVP)

- **Description**: MVP shall support single concurrent user
- **Priority**: Critical
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Single user can upload and analyze videos
  - [ ] No multi-user conflict handling needed
  - [ ] Session isolation not required for MVP
- **Dependencies**: None
- **Implementation Notes**: Local server model for MVP

#### REQ-NF-SC-002: Future Scalability Design

- **Description**: Architecture shall support future multi-user expansion
- **Priority**: Low
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Session ID included in all video upload/access API calls (enables future user isolation)
  - [ ] Backend API is stateless: no user state stored in application memory, all state client-side or in files
  - [ ] Backend API follows REST constraints: HTTP methods (GET/POST/DELETE), stateless, resource-based URLs
  - [ ] Data access layer abstracted: all file I/O goes through service/repository classes (not direct in endpoints)
  - [ ] Zero frontend API calls reference file system paths directly (all paths handled server-side)
  - [ ] Architecture documented: clear module boundaries between presentation, business logic, and data layers
- **Measurement Method**:
  - Code review verifies session ID in API signatures
  - Static analysis confirms no global state or class variables storing user data in backend
  - API endpoint audit confirms REST compliance (correct HTTP methods, resource-oriented URLs)
  - Code review verifies file access isolated to data service layer
  - Frontend code review confirms no direct file path references
  - Architecture documentation review confirms layer separation documented
- **Implementation Notes**:
  - Design with future cloud deployment in mind
  - Data layer abstraction allows swapping local filesystem for database without frontend changes
  - REST constraint verification: GET for retrieval, POST for creation, DELETE for cleanup
  - Future database migration: replace file service with database repository, API contracts unchanged
- **Dependencies**: All implementation requirements

### Reliability (REQ-NF-R)

#### REQ-NF-R-001: Video Format Handling

- **Description**: System shall handle video format variations gracefully
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Video resolutions 720p-4K successfully upload and playback (tested: 720p, 1080p, 1440p, 4K)
  - [ ] Framerates 30-240fps successfully upload and playback (tested: 30fps, 60fps, 120fps, 240fps)
  - [ ] Supported MP4 encodings (H.264, H.265/HEVC) detected via metadata extraction and accepted
  - [ ] Unsupported formats (AVI, MOV with non-H.264/H.265, WebM, etc.) rejected with error message within 2 seconds of upload
  - [ ] Error message specifies unsupported format/codec and recommends MP4 (H.264 or H.265/HEVC)
  - [ ] Codec validation: 100% of test videos with supported codecs accepted, 100% with unsupported codecs rejected
- **Measurement Method**:
  - Automated test suite uploads sample videos at different resolutions and framerates
  - Backend logs extraction of video metadata (resolution, framerate, codec)
  - Test harness validates playback succeeds for supported formats
  - Automated tests submit unsupported formats and verify rejection with correct error message
  - ffprobe or similar tool validates extracted metadata accuracy
- **Implementation Notes**:
  - Server-side video metadata extraction using ffprobe or Python libraries (e.g., opencv-python, ffmpeg-python)
  - Document explicit list of supported MP4 encodings in README.md
  - Supported codecs MVP: H.264 (required), H.265/HEVC (required)
  - Test files: maintain test video corpus with representative formats
- **Dependencies**: REQ-F-ERROR-001

#### REQ-NF-R-002: Temporary File Cleanup

- **Description**: System shall clean up temporary files reliably
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Cleanup on explicit session end
  - [ ] Background job cleans files >1 hour old
  - [ ] Cleanup works even if browser crashes
  - [ ] Disk space monitored and logged
  - [ ] Failed uploads cleaned up
- **Dependencies**: REQ-F-UPLOAD-002
- **Implementation Notes**: Scheduled cleanup task, crash-safe design

#### REQ-NF-R-003: Memory Leak Prevention

- **Description**: System shall prevent memory leaks during long sessions
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] React components clean up properly (`useEffect` return)
  - [ ] `requestVideoFrameCallback` cancelled on unmount
  - [ ] Konva layers destroyed on unmount
  - [ ] No (<0.5%) memory growth over 1-hour session
  - [ ] Video refs released properly
- **Dependencies**: All frontend requirements
- **Implementation Notes**: Careful resource cleanup in React lifecycle

### Usability (REQ-NF-U)

#### REQ-NF-U-001: Intuitive Interface

- **Description**: UI shall be intuitive for non-technical golf enthusiasts
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] 100% of primary controls (play, pause, frame step, sync/playback mode, upload) visible on initial page load without expanding menus
  - [ ] UI contrast ratio ≥4.5:1 for all text and controls (WCAG AA standard)
  - [ ] Button placement consistent: playback controls centered below videos, mode controls top-right
  - [ ] 100% of interactive elements have visible text labels (icons alone not used)
  - [ ] Zero technical jargon in user-facing text (no terms like "framerate", "codec", "RESTful", etc.)
- **Measurement Method**:
  - Automated DOM inspection verifies all primary controls present without JavaScript interactions
  - Contrast ratio validation using automated accessibility testing tools (axe-core, Lighthouse)
  - Visual regression tests verify button placement consistency across pages
  - Automated text analysis scans for technical terms from exclusion list
  - Accessibility audit confirms all interactive elements have accessible labels
- **Implementation Notes**:
  - User testing with non-technical golfers recommended but not required for acceptance
  - Technical terms allowed in error messages only if accompanied by plain language explanation
  - "Primary controls" = play/pause, frame step, mode toggle, video upload, annotation tools
- **Dependencies**: All UI requirements

#### REQ-NF-U-002: Sync Workflow Discoverability

- **Description**: Sync workflow shall be discoverable and easy to execute
- **Priority**: Critical
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Sync Mode button labeled "Sync Mode" (no abbreviations) and positioned in top-right control area
  - [ ] Current mode indicated with contrasting background color and text label (e.g., badge showing "Sync Mode" or "Playback Mode")
  - [ ] Help text visible when Sync Mode active: "Navigate each video to desired sync point, then switch to Playback Mode"
  - [ ] Sync point marked on timeline with visual indicator (vertical line, icon, or color change) when set
  - [ ] Mode toggle button disabled with tooltip when <2 videos loaded
  - [ ] Usability test: ≥80% of test users (n≥5) complete sync workflow without external documentation
- **Measurement Method**:
  - Automated DOM inspection verifies button label text and position
  - Visual regression tests verify mode indicator styling changes between modes
  - Automated accessibility tests verify help text visibility and ARIA labels
  - Manual usability testing with 5-10 non-technical users (video recorded for analysis)
  - Success metric: user completes workflow = loads 2 videos, sets sync points, switches to Playback, videos play synchronized
- **Implementation Notes**:
  - Clear UI/UX design, onboarding hints
  - Usability testing recommended during development but not blocking for MVP completion
  - Consider progressive disclosure: show help text on first Sync Mode activation only
- **Dependencies**: REQ-F-SYNC-001, REQ-F-SYNC-002

#### REQ-NF-U-003: Annotation Tool Responsiveness

- **Description**: Annotation tools shall be responsive and easy to use
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Drawing responsiveness: meets REQ-NF-P-002 performance criteria (≤16ms latency, ≥55fps)
  - [ ] Tool cursor changes within 50ms of tool selection click
  - [ ] Visual feedback during drawing: cursor position matches rendered line within 5 pixels
  - [ ] Undo/delete controls respond within 100ms (see REQ-NF-P-005)
  - [ ] Drawing confined to video area: 100% of mouse events outside video bounds ignored
  - [ ] Canvas clipping prevents annotation rendering outside video bounds
- **Measurement Method**:
  - Automated Playwright tests measure cursor change timing with `performance.now()`
  - Visual regression tests verify cursor-to-line positioning accuracy (pixel comparison)
  - Boundary tests simulate mouse events outside video area and verify no annotations created
  - DOM inspection confirms canvas clipping rect matches video dimensions
- **Implementation Notes**:
  - Cross-reference REQ-NF-P-002 for drawing performance requirements
  - Use CSS `cursor` property with tool-specific cursors (crosshair, pencil, etc.)
  - Implement canvas clipping with Konva `clip()` or CSS `clip-path`
  - Mouse event handlers check bounds before creating annotation objects
  - Automated tests verify cursor positioning accuracy by comparing screenshot diffs
- **Dependencies**: REQ-F-ANNOT-001, REQ-F-ANNOT-002

### Maintainability (REQ-NF-M)

#### REQ-NF-M-001: Code Quality Standards

- **Description**: Code shall follow clean architecture and quality standards
- **Priority**: High
- **Status**: Implemented (TypeScript strict mode enabled, ESLint configured and passing)
- **Acceptance Criteria**:
  - [ ] Backend: 100% of public functions/methods have type hints, mypy passes with 0 errors
  - [ ] Backend: 100% of public functions/classes/modules have Google-style docstrings
  - [ ] Backend: Flake8/Black passes with 0 PEP8 violations
  - [ ] Frontend: TypeScript strict mode enabled, tsc compiles with 0 errors
  - [ ] Frontend: ESLint passes with 0 errors (warnings acceptable)
  - [ ] Test coverage ≥80% for core logic modules (video sync, annotation rendering, playback control)
  - [ ] Zero files exceed 1000 lines
  - [ ] Zero functions exceed 100 lines
  - [ ] Module separation verified: frontend code in `/frontend`, backend in `/backend`, no cross-imports
  - [ ] Layer separation verified: video logic in separate module from annotation logic, no circular dependencies
- **Measurement Method**:
  - mypy, Flake8/Black automated checks in CI/CD
  - TypeScript compiler (`tsc --noEmit`) and ESLint in CI/CD
  - Coverage.py / istanbul for code coverage metrics
  - Static analysis tool (e.g., `wc -l`, `scc`) counts lines per file/function
  - Import analysis verifies no frontend imports backend modules and vice versa
  - Dependency graph analysis (e.g., `madge` for TypeScript, custom script for Python) detects circular dependencies
- **Implementation Notes**:
  - Linting and type checking in CI/CD pipeline (must pass to merge)
  - Core logic modules: video playback, sync calculation, annotation rendering, frame stepping
  - Use pre-commit hooks to run linting locally before commit
- **Dependencies**: All implementation requirements

#### REQ-NF-M-002: Documentation Standards

- **Description**: System shall be well-documented for open-source contributions
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] README.md exists with all sections: prerequisites, installation, usage, architecture overview, contribution guidelines
  - [ ] Backend API documentation auto-generated via FastAPI /docs endpoint (100% of endpoints documented)
  - [ ] All complex algorithms (sync calculation, frame stepping) have inline comments explaining logic
  - [ ] Minimum 1 architecture diagram in `docs/` folder showing system components and data flow
  - [ ] CONTRIBUTING.md file exists with setup instructions, code style guide, PR process
  - [ ] LICENSE file exists (open-source license: MIT, Apache 2.0, or GPL)
  - [ ] 100% of public API functions have docstrings with parameters, returns, and examples
- **Measurement Method**:
  - File existence check: README.md, CONTRIBUTING.md, LICENSE, docs/\*.{png,svg}
  - README section verification: grep for section headings (Prerequisites, Installation, Usage, Architecture, Contributing)
  - FastAPI /docs endpoint accessibility test (HTTP 200 response)
  - Docstring coverage tool (e.g., `interrogate` for Python, `typedoc` for TypeScript)
  - Manual review confirms architecture diagram shows key components
  - License validity check: file contains recognized open-source license text
- **Implementation Notes**:
  - Maintain documentation alongside code changes
  - Use mermaid.js or draw.io for architecture diagrams
  - FastAPI automatically generates /docs from decorators and docstrings
  - Complex algorithms = sync offset calculation, playback duration equalization, frame stepping logic
- **Dependencies**: All implementation requirements

#### REQ-NF-M-003: Standard Libraries and Frameworks

- **Description**: System shall use standard, well-maintained libraries to ensure long-term maintainability
- **Priority**: Medium
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] All core dependencies actively maintained (commits/releases within past 6 months)
  - [ ] All core dependencies have ≥1000 GitHub stars or equivalent community adoption metrics
  - [ ] All core dependencies have LTS (Long Term Support) or stable release versions
  - [ ] No dependencies marked as deprecated or archived
  - [ ] Dependency security audit passes with no high/critical vulnerabilities
  - [ ] Major framework/library versions documented with upgrade path identified
- **Measurement Method**:
  - GitHub activity metrics (commits, issues, releases)
  - npm audit / pip audit for security vulnerabilities
  - Package registry metrics (downloads, stars, forks)
  - Manual review of deprecation status in package documentation
- **Dependencies**: All implementation requirements
- **Implementation Notes**:
  - Technology stack documented in Technical Constraints section and MVP_PRP.md
  - Selected libraries: React 18+, FastAPI, react-konva, HTML5 APIs (see PRP for rationale)
  - Run `npm audit` and `pip audit` in CI/CD
  - Review dependency health quarterly for long-term projects

### Portability (REQ-NF-PT)

#### REQ-NF-PT-001: Raspberry Pi 4 Deployment

- **Description**: System shall run on Ubuntu Linux on Raspberry Pi 4 (8GB minimum)
- **Priority**: Critical
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Installation successful on Ubuntu 22.04 LTS (ARM64) without manual compilation
  - [ ] Backend startup time ≤10 seconds
  - [ ] Frontend build completes successfully on ARM64 architecture
  - [ ] Frontend served successfully with HTTP 200 response
  - [ ] No ARM-incompatible dependencies or x86-only binaries
  - [ ] Dual video playback meets REQ-NF-P-001 criteria on Raspberry Pi 4 8GB (>25fps, <80% CPU)
  - [ ] System memory usage ≤4GB during dual video playback
- **Measurement Method**:
  - Automated installation script verifies all components start successfully
  - Systemd service status monitoring for backend startup timing
  - Playwright tests run on Raspberry Pi 4 to validate performance criteria
  - System monitoring (htop/free) for CPU and memory usage
  - Architecture check: `uname -m` reports aarch64, all binaries validated with `file` command
- **Implementation Notes**:
  - Test on actual Raspberry Pi 4 8GB hardware
  - Use pre-built ARM wheels for Python packages where available
  - Cross-reference REQ-NF-P-001 for playback performance requirements
  - Installation script should validate ARM architecture before proceeding
  - Develop automated test suite to run on Raspberry Pi 4 8GB hardware
- **Dependencies**: All implementation requirements

#### REQ-NF-PT-002: No Proprietary Dependencies

- **Description**: System shall not depend on proprietary services
- **Priority**: High
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] No cloud services required for MVP
  - [ ] All dependencies open-source
  - [ ] Works fully offline (after initial setup)
  - [ ] No license fees for MVP deployment
- **Dependencies**: All implementation requirements
- **Implementation Notes**: Ensure open-source license compatibility

#### REQ-NF-PT-003: Cloud Migration Path

- **Description**: Architecture shall support future cloud hosting migration
- **Priority**: Low
- **Status**: Planned
- **Acceptance Criteria**:
  - [ ] Stateless backend design
  - [ ] Environment-based configuration
  - [ ] Storage abstraction allows cloud object storage swap
  - [ ] No hard-coded local paths in business logic
- **Dependencies**: REQ-NF-SC-002
- **Implementation Notes**: Design patterns that work locally and in cloud

---

## Technical Constraints

### Platform Requirements

- **Operating Systems**: Ubuntu Linux (ARM - Raspberry Pi 4 for MVP)
- **Python Version**: 3.11 or higher
- **Node.js Version**: 18+ (for frontend build)
- **Deployment**: Local server, desktop browser clients

### Technical Standards

- **Backend Code Quality**: PEP8, type hints (mypy), docstrings
- **Frontend Code Quality**: TypeScript strict mode, ESLint
- **Testing Requirements**:
  - Playwright for E2E tests (cross-browser)
  - Vitest for unit tests
  - > 80% coverage for core logic
- **Documentation Standards**: Google-style docstrings, README, architecture docs
- **Version Control**: Git with feature branches

---

## Integration Requirements

### External Systems

None for MVP - all processing local

### Browser APIs

#### INT-001: WebCodecs API

- **Description**: Direct video frame decode for exact frame control
- **Integration Type**: Browser Web API
- **Browser Support**: Chrome 94+, Firefox 130+, Safari 17.4+, Edge 94+ (~95% market coverage as of Nov 2024)
- **Requirements**: REQ-F-FRAME-001, REQ-F-FRAME-002, REQ-F-FRAME-003, REQ-F-SYNC-002, REQ-F-SYNC-003
- **Documentation**:
  - MDN VideoDecoder: https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder
  - W3C WebCodecs Spec: https://w3c.github.io/webcodecs/
  - Web.dev Guide: https://web.dev/articles/webcodecs
- **Critical**: Core to exact frame-accurate playback and deterministic dual-video sync - validated in Phase 0 Task 0.3

#### INT-002: mp4box.js Library

- **Description**: JavaScript MP4 container parser for extracting codec configuration and video samples
- **Integration Type**: npm package
- **Browser Support**: All modern browsers
- **Requirements**: REQ-F-FRAME-001 (provides frame data for WebCodecs decode)
- **Documentation**: https://github.com/gpac/mp4box.js/
- **Critical**: Required for WebCodecs - extracts codec config bytes and EncodedVideoChunk data from MP4 files

#### INT-003: HTML5 Video API

- **Description**: Video playback, speed control
- **Integration Type**: Browser Web API
- **Browser Support**: All modern browsers
- **Requirements**: REQ-F-PLAYBACK-001 (background playback only), REQ-F-PLAYBACK-002, REQ-F-PLAY-002 (speed control)
- **Documentation**: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
- **Note**: Used only for continuous playback and speed control. Frame-accurate seeking utilizes WebCodecs approach.

#### INT-004: Canvas API (via react-konva)

- **Description**: Video frame rendering (from WebCodecs VideoFrame) and annotation drawing
- **Integration Type**: Browser Web API (wrapped by react-konva)
- **Browser Support**: All modern browsers
- **Requirements**:
  - REQ-F-FRAME-001 (VideoFrame rendering to canvas)
  - REQ-F-ANNOT-001, REQ-F-ANNOT-002 (annotation drawing)
- **Documentation**: https://konvajs.org/docs/react/index.html
- **Note**: Canvas used for both decoded VideoFrame rendering and annotation overlay drawing

---

## Requirements Traceability Matrix

| Requirement ID     | Title                          | Priority | Status  | Dependencies                                   | Phase |
| ------------------ | ------------------------------ | -------- | ------- | ---------------------------------------------- | ----- |
| REQ-F-UPLOAD-001   | Local File Upload              | Critical | Planned | None                                           | 0/1   |
| REQ-F-UPLOAD-002   | Temporary Storage              | Critical | Planned | REQ-F-UPLOAD-001                               | 1     |
| REQ-F-UPLOAD-003   | Framerate Validation           | High     | Planned | REQ-F-UPLOAD-001                               | 1     |
| REQ-F-PLAYBACK-001 | Single Video Playback          | Critical | Planned | REQ-F-UPLOAD-001                               | 0/1   |
| REQ-F-PLAYBACK-002 | Dual Video Display             | Critical | Planned | REQ-F-PLAYBACK-001                             | 0/1   |
| REQ-F-PLAYBACK-003 | Video Streaming                | High     | Planned | REQ-F-UPLOAD-002                               | 1     |
| REQ-F-SYNC-001     | Independent Controls           | Critical | Planned | REQ-F-PLAYBACK-002                             | 0/1   |
| REQ-F-SYNC-002     | Sync Point Selection           | Critical | Planned | REQ-F-SYNC-001                                 | 0/1   |
| REQ-F-SYNC-003     | Sync Offset Calc               | Critical | Planned | REQ-F-SYNC-002                                 | 0/1   |
| REQ-F-SYNC-004     | Playback Duration Equalization | Critical | Planned | REQ-F-SYNC-002, REQ-F-SYNC-003, REQ-F-TRIM-001 | 0/1   |
| REQ-F-PLAY-001     | Unified Controls               | Critical | Planned | REQ-F-SYNC-003                                 | 0/1   |
| REQ-F-PLAY-002     | Speed Control                  | High     | Planned | REQ-F-PLAY-001                                 | 1     |
| REQ-F-PLAY-003     | Loop Playback                  | Medium   | Planned | REQ-F-PLAY-001                                 | 1     |
| REQ-F-FRAME-001    | Frame Stepping                 | Critical | Planned | REQ-F-PLAYBACK-001                             | 0     |
| REQ-F-FRAME-002    | Frame Counter                  | High     | Planned | REQ-F-FRAME-001                                | 0/1   |
| REQ-F-FRAME-003    | Seeking Precision              | Critical | Planned | REQ-F-FRAME-001                                | 0     |
| REQ-F-TRIM-001     | Non-Destructive Trim           | High     | Planned | REQ-F-PLAYBACK-001                             | 1     |
| REQ-F-TRIM-002     | Trim Reset                     | Medium   | Planned | REQ-F-TRIM-001                                 | 1     |
| REQ-F-ANNOT-001    | Drawing Tools                  | Critical | Planned | REQ-F-PLAYBACK-001                             | 0/1   |
| REQ-F-ANNOT-002    | Annotation Rendering           | Critical | Planned | REQ-F-ANNOT-001                                | 0/1   |
| REQ-F-ANNOT-003    | Annotation Management          | High     | Planned | REQ-F-ANNOT-002                                | 1     |
| REQ-F-ANNOT-004    | Fixed Style (MVP)              | Medium   | Planned | REQ-F-ANNOT-001                                | 1     |
| REQ-F-ANNOT-005    | Static Annotations             | High     | Planned | REQ-F-ANNOT-002                                | 1     |
| REQ-F-ERROR-001    | User Error Messages            | Critical | Planned | All                                            | 1     |
| REQ-F-ERROR-002    | Server Logging                 | High     | Planned | All                                            | 1     |
| REQ-F-DOC-001      | Installation Docs              | Critical | Planned | All                                            | 1     |
| REQ-NF-P-001       | Playback Smoothness            | High     | Planned | REQ-F-PLAYBACK-002                             | 0/1   |
| REQ-NF-P-002       | Annotation Performance         | High     | Planned | REQ-F-ANNOT-002                                | 0/1   |
| REQ-NF-P-003       | Video Load Time                | Medium   | Planned | REQ-F-UPLOAD-001                               | 1     |
| REQ-NF-P-004       | Frame Step Response            | High     | Planned | REQ-F-FRAME-001                                | 0     |
| REQ-NF-P-005       | UI Response                    | Medium   | Planned | All                                            | 1     |
| REQ-NF-BC-001      | Desktop Browser Support        | Critical | Planned | All                                            | 0     |
| REQ-NF-BC-002      | Feature Detection              | High     | Planned | REQ-F-ERROR-001                                | 1     |
| REQ-NF-SC-001      | Single User (MVP)              | Critical | Planned | None                                           | 1     |
| REQ-NF-SC-002      | Future Scalability             | Low      | Planned | All                                            | 1     |
| REQ-NF-R-001       | Video Format Handling          | High     | Planned | REQ-F-ERROR-001                                | 1     |
| REQ-NF-R-002       | File Cleanup                   | High     | Planned | REQ-F-UPLOAD-002                               | 1     |
| REQ-NF-R-003       | Memory Leak Prevention         | High     | Planned | All                                            | 1     |
| REQ-NF-U-001       | Intuitive Interface            | High     | Planned | All                                            | 1     |
| REQ-NF-U-002       | Sync Discoverability           | Critical | Planned | REQ-F-SYNC-001                                 | 1     |
| REQ-NF-U-003       | Annotation Usability           | High     | Planned | REQ-F-ANNOT-001                                | 1     |
| REQ-NF-M-001       | Code Quality                   | High     | Planned | All                                            | 0/1   |
| REQ-NF-M-002       | Documentation                  | High     | Planned | All                                            | 0/1   |
| REQ-NF-M-003       | Standard Libraries             | Medium   | Planned | All                                            | 0/1   |
| REQ-NF-PT-001      | Raspberry Pi Deployment        | Critical | Planned | All                                            | 1     |
| REQ-NF-PT-002      | No Proprietary Deps            | High     | Planned | All                                            | 0/1   |
| REQ-NF-PT-003      | Cloud Migration Path           | Low      | Planned | REQ-NF-SC-002                                  | 1     |

**Phase Legend:**

- **Phase 0**: Technical spikes to validate feasibility (2-3 sessions)
- **Phase 1**: MVP core features implementation
- **0/1**: Requirement spans both Phase 0 (spike) and Phase 1 (full implementation)

---

## Requirements Coverage Analysis

### Implementation Coverage

**Total Requirements**: 47

- **Planned**: 42 (89%)
- **In Progress**: 5 (11%)
  - REQ-F-FRAME-001: Frame Stepping (WebCodecs spike)
  - REQ-F-FRAME-002: Frame Counter Display (WebCodecs spike)
  - REQ-F-FRAME-003: Seeking Precision (WebCodecs spike)
  - REQ-NF-P-004: Frame Stepping Response Time (WebCodecs spike)
  - REQ-NF-M-001: Code Quality Standards (frontend TypeScript + ESLint)
- **Implemented (Awaiting Validation)**: 0 (0%)
- **Validated**: 0 (0%)

### Session 4 Progress (2025-11-14)

- **Architectural Pivot**: WebCodecs API adopted for exact frame accuracy (0 tolerance)
- **Deprecated Validations**: REQ-F-FRAME-001/002/003, REQ-NF-P-004 (achieved ±1 frame but failed 0 tolerance)
- **Updated**: Browser requirements (Chrome 94+, Firefox 130+, Safari 17.4+)
- **Added**: INT-002 mp4box.js integration requirement
- **In Progress**: 5 requirements updated for WebCodecs spike (Task 0.3)

### Session 3 Progress (2025-11-12)

- **Validated (Deprecated)**: 4 requirements with ±1 frame tolerance (REQ-F-FRAME-001, REQ-F-FRAME-002, REQ-F-FRAME-003, REQ-NF-P-004)
- **Critical Finding**: Exact frame accuracy (0 tolerance) not achievable with requestVideoFrameCallback approach

### Session 2 Progress (2025-11-09)

- **Implemented (Awaiting Validation)**: 5 requirements initially, pending test fixes

### Session 1 Progress (2025-10-29)

- **Implemented (Awaiting Validation)**: 5 requirements implemented but test environment blocked validation

### Priority Breakdown

- **Critical**: 19 (0% Complete, 3 In Progress)
- **High**: 22 (0% Complete, 2 In Progress)
- **Medium**: 6 (0% Complete)
- **Low**: 2 (0% Complete)

### Requirements by Area

- **Video Upload**: 3 requirements (0% Complete)
- **Video Playback**: 3 requirements (0% Complete)
- **Synchronization**: 4 requirements (0% Complete)
- **Playback Mode**: 3 requirements (0% Complete)
- **Frame Control**: 3 requirements (0% Complete)
- **Trimming**: 2 requirements (0% Complete)
- **Annotations**: 5 requirements (0% Complete)
- **Error Handling**: 2 requirements (0% Complete)
- **Documentation**: 1 requirement (0% Complete)
- **Non-Functional**: 21 requirements (0% Complete)

---

## Change History

### Version 1.0 - 2025-10-22

**Initial Release - MVP Scope Definition**

**Functional Requirements (26 total):**

- REQ-F-UPLOAD-001 through REQ-F-UPLOAD-003: Video Upload (3)
- REQ-F-PLAYBACK-001 through REQ-F-PLAYBACK-003: Video Playback (3)
- REQ-F-SYNC-001 through REQ-F-SYNC-004: Synchronization Mode (4)
- REQ-F-PLAY-001 through REQ-F-PLAY-003: Playback Mode (3)
- REQ-F-FRAME-001 through REQ-F-FRAME-003: Frame-Accurate Seeking (3)
- REQ-F-TRIM-001 through REQ-F-TRIM-002: Video Trimming (2)
- REQ-F-ANNOT-001 through REQ-F-ANNOT-005: Annotation Tools (5)
- REQ-F-ERROR-001 through REQ-F-ERROR-002: Error Handling (2)
- REQ-F-DOC-001: Deployment Documentation (1)

**Non-Functional Requirements (20 total):**

- REQ-NF-P-001 through REQ-NF-P-005: Performance (5)
- REQ-NF-BC-001 through REQ-NF-BC-002: Browser Compatibility (2)
- REQ-NF-SC-001 through REQ-NF-SC-002: Scalability (2)
- REQ-NF-R-001 through REQ-NF-R-003: Reliability (3)
- REQ-NF-U-001 through REQ-NF-U-003: Usability (3)
- REQ-NF-M-001 through REQ-NF-M-003: Maintainability (3)
- REQ-NF-PT-001 through REQ-NF-PT-003: Portability (3)

**Requirements Quality Standards:**

- All non-functional requirements enhanced with quantitative, testable acceptance criteria
- Automated measurement methods specified for performance, usability, and quality requirements
- Technology prescriptions removed from requirements (moved to implementation notes and PRP)
- Technology Stack section removed from Technical Constraints (documented in MVP_PRP.md)
- Requirements describe "what" must be achieved, not "how" to implement

**Priority Breakdown:**

- Critical: 19 requirements
- High: 21 requirements
- Medium: 6 requirements
- Low: 2 requirements

**Implementation Status:**

- All requirements in "Planned" status
- Project in Phase 0 (Technical Spikes)

**Design Inputs Source:**

- inputs/INITIAL.md (comprehensive design document)
- V1 Golf App reference product

**Technical Risks Identified:**

- Frame-accurate seeking across browsers (HIGH RISK - Phase 0 spike required)
- Synchronized video playback (HIGH RISK - Phase 0 spike required)
- Canvas overlay performance (MEDIUM RISK - Phase 0 spike required)

**Success Metrics (MVP):**

- Frame-accurate synchronization working across all target browsers
- Smooth dual-video playback on Raspberry Pi 4 8GB
- Intuitive sync workflow discoverable without documentation
- All core analysis workflows functional (upload → sync/trim → annotate → playback)

---
