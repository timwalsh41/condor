# Annotations Spike - Design & Implementation

**Status**: Completed (Subtask 0.5.5 - Dual-Video Support + Refactored Architecture)  
**Date**: 2025-12-01  
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
- **Tool Selection**: Integrated tool state management via `setTool(tool)` and `getTool()`
- **Drawing State Machine**: Manages drawing workflow independent of UI
  - `startDrawing(point)`: Initialize drawing session with internally selected tool
  - `continueDrawing(point)`: Update in-progress drawing (append for freehand, update endpoint for oval/arrow)
  - `addPolylineVertex(point)`: Click-to-add for polyline tool
  - `finishDrawing()`: Validate, create annotation, reset state
  - `cancelDrawing()`: Abort without saving
  - Query methods: `isDrawing()`, `isPolylineActive()`, `getTool()`
  - State access: `getDrawingState()`, `getPreviewPoints()` (immutable copies)

**3. Custom Hook** (`src/hooks/useVideoAnnotations.ts`)

- **Encapsulation**: All annotation logic per video channel in single hook
- **Scale Calculation**: Automatic canvas scaling to match video display size
- **Event Handlers**: Generated handlers for mouse events and keyboard shortcuts
- **Keyboard Support**: Enter/Escape handling for polyline finalization/cancellation
- **Returns**: Manager, tool state, drawing state, annotations, scale, and event handlers

**4. Component Integration** (`src/components/DualVideoSyncDemo.tsx`)

- **Dual-Video Support**: Independent annotation state for Video A and Video B
- **Hook Usage**: Single line per video: `useVideoAnnotations(videoDecoder, videoId, activeVideo, setActiveVideo)`
- **Tool Selection UI**: 4 buttons per video (Freehand, Polyline, Oval, Arrow) with visual feedback
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

**Live Preview** (red dashed):

- Drag-based: Freehand/Oval/Arrow render in-progress shape using `getPreviewPoints()` conversion
- Polyline: Completed segments + semi-transparent cursor preview line

### Performance Considerations

- **React State Updates**: Batched automatically by React 18
- **Konva Rendering**: Canvas-based, efficient for <100 shapes
- **State Machine**: Minimal overhead, single object updates
- **Memory**: In-memory only (Phase 0 scope)
- **Konva.Animation**: NOT implemented in Phase 0 spike. Extensive testing showed no flickering or rendering issues during video playback. React Konva's layer maintains its own canvas independently of WebCodecs video canvas. Implementation deferred until testing proves necessary (straightforward to add: create `Konva.Animation` instance, start/stop with play/pause state).

## Testing

### Unit Tests

**AnnotationManager** (`src/utils/tests/AnnotationManager.test.ts`) - **67 tests**:

- Annotation CRUD operations
- Tool selection integration (`setTool`, `getTool`)
- Drawing state machine (all 4 tools)
- Point validation and workflows

**useVideoAnnotations Hook** (`src/hooks/tests/useVideoAnnotations.test.ts`) - **14 tests**:

- Hook initialization and state management
- Tool selection via hook API
- Event handler generation
- Scale calculation
- Keyboard shortcuts (Enter/Escape for polyline)
- Video activation logic

**Total: 81 tests passing** - Business logic and React integration both fully covered.

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

5. **Keyboard Shortcuts**: Context-aware implementation using `activeVideo` state ensures only the active video responds to Enter/Escape keys

## References

- **React Konva**: https://konvajs.org/docs/react/
- **Task 0.5 Plan**: `/workspace/project/phase_0/TASK_0.5_PLAN.md`
- **Requirements**: `/workspace/project/REQUIREMENTS.md` (REQ-F-ANNOT-\*)
