import type { AnnotationType, DrawingState } from "../types/annotations";

export interface AnnotationToolbarProps {
  selectedTool: AnnotationType;
  onToolChange: (tool: AnnotationType) => void;
  activeVideo: "A" | "B" | null;
  videoAReady: boolean;
  videoBReady: boolean;
  canUndoA: boolean;
  canRedoA: boolean;
  canUndoB: boolean;
  canRedoB: boolean;
  onUndoA: () => void;
  onRedoA: () => void;
  onUndoB: () => void;
  onRedoB: () => void;
  annotationsALength: number;
  annotationsBLength: number;
  onClearAllA: () => void;
  onClearAllB: () => void;
  drawingStateA: DrawingState;
  drawingStateB: DrawingState;
}

const TOOLS: { type: AnnotationType; label: string }[] = [
  { type: "select", label: "Select" },
  { type: "freehand", label: "Freehand" },
  { type: "polyline", label: "Polyline" },
  { type: "oval", label: "Oval" },
  { type: "arrow", label: "Arrow" },
  { type: "text", label: "Text" },
  { type: "angle", label: "\u2220 Angle" },
];

function toolButtonStyle(selected: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "4px",
    border: selected ? "2px solid #2196F3" : "1px solid #999",
    backgroundColor: selected ? "#E3F2FD" : "white",
    fontWeight: selected ? "bold" : "normal",
  };
}

function undoRedoButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    fontSize: "14px",
    borderRadius: "4px",
    border: "1px solid #999",
    backgroundColor: disabled ? "#f5f5f5" : "white",
    color: disabled ? "#999" : "#333",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function clearAllButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    fontSize: "14px",
    borderRadius: "4px",
    border: "1px solid #d32f2f",
    backgroundColor: disabled ? "#f5f5f5" : "white",
    color: disabled ? "#999" : "#d32f2f",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export function AnnotationToolbar({
  selectedTool,
  onToolChange,
  activeVideo,
  videoAReady,
  videoBReady,
  canUndoA,
  canRedoA,
  canUndoB,
  canRedoB,
  onUndoA,
  onRedoA,
  onUndoB,
  onRedoB,
  annotationsALength,
  annotationsBLength,
  onClearAllA,
  onClearAllB,
  drawingStateA,
  drawingStateB,
}: AnnotationToolbarProps) {
  const helperText = getHelperText(
    selectedTool,
    drawingStateA,
    drawingStateB,
  );

  return (
    <div
      style={{
        padding: "10px",
        backgroundColor: "#f5f5f5",
        border: "1px solid #ccc",
        borderRadius: "4px",
        marginBottom: "15px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.type}
            data-testid={`tool-${tool.type}`}
            onClick={() => onToolChange(tool.type)}
            style={toolButtonStyle(selectedTool === tool.type)}
          >
            {tool.label}
          </button>
        ))}

        <div
          style={{ marginLeft: "auto", display: "flex", gap: "8px" }}
        >
          {activeVideo === "A" && videoAReady && (
            <>
              <button
                data-testid="undo-a"
                onClick={onUndoA}
                disabled={!canUndoA}
                style={undoRedoButtonStyle(!canUndoA)}
              >
                {"\u21A9"} Undo
              </button>
              <button
                data-testid="redo-a"
                onClick={onRedoA}
                disabled={!canRedoA}
                style={undoRedoButtonStyle(!canRedoA)}
              >
                {"\u21AA"} Redo
              </button>
            </>
          )}
          {activeVideo === "B" && videoBReady && (
            <>
              <button
                data-testid="undo-b"
                onClick={onUndoB}
                disabled={!canUndoB}
                style={undoRedoButtonStyle(!canUndoB)}
              >
                {"\u21A9"} Undo
              </button>
              <button
                data-testid="redo-b"
                onClick={onRedoB}
                disabled={!canRedoB}
                style={undoRedoButtonStyle(!canRedoB)}
              >
                {"\u21AA"} Redo
              </button>
            </>
          )}
          {videoAReady && (
            <button
              data-testid="clear-all-a"
              onClick={onClearAllA}
              disabled={annotationsALength === 0}
              style={clearAllButtonStyle(annotationsALength === 0)}
            >
              Clear All A
            </button>
          )}
          {videoBReady && (
            <button
              data-testid="clear-all-b"
              onClick={onClearAllB}
              disabled={annotationsBLength === 0}
              style={clearAllButtonStyle(annotationsBLength === 0)}
            >
              Clear All B
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          marginTop: "8px",
          minHeight: "18px",
          color: "#666",
          fontStyle: "italic",
        }}
      >
        {helperText}
      </div>
    </div>
  );
}

function getHelperText(
  selectedTool: AnnotationType,
  drawingStateA: DrawingState,
  drawingStateB: DrawingState,
): string {
  if (
    selectedTool === "polyline" &&
    (drawingStateA.mode === "polyline-active" ||
      drawingStateB.mode === "polyline-active")
  ) {
    return "Click to add vertices. Press Enter to finish or Escape to cancel.";
  }
  if (
    selectedTool === "angle" &&
    (drawingStateA.mode === "angle-active" ||
      drawingStateB.mode === "angle-active")
  ) {
    return "Click arm1 end, then vertex, then arm2 end to measure angle. Escape to cancel.";
  }
  if (selectedTool === "text") {
    return "Click on the video to place a text label.";
  }
  return "\u00A0";
}
