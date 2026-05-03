import { Fragment, memo } from "react";
import type Konva from "konva";
import { Stage, Layer, Line, Arrow, Ellipse, Rect, Text as KonvaText } from "react-konva";
import type { Annotation, DrawingState, Point } from "../types/annotations";
import type { AnnotationHandlers } from "../hooks/useVideoAnnotations";
import type { AnnotationManager } from "../utils/AnnotationManager";

const CONTROL_POINT_SIZE = 12;
const CONTROL_POINT_HIT_SCALE = 1.5;
const CONTROL_POINT_HIT_SIZE = CONTROL_POINT_SIZE * CONTROL_POINT_HIT_SCALE;

const pointsToKonva = (points: Point[]): number[] => {
  return points.flatMap((p) => [p.x, p.y]);
};

const getControlPoints = (annotation: { type: string; points: Point[] }): Point[] => {
  switch (annotation.type) {
    case "freehand":
      if (annotation.points.length >= 2) {
        return [annotation.points[0], annotation.points[annotation.points.length - 1]];
      }
      return annotation.points;
    case "polyline":
    case "arrow":
      return annotation.points;
    case "angle":
      return annotation.points;
    case "oval": {
      const start = annotation.points[0];
      const end = annotation.points[1];
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      return [
        { x: minX, y: minY },
        { x: centerX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: centerY },
        { x: maxX, y: maxY },
        { x: centerX, y: maxY },
        { x: minX, y: maxY },
        { x: minX, y: centerY },
      ];
    }
    default:
      return annotation.points;
  }
};

interface VideoCanvasProps {
  width: number;
  height: number;
  annotations: Annotation[];
  selectedIds: Set<string>;
  drawingState: DrawingState;
  polylineMousePos: Point | null;
  handlers: AnnotationHandlers;
  annotationManager: AnnotationManager;
  layerRef: React.RefObject<Konva.Layer | null>;
  isDraggingAnnotation: boolean;
  isReshapingAnnotation: boolean;
  updateAnnotationText: (id: string, text: string) => void;
}

function ControlPoint({ point, onMouseDown }: { point: Point; onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void }) {
  return (
    <Rect
      x={point.x - CONTROL_POINT_SIZE / 2}
      y={point.y - CONTROL_POINT_SIZE / 2}
      width={CONTROL_POINT_SIZE}
      height={CONTROL_POINT_SIZE}
      fill="white"
      stroke="black"
      strokeWidth={1}
      hitStrokeWidth={CONTROL_POINT_HIT_SIZE}
      cursor="pointer"
      onClick={(e) => { e.cancelBubble = true; }}
      onMouseDown={onMouseDown}
    />
  );
}

const areEqual = (prev: VideoCanvasProps, next: VideoCanvasProps): boolean => {
  if (prev.annotations !== next.annotations) return false;
  if (prev.width !== next.width || prev.height !== next.height) return false;
  if (prev.drawingState.mode !== next.drawingState.mode) return false;
  if (prev.isDraggingAnnotation !== next.isDraggingAnnotation) return false;
  if (prev.isReshapingAnnotation !== next.isReshapingAnnotation) return false;
  if (prev.selectedIds.size !== next.selectedIds.size) return false;
  return true;
};

