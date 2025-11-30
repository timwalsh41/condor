# Task 0.5: Canvas Overlay Spike - Implementation Plan

## Status:

**Last Subtask Completed:** 0.5.1
**Last Updated:** 2025-11-29

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

**Goal**: Add freehand line drawing tool that continuously tracks mouse movement.

**Implementation**:

1. Create annotation state management:
   ```typescript
   interface Annotation {
     id: string;
     type: "freehand" | "polyline" | "oval" | "arrow";
     points: number[]; // For freehand: [x1, y1, x2, y2, x3, y3, ...]
     color: string;
     strokeWidth: number;
   }
   ```
2. Implement mouse event handlers: `onMouseDown`, `onMouseMove`, `onMouseUp`
3. Track drawing state: `isDrawing`, `currentPoints`, `annotations`
4. On `onMouseMove` during drag: Continuously append `[mouseX, mouseY]` to `currentPoints`
5. Render completed freehand lines as Konva `Line` shapes with `lineCap="round"`, `lineJoin="round"`
6. Show drawing-in-progress with real-time feedback (dashed preview line)

**Deliverables**:

- Freehand drawing works with mouse click-drag-release
- Line smoothly follows mouse path during drag
- Completed freehand lines persist and display on Video A
- Drawing state managed correctly (start, draw, finish)

**Testing**:

- Manual: Draw freehand line on Video A, verify it appears and persists
- Unit test: Test annotation state updates (add/remove annotations)

**User-Facing**:

- Users can draw smooth, continuous freehand lines on Video A
- Live preview shows line following mouse during drag
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 60 minutes

---

### Subtask 0.5.3: Implement Segmented Polyline Drawing (Video A)

**Goal**: Add segmented polyline tool with click-to-add-vertex interaction.

**Implementation**:

1. Add polyline tool to annotation type system
2. Implement click-based drawing logic:
   - `onClick`: Add vertex at click position to `currentPoints`
   - Continue adding vertices on subsequent clicks
   - `onDblClick` or Enter key: Finalize polyline and add to `annotations`
   - Escape key: Cancel current polyline
3. Store polyline as: `points = [x1, y1, x2, y2, x3, y3, ...]` (vertex sequence)
4. Render polyline as Konva `Line` shape connecting vertices with straight segments
5. Show drawing-in-progress: render temporary line with vertices added so far
6. Visual feedback: highlight current vertex position with small circle

**Deliverables**:

- Segmented polyline drawing works with click-to-add-vertex pattern
- Double-click or Enter finalizes polyline
- Escape cancels drawing
- Polylines render as straight-segment connections between vertices
- Completed polylines persist alongside freehand lines

**Testing**:

- Manual: Draw segmented polyline on Video A with 3+ vertices, verify shape accuracy
- Unit test: Test polyline vertex collection and finalization logic

**User-Facing**:

- Users can draw precise angular annotations with click-to-place vertices
- Useful for marking swing plane angles, joint positions, etc.
- Live preview shows polyline-in-progress
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 60 minutes

---

### Subtask 0.5.4: Implement Oval Drawing (Video A)

**Goal**: Add axis-aligned oval/ellipse drawing tool with center and radius calculation.

**Implementation**:

1. Add oval tool to annotation type system
2. Implement oval drawing logic:
   - `onMouseDown`: Capture center point (startX, startY)
   - `onMouseMove`: Calculate radiusX/radiusY from mouse distance
   - `onMouseUp`: Finalize oval with calculated dimensions
3. Store oval as: `points = [centerX, centerY, radiusX, radiusY]` (axis-aligned, no rotation)
4. Render oval as Konva `Ellipse` shape with `x`, `y`, `radiusX`, `radiusY` props

**Deliverables**:

- Oval drawing works with click-drag-release (center to edge)
- Ovals render correctly with proper dimensions (axis-aligned)
- Oval annotations persist alongside freehand lines and polylines

**Note**: Ovals are axis-aligned (major/minor axes parallel to x/y). Rotation capability can be added in Phase 1 if needed.

**Testing**:

- Manual: Draw oval on Video A, verify shape accuracy
- Unit test: Test oval coordinate calculation (center + radius)

**User-Facing**:

- Users can draw circular/elliptical shapes on Video A
- Visual feedback shows oval expanding as mouse drags
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 45 minutes

---

### Subtask 0.5.5: Implement Arrow Drawing (Video A)

**Goal**: Add arrow/directional annotation tool.

**Implementation**:

1. Add arrow tool to annotation type system
2. Implement arrow drawing logic:
   - `onMouseDown`: Capture start point (startX, startY)
   - `onMouseMove`: Update end point (endX, endY)
   - `onMouseUp`: Finalize arrow with start/end points
3. Store arrow as: `points = [startX, startY, endX, endY]`
4. Render arrow as Konva `Arrow` shape with `pointerLength={10}`, `pointerWidth={10}`

**Deliverables**:

- Arrow drawing works with click-drag-release (start to end)
- Arrows render with correct direction and arrowhead
- Arrow annotations persist alongside freehand lines, polylines, and ovals

**Testing**:

- Manual: Draw arrow on Video A, verify direction and appearance
- Unit test: Test arrow coordinate storage (start/end points)

**User-Facing**:

- Users can draw directional arrows on Video A
- Visual feedback shows arrow extending as mouse drags
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 45 minutes

