import { useState } from 'react';
import { WebCodecsDemo } from './components/WebCodecsDemo';
import { DualVideoSyncDemo } from './components/DualVideoSyncDemo';
import './App.css';

/**
 * Spike validation app for frame-accurate video control
 *
 * Phase 0 Spikes:
 * - Task 0.3: WebCodecs Frame Control Spike (single video)
 * - Task 0.4: Dual Video Sync Spike (synchronized dual video)
 *
 * Demonstrates exact frame positioning (0 frame error) using WebCodecs API
 * with LRU frame cache and GOP=30 optimization.
 */
function App() {
  const [activeDemo, setActiveDemo] = useState<'single' | 'dual'>('single');

  return (
    <div className="app">
      {/* Navigation */}
      <div style={{
        padding: '20px',
        backgroundColor: '#333',
        color: 'white',
        display: 'flex',
        gap: '20px',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => setActiveDemo('single')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            backgroundColor: activeDemo === 'single' ? '#4CAF50' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Single Video Demo (Task 0.3)
        </button>
        <button
          onClick={() => setActiveDemo('dual')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            backgroundColor: activeDemo === 'dual' ? '#4CAF50' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Dual Video Sync Demo (Task 0.4)
        </button>
      </div>

      {/* Demo Content */}
      {activeDemo === 'single' && <WebCodecsDemo />}
      {activeDemo === 'dual' && <DualVideoSyncDemo />}
    </div>
  );
}

export default App;