function VideoCanvasInner({
  width,
  height,
  annotations,
  selectedIds,
  drawingState,
  polylineMousePos,
  handlers,
  annotationManager,
  layerRef,
  isDraggingAnnotation,
  isReshapingAnnotation,
  updateAnnotationText,
}: VideoCanvasProps) {
  const stageOnMouseMove =
    isDraggingAnnotation || isReshapingAnnotation
      ? handlers.handleStageMouseMove
      : handlers.handleMouseMove;
  const stageOnMouseUp =
    isDraggingAnnotation || isReshapingAnnotation
      ? handlers.handleStageMouseUp
      : handlers.handleMouseUp;

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={handlers.handleMouseDown}
      onMouseMove={stageOnMouseMove}
      onMouseUp={stageOnMouseUp}
      onMouseLeave={stageOnMouseUp}
      onClick={handlers.handleClick}
      onDblClick={handlers.handleDoubleClick}
    >
      <Layer ref={layerRef}>
        {annotations.map((annotation) => {
          const isSelected = selectedIds.has(annotation.id);
          const canDrag = isSelected && drawingState.mode === "idle";
          const cursorStyle = canDrag ? "move" : "pointer";

          switch (annotation.type) {
            case "freehand":
            case "polyline":
              return (
                <Fragment key={annotation.id}>
                  <Line
                    points={pointsToKonva(annotation.points)}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                    lineCap="round"
                    lineJoin="round"
                    tension={annotation.type === "freehand" ? 0.5 : 0}
                    hitStrokeWidth={20}
                    cursor={cursorStyle}
                    onClick={(e) => handlers.handleAnnotationClick(annotation.id, e)}
                    onMouseDown={(e) => {
                      if (canDrag) handlers.handleAnnotationDragStart(annotation.id, e);
                    }}
                  />
                  {isSelected &&
                    getControlPoints(annotation).map((point, idx) => (
                      <ControlPoint
                        key={`cp-${annotation.id}-${idx}`}
                        point={point}
                        onMouseDown={(e) => handlers.handleControlPointMouseDown(annotation.id, idx, e)}
                      />
                    ))}
                </Fragment>
              );

            case "oval": {
              const start = annotation.points[0];
              const end = annotation.points[1];
              const centerX = (start.x + end.x) / 2;
              const centerY = (start.y + end.y) / 2;
              const radiusX = Math.abs(end.x - start.x) / 2;
              const radiusY = Math.abs(end.y - start.y) / 2;
              return (
                <Fragment key={annotation.id}>
                  <Ellipse
                    x={centerX}
                    y={centerY}
                    radiusX={radiusX}
                    radiusY={radiusY}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                    cursor={cursorStyle}
                    onClick={(e) => handlers.handleAnnotationClick(annotation.id, e)}
                    onMouseDown={(e) => {
                      if (canDrag) handlers.handleAnnotationDragStart(annotation.id, e);
                    }}
                  />
                  {isSelected &&
                    getControlPoints(annotation).map((point, idx) => (
                      <ControlPoint
                        key={`cp-${annotation.id}-${idx}`}
                        point={point}
                        onMouseDown={(e) => handlers.handleControlPointMouseDown(annotation.id, idx, e)}
                      />
                    ))}
                </Fragment>
              );
            }

            case "arrow":
              return (
                <Fragment key={annotation.id}>
                  <Arrow
                    points={pointsToKonva(annotation.points)}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                    fill={annotation.color}
                    pointerLength={10}
                    pointerWidth={10}
                    hitStrokeWidth={20}
                    cursor={cursorStyle}
                    onClick={(e) => handlers.handleAnnotationClick(annotation.id, e)}
                    onMouseDown={(e) => {
                      if (canDrag) handlers.handleAnnotationDragStart(annotation.id, e);
                    }}
                  />
                  {isSelected &&
                    getControlPoints(annotation).map((point, idx) => (
                      <ControlPoint
                        key={`cp-${annotation.id}-${idx}`}
                        point={point}
                        onMouseDown={(e) => handlers.handleControlPointMouseDown(annotation.id, idx, e)}
                      />
                    ))}
                </Fragment>
              );

            case "text":
              return annotation.points[0] ? (
                <KonvaText
                  key={annotation.id}
                  x={annotation.points[0].x}
                  y={annotation.points[0].y}
                  text={annotation.text ?? ""}
                  fontSize={54}
                  fill={annotation.color}
                  stroke={isSelected ? "#2196F3" : undefined}
                  strokeWidth={isSelected ? 1 : 0}
                  cursor={cursorStyle}
                  onClick={(e) => handlers.handleAnnotationClick(annotation.id, e)}
                  onMouseDown={(e) => {
                    if (canDrag) handlers.handleAnnotationDragStart(annotation.id, e);
                  }}
                  onDblClick={() => {
                    const newText = window.prompt(
                      "Edit annotation text:",
                      annotation.text ?? ""
                    );
                    if (newText !== null && newText.trim()) {
                      updateAnnotationText(annotation.id, newText.trim());
                    }
                  }}
                />
              ) : null;

            case "angle": {
              if (annotation.points.length < 3) return null;
              const [arm1, vx, arm2] = annotation.points;
              const dx1 = arm1.x - vx.x, dy1 = arm1.y - vx.y;
              const dx2 = arm2.x - vx.x, dy2 = arm2.y - vx.y;
              const angleDeg = Math.round(
                Math.abs(
                  Math.atan2(
                    dx1 * dy2 - dy1 * dx2,
                    dx1 * dx2 + dy1 * dy2
                  ) *
                    (180 / Math.PI)
                )
              );
              const lblText = `${angleDeg}°`;
              const lblWidth = lblText.length * 10 + 8;
              return (
                <Fragment key={annotation.id}>
                  <Line
                    key={`${annotation.id}-l1`}
                    points={[arm1.x, arm1.y, vx.x, vx.y]}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                    lineCap="round"
                    hitStrokeWidth={20}
                    cursor={cursorStyle}
                    onClick={(e) => handlers.handleAnnotationClick(annotation.id, e)}
                    onMouseDown={(e) => {
                      if (canDrag) handlers.handleAnnotationDragStart(annotation.id, e);
                    }}
                  />
                  <Line
                    key={`${annotation.id}-l2`}
                    points={[vx.x, vx.y, arm2.x, arm2.y]}
                    stroke={annotation.color}
                    strokeWidth={annotation.strokeWidth}
                    lineCap="round"
                    hitStrokeWidth={20}
                    cursor={cursorStyle}
                    onClick={(e) => handlers.handleAnnotationClick(annotation.id, e)}
                    onMouseDown={(e) => {
                      if (canDrag) handlers.handleAnnotationDragStart(annotation.id, e);
                    }}
                  />
                  <Rect
                    key={`${annotation.id}-lblbg`}
                    x={vx.x + 6}
                    y={vx.y - 26}
                    width={lblWidth}
                    height={22}
                    fill="white"
                    opacity={0.8}
                    listening={false}
                  />
                  <KonvaText
                    key={`${annotation.id}-lbl`}
                    x={vx.x + 8}
                    y={vx.y - 24}
                    text={lblText}
                    fontSize={16}
                    fill="red"
                    fontStyle="bold"
                    listening={false}
                  />
                  {isSelected &&
                    getControlPoints(annotation).map((point, idx) => (
                      <ControlPoint
                        key={`cp-${annotation.id}-${idx}`}
                        point={point}
                        onMouseDown={(e) =>
                          handlers.handleControlPointMouseDown(annotation.id, idx, e)
                        }
                      />
                    ))}
                </Fragment>
              );
            }

            default:
              return null;
          }
        })}

        {drawingState.mode === "drag-drawing" && drawingState.points.length >= 2 && (
          <>
            {drawingState.tool === "freehand" && (
              <Line
                points={annotationManager.getPreviewPoints()!}
                stroke="#FF0000"
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
                tension={0.5}
                listening={false}
              />
            )}
            {drawingState.tool === "oval" && drawingState.points.length === 2 && (
              <Ellipse
                x={(drawingState.points[0].x + drawingState.points[1].x) / 2}
                y={(drawingState.points[0].y + drawingState.points[1].y) / 2}
                radiusX={
                  Math.abs(drawingState.points[1].x - drawingState.points[0].x) / 2
                }
                radiusY={
                  Math.abs(drawingState.points[1].y - drawingState.points[0].y) / 2
                }
                stroke="#FF0000"
                strokeWidth={6}
                listening={false}
              />
            )}
            {drawingState.tool === "arrow" && drawingState.points.length === 2 && (
              <Arrow
                points={annotationManager.getPreviewPoints()!}
                stroke="#FF0000"
                strokeWidth={6}
                fill="#FF0000"
                pointerLength={10}
                pointerWidth={10}
                listening={false}
              />
            )}
          </>
        )}

        {drawingState.mode === "polyline-active" &&
          drawingState.points.length >= 2 && (
            <Line
              points={annotationManager.getPreviewPoints()!}
              stroke="#FF0000"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )}

        {drawingState.mode === "polyline-active" &&
          polylineMousePos &&
          drawingState.points.length >= 1 && (
            <Line
              points={[
                drawingState.points[drawingState.points.length - 1].x,
                drawingState.points[drawingState.points.length - 1].y,
                polylineMousePos.x,
                polylineMousePos.y,
              ]}
              stroke="#FF0000"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              opacity={0.6}
              listening={false}
            />
          )}

        {drawingState.mode === "angle-active" &&
          drawingState.points.length >= 1 && (
            <>
              {drawingState.points.length >= 2 && (
                <Line
                  points={[
                    drawingState.points[0].x,
                    drawingState.points[0].y,
                    drawingState.points[1].x,
                    drawingState.points[1].y,
                  ]}
                  stroke="#FF0000"
                  strokeWidth={6}
                  lineCap="round"
                  listening={false}
                />
              )}
              {polylineMousePos && (
                <Line
                  points={[
                    drawingState.points[drawingState.points.length - 1].x,
                    drawingState.points[drawingState.points.length - 1].y,
                    polylineMousePos.x,
                    polylineMousePos.y,
                  ]}
                  stroke="#FF0000"
                  strokeWidth={6}
                  lineCap="round"
                  opacity={0.6}
                  listening={false}
                />
              )}
            </>
          )}
      </Layer>
    </Stage>
  );
}

export const VideoCanvas = memo(VideoCanvasInner, areEqual);

// Re-exported for unit tests
// Re-exported for unit tests
// eslint-disable-next-line react-refresh/only-export-components
export { pointsToKonva, getControlPoints, CONTROL_POINT_SIZE, CONTROL_POINT_HIT_SIZE };
export type { VideoCanvasProps };
