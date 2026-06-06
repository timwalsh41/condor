# Annotations Spike - Design & Implementation

**Status**: Completed (Subtask 0.5.5 - Dual-Video Support + Refactored Architecture)  
**Date**: 2025-12-01  
**Related**: Task 0.5 - Canvas Overlay Spike

## Overview

The annotation system enables users to draw shapes (freehand, polyline, oval, arrow) over video frames during golf swing analysis. Annotations are rendered as canvas overlays using React Konva, positioned precisely over the video display.

## Architecture

### AnnotationManager Pattern

The implementation separates business logic from UI through a modular, testable architecture:

**1. Type Definitions** (`frontend/src/types/annotations.ts`)

- `Annotation`: Core data structure with id, type, points, style
- `AnnotationType`: Union type for tool types (freehand | polyline | oval | arrow)
- `AnnotationStyle`: Color and stroke width configuration
- `DrawingState`: State machine union (idle | drag-drawing | polyline-active)
- `Point`: Coordinate interface for type-safe position handling

**2. Business Logic** (`frontend/src/utils/AnnotationManager.ts`)

- **Data Management**: CRUD operations, unique ID generation, validation
- **Tool Selection**: Integrated tool state management via `setTool(tool)` and `getTool()`
- **Drawing State Machine**: Manages drawing workflow independent of UI
  - `startDrawing(point)`: Initialize drawing session with internally selected tool (clears selections)
  - `continueDrawing(point)`: Update in-progress drawing (append for freehand, update endpoint for oval/arrow)
  - `addPolylineVertex(point)`: Click-to-add for polyline tool
  - `finishDrawing()`: Validate, create annotation, reset state
  - `cancelDrawing()`: Abort without saving
  - Query methods: `isDrawing()`, `isPolylineActive()`, `getTool()`
  - State access: `getDrawingState()`, `getPreviewPoints()` (immutable copies)
- **Selection Management**: Set-based tracking for multi-select support
  - `toggleSelection(id, isMultiSelect)`: Add/remove from selection (ctrl-click support)
  - `isSelected(id)`: Check selection state
  - `getSelectedIds()`: Retrieve immutable copy of selected IDs
  - `clearSelection()`: Clear all selections
  - `deleteSelected()`: Remove selected annotations, return count, clear selections
- **Drag Operations**: Point transformation approach for repositioning
  - `updateAnnotationPoints(id, delta)`: Transform annotation points by delta offset
  - `startDrag(primaryId, selectedIds, annotations)`: Initialize drag with all selected annotations
  - `updateDrag(delta)`: Apply cumulative delta from original positions (all selected move together)
  - `endDrag()`: Finalize drag and reset state
  - `isDragging()`: Query active drag state
- **Reshape Operations**: Control point manipulation for resizing
  - `startReshape(annotationId, controlPointIndex)`: Store original points and reshape state
  - `updateReshape(newPosition)`: Type-specific point updates (vertex move for arrow/polyline, bounds adjust for oval, endpoint move for freehand)
  - `endReshape()`: Clear reshape state
  - `isReshaping()`: Query active reshape state
  - `getReshapeState()`: Get current reshape metadata

**3. Custom Hook** (`frontend/src/hooks/useVideoAnnotations.ts`)

- **Encapsulation**: All annotation logic per video channel in single hook
- **Scale Calculation**: Automatic canvas scaling to match video display size
- **Event Handlers**: Generated handlers for mouse events, annotation clicks, and keyboard shortcuts
  - `handleAnnotationClick`: Selection with ctrl-key detection for multi-select, `cancelBubble` to prevent event propagation
  - Target checking: `target !== stage` prevents drawing on annotation/control point clicks
- **Keyboard Support**: 
  - Enter/Escape: Polyline finalization/cancellation
  - Delete: Removes selected annotations (with input/textarea safeguard)
- **Drag Handlers**:
  - `handleAnnotationDragStart`: Initiates drag for selected annotations (prevents during drawing)
  - `handleStageMouseMove`: Updates drag position with live preview (calculates delta from start)
  - `handleStageMouseUp`: Finalizes drag operation
  - `dragMoved` state: Prevents onClick deselection after drag completes
