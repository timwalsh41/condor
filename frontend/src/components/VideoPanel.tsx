/**
 * VideoPanel component
 *
 * Extracted from DualVideoSynchronizer monolith. Renders a single video panel
 * including the video canvas, annotation overlay (VideoCanvas), frame counter,
 * and per-video controls (VideoControls in SYNC mode).
 *
 * Handles rotation-aware dimension calculation, scaling, and placeholder
 * states ("No video loaded" / "Loading...").
 *
 * @module VideoPanel
 */

import type Konva from "konva";
import { VideoCanvas } from "./VideoCanvas";
import { VideoControls } from "./VideoControls";
import type { VideoControlsHandle } from "../hooks/useVideoControls";
import type { UseWebCodecsDecoderResult } from "../hooks/useWebCodecsDecoder";
import type { Annotation, DrawingState, Point } from "../types/annotations";
import type { AnnotationHandlers } from "../hooks/useVideoAnnotations";
import type { AnnotationManager } from "../utils/AnnotationManager";

export interface VideoPanelProps {
  /** Video slot identifier ("a" or "b") */
  videoSlot: "a" | "b";
  /** WebCodecs decoder result for this video */
  videoDecoder: UseWebCodecsDecoderResult;
  /** Video height slider value (for scaling) */
  videoHeight: number;
  /** File/blob reference (for loading/empty state) */
  file: File | Blob | null;
  /** Annotations to render on this video */
  annotations: Annotation[];
  /** Set of selected annotation IDs */
  selectedIds: Set<string>;
  /** Current drawing state */
  drawingState: DrawingState;
  /** Mouse position for polyline/angle preview */
  polylineMousePos: Point | null;
  /** Annotation canvas scale factor */
  annotationScale: number;
  /** Annotation event handlers */
  handlers: AnnotationHandlers;
  /** Annotation manager instance */
  annotationManager: AnnotationManager;
  /** Konva Layer ref */
  layerRef: React.RefObject<Konva.Layer | null>;
  /** Whether an annotation is being dragged */
  isDraggingAnnotation: boolean;
  /** Whether an annotation is being reshaped */
  isReshapingAnnotation: boolean;
  /** Callback to update annotation text */
  updateAnnotationText: (id: string, text: string) => void;
  /** Current mode (controls only shown in SYNC mode) */
  mode: "sync" | "playback";
  /** Video controls handle (required in SYNC mode) */
  controls?: VideoControlsHandle;
}

/**
 * Calculate rotation-aware display dimensions for a video.
 *
 * When rotation is 90 or 270 degrees, width and height are swapped
 * for display purposes. The canvas always renders at native resolution.
 */
function calculateDisplayDimensions(
  metadata: UseWebCodecsDecoderResult["metadata"],
  videoHeight: number
) {
  const rotation = metadata?.rotation ?? 0;
  const isRotated = rotation === 90 || rotation === 270;
  const baseDisplayWidth = isRotated ? metadata!.height : metadata!.width;
  const baseDisplayHeight = isRotated ? metadata!.width : metadata!.height;

  const scale =
    baseDisplayHeight > videoHeight
      ? videoHeight / baseDisplayHeight
      : 1;
  const displayWidth = baseDisplayWidth * scale;
  const displayHeight = baseDisplayHeight * scale;

  const canvasWidth = metadata!.width;
  const canvasHeight = metadata!.height;

  return {
    rotation,
    isRotated,
    baseDisplayWidth,
    baseDisplayHeight,
    scale,
    displayWidth,
    displayHeight,
    canvasWidth,
    canvasHeight,
  };
}

export function VideoPanel({
  videoSlot,
  videoDecoder,
  videoHeight,
  file,
  annotations,
  selectedIds,
  drawingState,
  polylineMousePos,
  annotationScale,
  handlers,
  annotationManager,
  layerRef,
  isDraggingAnnotation,
  isReshapingAnnotation,
  updateAnnotationText,
  mode,
  controls,
}: VideoPanelProps) {
  const isReady = videoDecoder.isReady && videoDecoder.metadata;

  if (!isReady) {
    return (
      <div
        style={{
          padding: "100px 20px",
          backgroundColor: "#f5f5f5",
          border: "2px dashed #ccc",
          textAlign: "center",
          color: "#999",
        }}
      >
        {file ? "Loading..." : "No video loaded"}
      </div>
    );
  }

  const dims = calculateDisplayDimensions(videoDecoder.metadata, videoHeight);

  return (
    <div>
      {/* Video canvas with scaling, rotation, and annotation overlay */}
      <div
        style={{
          border: "2px solid #333",
          backgroundColor: "#000",
          position: "relative",
          width: `${dims.displayWidth}px`,
          height: `${dims.displayHeight}px`,
          maxWidth: "100%",
        }}
      >
        {/* Scale container */}
        <div
          style={{
            position: "relative",
            width: `${dims.baseDisplayWidth}px`,
            height: `${dims.baseDisplayHeight}px`,
            transform: `scale(${dims.scale})`,
            transformOrigin: "top left",
            overflow: "hidden",
          }}
        >
          {/* Rotation container */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: `${dims.canvasWidth}px`,
              height: `${dims.canvasHeight}px`,
              transform: `translate(-50%, -50%) rotate(${dims.rotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            <canvas
              ref={videoDecoder.canvasRef}
              data-testid={`video-canvas-${videoSlot}`}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
              }}
            />
          </div>

          {/* Annotation overlay - independent of rotation */}
          {videoDecoder.metadata && (
            <div
              data-testid={`annotation-container-${videoSlot}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "auto",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  transform: `scale(${annotationScale})`,
                  transformOrigin: "top left",
                }}
              >
                <VideoCanvas
                  width={dims.baseDisplayWidth}
                  height={dims.baseDisplayHeight}
                  annotations={annotations}
                  selectedIds={selectedIds}
                  drawingState={drawingState}
                  polylineMousePos={polylineMousePos}
                  handlers={handlers}
                  annotationManager={annotationManager}
                  layerRef={layerRef}
                  isDraggingAnnotation={isDraggingAnnotation}
                  isReshapingAnnotation={isReshapingAnnotation}
                  updateAnnotationText={updateAnnotationText}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Frame counter */}
      <div
        data-testid={`frame-counter-${videoSlot}`}
        style={{
          fontSize: "12px",
          fontWeight: "bold",
          marginTop: "10px",
          fontFamily: "monospace",
        }}
      >
        Frame {videoDecoder.currentFrame} of {videoDecoder.totalFrames}
      </div>

      {/* Per-video controls (SYNC mode only) */}
      {mode === "sync" && controls && (
        <VideoControls
          totalFrames={videoDecoder.totalFrames}
          currentFrame={videoDecoder.currentFrame}
          isPlaying={videoDecoder.isPlaying}
          playbackRate={videoDecoder.playbackRate}
          sliderValue={controls.sliderValue}
          videoSlot={videoSlot}
          onPlayPause={controls.playPause}
          onStepForward={controls.stepForward}
          onStepBackward={controls.stepBackward}
          onSliderChange={controls.onSliderChange}
          onSliderRelease={controls.onSliderRelease}
          onSpeedChange={controls.onSpeedChange}
        />
      )}
    </div>
  );
}
