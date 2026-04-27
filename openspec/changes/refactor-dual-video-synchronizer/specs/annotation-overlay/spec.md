## ADDED Requirements

### Requirement: Annotation drawing tools
The system SHALL support 7 annotation types: freehand, polyline, oval, arrow, text, angle, and select. Each tool has specific interaction behavior.

#### Scenario: Freehand drawing
- **WHEN** the user selects the freehand tool and clicks-drag on the canvas
- **THEN** a red freehand line is drawn in real-time (preview)
- **THEN** on mouse-up, the annotation is finalized and persisted
- **THEN** the annotation can be selected and dragged

#### Scenario: Polyline drawing
- **WHEN** the user selects the polyline tool and clicks on the canvas
- **THEN** each click adds a vertex to the polyline
- **THEN** a rubber-band line shows the next segment from the last vertex to the cursor
- **THEN** pressing Enter or double-clicking finalizes the polyline
- **THEN** pressing Escape cancels the drawing
- **THEN** the finalized polyline can be selected, dragged, and its vertices reshaped

#### Scenario: Oval drawing
- **WHEN** the user selects the oval tool and clicks-drag on the canvas
- **THEN** a red oval preview is drawn in real-time
- **THEN** on mouse-up, the oval annotation is finalized
- **THEN** the oval can be selected, dragged, and its control points reshaped

#### Scenario: Arrow drawing
- **WHEN** the user selects the arrow tool and clicks-drag on the canvas
- **THEN** a red arrow preview is drawn in real-time
- **THEN** on mouse-up, the arrow annotation is finalized
- **THEN** the arrow can be selected, dragged, and its endpoints reshaped

#### Scenario: Text annotation
- **WHEN** the user selects the text tool and clicks on the canvas
- **THEN** a text annotation is placed at the click position
- **THEN** double-clicking the text annotation opens a prompt to edit the text
- **THEN** the text annotation can be selected and dragged

#### Scenario: Angle annotation
- **WHEN** the user selects the angle tool and clicks on the canvas
- **THEN** the first click sets the end of arm 1
- **THEN** the second click sets the vertex
- **THEN** the third click sets the end of arm 2
- **THEN** the angle is calculated and displayed at the vertex
- **THEN** pressing Escape cancels the drawing
- **THEN** the angle can be selected, dragged, and its points reshaped

#### Scenario: Select tool
- **WHEN** the user selects the select tool
- **THEN** clicking an annotation selects it (shows control points)
- **THEN** clicking on empty space deselects all annotations
- **THEN** Ctrl+click adds to the selection (multi-select)
- **THEN** dragging a selected annotation moves it

### Requirement: Annotation persistence
Annotations SHALL be stored per video channel and survive session save/load.

#### Scenario: Annotations stored per channel
- **WHEN** the user adds annotations to Video A
- **THEN** Video B's annotations are not affected
- **THEN** each channel's annotations are stored independently

#### Scenario: Annotations restored on session load
- **WHEN** the user loads a session that has annotations
- **THEN** annotations for both channels are restored
- **THEN** annotations render correctly on the first frame after restore (no visual flash)

### Requirement: Annotation manipulation
Annotations SHALL support selection, dragging, reshaping, deletion, undo, and redo.

#### Scenario: Annotation deletion
- **WHEN** one or more annotations are selected
- **THEN** pressing Delete or Backspace removes them
- **THEN** pressing Delete or Backspace while focused on an input field does NOT delete annotations

#### Scenario: Undo/Redo
- **WHEN** the user performs an annotation operation (draw, delete, reshape)
- **THEN** undo (Ctrl+Z) reverses the operation
- **THEN** redo (Ctrl+Y or Ctrl+Shift+Z) re-applies the operation
- **THEN** undo/redo is scoped to the active video channel

#### Scenario: Annotation reshaping
- **WHEN** an annotation is selected and its control points are visible
- **THEN** clicking and dragging a control point reshapes the annotation
- **THEN** the reshaping updates in real-time as the control point moves

### Requirement: Annotation canvas alignment
Annotations SHALL be correctly positioned over the video regardless of video rotation or display scaling.

#### Scenario: Annotations aligned with non-rotated video
- **WHEN** the video has rotation=0 and is displayed at full size
- **THEN** annotations drawn at position (x, y) appear at the correct visual location

#### Scenario: Annotations aligned with rotated video
- **WHEN** the video has rotation=90 or rotation=270
- **THEN** annotations drawn on the canvas appear correctly oriented over the video

#### Scenario: Annotations unaffected by display scaling
- **WHEN** the user adjusts the video display height slider
- **THEN** annotations remain correctly positioned relative to the video content
- **THEN** annotation coordinates are stored at video-internal resolution, not display resolution
