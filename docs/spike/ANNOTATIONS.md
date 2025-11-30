# Annotations Spike - Design & Implementation

**Status**: Completed (Subtask 0.5.2 - Freehand Drawing)  
**Date**: 2025-11-29  
**Related**: Task 0.5 - Canvas Overlay Spike

## Overview

The annotation system enables users to draw freehand lines (and future: polylines, ovals, arrows) over video frames during golf swing analysis. Annotations are rendered as canvas overlays positioned precisely over the video display using React Konva.

## Architecture

### Modular Design

The implementation follows a clean separation of concerns:

1. **Type Definitions** (`src/types/annotations.ts`)

   - `Annotation` interface: Core data structure
   - `AnnotationType` union: Tool types (freehand, polyline, oval, arrow)
   - `AnnotationStyle`: Color and stroke width configuration
   - `DEFAULT_ANNOTATION_STYLE`: MVP fixed style (red, 3px)

2. **Business Logic** (`src/utils/AnnotationManager.ts`)

   - `AnnotationManager` class: Manages annotation collection
   - CRUD operations: create, add, remove, clear, get by ID
   - Validation: Type-specific point validation (static method)
   - Unique ID generation per annotation

3. **React Integration** (`src/components/DualVideoSyncDemo.tsx`)
   - Mouse event handlers for drawing interaction
   - React state management for UI updates
   - Konva Stage/Layer/Line rendering

### Integration with Video Framework

#### Canvas Overlay Structure

```
Video Canvas Container (position: relative)
  └─ Video Canvas (WebCodecs rendering)
  └─ Annotation Wrapper (position: absolute, top: 0, left: 0)
      └─ Scaling Wrapper (CSS transform: scale)
          └─ Konva Stage (width: videoMetadata.width, height: videoMetadata.height)
              └─ Konva Layer
                  └─ Line components (completed annotations)
                  └─ Line component (live preview, dashed)
```

**Key Design Decision**: The Konva Stage dimensions match the video's intrinsic dimensions (e.g., 1280×720), then CSS scaling transforms the entire Stage to match the displayed video size. This keeps annotation coordinates in video pixel space, simplifying coordinate management.

#### Coordinate System

- **Stage Coordinates**: Match video metadata dimensions (e.g., 1280×720)
- **Display Scaling**: Calculated as `displayWidth / videoWidth`
- **CSS Transform**: Applied to wrapper div outside the Stage
- **Mouse Events**: Konva's `getPointerPosition()` automatically handles coordinate transformation

This approach ensures annotations are resolution-independent and maintain correct alignment during:

- Window resize
- Browser zoom
- Different display sizes

#### Video Lifecycle Integration

Annotations persist independently of video state:

- **Static annotations**: Drawn once, visible on all frames
- **Independent of playback**: Remain visible during play/pause/seek
- **Per-video management**: Each video channel has its own AnnotationManager instance

### State Management

#### Component State (DualVideoSyncDemo.tsx)

```typescript
const [annotationManager] = useState(() => new AnnotationManager());
const [selectedTool, setSelectedTool] = useState<AnnotationType>("freehand");
const [isDrawing, setIsDrawing] = useState(false);
const [currentPoints, setCurrentPoints] = useState<number[]>([]);
const [annotations, setAnnotations] = useState<Annotation[]>([]);
```

- `annotationManager`: Persistent instance managing annotation data
- `selectedTool`: Active drawing tool (future: UI selector)
- `isDrawing`: Tracks active drawing session
- `currentPoints`: Accumulates coordinates during drag
- `annotations`: React state copy for re-rendering (synced from manager)

#### Drawing Flow

1. **Mouse Down**: Initialize drawing, capture first point
2. **Mouse Move**: Append points to `currentPoints` array
3. **Mouse Up**: Validate and finalize annotation
   - Manager validates point array for tool type
   - If valid, annotation added to manager and React state updated
   - If invalid, warning logged, no annotation created

### Rendering

#### Konva Line Component

Completed annotations render as:

```typescript
<Line
  points={annotation.points} // [x1, y1, x2, y2, ...]
  stroke={annotation.color} // #FF0000 (red)
  strokeWidth={annotation.strokeWidth} // 3px
  lineCap="round"
  lineJoin="round"
  tension={0.5} // Smooth curves for freehand
/>
```

Live preview (during drawing) renders with `dash={[10, 5]}` for visual distinction.

## Implementation Details

### Point Validation

Type-specific validation ensures data integrity:

| Tool Type | Validation Rule                                          |
| --------- | -------------------------------------------------------- |
| Freehand  | ≥2 points (≥4 coordinates), even-length array            |
| Polyline  | ≥2 points (≥4 coordinates), even-length array            |
| Oval      | Exactly 2 points (4 coordinates): top-left, bottom-right |
| Arrow     | Exactly 2 points (4 coordinates): start, end             |

Validation occurs before adding annotations to prevent invalid data in the system.

### Performance Considerations

- **React State Updates**: Batched automatically by React 18
- **Konva Rendering**: Efficient canvas-based drawing
- **Point Accumulation**: Direct array spreading (acceptable for freehand strokes <100 points)
- **Memory**: Annotations stored in-memory only (Phase 0 scope)

Future optimizations if needed:

- Use `useRef` for live preview to avoid React re-renders during drag
- Throttle mousemove events for very long strokes
- Implement annotation persistence/export (Phase 1+)

## Testing

### Unit Tests

**Location**: `src/utils/tests/AnnotationManager.test.ts`

Coverage:

- Annotation creation with default/custom styles
- Unique ID generation
- CRUD operations (add, get, remove, clear)
- Point validation for all tool types
- Edge cases (empty arrays, odd-length, floating point)
- Integration workflow scenario

## Future Work

### Architectural Extensions (Post-Phase 0)

1. **Annotation Management UI** (Phase 1+)

   - Delete individual annotations
   - Toggle visibility (show/hide all)
   - Annotation count display
   - Selection/highlighting

2. **Style Customization** (Phase 4)

   - Color picker
   - Stroke width selector
   - Custom styles per annotation

3. **Persistence** (Phase 1+)

   - Save/load annotations with video metadata
   - Export annotations as JSON
   - Import annotations from file

4. **Advanced Features** (Future)
   - Time-based annotations (appear on specific frame ranges)
   - Annotation labels/text
   - Annotation grouping
   - Undo/redo support

## Requirements Satisfied

- **REQ-F-ANNOT-001**: Drawing Tools (freehand implemented)
- **REQ-F-ANNOT-002**: Annotation Rendering (overlay, alignment, visible during playback)
- **REQ-F-ANNOT-004**: Fixed style in MVP (red, 3px, no customization UI)

## Key Learnings

1. **Coordinate System Design**: Using video intrinsic dimensions for Stage + CSS scaling for display is simpler than maintaining dual coordinate systems

2. **Modular Architecture**: Separating `AnnotationManager` from React components enables:

   - Pure unit testing of business logic
   - Reusability across Video A/B channels
   - Future export/import features

3. **Validation Early**: Point validation before adding annotations prevents invalid data propagation

4. **State Management Pattern**: Using both `AnnotationManager` (source of truth) and React state (UI synchronization) provides clean separation

5. **Konva Integration**: React Konva handles canvas rendering complexity, allowing focus on application logic

## References

- **React Konva Documentation**: https://konvajs.org/docs/react/
- **Task 0.5 Plan**: `/workspace/project/phase_0/TASK_0.5_PLAN.md`
- **Requirements**: `/workspace/project/REQUIREMENTS.md` (REQ-F-ANNOT-\*)
