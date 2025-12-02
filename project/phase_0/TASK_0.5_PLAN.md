# Task 0.5: Canvas Overlay Spike - Implementation Plan

## Status:

**Last Subtask Completed:** 0.5.5 (with comprehensive refactoring)
**Skipped Subtasks:** 0.5.4
**Last Updated:** 2025-11-30 (Completed: Extended annotations to Video B with architectural improvements)

## Overview

**Goal**: Validate canvas overlay for annotations over WebCodecs video with performance testing.

**Requirements Validated**:

- REQ-F-ANNOT-002 (Annotation Rendering)
- REQ-NF-P-002 (Annotation Performance)

**Acceptance Criteria**:

1. react-konva Stage + Layer positioned exactly over video element
2. Canvas dimensions match video display dimensions (`clientWidth/clientHeight`, NOT `videoWidth/videoHeight`)
3. Basic drawing tools: freehand line, segmented polyline, oval (axis-aligned), arrow
4. Konva.Animation keeps layer visible during video playback (if needed to prevent flicker)
5. Drawing latency ≤16ms (measured at 95th percentile)
6. No video playback stuttering with 10+ annotations
7. Stress test: 50+ complex annotations render smoothly
8. Spike tests pass (`tests/spikes/test_canvas_overlay.spec.ts`)
9. Spike documentation created (`docs/spike/CANVAS_OVERLAY.md`)
10. (Optional) Basic annotation editing: selection, deletion, dragging, transform

**Risk Level**: MEDIUM - Performance-critical feature
**Confidence**: 8/10

## Implementation Approach

### Scope Decisions

- **Component**: Extend `DualVideoSyncDemo.tsx` (reuse existing video rendering)
- **Initial Implementation**: Video A only (simpler debugging)
- **Final Deliverable**: Both Video A and Video B with annotation canvas
- **Drawing Tools**: Freehand line, segmented polyline, oval (axis-aligned), arrow - implemented incrementally
- **Performance Target**: Desktop browsers only (Chrome/Firefox/WebKit)
- **Optional Features**: Annotation editing (selection, deletion, dragging, transform) - can defer to Phase 1

### Architecture

**Canvas Overlay Structure**:

```
Container (position: relative)
├── Video Canvas (z-index: 0) - WebCodecs VideoFrame rendering
└── Konva Stage (z-index: 1) - Annotation overlay (position: absolute)
    └── Konva Layer
        ├── Line shapes (freehand, segmented polyline)
        ├── Ellipse shapes (axis-aligned oval)
        ├── Arrow shapes (directional arrow)
        └── Transformer (optional - for editing)
```

**Critical Sizing**:

- Annotation Stage internal dimensions = Video metadata dimensions (e.g., 1920×1080)
- Annotation Stage CSS = 100% width/height (matches video canvas CSS scaling)
- Konva handles coordinate mapping internally via Stage width/height props

## Subtask Breakdown

### Subtask 0.5.1: Setup react-konva and Canvas Overlay (Video A)

**Status**: ✅ COMPLETE

**Goal**: Install dependencies and create basic annotation canvas overlay on Video A.

**Implementation**:

1. Install dependencies: `npm install react-konva konva @types/konva`
2. Add annotation canvas overlay to DualVideoSyncDemo (Video A section only)
3. Position Stage absolutely over video canvas with exact alignment
4. Size Stage from video metadata: `width={videoA.metadata?.width}`, `height={videoA.metadata?.height}`
5. Apply CSS: `position: absolute, top: 0, left: 0, width: 100%, height: 100%`

**Deliverables**:

- react-konva dependencies installed
- Empty annotation Stage rendering over Video A
- Canvas alignment verified (video and annotation bounds match)

**Testing**:

- Visual verification: annotation canvas positioned exactly over video
- Manually verify no disruption to dual-video sync functionality & playback
- No existing tests required (foundation for subsequent subtasks)

**User-Facing**:

- Transparent overlay canvas visible in browser DevTools (no visual change yet)
- Foundation ready for drawing implementation