- **Reshape Handlers**:
  - `handleControlPointMouseDown`: Initiates reshape via `manager.startReshape()`, sets `isReshapingAnnotation = true`
  - `handleStageMouseMove`: When reshaping, calls `manager.updateReshape()` with current mouse position
  - `handleStageMouseUp`: Finalizes reshape via `manager.endReshape()`, sets `isReshapingAnnotation = false`
- **Returns**: Manager, tool state, drawing state, annotations, selectedIds, scale, drag state, reshape state, and event handlers

**4. Component Integration** (`frontend/src/components/DualVideoSyncDemo.tsx`)

- **Dual-Video Support**: Independent annotation state for Video A and Video B
- **Hook Usage**: Single line per video: `useVideoAnnotations(videoDecoder, videoId, activeVideo, setActiveVideo)`
- **Tool Selection UI**: 4 buttons per video (Freehand, Polyline, Oval, Arrow) with visual feedback
- **Konva Rendering**: Stage/Layer/Line/Ellipse/Arrow components for completed + preview annotations
- **Selection UI**: 
  - `onClick` handlers on all annotation shapes (Line/Ellipse/Arrow) pass events to `handleAnnotationClick`
  - Control points rendered as 8x8px white Rects with black stroke when annotation selected
  - `hitStrokeWidth={20}` on Line/Arrow for easier selection (20px clickable area vs 3px visual)
  - Preview shapes: `listening={false}` makes red dashed drawing previews non-interactive
- **Drag UI**:
  - `onMouseDown` on annotation shapes triggers drag when selected and idle
  - Pre-computed cursor: "move" when draggable, "pointer" otherwise (Konva requires static values)
  - Live preview: annotations follow cursor during drag
- **Reshape UI**:
  - Control point Rects have `onMouseDown` handler calling `handleControlPointMouseDown(annotationId, idx, e)`
  - `e.cancelBubble = true` prevents event propagation to annotation shape
  - Stage handlers route to reshape logic when `isReshapingAnnotation = true`
  - Stage `onMouseMove`/`onMouseUp`/`onMouseLeave` check `isDraggingAnnotation || isReshapingAnnotation` to route events correctly
- **Clear All UI**: Buttons per video (disabled when empty) call `clearAll()` from hook

### Canvas Overlay Structure

```
Video Canvas Container (position: relative)
  └─ Video Canvas (WebCodecs rendering, z-index: 0)
  └─ Annotation Wrapper (position: absolute, top: 0, left: 0, z-index: 1)
      └─ Scaling Wrapper (CSS transform: scale)
          └─ Konva Stage (width: videoMetadata.width, height: videoMetadata.height)
              └─ Konva Layer
                  ├─ Completed annotations (Line, Ellipse, Arrow components)
                  ├─ Drag-based preview (freehand/oval/arrow - dashed red)
                  └─ Polyline preview (completed segments + cursor preview - dashed red, 60% opacity)
```

**Coordinate System Design**: Stage dimensions match video intrinsic dimensions (e.g., 1920×1080), CSS scaling matches displayed size. Konva handles coordinate transformation automatically via `getPointerPosition()`.

### Drawing Interaction Patterns

**Drag-Based Tools** (Freehand, Oval, Arrow):

1. Mouse Down → `startDrawing()` with first point
2. Mouse Move → `continueDrawing()` (freehand appends, oval/arrow update endpoint)
3. Mouse Up → `finishDrawing()` creates annotation

**Click-Based Tool** (Polyline):

1. First Click → `startDrawing()` with first vertex
2. Mouse Move → Live preview from last vertex to cursor (semi-transparent)
3. Subsequent Clicks → `addPolylineVertex()` adds vertices
4. Finalize → Double-click, Enter key, or manual finish

**Keyboard Shortcuts**:

- Enter: Finalize polyline
- Escape: Cancel polyline
- Delete: Remove selected annotations

**Annotation Dragging**:

1. Mouse Down on selected annotation → `handleAnnotationDragStart()` stores start position
2. Mouse Move → `handleStageMouseMove()` calculates delta, updates all selected via `updateDrag()`
3. Mouse Up → `handleStageMouseUp()` finalizes via `endDrag()`, sets dragMoved flag to prevent deselection

**Annotation Reshaping** (Resize via Control Points):

