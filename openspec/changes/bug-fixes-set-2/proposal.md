## Why

The Phase 2 implementation contains nine UI/UX bugs and workflow inconsistencies that degrade user experience and prevent reliable session persistence. These bugs span annotation tools, video upload workflows, scrub bar interactions, and session save/load functionality. A critical workflow design flaw allows users to save sessions with un-saved videos, causing database FK constraint violations. These issues need resolution before Phase 2 can be considered production-ready.

## What Changes

This change addresses nine specific bugs from BUG_FIXES_SET_2.md:

1. **Annotation Text Size**: Increase text and angle label font sizes to be proportional to stroke width (currently too small relative to 6px stroke width)

2. **Angle Annotation Drawing Logic**: Fix the preview behavior to connect vertex 3 to vertex 2 (measuring angle 1-2-3) instead of vertex 1 (current behavior measures 2-1-3)

3. **Keyboard Delete Support**: Add "Backspace" key support alongside "Delete" for Mac keyboard compatibility

4. **Video Load State Reset**: When new video uploaded, automatically clear sync state, trim bounds, and return to SYNC mode

5. **Scrub Bar Handle Bounds**: Fix trim handles that extend beyond the track boundaries and go off-screen

6. **Session Load State Restoration**: Fix session loading to properly restore:
   - Mode to PLAYBACK instead of SYNC
   - Synchronized video positions (not frame 0)
   - UI state (hide "No video uploaded" banner, disable save buttons for library videos)

7. **Library Video Save Button State**: When loading video directly from library, pre-populate saved state so save button is disabled

8. **New Upload on Same Channel**: Reset save button state when new video uploaded to same channel (currently shows previous video as saved)

9. **Workflow Guard - Session Save Prerequisite**: **BREAKING** - Block session save until all videos are saved to library. Add UI messaging to guide users.

## Capabilities

### New Capabilities
*None - this is a bug fix change with no new user-facing capabilities*

### Modified Capabilities
*None - existing capability specifications remain unchanged; this addresses implementation bugs*

## Impact

**Frontend Components:**
- `DualVideoSynchronizer.tsx` - Annotation rendering, mode switching, video synchronization on load
- `useVideoAnnotations.ts` - Keyboard handler for delete/backspace
- `TrimScrubBar.tsx` - Handle positioning and bounds
- `VideoUploadWorkflow.tsx` - State reset triggers
- `AddToLibraryPanel.tsx` - Save button state management
- `SaveSessionPanel.tsx` - Validation and UI messaging (new constraint)
- `sessionStore.ts` - restoreSessionState() logic

**Backend:**
- No backend changes required - FK constraint enforcement is correct, frontend must prevent violations

**User Experience:**
- Users must now save videos to library before saving sessions (new workflow constraint)
- Clearer guidance when session save is disabled
- More reliable session restore with all state properly hydrated

**Tests:**
- Update existing tests for new keyboard handler
- Add tests for session save validation
- Add tests for video load state reset
- Verify angle annotation drawing behavior