**Estimated Time**: 30-45 minutes

---

### Subtask 0.5.2: Implement Freehand Line Drawing (Video A)

**Status**: ✅ COMPLETE

**Goal**: Add freehand line drawing tool that continuously tracks mouse movement.

**Implementation Summary**:

- Created modular annotation architecture:
  - `src/types/annotations.ts`: Type definitions (Annotation, AnnotationType, AnnotationStyle)
  - `src/utils/AnnotationManager.ts`: Business logic class (CRUD operations, validation)
  - `src/utils/tests/AnnotationManager.test.ts`: Comprehensive unit tests (28 passing)
- Integrated into DualVideoSyncDemo.tsx with mouse event handlers
- Freehand drawing functional: click-drag-release creates smooth lines
- Live preview renders with dashed stroke during drawing
- Annotations persist across playback/pause/seek operations
- Technical documentation: `docs/spike/ANNOTATIONS.md`

**Deliverables**: ✅ All Complete

- Freehand drawing works with mouse click-drag-release
- Line smoothly follows mouse path during drag
- Completed freehand lines persist and display on Video A
- Drawing state managed correctly (start, draw, finish)

**Testing**: ✅ Complete

- Unit tests: 28/28 passing (AnnotationManager business logic)
- Manual testing: Verified in browser demo - working perfectly
- Build validation: No TypeScript errors or warnings

**User-Facing**: ✅ Functional

- Users can draw smooth, continuous freehand lines on Video A
- Live preview shows line following mouse during drag
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 60 minutes | **Actual Time**: ~90 minutes (including architecture refactoring)

---

### Subtask 0.5.3: Integrated Annotation Framework - All Drawing Tools + Tool Selection UI (Video A)

**Status**: ✅ COMPLETE

**Goal**: Implement complete annotation drawing framework with all four tools (freehand, polyline, oval, arrow) and tool selection UI in a single integrated implementation.

**Implementation Summary**:

Delivered an **Enhanced AnnotationManager Pattern** that separates business logic from UI:

1. **Architecture Refactoring**:

   - Moved drawing state management into AnnotationManager (state machine pattern)
   - Added `DrawingState` and `Point` types to `annotations.ts`
   - Enhanced AnnotationManager with 11 new methods for drawing workflow
   - Component handlers refactored to thin adapters (5-10 lines each, delegate to manager)

2. **Tool Selection UI**: 4 tool buttons below video frame counter, active tool highlighted

3. **Drawing Implementations**:

   - **Freehand**: Drag to draw continuous smooth line
   - **Polyline**: Click-to-add vertices, Enter/Escape/double-click to finalize
   - **Oval**: Drag axis-aligned ellipse
   - **Arrow**: Drag arrow with pointer

4. **Live Preview**: All tools show red dashed preview, polyline includes cursor preview segment

**Deliverables**: ✅ All Complete

- ✅ All 4 tools functional with proper interaction patterns
- ✅ Enhanced AnnotationManager with state machine (11 methods)
- ✅ Tool selection UI with visual feedback
- ✅ Live preview for all tools
- ✅ 66/66 unit tests passing (38 new for state machine)

**Architecture Benefits**:

- ✅ Testable: Business logic tested without React
- ✅ Modular: Drawing logic extracted from UI
- ✅ Reusable: Ready for Video B extension

**Documentation**: ✅ `docs/spike/ANNOTATIONS.md` updated (212 lines)

**Estimated Time**: 2-3 hours | **Actual Time**: ~4 hours (including refactoring and bug fixes)

---

### Subtask 0.5.4: Integrate Konva.Animation with Playback (Video A)

**Status**: ⏭️ SKIPPED (for now)

**Goal**: Validate that annotations remain visible during video playback and implement Konva.Animation if needed to prevent flicker.

**Rationale**: Extensive Firefox testing shows no flickering or rendering issues. Implementation deferred until testing in subsequent phases reveals need. Can be added easily if issues arise.