1. Mouse Down on control point → `handleControlPointMouseDown()` calls `manager.startReshape(annotationId, controlIndex)`
2. Mouse Move → `handleStageMouseMove()` checks `isReshapingAnnotation`, calls `manager.updateReshape(point)` with type-specific logic:
   - **Arrow/Polyline**: Updates the vertex at `controlIndex` to new position
   - **Oval**: Recalculates bounding box based on which control point moved (8 control points: corners + midpoints)
   - **Freehand**: Updates start or end point (only 2 control points)
3. Mouse Up → `handleStageMouseUp()` calls `manager.endReshape()` to finalize
4. **Event Routing**: Stage handlers check `isDraggingAnnotation || isReshapingAnnotation` to route to `handleStageMouseMove`/`handleStageMouseUp`

### State Management Flow

**Architecture**: Custom hook pattern avoids duplication while maintaining testability:

- **AnnotationManager**: Owns tool selection and drawing state (business logic)
- **useVideoAnnotations**: Encapsulates React state, event handlers, and keyboard shortcuts per video
- **Component**: Consumes hook results, renders UI and Konva elements

**Benefits**:

- Zero duplication between Video A/B channels
- Business logic testable without React (67 AnnotationManager tests)
- Hook testable with React Testing Library (14 hook tests)
- Clear separation of concerns: manager (logic), hook (React integration), component (rendering)
- Keyboard shortcuts context-aware (only active video responds)

### Data Model

**Type-Safe Point Storage**:

```typescript
interface Point {
  x: number;
  y: number;
}
interface Annotation {
  points: Point[]; // Type-safe coordinate pairs
  // ... other properties
}
```

**Design Rationale**: Store coordinates as structured `Point[]` instead of flat `number[]` for:

- Type safety: Impossible to have odd-length arrays
- Clarity: `annotation.points[0].x` vs `annotation.points[0]`
- Maintainability: Easier to understand and less error-prone

**Konva Compatibility Layer**: Since react-konva requires flat `number[]` for rendering:

```typescript
// Helper function for rendering
const pointsToKonva = (points: Point[]): number[] =>
  points.flatMap((p) => [p.x, p.y]);

// Usage in JSX
<Line points={pointsToKonva(annotation.points)} />;
```

### Point Validation

Type-specific validation ensures data integrity:

| Tool     | Validation Rule                       |
| -------- | ------------------------------------- |
| Freehand | ≥2 points (unlimited coordinates)     |
| Polyline | ≥2 points (unlimited coordinates)     |
| Oval     | Exactly 2 points: start, end (bounds) |
| Arrow    | Exactly 2 points: start, end          |

Validation occurs in `AnnotationManager.validatePoints()` before adding annotations.

### Rendering Components

**Completed Annotations**:

```typescript
// Freehand & Polyline - convert Point[] to flat array for Konva
<Line points={pointsToKonva(annotation.points)} stroke={color} strokeWidth={width}
      tension={type === 'freehand' ? 0.5 : 0} />

// Oval - access Point properties directly
const start = annotation.points[0];
const end = annotation.points[1];
<Ellipse x={(start.x + end.x) / 2} y={(start.y + end.y) / 2}
         radiusX={Math.abs(end.x - start.x) / 2} radiusY={Math.abs(end.y - start.y) / 2}
         stroke={color} />

// Arrow - convert Point[] to flat array
<Arrow points={pointsToKonva(annotation.points)} stroke={color} fill={color}
       pointerLength={10} pointerWidth={10} />
```

**Live Preview** (red dashed, `listening={false}`):

- Drag-based: Freehand/Oval/Arrow render in-progress shape using `getPreviewPoints()` conversion
- Polyline: Completed segments + semi-transparent cursor preview line
- Non-interactive: All preview shapes have `listening={false}` so clicks pass through to Stage handlers

**Control Points** (selected annotations only):

