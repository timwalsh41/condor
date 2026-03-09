import { useRef } from "react";

/**
 * TrimScrubBar — unified playhead scrubber + trim handles for PLAYBACK mode.
 *
 * Renders a single div-based track with three interactive targets:
 * - Playhead (hidden native <input type="range"> for seek + test compatibility)
 * - In handle (draggable div, orange bracket on left of active zone)
 * - Out handle (draggable div, orange bracket on right of active zone)
 *
 * CSS regions: muted grey rails outside the trim zone, green highlight inside.
 * Trim handles always take visual precedence over the playhead marker.
 *
 * Hit-testing priority: trim handles intercept pointer events via z-index and
 * pointer capture; the underlying native input handles all other track clicks.
 *
 * Validates: REQ-F-TRIM-001, REQ-F-TRIM-002
 */

const HANDLE_WIDTH = 14; // px, visual width of each trim handle

interface TrimScrubBarProps {
  min: number;
  max: number;
  /** In-point frame number (always set, never null — initialized to min). */
  trimStart: number;
  /** Out-point frame number (always set, never null — initialized to max). */
  trimEnd: number;
  /** Current playhead position (Video A frame units). */
  playhead: number;
  /** Whether loop mode is active. */
  isLooping: boolean;
  /** Human-readable frame position label shown below the track. */
  frameLabel: string;
  /** Called while user drags the playhead (live UI update, no seek). */
  onPlayheadDrag: (frame: number) => void;
  /** Called when user releases the playhead after dragging (triggers seek). */
  onPlayheadRelease: (frame: number) => void;
  /** Called whenever the In handle changes position. */
  onTrimStartChange: (frame: number) => void;
  /** Called whenever the Out handle changes position. */
  onTrimEndChange: (frame: number) => void;
  /** Toggle loop-on-end mode. */
  onLoopToggle: () => void;
  /** Seek playhead back to the In point. */
  onReturnToIn: () => void;
  /** Reset trim handles to full range (min/max). */
  onResetTrim: () => void;
}

