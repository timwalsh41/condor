import { FrameStepper } from './components/FrameStepper';
import './App.css';

/**
 * Spike validation app for frame-accurate video control
 *
 * Phase 0 - Task 0.2: Frame-Accurate Seeking Spike
 * Validates REQ-F-FRAME-001, REQ-F-FRAME-003, REQ-NF-P-004, REQ-NF-BC-001
 */
function App() {
  // Use locally generated test video with frame counter burned in
  const testVideoUrl = '/test_30fps_10s.mp4';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Frame-Accurate Video Control Spike</h1>
        <p>Phase 0 - Task 0.2: Validating requestVideoFrameCallback API</p>
      </header>

      <main>
        <FrameStepper videoSrc={testVideoUrl} framerate={30} />
      </main>

      <footer className="app-footer">
        <p>
          <strong>Test Instructions:</strong> Use frame step buttons to validate
          frame-accurate control. Frame counter should update with ≤1 frame accuracy.
        </p>
      </footer>
    </div>
  );
}

export default App;