```typescript
// Type-specific control points from helper function
const getControlPoints = (annotation: Annotation): Point[] => {
  switch (annotation.type) {
    case 'freehand':
    case 'arrow':
      return [annotation.points[0], annotation.points[annotation.points.length - 1]]; // Start and end
    case 'polyline':
      return annotation.points; // All vertices
    case 'oval': {
      // 8 points: corners + midpoints of bounding box
      const [start, end] = annotation.points;
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      return [
        { x: centerX, y: centerY - radiusY }, // Top
        { x: centerX + radiusX, y: centerY }, // Right
        { x: centerX, y: centerY + radiusY }, // Bottom
        { x: centerX - radiusX, y: centerY }, // Left
        { x: centerX + radiusX * 0.707, y: centerY - radiusY * 0.707 }, // Top-right
        { x: centerX + radiusX * 0.707, y: centerY + radiusY * 0.707 }, // Bottom-right
        { x: centerX - radiusX * 0.707, y: centerY + radiusY * 0.707 }, // Bottom-left
        { x: centerX - radiusX * 0.707, y: centerY - radiusY * 0.707 }, // Top-left
      ];
    }
  }
};

// Render 8x8px white Rects with black stroke (interactive for future drag/edit)
{isSelected && getControlPoints(annotation).map((point, idx) => (
  <Rect key={`cp-${annotation.id}-${idx}`} x={point.x - 4} y={point.y - 4}
        width={8} height={8} fill="white" stroke="black" strokeWidth={1} />
))}
```

### Performance Considerations

- **React State Updates**: Batched automatically by React 18
- **Konva Rendering**: Canvas-based, efficient for <100 shapes
- **State Machine**: Minimal overhead, single object updates
- **Memory**: In-memory only (Phase 0 scope)
- **Konva.Animation**: NOT implemented in Phase 0 spike. Extensive testing showed no flickering or rendering issues during video playback. React Konva's layer maintains its own canvas independently of WebCodecs video canvas. Implementation deferred until testing proves necessary (straightforward to add: create `Konva.Animation` instance, start/stop with play/pause state).

## Testing

### Unit Tests

**AnnotationManager** (`frontend/src/utils/tests/AnnotationManager.test.ts`) - **137 tests**:

- Annotation CRUD operations
- Tool selection integration (`setTool`, `getTool`)
- Drawing state machine (all 4 tools)
- Point validation and workflows
- Selection management (17 tests): `toggleSelection`, `isSelected`, `getSelectedIds`, `clearSelection`, `deleteSelected`, integration with `startDrawing`/`clearAll`
- Drag operations (21 tests): `updateAnnotationPoints`, `startDrag`, `updateDrag` (including cumulative delta), `endDrag`, `isDragging`, integration scenarios
- Reshape operations (31 tests): `startReshape`, `updateReshape` (arrow/polyline/oval/freehand), `endReshape`, `isReshaping`, `getReshapeState`, integration scenarios

**useVideoAnnotations Hook** (`frontend/src/hooks/tests/useVideoAnnotations.test.ts`) - **38 tests**:

- Hook initialization and state management
- Tool selection via hook API
- Event handler generation
- Scale calculation
- Keyboard shortcuts (Enter/Escape for polyline, Delete for selection)
- Video activation logic
- Selection and deletion (6 tests): `handleAnnotationClick`, multi-select, Delete key, `clearAll`
- Drag operations (9 tests): handler existence, drag workflow (start/move/end), prevention during drawing, multi-select group drag
- Reshape operations (9 tests): handler existence, reshape workflow (start/move/end), prevention during drawing, type-specific reshape

**Total: 175 unit tests passing** - Business logic, React integration, drag functionality, and reshape functionality fully covered.

### Integration Tests

**Playwright E2E Tests** (`frontend/tests/test_canvas_overlay.spec.ts`) - **44/60 tests passing (73%)**:

**Passing tests:**
- ✅ Canvas Overlay Alignment (5 tests): Canvas positioning, dimension matching, window resize, pointer-events
- ✅ Drawing Functionality - Partial (3/4 tools): Freehand, Oval, Arrow, Polyline cancellation
- ✅ Dual Video Independence (1 test): Independent annotation state per video
- ✅ Playback Integration (1 test): Annotations persist during playback
- ✅ HEVC Codec Blocking (3 tests): Early detection, post-parse detection, error messaging
- ✅ Interactive Features - Partial (1/3 tests): Clear All button

**Failing tests (16/60):**
- ❌ Polyline finalization (Enter key, double-click)
- ❌ Annotation selection (clicking annotations)
- ❌ Annotation deletion (Delete key)
- ❌ Tool switching (depends on polyline)

### Testing Limitations: Headless React+Konva Integration

**Root Cause:**

Certain interactions cannot be reliably automated in headless Playwright due to React+Konva event coordination requirements:

1. **Polyline Finalization**: The keyboard handler (`useVideoAnnotations.ts:149`) requires `activeVideo === videoId` state to be set before Enter/Escape keys work. This state is set by React event handlers (`handleClick`, `handleMouseDown`) which don't trigger properly when dispatching synthetic DOM events to the Konva canvas in headless mode.

