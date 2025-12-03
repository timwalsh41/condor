import { DualVideoSyncDemo } from "./components/DualVideoSyncDemo";
import "./App.css";

/**
 * Golf swing analysis app with dual-video synchronized playback
 *
 * Phase 0 Features:
 * - Frame-accurate video control using WebCodecs API
 * - Synchronized dual video playback
 * - Canvas overlay annotations (freehand, polyline, oval, arrow)
 * - Annotation selection, deletion, and dragging
 *
 * Demonstrates exact frame positioning (0 frame error) with LRU frame cache
 * and GOP=30 optimization.
 */
function App() {
  return (
    <div className="app">
      <DualVideoSyncDemo />
    </div>
  );
}

export default App;