**Context**: Annotations are static data that don't change dynamically themselves during video playback. However, the annotation layer may need continuous redrawing to stay visible over the updating video canvas during playback. This subtask validates whether Konva.Animation is necessary.

**Implementation**:

1. **First, test without Konva.Animation**:
   - Draw annotations on paused video
   - Start video playback
   - Verify if annotations remain visible without flicker
2. **If flicker occurs, implement Konva.Animation**:
   - Create Konva.Animation instance linked to annotation Layer
   - Start animation when video plays: `animation.start()` on `isPlaying === true`
   - Stop animation when video pauses: `animation.stop()` on `isPlaying === false`
   - Use empty callback pattern: `new Konva.Animation(() => {}, layer)` (triggers layer redraw each frame)
3. Implement cleanup: `animation.stop()` and `layer.destroy()` on unmount

**Deliverables**:

- Annotations remain visible during video playback (with or without Konva.Animation)
- No flickering or disappearing annotations
- Proper resource cleanup prevents memory leaks
- Documentation of whether Konva.Animation was needed

**Testing**:

- Manual: Draw annotations, play video, verify annotations stay visible
- Integration test: Test annotation visibility during playback (measure pixel alpha)

**User-Facing**:

- Annotations persist during video playback, pausing, and seeking
- No visual glitches or performance degradation
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 45 minutes

---

### Subtask 0.5.5: Extend Annotation Canvas to Video B

**Status**: ✅ COMPLETE

**Goal**: Add annotation canvas to Video B with independent annotation state.

**Implementation** (Enhanced with Comprehensive Refactoring):

1. ✅ Created `useVideoAnnotations` custom hook - encapsulates all annotation logic per video channel
2. ✅ Enhanced `AnnotationManager` with integrated tool selection (`setTool/getTool` methods)
3. ✅ Eliminated code duplication - replaced ~200 lines of duplicated handlers with hook pattern
4. ✅ Abstracted scale calculation into hook - single implementation for both videos
5. ✅ Moved keyboard handling into hook - Enter/Escape for polyline finalization/cancellation
6. ✅ Updated `DualVideoSyncDemo.tsx` to use hooks - reduced from 10+ state variables per video to single hook call

**Deliverables**:

- ✅ Video B has working annotation canvas with all four tools (freehand, polyline, oval, arrow)
- ✅ Video A and Video B annotations do not interfere with each other
- ✅ Both videos support independent drawing and playback
- ✅ Clean architecture: tool selection in AnnotationManager, unified handlers via custom hook
- ✅ Comprehensive test coverage: 67 AnnotationManager tests + 11 hook tests (78 total) - all passing

**Testing**:

- ✅ Unit: 67 tests for AnnotationManager (updated for new API with tool selection)
- ✅ Unit: 14 tests for useVideoAnnotations hook (initialization, tool selection, handlers, scale, integration, keyboard shortcuts)
- ⏳ Manual: Draw on both videos, verify independence (pending user testing)
- ⏳ Integration: Test independent annotation state per video (deferred to 0.5.6)

**Keyboard Shortcuts**:

- ✅ Enter key: Finalizes active polyline
- ✅ Escape key: Cancels active polyline
- ✅ Context-aware: Only responds when the correct video channel is active
- ✅ Tested: 3 tests verify Enter/Escape behavior and video activation logic

**User-Facing**:

- ✅ Users can annotate both videos independently
- ✅ Full dual-video annotation capability demonstrated
- ✅ Demo exercisable via `npm run dev` at `/dual-video-sync`
- ✅ Clean code architecture - easier to maintain and extend

**Architectural Improvements** (Beyond Original Scope):

- **Custom Hook Pattern**: `useVideoAnnotations(videoDecoder, videoId, setActiveVideo)` returns all state/handlers
- **Tool Selection Integrated**: AnnotationManager now owns tool state - eliminates prop passing
- **DRY Principle**: Zero duplication between Video A/B - both use identical hook instantiation
- **Type Safety**: Full TypeScript support with proper generic types
- **Testability**: Hook and manager independently testable with clear responsibilities

