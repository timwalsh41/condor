# Manual Testing Guide for Bug Fixes

## Overview

This document provides comprehensive manual testing procedures for validating bug fixes in the bug-fixes-set-2 change. These tests should be performed manually in addition to the automated test suite.

## Prerequisites

- Backend server running on http://localhost:8000
- Frontend dev server running (typically http://localhost:5173)
- Test video files available in `/tests/fixtures/videos/`
- Browser: Chrome, Firefox, or Safari (latest versions)

---

## Test 5.3.1: Mac - Delete Selected Annotations with Backspace Key

**Related Bug Fix:** 1.3 (Fix Keyboard Delete for Mac)

**Objective:** Verify that Mac users can delete selected annotations using the Backspace key.

### Steps:

1. **Upload Videos**
   - Navigate to the application in browser
   - Upload test video to Slot A
   - Wait for video to finish processing

2. **Draw an Annotation**
   - Select the "Line" or "Arrow" tool from the toolbar
   - Click and drag on Video A canvas to draw an annotation
   - Release to complete the annotation

3. **Select the Annotation**
   - Click on the drawn annotation to select it
   - Verify the annotation shows selection handles (control points)

4. **Delete with Backspace**
   - Press the **Backspace** key (not Delete key on Mac keyboard)
   - Verify the annotation is removed from the canvas

5. **Test Safety Check**
   - Click on a text input field (if available) or add a text annotation
   - Type some text
   - Press Backspace to delete the typed text
   - Verify the text is deleted but no annotation is affected

### Expected Result:
- Backspace key deletes selected annotations
- Backspace key works normally in input fields without deleting annotations

---

## Test 5.3.2: Windows/Linux - Delete Key Still Works

**Related Bug Fix:** 1.3 (Fix Keyboard Delete for Mac)

**Objective:** Verify that Windows and Linux users can still delete annotations using the Delete key.

### Steps:

1. **Upload Videos**
   - Navigate to the application
   - Upload test video to Slot A
   - Wait for processing to complete

2. **Draw and Select Annotation**
   - Draw a line annotation on Video A
   - Click to select the annotation

3. **Delete with Delete Key**
   - Press the **Delete** key (Del key on Windows/Linux keyboard)
   - Verify the annotation is removed

4. **Test Multiple Selections**
   - Draw 2-3 annotations
   - Select all annotations (using Ctrl+Click or multi-select)
   - Press Delete key
   - Verify all selected annotations are removed

### Expected Result:
- Delete key removes selected annotations on Windows/Linux
- Behavior is identical to Backspace on Mac

---

## Test 5.3.3: Text Size Readable on 1080p Video

**Related Bug Fix:** 1.1 (Fix Text Annotation Font Size)

**Objective:** Verify that text annotations are readable at the correct font size (24px = strokeWidth * 4).

### Steps:

1. **Upload 1080p Video**
   - Upload a 1920x1080 test video to Slot A
   - Ensure the video is displayed at full resolution

2. **Create Text Annotation**
   - Select the "Text" tool from toolbar
   - Click on the video canvas to place text
   - Type "Test Text Annotation"

3. **Visual Verification**
   - The text should be clearly readable
   - Font size should be proportional to annotation stroke width (6px stroke = 24px font)
   - Text should not appear too small or blurry

4. **Compare with Angle Labels**
   - Draw an angle annotation (3 clicks: vertex, arm1, arm2)
   - The angle measurement label should display at 18px font size
   - Verify the label is readable and properly positioned

5. **Test at Different Zoom Levels**
   - If zoom controls are available, test at 100%, 75%, and 125% zoom
   - Text should remain readable at all zoom levels

### Expected Result:
- Text annotations display at 24px font size (strokeWidth * 4)
- Angle labels display at 18px font size
- All text is clearly readable on 1080p videos

---

## Test 5.3.4: Angle Annotation - 3-Click Flow Produces Correct Angle Measurement

**Related Bug Fix:** 1.2 (Fix Angle Annotation Drawing Logic)

**Objective:** Verify that angle annotations measure the correct angle (1-2-3, not 2-1-3).

### Steps:

1. **Prepare Video**
   - Upload test video to Slot A
   - Navigate to frame with clear reference points (e.g., a corner or intersection)

2. **Draw 90° Angle**
   - Select the "Angle" tool
   - **Click 1:** Place vertex at the corner/intersection point
   - **Click 2:** Place arm1 end along horizontal edge (e.g., to the right)
   - **Click 3:** Place arm2 end along vertical edge (e.g., downwards)

3. **Verify Preview Line**
   - After Click 2, verify the rubber-band preview line extends from arm1-end (Click 2 position), NOT from vertex (Click 1 position)
   - The preview should connect arm1-end to the current cursor position

4. **Check Angle Measurement**
   - After completing Click 3, verify the angle label displays approximately **90°** (±2° tolerance acceptable)
   - The angle should be measured between arm1 and arm2 extending from the vertex

5. **Test 45° Angle**
   - Draw another angle with arms at 45° to each other
   - Verify the measurement shows approximately **45°**

6. **Verify Point Order**
   - Draw an angle where vertex → arm1 → arm2 is clearly distinguishable
   - The measured angle should be the interior angle between the two arms
   - Should NOT be measuring 360° minus the actual angle

### Expected Result:
- Click 1 = vertex, Click 2 = arm1-end, Click 3 = arm2-end
- Preview line extends from arm1-end to cursor (not from vertex)
- Angle measurement is correct (interior angle between arms)
- 90° angles measure approximately 90°, 45° angles measure approximately 45°

---

## Test 5.3.5: Trim Handles Never Go Off-Screen

**Related Bug Fix:** 3.1 (Fix Scrub Bar Trim Handle Bounds)

**Objective:** Verify that trim handles remain fully visible at 0% and 100% positions.

### Steps:

1. **Upload Video and Enable Trim Mode**
   - Upload test video to Slot A
   - Switch to TRIM mode (if available) or activate trim controls
   - Locate the Trim Scrub Bar below the video

2. **Test 0% Position**
   - Drag the left trim handle to the far left (0% position)
   - Verify the handle is **fully visible** - not cut off by the container edge
   - Handle circle should be completely within view

3. **Test 100% Position**
   - Drag the right trim handle to the far right (100% position)
   - Verify the handle is **fully visible**
   - Handle circle should not overflow or be clipped

4. **Test Middle Positions**
   - Move handles to 25%, 50%, and 75% positions
   - Verify handles align correctly with the playback range bar
   - The green bar should extend from left handle to right handle

5. **Test Edge Cases**
   - Set left handle to 0% and right handle to 100%
   - Both handles should be fully visible simultaneously
   - No clipping or overflow should occur

### Expected Result:
- Trim handles are fully visible at all positions including 0% and 100%
- 10px horizontal padding on track container prevents overflow
- Green playback range aligns correctly with handle positions

---

## Test 5.3.6: Session Save Blocked Until Library Save Complete

**Related Bug Fix:** 4.1 (Enforce Library Save Before Session Save)

**Objective:** Verify that session save is disabled until both videos are saved to the library.

### Steps:

1. **Upload Videos Without Library Save**
   - Upload test videos to both Slot A and Slot B
   - Wait for processing to complete
   - **Do NOT save videos to library yet**

2. **Open Session Panel**
   - Click the "Session" button or panel toggle
   - Session save panel should open

3. **Verify Disabled State**
   - The "Save Session" button should be **disabled** (grayed out)
   - Hover over the button - a tooltip should appear: "Save both videos to library before saving session"
   - An inline warning message should display: "Save both videos to library before saving session" (orange text with border)

4. **Save Video A to Library**
   - Open Library panel
   - Click "Save Video A" button
   - Wait for save to complete
   - Return to Session panel
   - Button should still be disabled (Video B not saved yet)

5. **Save Video B to Library**
   - Save Video B to library
   - Return to Session panel

6. **Verify Enabled State**
   - The "Save Session" button should now be **enabled**
   - Warning message should disappear or change
   - Hover should show no tooltip or different tooltip

7. **Test Button Highlighting**
   - While session save is blocked, the Library save buttons should have an orange pulse animation (highlightUnsaved prop)
   - This draws attention to the required action

### Expected Result:
- Session save disabled until both videos are in library
- Tooltip explains why save is blocked
- Orange warning message displayed inline
- Library save buttons highlighted when session save blocked
- Session save becomes enabled immediately after second video saved

---

## Test 5.3.7: Session Loads in PLAYBACK Mode with Videos Synchronized

**Related Bug Fix:** 2.2 (Fix Session Load State Restoration)

**Objective:** Verify that loaded sessions start in PLAYBACK mode with proper sync frame restoration.

### Steps:

1. **Set Up Session**
   - Upload videos to both slots
   - Save both videos to library
   - Set sync point: Video A at frame 50, Video B at frame 75 (offset +25)
   - Switch to PLAYBACK mode
   - Save session with name "Test Sync Session"

2. **Clear Current State**
   - Refresh the page or navigate to home
   - Verify videos are unloaded and app is in initial state

3. **Load Session**
   - Open Session panel
   - Find "Test Sync Session" in the list
   - Click "Load" button
   - Wait for session to load (videos will load from library)

4. **Verify Mode**
   - Check the Mode indicator at the top
   - Should display **"PLAYBACK MODE"** (not SYNC MODE)

5. **Verify Sync Frames**
   - Check Video A frame counter: should be at or near frame 50
   - Check Video B frame counter: should be at or near frame 75
   - Calculate offset: Video B - Video A should equal +25

6. **Test Sync Persistence**
   - Step forward 10 frames using unified controls
   - Verify both videos step together maintaining offset
   - Offset should remain exactly +25

7. **Verify No "No Video Uploaded" Banner**
   - When videos load from session, they should display metadata
   - Should NOT show "No video uploaded" banner

### Expected Result:
- Session loads in PLAYBACK mode automatically
- Videos seek to correct sync frames (50 and 75)
- Sync offset (+25) is maintained and displayed
- Videos show metadata display, not "No video uploaded" banner

---

## Test 5.3.8: All Existing Tests Pass

**Related Bug Fix:** All bug fixes (regression testing)

**Objective:** Verify that all automated tests pass after bug fix implementations.

### Steps:

1. **Backend Unit Tests**
   ```bash
   cd /workspace
   uv run pytest backend/ -v
   ```
   - Expected: All tests pass (124 tests)
   - Look for: "124 passed" in output

2. **Backend Integration Tests**
   ```bash
   uv run pytest tests/test_backend_integration.py -v
   ```
   - Expected: All integration tests pass
   - Tests video upload, processing, streaming workflows

3. **Frontend Unit Tests**
   ```bash
   cd /workspace/frontend
   npm test -- --run
   ```
   - Expected: All tests pass (609 tests)
   - Look for: "609 passed" in output

4. **Frontend E2E Tests (if running)**
   ```bash
   npm run test:e2e
   ```
   - Expected: All E2E tests pass
   - Note: Requires dev server running

5. **Backend Linting**
   ```bash
   uv run ruff check backend/
   ```
   - Note: May have pre-existing errors, check no NEW errors introduced

6. **Frontend Linting**
   ```bash
   npm run lint
   ```
   - Note: May have pre-existing errors, check no NEW errors introduced

### Expected Result:
- Backend: 124 unit tests pass
- Frontend: 609 unit tests pass
- All E2E tests pass (if run)
- No new lint errors introduced by bug fixes

---

## Test Data Requirements

### Test Videos
- `test_gop30_h264.mp4` - 1080p H.264 video with GOP=30 (optimal)
- `test_30fps_10s.mp4` - 30fps video for sync testing
- Any 1920x1080 video for text readability tests

### Test Environment
- Browser: Chrome 120+, Firefox 121+, or Safari 17+
- Screen resolution: 1920x1080 or higher recommended
- OS: macOS 14+ (for Backspace tests), Windows 11, or Linux

---

## Sign-Off Checklist

Before considering bug-fixes-set-2 complete, verify:

- [ ] 5.3.1: Mac Backspace key deletes annotations ✓
- [ ] 5.3.2: Windows/Linux Delete key works ✓
- [ ] 5.3.3: Text readable on 1080p video ✓
- [ ] 5.3.4: Angle measurement correct (3-click flow) ✓
- [ ] 5.3.5: Trim handles never off-screen ✓
- [ ] 5.3.6: Session save blocked until library save ✓
- [ ] 5.3.7: Session loads in PLAYBACK mode with sync ✓
- [ ] 5.3.8: All automated tests pass ✓

---

## Notes

- Manual tests should be performed on a clean browser session (clear cache/cookies)
- Tests 5.3.1 and 5.3.2 require testing on actual Mac and Windows/Linux machines respectively
- If running tests in CI/CD, some manual tests may need to be adapted or skipped
- Document any test failures with screenshots and browser console logs
