export interface VideoControlsProps {
  totalFrames: number;
  currentFrame: number;
  isPlaying: boolean;
  playbackRate: number;
  sliderValue: number;
  videoSlot: "a" | "b";
  onPlayPause: () => void;
  onStepForward: (coarse: boolean) => void;
  onStepBackward: (coarse: boolean) => void;
  onSliderChange: (value: number) => void;
  onSliderRelease: () => void;
  onSpeedChange: (rate: number) => void;
}

export function VideoControls({
  totalFrames,
  currentFrame,
  isPlaying,
  playbackRate,
  sliderValue,
  videoSlot,
  onPlayPause,
  onStepForward,
  onStepBackward,
  onSliderChange,
  onSliderRelease,
  onSpeedChange,
}: VideoControlsProps) {
  const testid = (base: string) => `${base}-${videoSlot}`;

  return (
    <div
      data-testid={`video-${videoSlot}-controls`}
      style={{
        padding: "12px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
      }}
    >
      <input
        data-testid={testid("scrub-bar")}
        type="range"
        min="0"
        max={totalFrames - 1}
        value={sliderValue}
        onChange={(e) => onSliderChange(Number(e.target.value))}
        onMouseUp={onSliderRelease}
        onTouchEnd={onSliderRelease}
        style={{ width: "100%", height: "30px", marginBottom: "8px" }}
      />

      <button
        data-testid={testid("play-pause")}
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
          marginBottom: "8px",
        }}
      >
        {isPlaying ? "\u23F8 Pause" : "\u25B6 Play"}
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <button
          data-testid={testid("step-backward-coarse")}
          onClick={() => onStepBackward(true)}
          disabled={currentFrame === 0}
          style={{
            padding: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: currentFrame === 0 ? "not-allowed" : "pointer",
            backgroundColor: currentFrame === 0 ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          {"\u2190"} Back 5
        </button>
        <button
          data-testid={testid("step-forward-coarse")}
          onClick={() => onStepForward(true)}
          disabled={currentFrame >= totalFrames - 1}
          style={{
            padding: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor:
              currentFrame >= totalFrames - 1 ? "not-allowed" : "pointer",
            backgroundColor:
              currentFrame >= totalFrames - 1 ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Forward 5 {"\u2192"}
        </button>
        <button
          data-testid={testid("step-backward-fine")}
          onClick={() => onStepBackward(false)}
          disabled={currentFrame === 0}
          style={{
            padding: "8px",
            fontSize: "14px",
            cursor: currentFrame === 0 ? "not-allowed" : "pointer",
            backgroundColor: currentFrame === 0 ? "#ccc" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          {"\u2190"} Back 1
        </button>
        <button
          data-testid={testid("step-forward-fine")}
          onClick={() => onStepForward(false)}
          disabled={currentFrame >= totalFrames - 1}
          style={{
            padding: "8px",
            fontSize: "14px",
            cursor:
              currentFrame >= totalFrames - 1 ? "not-allowed" : "pointer",
            backgroundColor:
              currentFrame >= totalFrames - 1 ? "#ccc" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Forward 1 {"\u2192"}
        </button>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontWeight: "bold",
        }}
      >
        Speed:
        <select
          data-testid={testid("speed-select")}
          value={playbackRate}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
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
    </div>
  );
}