**Code Impact**:

- DualVideoSyncDemo.tsx: ~150 lines removed (duplicated state, handlers, scale calculation, keyboard handling)
- useVideoAnnotations.ts: 239 lines added (new hook with all encapsulated logic)
- AnnotationManager.ts: 15 lines added (tool selection methods)
- AnnotationManager.test.ts: Updated 67 tests for new API, added 2 tool selection tests
- useVideoAnnotations.test.ts: 195 lines added (11 new tests)

**Time Invested**: ~3 hours (including comprehensive refactoring)

---

### Subtask 0.5.6: Create Playwright Integration Tests

**Status**: Not started

**Goal**: Automated cross-browser tests for canvas overlay functionality.

**Test File**: `tests/spikes/test_canvas_overlay.spec.ts`

**Test Coverage**:

1. **Canvas Alignment Test**:

   - Verify annotation canvas positioned exactly over video canvas
   - Compare bounding boxes (should match exactly)

2. **Drawing Functionality Tests** (one test per tool):

   - Test freehand: Draw freehand line, verify Line shape exists in DOM
   - Test polyline: Draw segmented polyline with click-to-add-vertex, verify Line shape exists in DOM
   - Test oval: Draw oval, verify Ellipse shape exists in DOM
   - Test arrow: Draw arrow, verify Arrow shape exists in DOM

3. **Tool Switching Test**:

   - Switch between tools, draw each type, verify correct shapes

4. **Playback Integration Test**:

   - Draw annotations, start playback, verify annotations remain visible
   - Check pixel alpha channel (annotation pixels should have alpha > 0)

5. **Dual Video Independence Test**:
   - Draw on Video A and Video B
   - Verify annotations are independent (different annotation counts)

**Deliverables**:

- Playwright test suite with ~10-12 tests
- Tests pass cross-browser (Chrome, Firefox, WebKit)
- Test helpers for navigation, drawing, and state inspection

**Testing**:

- Run: `npx playwright test tests/spikes/test_canvas_overlay.spec.ts`
- Expected: All tests pass headless across all three browsers

**User-Facing**:

- Automated validation ensures consistent behavior across browsers
- CI-ready test suite

**Estimated Time**: 90 minutes

---

### Subtask 0.5.7: Performance Testing and Validation

**Status**: Not started

**Goal**: Measure and validate drawing latency and playback performance.

**Performance Tests**:

1. **Drawing Latency Test** (≤16ms target):

   ```typescript
   const latency = await page.evaluate(() => {
     const stage = document.querySelector("canvas:nth-of-type(2)");
     const start = performance.now();

     // Simulate mouse drawing
     const event = new MouseEvent("mousedown", { clientX: 100, clientY: 100 });
     stage.dispatchEvent(event);

     return performance.now() - start;
   });

   expect(latency).toBeLessThan(16);
   ```

2. **Playback Smoothness Test** (10+ annotations):

   - Create 10 annotations programmatically (mix of freehand, polyline, oval, arrow)
   - Measure frame drops during 5-second playback
   - Expect: <10% frame drop rate

3. **Stress Test** (50+ complex annotations):
   - Create 50 freehand lines with 20+ points each
   - Create 50 segmented polylines with 5+ vertices
   - Create 50 ovals
   - Create 50 arrows
   - Measure layer render time with `layer.batchDraw()`
   - Expect: <33ms (30fps target)

**Deliverables**:

- Performance measurement tests in Playwright suite
- Documented performance results (drawing latency, playback smoothness, stress test)
- Layer caching implemented ONLY if stress test fails (>33ms)

**Testing**:

- Run performance tests across Chrome, Firefox, WebKit
- Document results in performance report

**User-Facing**:

- Validated performance meets requirements
- No user-facing changes (testing only)

**Estimated Time**: 90 minutes

---

### Subtask 0.5.8: Create Spike Documentation

**Status**: Not started

**Goal**: Document implementation, findings, and recommendations for Phase 1.

**Documentation File**: `docs/spike/ANNOTATIONS.md`

