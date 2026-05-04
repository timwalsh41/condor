import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PlaybackControls } from "../PlaybackControls";
import type { PlaybackControlsProps } from "../PlaybackControls";

function createMockHandlers() {
  return {
    onPlayPause: vi.fn(),
    onStepForward: vi.fn(),
    onStepBackward: vi.fn(),
    onSliderChange: vi.fn(),
    onSliderRelease: vi.fn(),
    onTrimStartChange: vi.fn(),
    onTrimEndChange: vi.fn(),
    onReturnToIn: vi.fn(),
    onLoopToggle: vi.fn(),
    onResetTrim: vi.fn(),
    onSpeedChange: vi.fn(),
  };
}

const mockPlayheadState = {
  position: 50,
  syncOffset: 5,
  maxPosition: 194,
};

const defaultProps: PlaybackControlsProps = {
  playheadState: mockPlayheadState,
  trimStart: 10,
  trimEnd: 180,
  isPlaying: false,
  isLooping: false,
  playbackRate: 1.0,
  syncOffset: 5,
  totalFramesA: 200,
  totalFramesB: 200,
  sliderValue: 50,
  ...createMockHandlers(),
};

function renderPlaybackControls(props: Partial<PlaybackControlsProps> = {}) {
  return render(<PlaybackControls {...defaultProps} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PlaybackControls", () => {
  it("renders TrimScrubBar with computed range from sync offset", () => {
    const { container } = renderPlaybackControls();
    const scrubBar = container.querySelector('[data-testid="scrub-bar-both"]');
    expect(scrubBar).toBeTruthy();
    expect(scrubBar?.getAttribute("min")).toBe("0");
    expect(scrubBar?.getAttribute("max")).toBe("194");
    expect(
      container.querySelector('[data-testid="trim-in-handle"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="trim-out-handle"]')
    ).toBeTruthy();
  });

  it("renders play button with correct label based on isPlaying", () => {
    const { container, rerender } = renderPlaybackControls({ isPlaying: false });
    const btn = container.querySelector(
      '[data-testid="play-pause-both"]'
    ) as HTMLButtonElement;
    expect(btn?.textContent).toContain("▶");
    expect(btn?.textContent).toContain("Play");

    rerender(
      <PlaybackControls {...defaultProps} isPlaying={true} />
    );
    const btn2 = container.querySelector(
      '[data-testid="play-pause-both"]'
    ) as HTMLButtonElement;
    expect(btn2?.textContent).toContain("⏸");
    expect(btn2?.textContent).toContain("Pause");
  });

  it("renders 4 step buttons in grid layout", () => {
    const { container } = renderPlaybackControls();
    expect(
      container.querySelector('[data-testid="step-backward-coarse-both"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="step-backward-fine-both"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="step-forward-fine-both"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="step-forward-coarse-both"]')
    ).toBeTruthy();
  });

  it("speed selector shows all 5 speed options", () => {
    const { container } = renderPlaybackControls();
    const speedSelect = container.querySelector(
      '[data-testid="speed-select-both"]'
    );
    const options = Array.from(speedSelect?.querySelectorAll("option") ?? []);
    expect(options).toHaveLength(5);
    expect(options[0].getAttribute("value")).toBe("0.1");
    expect(options[1].getAttribute("value")).toBe("0.25");
    expect(options[2].getAttribute("value")).toBe("0.5");
    expect(options[3].getAttribute("value")).toBe("1");
    expect(options[4].getAttribute("value")).toBe("2");
  });

  it("displays sync offset with correct sign and description", () => {
    const { container, rerender } = renderPlaybackControls({ syncOffset: 5 });
    const display = container.querySelector(
      '[data-testid="sync-offset-display"]'
    );
    expect(display?.textContent).toContain("Sync offset:");
    expect(display?.textContent).toContain("+5");
    expect(display?.textContent).toContain("ahead of");

    rerender(
      <PlaybackControls
        {...defaultProps}
        syncOffset={-3}
        playheadState={{ ...mockPlayheadState, syncOffset: -3 }}
      />
    );
    const display2 = container.querySelector(
      '[data-testid="sync-offset-display"]'
    );
    expect(display2?.textContent).toContain("-3");
    expect(display2?.textContent).toContain("behind");

    rerender(
      <PlaybackControls
        {...defaultProps}
        syncOffset={0}
        playheadState={{ ...mockPlayheadState, syncOffset: 0 }}
      />
    );
    const display3 = container.querySelector(
      '[data-testid="sync-offset-display"]'
    );
    expect(display3?.textContent).toContain("aligned with");
  });

  it("clicking play calls onPlayPause callback", () => {
    const onPlayPause = vi.fn();
    const { container } = renderPlaybackControls({ onPlayPause });
    fireEvent.click(
      container.querySelector('[data-testid="play-pause-both"]')!
    );
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("clicking trim start handle calls onTrimStartChange", () => {
    const onTrimStartChange = vi.fn();
    const { container } = renderPlaybackControls({ onTrimStartChange });
    const setInBtn = container.querySelector(
      '[data-testid="set-in"]'
    ) as HTMLButtonElement;
    fireEvent.click(setInBtn);
    expect(onTrimStartChange).toHaveBeenCalled();
  });

  it("clicking trim end handle calls onTrimEndChange", () => {
    const onTrimEndChange = vi.fn();
    const { container } = renderPlaybackControls({ onTrimEndChange });
    const setOutBtn = container.querySelector(
      '[data-testid="set-out"]'
    ) as HTMLButtonElement;
    fireEvent.click(setOutBtn);
    expect(onTrimEndChange).toHaveBeenCalled();
  });

  it("clicking return-to-in calls onReturnToIn", () => {
    const onReturnToIn = vi.fn();
    const { container } = renderPlaybackControls({ onReturnToIn });
    fireEvent.click(
      container.querySelector('[data-testid="return-to-in"]')!
    );
    expect(onReturnToIn).toHaveBeenCalledTimes(1);
  });

  it("clicking loop toggle calls onLoopToggle", () => {
    const onLoopToggle = vi.fn();
    const { container } = renderPlaybackControls({ onLoopToggle });
    fireEvent.click(
      container.querySelector('[data-testid="loop-toggle"]')!
    );
    expect(onLoopToggle).toHaveBeenCalledTimes(1);
  });

  it("scrub bar playhead updates when playheadState changes", () => {
    const { container, rerender } = renderPlaybackControls({ sliderValue: 50 });
    const hiddenInput = container.querySelector(
      '[data-testid="scrub-bar-both"]'
    ) as HTMLInputElement;
    expect(hiddenInput?.value).toBe("50");

    rerender(
      <PlaybackControls
        {...defaultProps}
        sliderValue={75}
      />
    );
    const hiddenInput2 = container.querySelector(
      '[data-testid="scrub-bar-both"]'
    ) as HTMLInputElement;
    expect(hiddenInput2?.value).toBe("75");
  });

  it("frame label shows correct Video A and Video B frame numbers", () => {
    const { container } = renderPlaybackControls();
    expect(container.textContent).toContain("Video A");
    expect(container.textContent).toContain("Frame 50");
    expect(container.textContent).toContain("Video B");
    expect(container.textContent).toContain("Frame 55");
  });

  it("step buttons call appropriate step callback", () => {
    const onStepForward = vi.fn();
    const onStepBackward = vi.fn();
    const { container } = renderPlaybackControls({
      onStepForward,
      onStepBackward,
    });

    fireEvent.click(
      container.querySelector('[data-testid="step-forward-fine-both"]')!
    );
    expect(onStepForward).toHaveBeenCalledWith(false);

    fireEvent.click(
      container.querySelector('[data-testid="step-forward-coarse-both"]')!
    );
    expect(onStepForward).toHaveBeenCalledWith(true);

    fireEvent.click(
      container.querySelector('[data-testid="step-backward-fine-both"]')!
    );
    expect(onStepBackward).toHaveBeenCalledWith(false);

    fireEvent.click(
      container.querySelector('[data-testid="step-backward-coarse-both"]')!
    );
    expect(onStepBackward).toHaveBeenCalledWith(true);
  });
});
