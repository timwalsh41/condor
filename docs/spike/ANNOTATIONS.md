# Annotations Spike - Design & Implementation

**Status**: Completed (Subtask 0.5.3 - All Drawing Tools + Enhanced Architecture)  
**Date**: 2025-11-30  
**Related**: Task 0.5 - Canvas Overlay Spike

## Overview

The annotation system enables users to draw shapes (freehand, polyline, oval, arrow) over video frames during golf swing analysis. Annotations are rendered as canvas overlays using React Konva, positioned precisely over the video display.

## Architecture

### AnnotationManager Pattern

The implementation separates business logic from UI through a modular, testable architecture:

**1. Type Definitions** (`src/types/annotations.ts`)

- `Annotation`: Core data structure with id, type, points, style
- `AnnotationType`: Union type for tool types (freehand | polyline | oval | arrow)
- `AnnotationStyle`: Color and stroke width configuration
- `DrawingState`: State machine union (idle | drag-drawing | polyline-active)
- `Point`: Coordinate interface for type-safe position handling

**2. Business Logic** (`src/utils/AnnotationManager.ts`)

- **Data Management**: CRUD operations, unique ID generation, validation
- **Drawing State Machine**: Manages drawing workflow independent of UI
  - `startDrawing(tool, point)`: Initialize drawing session
  - `continueDrawing(point)`: Update in-progress drawing (append for freehand, update endpoint for oval/arrow)
  - `addPolylineVertex(point)`: Click-to-add for polyline tool
  - `finishDrawing()`: Validate, create annotation, reset state
  - `cancelDrawing()`: Abort without saving
  - Query methods: `isDrawing()`, `isPolylineActive()`, `getCurrentTool()`
  - State access: `getDrawingState()`, `getPreviewPoints()` (immutable copies)

**3. React Integration** (`src/components/DualVideoSyncDemo.tsx`)

- **Thin Adapter Pattern**: Handlers delegate to AnnotationManager (5-10 lines each)
- **State Mirroring**: Component mirrors manager state via `setDrawingState()` for React re-rendering
- **Tool Selection UI**: 4 buttons (Freehand, Polyline, Oval, Arrow) with visual feedback
- **Konva Rendering**: Stage/Layer/Line/Ellipse/Arrow components for completed + preview annotations

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

**Keyboard Shortcuts** (Polyline):

- Enter: Finalize polyline
- Escape: Cancel without saving

### State Management Flow

````typescript
// AnnotationManager holds authoritative state
private drawingState: DrawingState = { mode: 'idle' };

### State Management Flow

```typescript
// AnnotationManager holds authoritative state
private drawingState: DrawingState = { mode: 'idle' };

// Component mirrors state for React rendering
const [drawingState, setDrawingState] = useState<DrawingState>({ mode: 'idle' });

// Handler delegates and syncs
const handleClick = (e) => {
  annotationManager.startDrawing('polyline', point);
  setDrawingState(annotationManager.getDrawingState()); // Trigger re-render
};
````

**Benefits**:

- Business logic testable without React
- State machine isolated from UI concerns
- Reusable across Video A/B channels
- Clear separation enables future features (undo/redo, persistence)

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

**Live Preview** (red dashed):

- Drag-based: Freehand/Oval/Arrow render in-progress shape using `getPreviewPoints()` conversion
- Polyline: Completed segments + semi-transparent cursor preview line

### Performance Considerations

- **React State Updates**: Batched automatically by React 18
- **Konva Rendering**: Canvas-based, efficient for <100 shapes
- **State Machine**: Minimal overhead, single object updates
- **Memory**: In-memory only (Phase 0 scope)

## Testing

### Unit Tests (`src/utils/tests/AnnotationManager.test.ts`)

**65 tests passing** covering:

- Annotation CRUD operations (create, add, get, remove, clear)
- Point validation for all tool types (using Point[] arrays)
- Drawing state machine (startDrawing, continueDrawing, finishDrawing, addPolylineVertex, cancelDrawing)
- State queries (isDrawing, isPolylineActive, getCurrentTool, getDrawingState, getPreviewPoints)
- Complete workflows for all drawing patterns
- Edge cases (empty arrays, validation failures, Point[] format)

**Key Achievement**: Business logic 100% testable without React or browser environment. All tests use type-safe Point[] data.

## Requirements Satisfied

- **REQ-F-ANNOT-001**: Drawing Tools (all 4 tools implemented)
- **REQ-F-ANNOT-002**: Annotation Rendering (overlay, alignment, visible during playback)
- **REQ-F-ANNOT-004**: Fixed style in MVP (red, 3px, no customization UI)

## Critical Learnings

1. **State Machine Architecture**: Separating drawing state management from UI enables:

   - Pure unit testing of business logic (66 tests, no React)
   - Reusability across Video A/B channels
   - Future features: undo/redo, persistence, import/export

2. **Coordinate System**: Video intrinsic dimensions for Stage + CSS scaling simplifies coordinate handling and ensures resolution independence

3. **Interaction Patterns**: Two distinct patterns identified:

   - Drag-based (freehand/oval/arrow): mouseDown → move → mouseUp
   - Click-based (polyline): click → click → finalize (Enter/double-click)
   - Critical: Prevent mouseUp from finishing polyline

4. **Thin Adapter Pattern**: Component handlers delegate to manager (5-10 lines), keeping UI logic minimal and testable logic maximal

5. **Live Preview UX**: Polyline cursor preview (semi-transparent segment to mouse) matches oval/arrow drag feedback, creating consistent interaction experience

## References

- **React Konva**: https://konvajs.org/docs/react/
- **Task 0.5 Plan**: `/workspace/project/phase_0/TASK_0.5_PLAN.md`
- **Requirements**: `/workspace/project/REQUIREMENTS.md` (REQ-F-ANNOT-\*)
