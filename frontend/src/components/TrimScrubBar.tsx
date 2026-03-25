import { useRef } from "react";

/**
 * TrimScrubBar — unified playhead scrubber + trim handles for PLAYBACK mode.
 *
 * Renders a single div-based track with three interactive targets:
 * - Playhead (blue vertical bar; also backed by a hidden <input> for Playwright)
 * - In handle (orange bracket, left of active zone)
 * - Out handle (orange bracket, right of active zone)
 *
 * Hit-testing priority: playhead is checked first so it wins over trim handles
 * whenever both are close to the pointer position.  A click anywhere on the
 * track that misses both handles also resolves to a playhead seek.
 *
 * Validates: REQ-F-TRIM-001, REQ-F-TRIM-002
 */

/** Half-width grab zone in pixels for each draggable target. */
const GRAB_ZONE = 10;
/** Visual width of each trim handle in pixels. */
const HANDLE_WIDTH = 14;

type DragTarget = "playhead" | "in" | "out" | null;

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
  const activeDragRef = useRef<DragTarget>(null);

  // Convert a frame number to a CSS percentage left offset.
  const toPercent = (frame: number): string => {
    if (max === min) return "0%";
    return `${((frame - min) / (max - min)) * 100}%`;
  };

  // Convert a client X coordinate to a frame number clamped to [min, max].
  // Accounts for the 10px horizontal padding on the track container.
  const clientXToFrame = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 20) return min;
    const innerWidth = rect.width - 20; // Subtract 10px padding on each side
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left - 10) / innerWidth));
    return Math.round(min + ratio * (max - min));
  };

  // Pixel position of a frame on the track (relative to viewport).
  // Accounts for the 10px horizontal padding on the track container.
  const frameToClientX = (frame: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || max === min) return 0;
    const innerWidth = rect.width - 20; // Subtract 10px padding on each side
    return rect.left + 10 + ((frame - min) / (max - min)) * innerWidth;
  };

  // --- Unified track pointer handlers (playhead has priority) ---

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    const distPlayhead = Math.abs(e.clientX - frameToClientX(playhead));
    const distIn = Math.abs(e.clientX - frameToClientX(trimStart));
    const distOut = Math.abs(e.clientX - frameToClientX(trimEnd));

    // Playhead wins if within grab zone OR if no handle is closer.
    if (distPlayhead <= GRAB_ZONE) {
      activeDragRef.current = "playhead";
    } else if (distIn <= GRAB_ZONE && distIn <= distOut) {
      activeDragRef.current = "in";
    } else if (distOut <= GRAB_ZONE) {
      activeDragRef.current = "out";
    } else {
      // General track click → seek playhead to clicked position
      activeDragRef.current = "playhead";
      onPlayheadDrag(clientXToFrame(e.clientX));
    }

    trackRef.current?.setPointerCapture(e.pointerId);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeDragRef.current) return;
    const frame = clientXToFrame(e.clientX);
    switch (activeDragRef.current) {
      case "playhead":
        onPlayheadDrag(frame);
        break;
      case "in":
        onTrimStartChange(Math.min(frame, trimEnd - 1));
        break;
      case "out":
        onTrimEndChange(Math.max(frame, trimStart + 1));
        break;
    }
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeDragRef.current === "playhead") {
      onPlayheadRelease(clientXToFrame(e.clientX));
    }
    activeDragRef.current = null;
    trackRef.current?.releasePointerCapture(e.pointerId);
  };

  // --- Set In / Set Out from current playhead ---

  const handleSetIn = () => {
    if (playhead < trimEnd) onTrimStartChange(playhead);
  };

  const handleSetOut = () => {
    if (playhead > trimStart) onTrimEndChange(playhead);
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
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        style={{
          position: "relative",
          height: "30px",
          marginBottom: "6px",
          cursor: "pointer",
          touchAction: "none",
          overflow: "hidden",
          padding: "0 10px",
        }}
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
         * Hidden native range input — carries data-testid="scrub-bar-both" for
         * Playwright test compatibility (fill + dispatchEvent). Pointer events
         * are disabled so all interaction flows through the track container.
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
            margin: 0,
            pointerEvents: "none",
          }}
        />

        {/* In handle — decorative; pointer events handled by track container */}
        <div
          data-testid="trim-in-handle"
          aria-hidden="true"
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
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Out handle — decorative; pointer events handled by track container */}
        <div
          data-testid="trim-out-handle"
          aria-hidden="true"
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
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Playhead marker — rendered above handles so it is always visible */}
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
            zIndex: 1,
          }}
        />
      </div>

      {/* Frame label */}
      <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
        {frameLabel}
      </div>

      {/* Controls row */}
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
            data-testid="set-in"
            onClick={handleSetIn}
            disabled={playhead >= trimEnd}
            title="Set In point to current frame"
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              cursor: playhead >= trimEnd ? "default" : "pointer",
              backgroundColor: "#fff",
              border: "1px solid #FF9800",
              color: "#E65100",
              borderRadius: "3px",
              opacity: playhead >= trimEnd ? 0.4 : 1,
            }}
          >
            [ In
          </button>
          <button
            data-testid="set-out"
            onClick={handleSetOut}
            disabled={playhead <= trimStart}
            title="Set Out point to current frame"
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              cursor: playhead <= trimStart ? "default" : "pointer",
              backgroundColor: "#fff",
              border: "1px solid #FF9800",
              color: "#E65100",
              borderRadius: "3px",
              opacity: playhead <= trimStart ? 0.4 : 1,
            }}
          >
            Out ]
          </button>
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