**Content Structure**:

1. **Overview**: What was validated, why it matters for Phase 1
2. **Architecture**:
   - Canvas overlay structure (diagram)
   - Sizing approach (internal dimensions vs CSS)
   - react-konva integration patterns
3. **Implementation Details**:
   - Freehand line, segmented polyline, oval (axis-aligned), arrow drawing logic
   - Tool selection and state management
   - Konva.Animation pattern for playback (if implemented)
   - Mouse coordinate handling (Konva handles scaling)
   - Optional editing features (selection, deletion, dragging, transform) - if implemented
4. **Performance Results**:
   - Drawing latency measurements (target: ≤16ms)
   - Playback smoothness results (target: no stuttering with 10+ annotations)
   - Stress test results (target: 50+ annotations at <33ms render)
5. **Critical Gotchas**:
   - Canvas sizing: internal buffer vs CSS display dimensions
   - Memory cleanup: `animation.stop()` and `layer.destroy()` on unmount
   - Coordinate mapping: Konva Stage handles automatically via width/height props
   - Konva.Animation: whether it was needed to prevent flicker
   - Oval limitations: axis-aligned only (rotation capability deferred to Phase 1)
6. **Browser Compatibility**:
   - Cross-browser validation results (Chrome/Firefox/WebKit)
   - Known issues or browser-specific quirks (if any)
7. **Phase 1 Integration Notes**:
   - How to integrate into full app
   - Recommended patterns to follow
   - Areas needing refactoring (state management, tool extensibility)
   - Features deferred to Phase 1 (oval rotation, annotation editing if not implemented)

**Deliverables**:

- Comprehensive spike documentation (`docs/spike/CANVAS_OVERLAY.md`)
- Clear recommendations for Phase 1 implementation
- Gotchas and best practices documented
- List of deferred features for Phase 1

**Testing**:

- Documentation review for accuracy and completeness
- No automated tests (documentation only)

**User-Facing**:

- Reference documentation for future development
- Knowledge transfer artifact

**Estimated Time**: 60 minutes

---

### Subtask 0.5.9: (Optional) Basic Annotation Selection and Deletion

**Status**: Not started

**Goal**: Add ability to select and delete annotations.

**Optional Status**: This subtask is OPTIONAL for spike completion. If not implemented, add as Phase 1 task: "REQ-F-ANNOT-003: Annotation Editing". Document deferral in spike documentation.

**Implementation**:

1. Add selection state: `const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)`
2. Implement click handler on annotation shapes:
   ```typescript
   <Line
     points={annotation.points}
     onClick={() => setSelectedAnnotationId(annotation.id)}
   />
   ```
3. Highlight selected annotation (different stroke color or stroke width)
4. Add keyboard handler for Delete key:
   ```typescript
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === "Delete" && selectedAnnotationId) {
         setAnnotations(
           annotations.filter((a) => a.id !== selectedAnnotationId)
         );
         setSelectedAnnotationId(null);
       }
     };
     window.addEventListener("keydown", handleKeyDown);
     return () => window.removeEventListener("keydown", handleKeyDown);
   }, [selectedAnnotationId]);
   ```
5. Add "Clear All" button (optional)

**Deliverables**:

- Click annotation to select (visual highlight)
- Delete key removes selected annotation
- Selection state managed correctly

**Testing**:

- Manual: Select annotation, press Delete, verify removal
- Unit test: Test selection state and deletion logic

**User-Facing**:

- Users can select and delete individual annotations
- Clear visual feedback on selection
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 45 minutes

---

### Subtask 0.5.10: (Optional) Annotation Dragging

**Status**: Not started

**Goal**: Add ability to move annotations by dragging.

**Optional Status**: This subtask is OPTIONAL for spike completion. Requires 0.5.9 (selection) to be implemented first. If not implemented, add as Phase 1 task. Document deferral in spike documentation.

**Implementation**:

