import { WebCodecsDemo } from './components/WebCodecsDemo';
import './App.css';

/**
 * Spike validation app for frame-accurate video control
 *
 * Phase 0 - Task 0.3: WebCodecs Frame Control Spike
 * Validates REQ-F-FRAME-001, REQ-F-FRAME-002, REQ-F-FRAME-003, REQ-NF-P-004, REQ-NF-BC-001
 *
 * Demonstrates exact frame positioning (0 frame error) using WebCodecs API
 * with LRU frame cache and GOP=30 optimization.
 */
function App() {
  return (
    <div className="app">
      <WebCodecsDemo />
    </div>
  );
}

export default App;
