## Context

The Condor Phase 2 implementation has nine specific bugs that affect user experience and data integrity:

1. **Annotation Text Size**: Text annotations render at 20px while strokes are 6px - disproportionately small on high-resolution golf swing videos
2. **Angle Drawing Logic**: Preview connects to wrong vertex after 2nd click, creating counter-intuitive angle measurement
3. **Keyboard Delete**: Only handles "Delete" key, not "Backspace" (Mac primary delete key)
4. **Video Load State**: New video upload doesn't clear previous sync/trim state
5. **Scrub Bar Handles**: Trim handles extend beyond track boundaries due to centering transform
6. **Session Load**: Restores data to stores but doesn't trigger UI side effects (mode, sync, button states)
7. **Library Video Save State**: Save buttons show enabled when videos already in library
8. **Upload Replacement**: Save button state persists when uploading new video to same channel
9. **FK Violation**: Users can attempt to save sessions with temporary video IDs, causing database errors

**Key Constraint:** The session save workflow must enforce library save first to maintain referential integrity. This is a user-facing constraint change that requires clear UI guidance.

## Goals / Non-Goals

**Goals:**
- Fix all nine bugs with minimal code changes
- Enforce library save before session save with clear UX
- Ensure session restore creates identical state to when saved
- Maintain backward compatibility for existing saved sessions
- Fix Mac keyboard compatibility for delete action
- Make scrub bar handles always visible and within bounds
- Ensure angle annotation drawing is intuitive (standard protractor-style)
- Reset analysis state cleanly on video reload

**Non-Goals:**
- Redesign annotation tools or add new annotation types
- Change database schema or session storage format
- Modify upload processing pipeline
- Add new user authentication or multi-user support
- Change video optimization or codec handling

## Decisions

### 1. Force Library Save Before Session Save
**Decision:** Block session save button when videos lack library IDs. Show inline message explaining why.

**Rationale:** 
- Option A (auto-save): Too implicit, user loses control over metadata
- Option C (remove FK): Loses referential integrity
- Option B (block with guidance): Explicit, user maintains control, clear data model

**Implementation:**
- In `SaveSessionPanel`, check `videoA?.metadata?.video_id` and `videoB?.metadata?.video_id`
- If either video exists but isn't in library (no library video_id), disable save
- Show tooltip: "Save both videos to library before saving session"

### 2. Text Size Scaling
**Decision:** Scale font sizes proportionally to stroke width

**Rationale:** Text should remain readable relative to annotation strokes. Fixed pixel sizes don't scale with video resolution.

**Formula:** `fontSize = strokeWidth * 4` → 24px for text annotations, 18px for angle labels

### 3. Angle Drawing Fix Strategy
**Decision:** Change rubber-band connection point from `points[0]` to `points[points.length - 1]`

**Rationale:** After 2nd click, preview should extend from arm1-end (2nd point) to cursor, not from vertex.

**Implementation:**
```tsx
// Current (wrong):
points={[
  drawingStateA.points[0].x,  // Always vertex
  drawingStateA.points[0].y,
  polylineMousePosA.x,
  polylineMousePosA.y,
]}

// Fixed:
const lastPoint = drawingStateA.points[drawingStateA.points.length - 1];
points={[
  lastPoint.x,  // Connects to most recent point
  lastPoint.y,
  polylineMousePosA.x,
  polylineMousePosA.y,
]}
```

### 4. Session State Restoration Approach
**Decision:** Make `restoreSessionState()` trigger the same actions as user interactions

**Current Problem:** Only writes to stores, doesn't trigger side effects

**Fix Strategy:**
1. After hydration, immediately switch mode: `setMode("PLAYBACK")`
2. Calculate and apply sync offset immediately after videos load
3. Seek both videos to their sync frame positions
4. Force UI components to recognize externally-loaded state

**Implementation in `sessionStore.ts`:**
```typescript
// After hydrate, trigger mode switch
const { setMode } = usePlaybackStore.getState();
setMode("PLAYBACK");

// Seek videos to sync positions
const targetFrameA = session.sync_frame_a ?? 0;
const targetFrameB = session.sync_frame_b ?? 0;
// Trigger video seeking via decoder refs or store actions
```

### 5. Video Upload Workflow State Coordination
**Decision:** Add callback or store flag to signal "new video loaded, reset analysis state"

**Implementation:**
- Add `resetAnalysisState()` action to `syncStore` and `trimStore`
- Call from `VideoUploadWorkflow.onUploadComplete` or `DualVideoSynchronizer` when video metadata changes

### 6. Save Button State Management
**Decision:** Derive saved state from library membership, not component-local state

**Current:** `savedSlots` is local Set, lost on remount

**Fixed:** Check `libraryStore.videos` for matching `video_id` to determine if already saved

```typescript
const isVideoSaved = (videoId: string) => {
  return libraryStore.videos.some(v => v.id === videoId);
};
```

### 7. Scrub Bar Handle Positioning
**Decision:** Add horizontal padding to track container and adjust percentage calculations

**Implementation:**
- Track container: `padding: '0 10px'` to accommodate handle overflow
- Handle transform: Keep centered transform but ensure hit area is within bounds
- Alternative: Clamp handle position to `max(10px, min(width - 10px, calculatedPos))`

**Chosen approach:** CSS padding solution - simpler, no JavaScript calculations

### 8. Keyboard Handler Fix
**Decision:** Add "Backspace" key alongside "Delete"

**Implementation:**
```typescript
if (e.key === "Delete" || e.key === "Backspace") {
  // Handle deletion
}
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Forcing library save breaks existing user workflows** | Medium | Clear UI messaging; button disabled state with tooltip; help text in save panel |
| **Session load changes mode unexpectedly** | Low | This is the correct behavior per user feedback; add visual feedback showing mode switch |
| **Text size changes affect existing annotations** | Low | Text renders dynamically from stored data; size change applies to all annotations uniformly |
| **Angle fix changes user muscle memory** | Low | Current behavior is buggy; users will adapt to correct protractor-style measurement |
| **Scrub bar padding affects precision** | Low | 10px padding is negligible relative to typical 800+ pixel track width |
| **Complex state reset on video change** | Medium | Test thoroughly with dual-video scenarios; ensure both channels reset independently |

**Trade-off:** Session save constraint adds friction but guarantees data integrity. The alternative (silent auto-save) would be more convenient but removes user control over library metadata.

## Migration Plan

Not applicable - this is a bug fix change with no data migration required. Existing saved sessions will load correctly with the fixed restoration logic.

## Open Questions

1. **Should we persist `savedSlots` to avoid confusion on component remount?** 
   - Decision: No, derive from library state instead (already covered in design)

2. **Should we auto-seek videos on session load, or just set sync offset?**
   - Decision: Auto-seek to sync frames for immediate visual feedback

3. **What happens if library video is deleted after session saved?**
   - Current: Session loads with null video, shows error
   - Acceptable: Edge case, user can re-link video manually

4. **Should we show "Save to Library" as primary action when session save is blocked?**
   - Decision: Yes, highlight the library save buttons prominently