1. Enable draggable on annotation shapes:
   ```typescript
   <Line
     points={annotation.points}
     draggable={true}
     onDragEnd={(e) => {
       const newPosition = e.target.position();
       updateAnnotationPosition(annotation.id, newPosition);
     }}
   />
   ```
2. Update annotation data structure to include position offset:
   ```typescript
   interface Annotation {
     id: string;
     type: "freehand" | "polyline" | "oval" | "arrow";
     points: number[];
     color: string;
     strokeWidth: number;
     x?: number; // Position offset after dragging
     y?: number;
   }
   ```
3. Apply position offset when rendering shapes
4. Update cursor to indicate draggability (grab/grabbing cursors)

**Deliverables**:

- Annotations can be dragged to new positions
- Position updates persist
- Smooth dragging interaction

**Testing**:

- Manual: Drag annotation, verify new position persists
- Unit test: Test position update logic

**User-Facing**:

- Users can reposition annotations by dragging
- Visual cursor feedback (grab cursor)
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 60 minutes

---

### Subtask 0.5.11: (Optional) Annotation Transform (Resize/Rotate)

**Status**: Not started

**Goal**: Add resize and rotation handles using Konva.Transformer.

**Optional Status**: This subtask is OPTIONAL for spike completion. Requires 0.5.9 (selection) to be implemented first. If not implemented, add as Phase 1 task. Document deferral in spike documentation.

**Implementation**:

