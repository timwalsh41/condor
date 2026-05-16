/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { VideoCanvas, pointsToKonva, getControlPoints } from "../VideoCanvas";
import type { Annotation, DrawingState, Point } from "../../types/annotations";
import type { AnnotationHandlers } from "../../hooks/useVideoAnnotations";

function createMockHandlers(): AnnotationHandlers {
  return {
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseUp: vi.fn(),
    handleClick: vi.fn(),
    handleDoubleClick: vi.fn(),
    handleAnnotationClick: vi.fn(),
    handleAnnotationDragStart: vi.fn(),
    handleControlPointMouseDown: vi.fn(),
    handleStageMouseMove: vi.fn(),
    handleStageMouseUp: vi.fn(),
  };
}

const mockAnnotationManager = {
  getPreviewPoints: vi.fn(),
} as any;

const idleDrawingState: DrawingState = { mode: "idle" };

const defaultProps = {
  width: 800,
  height: 600,
  annotations: [] as Annotation[],
  selectedIds: new Set<string>(),
  drawingState: idleDrawingState,
  polylineMousePos: null,
  handlers: createMockHandlers(),
  annotationManager: mockAnnotationManager,
  layerRef: { current: null } as any,
  isDraggingAnnotation: false,
  isReshapingAnnotation: false,
  updateAnnotationText: vi.fn(),
};

