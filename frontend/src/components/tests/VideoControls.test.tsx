import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { VideoControls } from "../VideoControls";
import type { VideoControlsProps } from "../VideoControls";

function createMockHandlers() {
  return {
    onPlayPause: vi.fn(),
    onStepForward: vi.fn(),
    onStepBackward: vi.fn(),
    onSliderChange: vi.fn(),
    onSliderRelease: vi.fn(),
    onSpeedChange: vi.fn(),
  };
}

const defaultProps: VideoControlsProps = {
  totalFrames: 100,
  currentFrame: 50,
  isPlaying: false,
  playbackRate: 1,
  sliderValue: 50,
  videoSlot: "a",
  ...createMockHandlers(),
};

function renderVideoControls(props: Partial<VideoControlsProps> = {}) {
  return render(<VideoControls {...defaultProps} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VideoControls", () => {
  it("renders scrub bar with correct min/max values", () => {
    const { container } = renderVideoControls();
    const scrubBar = container.querySelector('[data-testid="scrub-bar-a"]');
    expect(scrubBar).toBeTruthy();
    expect(scrubBar?.getAttribute("type")).toBe("range");
    expect(scrubBar?.getAttribute("min")).toBe("0");
    expect(scrubBar?.getAttribute("max")).toBe("99");
  });

  it('renders play button with "▶ Play" when not playing', () => {
    const { container } = renderVideoControls({ isPlaying: false });
    const playButton = container.querySelector('[data-testid="play-pause-a"]');
    expect(playButton?.textContent).toContain("▶");
    expect(playButton?.textContent).toContain("Play");
    expect(playButton?.textContent).not.toContain("⏸");
  });

  it('renders play button with "⏸ Pause" when playing', () => {
    const { container } = renderVideoControls({ isPlaying: true });
    const playButton = container.querySelector('[data-testid="play-pause-a"]');
    expect(playButton?.textContent).toContain("⏸");
    expect(playButton?.textContent).toContain("Pause");
    expect(playButton?.textContent).not.toContain("▶");
  });

  it("step-backward-fine button is disabled at frame 0", () => {
    const { container } = renderVideoControls({ currentFrame: 0 });
    expect(
      (container.querySelector('[data-testid="step-backward-fine-a"]') as HTMLButtonElement)?.disabled
    ).toBe(true);
  });

  it("step-forward-fine button is disabled at max frame", () => {
    const { container } = renderVideoControls({ currentFrame: 99 });
    expect(
      (container.querySelector('[data-testid="step-forward-fine-a"]') as HTMLButtonElement)?.disabled
    ).toBe(true);
  });

  it("step-backward-coarse button is disabled at frame 0", () => {
    const { container } = renderVideoControls({ currentFrame: 0 });
    expect(
      (container.querySelector('[data-testid="step-backward-coarse-a"]') as HTMLButtonElement)?.disabled
    ).toBe(true);
  });

  it("step-forward-coarse button is disabled at max frame", () => {
    const { container } = renderVideoControls({ currentFrame: 99 });
    expect(
      (container.querySelector('[data-testid="step-forward-coarse-a"]') as HTMLButtonElement)?.disabled
    ).toBe(true);
  });

  it("speed selector shows all 5 speed options", () => {
    const { container } = renderVideoControls();
    const speedSelect = container.querySelector('[data-testid="speed-select-a"]');
    const options = Array.from(speedSelect?.querySelectorAll("option") ?? []);
    expect(options).toHaveLength(5);
    expect(options[0].getAttribute("value")).toBe("0.1");
    expect(options[1].getAttribute("value")).toBe("0.25");
    expect(options[2].getAttribute("value")).toBe("0.5");
    expect(options[3].getAttribute("value")).toBe("1");
    expect(options[4].getAttribute("value")).toBe("2");
  });

  it("clicking play calls onPlayPause callback", () => {
    const onPlayPause = vi.fn();
    const { container } = renderVideoControls({ onPlayPause });
    fireEvent.click(container.querySelector('[data-testid="play-pause-a"]')!);
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("changing scrub bar calls onSliderChange and onSliderRelease", () => {
    const onSliderChange = vi.fn();
    const onSliderRelease = vi.fn();
    const { container } = renderVideoControls({ onSliderChange, onSliderRelease });
    const scrubBar = container.querySelector('[data-testid="scrub-bar-a"]')!;
    fireEvent.change(scrubBar, { target: { value: "75" } });
    expect(onSliderChange).toHaveBeenCalled();
    fireEvent.mouseUp(scrubBar);
    expect(onSliderRelease).toHaveBeenCalled();
  });

  it("calling onSliderRelease on touchEnd", () => {
    const onSliderRelease = vi.fn();
    const { container } = renderVideoControls({ onSliderRelease });
    fireEvent.touchEnd(container.querySelector('[data-testid="scrub-bar-a"]')!);
    expect(onSliderRelease).toHaveBeenCalled();
  });

  it("clicking step buttons calls appropriate step callback", () => {
    const onStepForward = vi.fn();
    const onStepBackward = vi.fn();
    const { container } = renderVideoControls({ onStepForward, onStepBackward });

    fireEvent.click(container.querySelector('[data-testid="step-forward-fine-a"]')!);
    expect(onStepForward).toHaveBeenCalledWith(false);

    fireEvent.click(container.querySelector('[data-testid="step-forward-coarse-a"]')!);
    expect(onStepForward).toHaveBeenCalledWith(true);

    fireEvent.click(container.querySelector('[data-testid="step-backward-fine-a"]')!);
    expect(onStepBackward).toHaveBeenCalledWith(false);

    fireEvent.click(container.querySelector('[data-testid="step-backward-coarse-a"]')!);
    expect(onStepBackward).toHaveBeenCalledWith(true);
  });

  it("changing speed calls onSpeedChange callback", () => {
    const onSpeedChange = vi.fn();
    const { container } = renderVideoControls({ onSpeedChange });
    const speedSelect = container.querySelector('[data-testid="speed-select-a"]')!;
    fireEvent.change(speedSelect, { target: { value: "0.5" } });
    expect(onSpeedChange).toHaveBeenCalledWith(0.5);
  });

  it("uses correct videoSlot for data-testid attributes", () => {
    const { container } = renderVideoControls({ videoSlot: "b" });
    expect(container.querySelector('[data-testid="video-b-controls"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="scrub-bar-b"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="play-pause-b"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="speed-select-b"]')).toBeTruthy();
  });
});
