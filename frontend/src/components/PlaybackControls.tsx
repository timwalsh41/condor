import { useCallback } from "react";
import { TrimScrubBar } from "./TrimScrubBar";
import type { PlayheadState } from "../utils/dualVideoPlayback";
import { calculatePlayheadRange } from "../utils/dualVideoPlayback";

export interface PlaybackControlsProps {
  playheadState: PlayheadState | null;
  trimStart: number | null;
  trimEnd: number | null;
  isPlaying: boolean;
  isLooping: boolean;
  playbackRate: number;
  syncOffset: number | null;
  totalFramesA: number;
  totalFramesB: number;
  sliderValue: number;
  onPlayPause: () => void;
  onStepForward: (coarse: boolean) => void;
  onStepBackward: (coarse: boolean) => void;
  onSliderChange: (value: number) => void;
  onSliderRelease: (value: number) => void;
  onTrimStartChange: (frame: number) => void;
  onTrimEndChange: (frame: number) => void;
  onReturnToIn: () => void;
  onLoopToggle: () => void;
  onResetTrim: () => void;
  onSpeedChange: (rate: number) => void;
}

export function PlaybackControls({
  playheadState,
  trimStart,
  trimEnd,
  isPlaying,
  isLooping,
  playbackRate,
  syncOffset,
  totalFramesA,
  totalFramesB,
  sliderValue,
  onPlayPause,
  onStepForward,
  onStepBackward,
  onSliderChange,
  onSliderRelease,
  onTrimStartChange,
  onTrimEndChange,
  onReturnToIn,
  onLoopToggle,
  onResetTrim,
  onSpeedChange,
}: PlaybackControlsProps) {
  const range = playheadState
    ? calculatePlayheadRange(totalFramesA, totalFramesB, playheadState.syncOffset)
    : { min: 0, max: 0 };

  const effectiveTrimStart = trimStart ?? range.min;
  const effectiveTrimEnd = trimEnd ?? range.max;

  const frameLabel = playheadState
    ? `Video A: Frame ${sliderValue} / ${range.max}` +
      ` | Video B: Frame ${sliderValue + playheadState.syncOffset}` +
      ` / ${totalFramesB - 1}` +
      (range.min > 0 ? ` (min: ${range.min})` : "")
    : "";

  const handleSpeedChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSpeedChange(Number(e.target.value));
    },
    [onSpeedChange]
  );

  return (
    <div
      data-testid="playback-controls"
      style={{
        padding: "12px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        marginBottom: "15px",
      }}
    >
      {playheadState && (
        <div style={{ marginBottom: "10px" }}>
          <TrimScrubBar
            min={range.min}
            max={range.max}
            trimStart={effectiveTrimStart}
            trimEnd={effectiveTrimEnd}
            playhead={sliderValue}
            isLooping={isLooping}
            frameLabel={frameLabel}
            onPlayheadDrag={onSliderChange}
            onPlayheadRelease={onSliderRelease}
            onTrimStartChange={onTrimStartChange}
            onTrimEndChange={onTrimEndChange}
            onLoopToggle={onLoopToggle}
            onReturnToIn={onReturnToIn}
            onResetTrim={onResetTrim}
          />
        </div>
      )}

      <button
        data-testid="play-pause-both"
        onClick={onPlayPause}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: "pointer",
          backgroundColor: isPlaying ? "#FF5722" : "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          width: "100%",
          marginBottom: "10px",
        }}
      >
        {isPlaying ? "\u23F8 Pause" : "\u25B6 Play"}
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <button
          data-testid="step-backward-coarse-both"
          onClick={() => onStepBackward(true)}
          style={{
            padding: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          {"\u2190"} Back 5 Frames
        </button>
        <button
          data-testid="step-backward-fine-both"
          onClick={() => onStepBackward(false)}
          style={{
            padding: "8px",
            fontSize: "14px",
            cursor: "pointer",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          {"\u2190"} Back 1 Frame
        </button>
        <button
          data-testid="step-forward-fine-both"
          onClick={() => onStepForward(false)}
          style={{
            padding: "8px",
            fontSize: "14px",
            cursor: "pointer",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Forward 1 Frame {"\u2192"}
        </button>
        <button
          data-testid="step-forward-coarse-both"
          onClick={() => onStepForward(true)}
          style={{
            padding: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Forward 5 Frames {"\u2192"}
        </button>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: "bold",
          marginBottom: "10px",
        }}
      >
        Playback Speed:
        <select
          data-testid="speed-select-both"
          value={playbackRate}
          onChange={handleSpeedChange}
          style={{
            padding: "8px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            flex: 1,
          }}
        >
          <option value="0.1">0.1x</option>
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1">1.0x</option>
          <option value="2">2.0x</option>
        </select>
      </label>

      <div
        data-testid="sync-offset-display"
        style={{
          padding: "8px",
          marginTop: "10px",
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          borderRadius: "4px",
          fontFamily: "monospace",
          fontSize: "14px",
        }}
      >
        <strong>Sync offset:</strong>{" "}
        {syncOffset !== null
          ? (syncOffset > 0 ? "+" : "") + syncOffset
          : "N/A"}{" "}
        frames (Video B is {Math.abs(syncOffset || 0)} frame
        {Math.abs(syncOffset || 0) !== 1 ? "s" : ""}{" "}
        {(syncOffset || 0) > 0
          ? "ahead of"
          : (syncOffset || 0) < 0
          ? "behind"
          : "aligned with"}{" "}
        Video A)
      </div>
    </div>
  );
}
