import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AnnotationToolbar } from "../AnnotationToolbar";
import type { AnnotationToolbarProps } from "../AnnotationToolbar";
import type { DrawingState } from "../../types/annotations";

const idleState: DrawingState = { mode: "idle" };

function createMockHandlers() {
  return {
    onToolChange: vi.fn(),
    onUndoA: vi.fn(),
    onRedoA: vi.fn(),
    onUndoB: vi.fn(),
    onRedoB: vi.fn(),
    onClearAllA: vi.fn(),
    onClearAllB: vi.fn(),
  };
}

const defaultProps: AnnotationToolbarProps = {
  selectedTool: "select",
  activeVideo: null,
  videoAReady: true,
  videoBReady: true,
  canUndoA: true,
  canRedoA: true,
  canUndoB: true,
  canRedoB: true,
  annotationsALength: 3,
  annotationsBLength: 3,
  drawingStateA: idleState,
  drawingStateB: idleState,
  ...createMockHandlers(),
};

function renderToolbar(props: Partial<AnnotationToolbarProps> = {}) {
  return render(<AnnotationToolbar {...defaultProps} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AnnotationToolbar", () => {
  it("renders all 7 tool buttons", () => {
    const { container } = renderToolbar();
    expect(container.querySelector('[data-testid="tool-select"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="tool-freehand"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="tool-polyline"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="tool-oval"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tool-arrow"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tool-text"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tool-angle"]')).toBeTruthy();
  });

  it("selected tool has blue border and light blue background", () => {
    const { container } = renderToolbar({ selectedTool: "freehand" });
    const selectBtn = container.querySelector(
      '[data-testid="tool-select"]',
    ) as HTMLButtonElement;
    const freehandBtn = container.querySelector(
      '[data-testid="tool-freehand"]',
    ) as HTMLButtonElement;

    // Selected tool (freehand) should have blue border and light blue bg
    expect(freehandBtn.style.border).toBe("2px solid #2196F3");
    expect(freehandBtn.style.backgroundColor).toBe("#E3F2FD");
    expect(freehandBtn.style.fontWeight).toBe("bold");

    // Unselected tool (select) should have gray border and white bg
    expect(selectBtn.style.border).toBe("1px solid #999");
    expect(selectBtn.style.backgroundColor).toBe("white");
    expect(selectBtn.style.fontWeight).toBe("normal");
  });

  it("unselected tools have gray border and white background", () => {
    const { container } = renderToolbar({ selectedTool: "oval" });
    const selectBtn = container.querySelector(
      '[data-testid="tool-select"]',
    ) as HTMLButtonElement;
    const freehandBtn = container.querySelector(
      '[data-testid="tool-freehand"]',
    ) as HTMLButtonElement;

    // Both unselected
    expect(selectBtn.style.border).toBe("1px solid #999");
    expect(selectBtn.style.backgroundColor).toBe("white");

    expect(freehandBtn.style.border).toBe("1px solid #999");
    expect(freehandBtn.style.backgroundColor).toBe("white");
  });

  it("clicking a tool calls onToolChange callback", () => {
    const onToolChange = vi.fn();
    const { container } = renderToolbar({ onToolChange });

    fireEvent.click(
      container.querySelector('[data-testid="tool-freehand"]')!,
    );
    expect(onToolChange).toHaveBeenCalledWith("freehand");

    fireEvent.click(container.querySelector('[data-testid="tool-oval"]')!);
    expect(onToolChange).toHaveBeenCalledWith("oval");
  });

  it("undo/redo buttons shown when activeVideo matches a ready video", () => {
    const { container, rerender } = render(
      <AnnotationToolbar
        {...defaultProps}
        activeVideo="A"
        videoAReady={true}
        videoBReady={true}
      />,
    );
    expect(container.querySelector('[data-testid="undo-a"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="redo-a"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="undo-b"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="redo-b"]')).toBeFalsy();

    rerender(
      <AnnotationToolbar
        {...defaultProps}
        activeVideo="B"
        videoAReady={true}
        videoBReady={true}
      />,
    );
    expect(container.querySelector('[data-testid="undo-b"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="redo-b"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="undo-a"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="redo-a"]')).toBeFalsy();
  });

  it("undo button is disabled when canUndo is false", () => {
    const { container } = renderToolbar({
      activeVideo: "A",
      canUndoA: false,
      canRedoA: true,
    });
    const undoBtn = container.querySelector(
      '[data-testid="undo-a"]',
    ) as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
  });

  it("redo button is disabled when canRedo is false", () => {
    const { container } = renderToolbar({
      activeVideo: "A",
      canUndoA: true,
      canRedoA: false,
    });
    const redoBtn = container.querySelector(
      '[data-testid="redo-a"]',
    ) as HTMLButtonElement;
    expect(redoBtn.disabled).toBe(true);
  });

  it("clear-all buttons shown when video is ready", () => {
    const { container, rerender } = render(
      <AnnotationToolbar
        {...defaultProps}
        videoAReady={true}
        videoBReady={false}
      />,
    );
    expect(
      container.querySelector('[data-testid="clear-all-a"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="clear-all-b"]'),
    ).toBeFalsy();

    rerender(
      <AnnotationToolbar
        {...defaultProps}
        videoAReady={false}
        videoBReady={true}
      />,
    );
    expect(
      container.querySelector('[data-testid="clear-all-a"]'),
    ).toBeFalsy();
    expect(
      container.querySelector('[data-testid="clear-all-b"]'),
    ).toBeTruthy();
  });

  it("clear-all button is disabled when no annotations", () => {
    const { container } = renderToolbar({
      annotationsALength: 0,
      annotationsBLength: 0,
    });
    const clearA = container.querySelector(
      '[data-testid="clear-all-a"]',
    ) as HTMLButtonElement;
    const clearB = container.querySelector(
      '[data-testid="clear-all-b"]',
    ) as HTMLButtonElement;
    expect(clearA.disabled).toBe(true);
    expect(clearB.disabled).toBe(true);
  });

  it("clear-all button is enabled when annotations exist", () => {
    const { container } = renderToolbar({
      annotationsALength: 5,
      annotationsBLength: 2,
    });
    const clearA = container.querySelector(
      '[data-testid="clear-all-a"]',
    ) as HTMLButtonElement;
    const clearB = container.querySelector(
      '[data-testid="clear-all-b"]',
    ) as HTMLButtonElement;
    expect(clearA.disabled).toBe(false);
    expect(clearB.disabled).toBe(false);
  });

  it("helper text shows polyline hint when polyline tool active and drawing", () => {
    const polylineActive: DrawingState = {
      mode: "polyline-active",
      points: [{ x: 10, y: 20 }],
    };
    const { container } = renderToolbar({
      selectedTool: "polyline",
      drawingStateA: polylineActive,
      drawingStateB: idleState,
    });
    expect(container.textContent).toContain(
      "Click to add vertices. Press Enter to finish or Escape to cancel.",
    );
  });

  it("helper text shows angle hint when angle tool active and drawing", () => {
    const angleActive: DrawingState = {
      mode: "angle-active",
      points: [{ x: 10, y: 20 }],
    };
    const { container } = renderToolbar({
      selectedTool: "angle",
      drawingStateA: angleActive,
      drawingStateB: idleState,
    });
    expect(container.textContent).toContain(
      "Click arm1 end, then vertex, then arm2 end to measure angle. Escape to cancel.",
    );
  });

  it("helper text shows text hint when text tool selected", () => {
    const { container } = renderToolbar({ selectedTool: "text" });
    expect(container.textContent).toContain(
      "Click on the video to place a text label.",
    );
  });

  it("helper text is empty (non-breaking space) when no tool hint applies", () => {
    const { container } = renderToolbar({ selectedTool: "select" });
    // Non-breaking space is \u00A0
    const helperDiv = container.querySelector(
      'div[style*="font-style: italic"]',
    );
    expect(helperDiv?.textContent).toBe("\u00A0");
  });

  it("undo/redo buttons call correct callbacks", () => {
    const onUndoA = vi.fn();
    const onRedoA = vi.fn();
    const { container } = renderToolbar({
      activeVideo: "A",
      onUndoA,
      onRedoA,
    });

    fireEvent.click(container.querySelector('[data-testid="undo-a"]')!);
    expect(onUndoA).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('[data-testid="redo-a"]')!);
    expect(onRedoA).toHaveBeenCalledTimes(1);
  });

  it("clear-all buttons call correct callbacks", () => {
    const onClearAllA = vi.fn();
    const onClearAllB = vi.fn();
    const { container } = renderToolbar({
      annotationsALength: 1,
      annotationsBLength: 1,
      onClearAllA,
      onClearAllB,
    });

    fireEvent.click(
      container.querySelector('[data-testid="clear-all-a"]')!,
    );
    expect(onClearAllA).toHaveBeenCalledTimes(1);

    fireEvent.click(
      container.querySelector('[data-testid="clear-all-b"]')!,
    );
    expect(onClearAllB).toHaveBeenCalledTimes(1);
  });

  it("undo/redo buttons not shown when activeVideo is null", () => {
    const { container } = renderToolbar({ activeVideo: null });
    expect(container.querySelector('[data-testid="undo-a"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="redo-a"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="undo-b"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="redo-b"]')).toBeFalsy();
  });
});