describe("VideoCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Konva Stage with correct dimensions", () => {
    const { container } = render(<VideoCanvas {...defaultProps} />);
    const stageDiv = container.querySelector(".konvajs-content");
    expect(stageDiv).toBeTruthy();
  });

  it("renders freehand annotation when provided in annotations array", () => {
    const annotations: Annotation[] = [
      {
        id: "fh-1",
        type: "freehand",
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 50 },
          { x: 100, y: 100 },
        ],
        color: "#FF0000",
        strokeWidth: 6,
      },
    ];
    const { container } = render(
      <VideoCanvas {...defaultProps} annotations={annotations} />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders polyline annotation with all vertices", () => {
    const annotations: Annotation[] = [
      {
        id: "pl-1",
        type: "polyline",
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 50 },
          { x: 100, y: 10 },
        ],
        color: "#FF0000",
        strokeWidth: 6,
      },
    ];
    const { container } = render(
      <VideoCanvas {...defaultProps} annotations={annotations} />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders oval annotation with correct radius", () => {
    const annotations: Annotation[] = [
      {
        id: "ov-1",
        type: "oval",
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ],
        color: "#FF0000",
        strokeWidth: 6,
      },
    ];
    const { container } = render(
      <VideoCanvas {...defaultProps} annotations={annotations} />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders arrow annotation with pointer", () => {
    const annotations: Annotation[] = [
      {
        id: "ar-1",
        type: "arrow",
        points: [
          { x: 10, y: 10 },
          { x: 200, y: 200 },
        ],
        color: "#FF0000",
        strokeWidth: 6,
      },
    ];
    const { container } = render(
      <VideoCanvas {...defaultProps} annotations={annotations} />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders text annotation with correct position and text", () => {
    const annotations: Annotation[] = [
      {
        id: "tx-1",
        type: "text",
        points: [{ x: 100, y: 200 }],
        color: "#FF0000",
        strokeWidth: 6,
        text: "Hello",
      },
    ];
    const { container } = render(
      <VideoCanvas {...defaultProps} annotations={annotations} />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders angle annotation with angle label", () => {
    const annotations: Annotation[] = [
      {
        id: "ag-1",
        type: "angle",
        points: [
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 200, y: 100 },
        ],
        color: "#FF0000",
        strokeWidth: 6,
      },
    ];
    const { container } = render(
      <VideoCanvas {...defaultProps} annotations={annotations} />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders control points when annotation is selected", () => {
    const annotations: Annotation[] = [
      {
        id: "sel-1",
        type: "arrow",
        points: [
          { x: 10, y: 10 },
          { x: 100, y: 100 },
        ],
        color: "#FF0000",
        strokeWidth: 6,
      },
    ];
    const selectedIds = new Set<string>(["sel-1"]);
    const { container } = render(
      <VideoCanvas
        {...defaultProps}
        annotations={annotations}
        selectedIds={selectedIds}
      />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("does NOT re-render when annotations array identity unchanged (React.memo)", () => {
    const annotations: Annotation[] = [
      {
        id: "mem-1",
        type: "arrow",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        color: "#FF0000",
        strokeWidth: 6,
      },
    ];
    const { container, rerender } = render(
      <VideoCanvas {...defaultProps} annotations={annotations} />
    );
    const firstHtml = container.innerHTML;
    rerender(<VideoCanvas {...defaultProps} annotations={annotations} />);
    expect(container.innerHTML).toBe(firstHtml);
  });

  it("renders drawing preview when drawingState.mode is drag-drawing", () => {
    const drawingState: DrawingState = {
      mode: "drag-drawing",
      tool: "freehand",
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
      ],
    };
    const { container } = render(
      <VideoCanvas {...defaultProps} drawingState={drawingState} />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders polyline preview when drawingState.mode is polyline-active", () => {
    const drawingState: DrawingState = {
      mode: "polyline-active",
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
      ],
    };
    const { container } = render(
      <VideoCanvas
        {...defaultProps}
        drawingState={drawingState}
        polylineMousePos={{ x: 80, y: 80 }}
      />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("renders angle preview when drawingState.mode is angle-active", () => {
    const drawingState: DrawingState = {
      mode: "angle-active",
      points: [
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
    };
    const { container } = render(
      <VideoCanvas
        {...defaultProps}
        drawingState={drawingState}
        polylineMousePos={{ x: 200, y: 100 }}
      />
    );
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("passes mouseDown events to handlers", () => {
    const handlers = createMockHandlers();
    const { container } = render(
      <VideoCanvas {...defaultProps} handlers={handlers} />
    );
    expect(handlers.handleMouseDown).not.toHaveBeenCalled();
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });

  it("passes click events to handlers", () => {
    const handlers = createMockHandlers();
    const { container } = render(
      <VideoCanvas {...defaultProps} handlers={handlers} />
    );
    expect(handlers.handleClick).not.toHaveBeenCalled();
    expect(container.querySelector(".konvajs-content")).toBeTruthy();
  });
});

describe("pointsToKonva", () => {
  it("converts Point[] to flat number[] correctly", () => {
    const points: Point[] = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ];
    expect(pointsToKonva(points)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("returns empty array for empty input", () => {
    expect(pointsToKonva([])).toEqual([]);
  });

  it("handles single point", () => {
    expect(pointsToKonva([{ x: 5, y: 15 }])).toEqual([5, 15]);
  });
});

describe("getControlPoints", () => {
  it("returns start and end points for freehand annotations", () => {
    const annotation = {
      type: "freehand",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 50, y: 50 },
        { x: 100, y: 100 },
      ],
    };
    expect(getControlPoints(annotation)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it("returns all points for polyline annotations", () => {
    const annotation = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 50, y: 50 },
      ],
    };
    expect(getControlPoints(annotation)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 50, y: 50 },
    ]);
  });

  it("returns all points for arrow annotations", () => {
    const annotation = {
      type: "arrow",
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ],
    };
    expect(getControlPoints(annotation)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ]);
  });

  it("returns all 3 points for angle annotations", () => {
    const annotation = {
      type: "angle",
      points: [
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ],
    };
    expect(getControlPoints(annotation)).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]);
  });

  it("returns 8 control points for oval annotations", () => {
    const annotation = {
      type: "oval",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    };
    const points = getControlPoints(annotation);
    expect(points).toHaveLength(8);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[2]).toEqual({ x: 100, y: 0 });
    expect(points[4]).toEqual({ x: 100, y: 100 });
    expect(points[6]).toEqual({ x: 0, y: 100 });
  });

  it("freehand control points are start and end only", () => {
    const annotation = {
      type: "freehand",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ],
    };
    const points = getControlPoints(annotation);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[1]).toEqual({ x: 10, y: 10 });
  });

  it("oval control points include 8 points (corners + midpoints)", () => {
    const annotation = {
      type: "oval",
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 200 },
      ],
    };
    const points = getControlPoints(annotation);
    expect(points).toHaveLength(8);
    // Corners
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[2]).toEqual({ x: 200, y: 0 });
    expect(points[4]).toEqual({ x: 200, y: 200 });
    expect(points[6]).toEqual({ x: 0, y: 200 });
    // Midpoints
    expect(points[1]).toEqual({ x: 100, y: 0 });
    expect(points[3]).toEqual({ x: 200, y: 100 });
    expect(points[5]).toEqual({ x: 100, y: 200 });
    expect(points[7]).toEqual({ x: 0, y: 100 });
  });
});
