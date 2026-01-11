import { DualVideoSynchronizer } from "./components/DualVideoSynchronizer";
import "./App.css";

/**
 * Golf swing analysis app with dual-video synchronized playback
 *
 * Phase 1 Task 1.3.2 Features:
 * - Video upload workflow with rotation controls (REQ-F-UPLOAD-001, REQ-F-UPLOAD-004)
 * - Backend integration for video processing and streaming (REQ-F-PLAYBACK-003)
 * - Frame-accurate video control using WebCodecs API (REQ-F-FRAME-001)
 * - Synchronized dual video playback (REQ-F-SYNC-001, REQ-F-PLAY-001)
 * - Canvas overlay annotations (REQ-F-ANNOT-001, REQ-F-ANNOT-002)
 * - Annotation selection, deletion, dragging, and reshaping
 * - Upload workflow UX improvements (REQ-NF-U-001, REQ-NF-U-002)
 *
 * Demonstrates exact frame positioning (0 frame error) with LRU frame cache
 * and GOP=30 optimization.
 */
function App() {
  return (
    <div className="app">
      <DualVideoSynchronizer />
    </div>
  );
}

export default App;