1. Add Transformer to layer:

   ```typescript
   const [transformerRef, setTransformerRef] =
     useState<Konva.Transformer | null>(null);

   useEffect(() => {
     if (!transformerRef || !selectedAnnotationId) return;

     const selectedNode = stageRef.current.findOne(`#${selectedAnnotationId}`);
     transformerRef.nodes([selectedNode]);
     transformerRef.getLayer().batchDraw();
   }, [selectedAnnotationId]);

   <Transformer ref={setTransformerRef} />;
   ```

2. Update annotation data on transform end:
   ```typescript
   onTransformEnd={(e) => {
     const node = e.target;
     updateAnnotation(annotation.id, {
       scaleX: node.scaleX(),
       scaleY: node.scaleY(),
       rotation: node.rotation(),
     });
   }}
   ```
3. Add scale and rotation to annotation data structure

**Deliverables**:

- Transformer appears when annotation selected
- Resize handles allow scaling
- Rotation handle allows rotation
- Transform updates persist

**Note**: This enables oval rotation, addressing the axis-aligned limitation.

**Testing**:

- Manual: Select annotation, resize/rotate, verify transform persists
- Unit test: Test transform data updates

**User-Facing**:

- Users can resize and rotate annotations with visual handles
- Professional annotation editing experience
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 75 minutes

---

### Subtask 0.5.12: Update Project Plan and Requirements

**Status**: Not started

**Goal**: Update project tracking documents with Task 0.5 completion status.

**Updates Required**:

1. **`project/PROJECT_PLAN.md`**:

   - Update Task 0.5 status: "Not Started" → "Complete"
   - Add completion date
   - Update Requirements Validated section
   - Update Current Status summary
   - Document which optional subtasks were completed/deferred

2. **`project/REQUIREMENTS.md`**:
   - Update REQ-F-ANNOT-002 status: "Planned" → "In Progress" or "Validated"
   - Update REQ-NF-P-002 status: "Planned" → "In Progress" or "Validated"
   - Add validation evidence (test results, performance metrics)
   - Add REQ-F-ANNOT-003 (Annotation Editing) if optional subtasks deferred to Phase 1

**Deliverables**:

- PROJECT_PLAN.md updated with Task 0.5 completion
- REQUIREMENTS.md updated with validation status
- Clear traceability from spike to requirements
- Phase 1 tasks created for deferred features

**Testing**:

- Documentation review (no automated tests)

**User-Facing**:

- Project status accurately reflects completion
- Requirements tracking updated
- Clear roadmap for Phase 1 features

**Estimated Time**: 30 minutes

---

## Summary

### Total Estimated Time

**Core Subtasks (Required)**: 8-11 hours across 8 subtasks (0.5.1 through 0.5.8, 0.5.12)

- Subtask 0.5.3 now includes all drawing tools + UI (2-3 hours vs original 3 hours sequential)
- Time savings from integrated approach: ~2 hours

**Optional Editing Features**: +3-4 hours if implementing subtasks 0.5.9, 0.5.10, 0.5.11

**Total Range**: 8-15 hours depending on optional feature implementation

### Subtask Dependencies

**Core Implementation Flow**:

- 0.5.1 → 0.5.2 → 0.5.3 (foundation → freehand → integrated all tools + UI)
- 0.5.3 → 0.5.4 (integrated tools → Konva.Animation for playback)
- 0.5.4 → 0.5.5 (extend Video A to Video B)
- 0.5.5 → 0.5.6 (tests require both videos implemented)
- 0.5.6 → 0.5.7 (performance tests build on integration tests)
- 0.5.7 → 0.5.8 (documentation requires performance results)

**Optional Editing Flow** (can defer to Phase 1):

- 0.5.8 → 0.5.9 (optional: selection/deletion)
- 0.5.9 → 0.5.10 (optional: dragging - requires selection)
- 0.5.9 → 0.5.11 (optional: transform - requires selection)
- {0.5.8 or 0.5.11} → 0.5.12 (update tracking - final step)

### Success Criteria (Final Validation)

**Core Requirements (Must Complete)**:

- [ ] All four drawing tools work on both videos (freehand, polyline, oval, arrow)
- [ ] Canvas overlay positioned exactly over video (pixel-perfect)
- [ ] Drawing latency ≤16ms (95th percentile)
- [ ] No stuttering with 10+ annotations during playback
- [ ] Stress test: 50+ annotations render smoothly (<33ms)
- [ ] All Playwright tests pass cross-browser (Chrome/Firefox/WebKit)
- [ ] Spike documentation complete
- [ ] PROJECT_PLAN.md and REQUIREMENTS.md updated

**Optional Features** (Can defer to Phase 1):

- [ ] Annotation selection and deletion (0.5.9)
- [ ] Annotation dragging (0.5.10)
- [ ] Annotation transform - resize/rotate (0.5.11)
- [ ] If deferred: REQ-F-ANNOT-003 created in REQUIREMENTS.md for Phase 1

### Critical Files

**Modified**:

- `frontend/src/components/DualVideoSyncDemo.tsx` (add annotation canvas with four drawing tools)
- `frontend/package.json` (add react-konva dependencies)

**New**:

- `tests/spikes/test_canvas_overlay.spec.ts` (Playwright tests - project root /tests)
- `docs/spike/CANVAS_OVERLAY.md` (spike documentation)
- `project/phase_0/TASK_0.5_PLAN.md` (this document)

**Updated**:

- `project/PROJECT_PLAN.md` (Task 0.5 status, optional subtasks status)
- `project/REQUIREMENTS.md` (REQ-F-ANNOT-002, REQ-NF-P-002 status; possibly REQ-F-ANNOT-003 for deferred editing)

### Integration Points

- Reuses WebCodecs rendering from Task 0.3
- Follows testing patterns from Tasks 0.2, 0.3, 0.4
- Memory cleanup pattern consistent with VideoFrame.close() (Task 0.3)
- Cross-browser testing infrastructure from Task 0.2.1

### Risk Mitigation

- **Canvas Alignment**: Start with Video A to isolate debugging
- **Performance**: Measure early with browser.evaluate(), implement Layer caching only if needed
- **Tool Complexity**: Integrated approach with proper state management from start (drag-based tools share handlers, only polyline differs)
- **Incremental Validation**: Test each tool immediately after implementation within 0.5.3
- **Cross-Browser**: Use established headless testing patterns from Tasks 0.2-0.4
- **Scope Management**: Optional editing subtasks (0.5.9-0.5.11) can be deferred to Phase 1 without blocking spike completion
- **Oval Limitations**: Axis-aligned ovals sufficient for spike; rotation capability via Transformer (0.5.14) or Phase 1