---

### Subtask 0.5.6: Add Tool Selection UI (Video A)

**Goal**: Create UI for switching between drawing tools.

**Implementation**:

1. Add tool selection state: `const [selectedTool, setSelectedTool] = useState<'freehand' | 'polyline' | 'oval' | 'arrow'>('freehand')`
2. Create tool selector buttons (freehand/polyline/oval/arrow)
3. Highlight active tool with visual indicator (bold text or background color)
4. Wire tool selection to drawing event handlers (conditional logic based on `selectedTool`)
5. Update mouse cursor based on selected tool (optional enhancement)

**Deliverables**:

- Four tool buttons rendered above Video A canvas
- Active tool visually highlighted
- Drawing behavior switches based on selected tool
- All four tools functional and toggleable

**Testing**:

- Manual: Select each tool, draw annotation, verify correct shape appears
- Integration test: Test tool switching and annotation type validation

**User-Facing**:

- Clear UI for selecting annotation tool (freehand, polyline, oval, arrow)
- Immediate visual feedback on tool selection
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 30 minutes

---

### Subtask 0.5.7: Integrate Konva.Animation with Playback (Video A)

**Goal**: Validate that annotations remain visible during video playback and implement Konva.Animation if needed to prevent flicker.

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

### Subtask 0.5.8: Extend Annotation Canvas to Video B

**Goal**: Add annotation canvas to Video B with independent annotation state.

**Implementation**:

1. Duplicate annotation canvas structure for Video B section
2. Create separate annotation state for Video B: `annotationsVideoB`, `currentPointsVideoB`
3. Reuse drawing logic and tool selection UI (shared or duplicated)
4. Ensure Video A and Video B annotations are independent
5. Apply same Konva.Animation pattern to Video B layer (if implemented in 0.5.7)

**Deliverables**:

- Video B has working annotation canvas with all four tools (freehand, polyline, oval, arrow)
- Video A and Video B annotations do not interfere with each other
- Both videos support independent drawing and playback

**Testing**:

- Manual: Draw on both videos, verify independence
- Integration test: Test independent annotation state per video

**User-Facing**:

- Users can annotate both videos independently
- Full dual-video annotation capability demonstrated
- Demo exercisable via `npm run dev` at `/dual-video-sync`

**Estimated Time**: 60 minutes

---

### Subtask 0.5.9: Create Playwright Integration Tests

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

### Subtask 0.5.10: Performance Testing and Validation

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

### Subtask 0.5.11: Create Spike Documentation

**Goal**: Document implementation, findings, and recommendations for Phase 1.

**Documentation File**: `docs/spike/CANVAS_OVERLAY.md`

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

### Subtask 0.5.12: (Optional) Basic Annotation Selection and Deletion

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

### Subtask 0.5.13: (Optional) Annotation Dragging

**Goal**: Add ability to move annotations by dragging.

**Optional Status**: This subtask is OPTIONAL for spike completion. Requires 0.5.12 (selection) to be implemented first. If not implemented, add as Phase 1 task. Document deferral in spike documentation.

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

### Subtask 0.5.14: (Optional) Annotation Transform (Resize/Rotate)

**Goal**: Add resize and rotation handles using Konva.Transformer.

**Optional Status**: This subtask is OPTIONAL for spike completion. Requires 0.5.12 (selection) to be implemented first. If not implemented, add as Phase 1 task. Document deferral in spike documentation.

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

### Subtask 0.5.15: Update Project Plan and Requirements

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

**Core Subtasks (Required)**: 10-13 hours across 11 subtasks (0.5.1 through 0.5.11, 0.5.15)

**Optional Editing Features**: +3-4 hours if implementing subtasks 0.5.12, 0.5.13, 0.5.14

**Total Range**: 10-17 hours depending on optional feature implementation

### Subtask Dependencies

**Core Implementation Flow**:

- 0.5.1 → 0.5.2 → 0.5.3 → 0.5.4 → 0.5.5 → 0.5.6 → 0.5.7 (sequential on Video A)
- 0.5.7 → 0.5.8 (extend to Video B after Video A validated)
- 0.5.8 → 0.5.9 (tests require both videos implemented)
- 0.5.9 → 0.5.10 (performance tests build on integration tests)
- 0.5.10 → 0.5.11 (documentation requires performance results)

**Optional Editing Flow** (can defer to Phase 1):

- 0.5.11 → 0.5.12 (optional: selection/deletion)
- 0.5.12 → 0.5.13 (optional: dragging - requires selection)
- 0.5.12 → 0.5.14 (optional: transform - requires selection)
- {0.5.11 or 0.5.14} → 0.5.15 (update tracking - final step)

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

- [ ] Annotation selection and deletion (0.5.12)
- [ ] Annotation dragging (0.5.13)
- [ ] Annotation transform - resize/rotate (0.5.14)
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
- **Tool Complexity**: Implement tools incrementally (freehand → polyline → oval → arrow)
- **Cross-Browser**: Use established headless testing patterns from Tasks 0.2-0.4
- **Scope Management**: Optional editing subtasks (0.5.12-0.5.14) can be deferred to Phase 1 without blocking spike completion
- **Oval Limitations**: Axis-aligned ovals sufficient for spike; rotation capability via Transformer (0.5.14) or Phase 1
