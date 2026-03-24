## 1. Annotation Bug Fixes

### 1.1 Fix Text Annotation Font Size
- [x] 1.1.1 Update text annotation fontSize from 20 to 24 (strokeWidth * 4) in DualVideoSynchronizer.tsx line 1523
- [x] 1.1.2 Update angle label fontSize from 16 to 18 in DualVideoSynchronizer.tsx line 1555
- [ ] 1.1.3 Verify text is readable relative to 6px stroke width on test videos

### 1.2 Fix Angle Annotation Drawing Logic
- [x] 1.2.1 Locate angle-active preview rendering in DualVideoSynchronizer.tsx (around line 1710)
- [x] 1.2.2 Change rubber-band connection from points[0] to points[points.length - 1]
- [x] 1.2.3 Test angle drawing: Click 1 → vertex, Click 2 → arm1-end, verify preview extends from arm1-end
- [x] 1.2.4 Verify angle 1-2-3 is measured correctly (not 2-1-3)

### 1.3 Fix Keyboard Delete for Mac
- [x] 1.3.1 Update useVideoAnnotations.ts line 238 to handle both "Delete" and "Backspace" keys
- [x] 1.3.2 Test on Mac: Verify Backspace key deletes selected annotations
- [x] 1.3.3 Test on Windows/Linux: Verify Delete key still works
- [x] 1.3.4 Ensure input/textarea safety check still prevents accidental deletion while typing

## 2. State Management Bug Fixes

### 2.1 Fix Video Load State Reset
- [x] 2.1.1 Add resetSyncState() action to syncStore
- [x] 2.1.2 Add resetTrimState() action to trimStore  
- [x] 2.1.3 Modify DualVideoSynchronizer to detect video metadata changes
- [x] 2.1.4 On video change, call syncStore.clearSyncPoints() and trimStore.reset()
- [x] 2.1.5 Set mode to "SYNC" when new video loaded
- [x] 2.1.6 Test: Load video A, set sync point, load new video A, verify sync cleared

### 2.2 Fix Session Load State Restoration
- [x] 2.2.1 Update restoreSessionState() in sessionStore.ts to call setMode("PLAYBACK")
- [x] 2.2.2 Calculate syncOffset from session.sync_frame_a and session.sync_frame_b
- [x] 2.2.3 After videos load, seek to sync frame positions (not frame 0)
- [x] 2.2.4 Test session save and load: verify mode is PLAYBACK, videos are synchronized
- [x] 2.2.5 Test: Load session, verify videos start at correct sync frames

### 2.3 Fix Library Video Save Button State
- [ ] 2.3.1 Modify AddToLibraryPanel to check libraryStore for video membership
- [ ] 2.3.2 Pre-populate savedSlots based on library video IDs
- [ ] 2.3.3 When loading from library, save buttons should show "Video X saved" and be disabled
- [ ] 2.3.4 Test: Load video from library, verify save button is disabled

### 2.4 Fix Upload New Video on Same Channel
- [ ] 2.4.1 Add useEffect in AddToLibraryPanel to watch video metadata changes
- [ ] 2.4.2 When video_id changes for a channel, remove that channel from savedSlots
- [ ] 2.4.3 Test: Upload video A, save to library, upload new video A, verify button shows "+ Video A"

## 3. UI Bug Fixes

### 3.1 Fix Scrub Bar Trim Handle Bounds
- [ ] 3.1.1 Add horizontal padding (10px) to TrimScrubBar track container
- [ ] 3.1.2 Adjust percentage calculations to account for padding
- [ ] 3.1.3 Test: Set trim handles to 0% and 100%, verify both fully visible
- [ ] 3.1.4 Test: Verify green playback range aligns correctly with handles

### 3.2 Fix "No Video Uploaded" Banner on Library Load
- [ ] 3.2.1 Add isExternallyLoaded prop or context to VideoUploadWorkflow
- [ ] 3.2.2 When video loaded from library/session, show metadata display instead of "No video uploaded"
- [ ] 3.2.3 Test: Load session with library videos, verify no "No video uploaded" banner shown

## 4. Workflow Constraint Implementation

### 4.1 Enforce Library Save Before Session Save
- [ ] 4.1.1 Modify SaveSessionPanel to check video library status
- [ ] 4.1.2 Create helper function isVideoInLibrary(videoId) in libraryStore
- [ ] 4.1.3 Disable save button with tooltip if videos not in library
- [ ] 4.1.4 Add inline message: "Save both videos to library before saving session"
- [ ] 4.1.5 Highlight library save buttons when session save is blocked
- [ ] 4.1.6 Test: Upload videos without saving to library, verify session save is disabled
- [ ] 4.1.7 Test: Save videos to library, verify session save becomes enabled

## 5. Testing and Validation

### 5.1 Frontend Unit Tests
- [ ] 5.1.1 Add test for Backspace key in useVideoAnnotations.test.ts
- [ ] 5.1.2 Add test for font size scaling in annotations
- [ ] 5.1.3 Update TrimScrubBar tests for new padding behavior
- [ ] 5.1.4 Add tests for session save validation logic

### 5.2 Integration Tests
- [ ] 5.2.1 Test full annotation workflow: draw angle, verify correct measurement
- [ ] 5.2.2 Test video reload flow: sync → upload new → verify reset
- [ ] 5.2.3 Test session lifecycle: save → load → verify state restoration
- [ ] 5.2.4 Test library workflow: upload → save → upload new → verify reset

### 5.3 Manual Testing Checklist
- [ ] 5.3.1 Mac: Delete selected annotations with Backspace key
- [ ] 5.3.2 Windows/Linux: Delete key still works
- [ ] 5.3.3 Text size readable on 1080p video
- [ ] 5.3.4 Angle annotation: 3-click flow produces correct angle measurement
- [ ] 5.3.5 Trim handles never go off-screen
- [ ] 5.3.6 Session save blocked until library save complete
- [ ] 5.3.7 Session loads in PLAYBACK mode with videos synchronized
- [ ] 5.3.8 All existing tests pass (run npm test and uv run pytest)

## 6. Documentation Update

### 6.1 Update README
- [ ] 6.1.1 Document new requirement: videos must be in library before session save
- [ ] 6.1.2 Update user instructions for annotation keyboard shortcuts (include Backspace)
- [ ] 6.1.3 Verify all user-facing instructions are current