export function TrimScrubBar({
  min,
  max,
  trimStart,
  trimEnd,
  playhead,
  isLooping,
  frameLabel,
  onPlayheadDrag,
  onPlayheadRelease,
  onTrimStartChange,
  onTrimEndChange,
  onLoopToggle,
  onReturnToIn,
  onResetTrim,
}: TrimScrubBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<"in" | "out" | null>(null);

  // Convert a frame number to a CSS percentage left offset.
  const toPercent = (frame: number): string => {
    if (max === min) return "0%";
    return `${((frame - min) / (max - min)) * 100}%`;
  };

  // Convert a client X coordinate to a frame number clamped to [min, max].
  const clientXToFrame = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return min;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + ratio * (max - min));
  };

  // --- Trim handle pointer handlers ---

  const handleTrimPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    type: "in" | "out"
  ) => {
    e.preventDefault();
    e.stopPropagation(); // prevent the underlying input from receiving this event
    activeDragRef.current = type;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handleTrimPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    type: "in" | "out"
  ) => {
    if (activeDragRef.current !== type) return;
    const frame = clientXToFrame(e.clientX);
    if (type === "in") {
      // In handle cannot cross Out handle
      onTrimStartChange(Math.min(frame, trimEnd - 1));
    } else {
      // Out handle cannot cross In handle
      onTrimEndChange(Math.max(frame, trimStart + 1));
    }
  };

  const handleTrimPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activeDragRef.current = null;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  };

  // Percentage positions for CSS layout
  const trimStartPct = toPercent(trimStart);
  const trimEndPct = toPercent(trimEnd);
  const playheadPct = toPercent(playhead);

  return (
    <div>
      {/* Track */}
      <div
        ref={trackRef}
        style={{ position: "relative", height: "30px", marginBottom: "6px" }}
      >
        {/* Visual track: grey rails + green active zone */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: "6px",
            transform: "translateY(-50%)",
            borderRadius: "3px",
            display: "flex",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: trimStartPct, backgroundColor: "#bbb", borderRadius: "3px 0 0 3px" }} />
          <div
            style={{
              width: `calc(${trimEndPct} - ${trimStartPct})`,
              minWidth: 0,
              backgroundColor: "#4CAF50",
            }}
          />
          <div style={{ flex: 1, backgroundColor: "#bbb", borderRadius: "0 3px 3px 0" }} />
        </div>

        {/*
         * Hidden native range input — carries data-testid for Playwright
         * compatibility and provides keyboard accessibility.
         * Positioned to cover the full track; trim handles sit above it (z-index 2).
         */}
        <input
          data-testid="scrub-bar-both"
          type="range"
          min={min}
          max={max}
          value={playhead}
          onChange={(e) => onPlayheadDrag(Number(e.target.value))}
          onMouseUp={(e) =>
            onPlayheadRelease(Number((e.target as HTMLInputElement).value))
          }
          onTouchEnd={(e) =>
            onPlayheadRelease(Number((e.target as HTMLInputElement).value))
          }
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
            margin: 0,
            zIndex: 1,
          }}
        />

        {/* In handle */}
        <div
          data-testid="trim-in-handle"
          onPointerDown={(e) => handleTrimPointerDown(e, "in")}
          onPointerMove={(e) => handleTrimPointerMove(e, "in")}
          onPointerUp={handleTrimPointerUp}
          style={{
            position: "absolute",
            top: "50%",
            left: trimStartPct,
            transform: "translate(-50%, -50%)",
            width: `${HANDLE_WIDTH}px`,
            height: "24px",
            backgroundColor: "#FF9800",
            border: "2px solid #E65100",
            borderRadius: "3px",
            cursor: "ew-resize",
            zIndex: 2,
            touchAction: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Out handle */}
        <div
          data-testid="trim-out-handle"
          onPointerDown={(e) => handleTrimPointerDown(e, "out")}
          onPointerMove={(e) => handleTrimPointerMove(e, "out")}
          onPointerUp={handleTrimPointerUp}
          style={{
            position: "absolute",
            top: "50%",
            left: trimEndPct,
            transform: "translate(-50%, -50%)",
            width: `${HANDLE_WIDTH}px`,
            height: "24px",
            backgroundColor: "#FF9800",
            border: "2px solid #E65100",
            borderRadius: "3px",
            cursor: "ew-resize",
            zIndex: 2,
            touchAction: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Playhead marker — decorative vertical bar, above handles visually */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: playheadPct,
            transform: "translate(-50%, -50%)",
            width: "4px",
            height: "30px",
            backgroundColor: "#1565C0",
            borderRadius: "2px",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      </div>

      {/* Frame label */}
      <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
        {frameLabel}
      </div>

      {/* Controls row: In/Out display, Reset, Return to In, Loop toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
        }}
      >
        <span style={{ color: "#555" }}>
          In: {trimStart} &nbsp;|&nbsp; Out: {trimEnd}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            data-testid="trim-reset"
            onClick={onResetTrim}
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer",
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "3px",
            }}
          >
            Reset
          </button>
          <button
            data-testid="return-to-in"
            onClick={onReturnToIn}
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer",
              backgroundColor: "#fff",
              border: "1px solid #4CAF50",
              color: "#2E7D32",
              borderRadius: "3px",
            }}
          >
            ⏮ In
          </button>
          <button
            data-testid="loop-toggle"
            onClick={onLoopToggle}
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer",
              backgroundColor: isLooping ? "#4CAF50" : "#fff",
              border: `1px solid ${isLooping ? "#2E7D32" : "#ccc"}`,
              color: isLooping ? "#fff" : "#333",
              borderRadius: "3px",
            }}
          >
            🔁 Loop
          </button>
        </div>
      </div>
    </div>
  );
}