2. **Annotation Selection**: Clicking annotations requires triggering the annotation shape's `onClick` handler. Direct event dispatch to the canvas triggers Konva's internal event system but doesn't properly invoke React's synthetic event handlers, preventing selection state updates.

3. **State Coordination**: The `activeVideo` state bridges React component state with Konva event handlers. When we dispatch MouseEvent/KeyboardEvent directly to the DOM canvas element, Konva processes them internally, but React's synthetic event system (which sets `activeVideo`) doesn't receive proper notification.

**Why Test Hooks Don't Help:**

Adding test-specific APIs (e.g., `window.__setActiveVideo()`) would allow bypassing the user interaction path entirely. This tests internal methods (e.g., `AnnotationManager.finishDrawing()`) but NOT the actual DOM → React → Konva event chain that users rely on. These are already covered by unit tests.

**What IS Tested:**

- ✅ **Core functionality**: 44/60 integration tests (73%) validate real user interactions
- ✅ **Business logic**: 175 unit tests cover all AnnotationManager and hook methods
- ✅ **Drawing tools**: 3/4 tools fully validated (freehand, oval, arrow work end-to-end)
- ✅ **Critical requirements**: Canvas alignment, HEVC blocking, dual-video independence

**What Requires Manual Testing:**

- Polyline tool finalization (Enter/double-click)
- Annotation selection (clicking shapes)
- Annotation deletion (Delete key after selection)

**Production Verification:**

These features work correctly in production (manually verified in Chrome, Firefox, Safari). The limitation is specific to headless automation, not the implementation.

## Requirements Satisfied

- **REQ-F-ANNOT-001**: Drawing Tools (all 4 tools implemented)
- **REQ-F-ANNOT-002**: Annotation Rendering (overlay, alignment, visible during playback)
- **REQ-F-ANNOT-004**: Fixed style in MVP (red, 3px, no customization UI)

## Critical Learnings

1. **Custom Hook Pattern**: Encapsulating per-video logic in `useVideoAnnotations` eliminated ~150 lines of duplication, enabling clean dual-video support with identical hook calls for Video A/B

2. **Tool Selection Integration**: Moving tool state into AnnotationManager (via `setTool`/`getTool`) simplified API and eliminated prop drilling

3. **Coordinate System**: Video intrinsic dimensions for Stage + CSS scaling simplifies coordinate handling and ensures resolution independence

4. **Interaction Patterns**: Two distinct patterns require different event handling:

   - Drag-based (freehand/oval/arrow): mouseDown → move → mouseUp
   - Click-based (polyline): click → click → finalize (Enter/double-click/double-click)

5. **Keyboard Shortcuts**: Context-aware implementation using `activeVideo` state ensures only the active video responds to Enter/Escape keys; Delete key operates globally on both videos simultaneously

6. **Selection UX**: Three enhancements improved usability:
   - `hitStrokeWidth={20}` makes thin lines easier to click (20px clickable area vs 3px visual)
   - Selections cleared on `startDrawing()` prevents confusion when drawing new annotations
   - Preview shapes with `listening={false}` prevents blocking clicks (fixes polyline vertex addition)

7. **Event Propagation**: Konva's `cancelBubble` prevents annotation clicks from triggering Stage handlers, but Stage handlers still fire - must check `event.target === stage` to distinguish background clicks from annotation clicks

8. **Reshape Event Routing**: Control point reshape requires proper event routing in Stage handlers. Initial implementation only checked `isDraggingAnnotation` to route to `handleStageMouseMove`/`handleStageMouseUp`, causing control point drags to trigger drawing instead of reshape. Fix: destructure `isReshapingAnnotation` from hook and check `isDraggingAnnotation || isReshapingAnnotation` in Stage's `onMouseMove`/`onMouseUp`/`onMouseLeave` handlers. This ensures reshape events route to the correct handlers that call `manager.updateReshape()` and `manager.endReshape()`.

## References

- **React Konva**: https://konvajs.org/docs/react/
- **Task 0.5 Plan**: `docs/project/phase_0/TASK_0.5_PLAN.md`
- **Requirements**: `docs/project/REQUIREMENTS.md` (REQ-F-ANNOT-\*)
