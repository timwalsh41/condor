/**
 * Dual Video Upload and Playback Workflow Component
 *
 * Orchestrates the complete workflow:
 * 1. Upload Video A (with rotation)
 * 2. Upload Video B (with rotation)
 * 3. Launch DualVideoSyncDemo with backend videos
 *
 * Validates:
 * - REQ-F-UPLOAD-001: Local file upload
 * - REQ-F-UPLOAD-004: Video rotation during upload
 * - REQ-F-PLAYBACK-001: Single video playback
 * - REQ-F-PLAYBACK-002: Dual video display
 *
 * Phase: Phase 1 Task 1.3 (DualVideoSyncDemo Backend Integration)
 */

import { useState } from 'react';
import { VideoUploadWorkflow } from './VideoUploadWorkflow';
import { DualVideoSyncDemo } from './DualVideoSyncDemo';
import { useVideoStore } from '../store/videoStore';
import type { VideoMetadata } from '../types/api';

type WorkflowState =
  | 'upload-a'      // Uploading video A
  | 'upload-b'      // Uploading video B
  | 'playback';     // Both videos uploaded, show playback

export function DualVideoWorkflow() {
  const [workflowState, setWorkflowState] = useState<WorkflowState>('upload-a');

  const { sessionId, videoA, videoB, setSessionId, setVideoA, setVideoB } = useVideoStore();

  /**
   * Handle Video A upload completion.
   */
  const handleVideoAUploadComplete = (metadata: VideoMetadata, blob: Blob) => {
    // Store session ID from first upload
    if (!sessionId && metadata.session_id) {
      setSessionId(metadata.session_id);
    }

    // Store video A metadata and blob
    setVideoA({ metadata, blob });

    // Move to video B upload
    setWorkflowState('upload-b');
  };

  /**
   * Handle Video B upload completion.
   */
  const handleVideoBUploadComplete = (metadata: VideoMetadata, blob: Blob) => {
    // Store video B metadata and blob
    setVideoB({ metadata, blob });

    // Move to playback
    setWorkflowState('playback');
  };

  /**
   * Handle upload cancellation - reset workflow.
   */
  const handleCancel = () => {
    setVideoA(null);
    setVideoB(null);
    setWorkflowState('upload-a');
  };

  /**
   * Handle "Upload New Videos" from playback view.
   */
  const handleReset = () => {
    setVideoA(null);
    setVideoB(null);
    setWorkflowState('upload-a');
  };

  // Render based on workflow state
  if (workflowState === 'upload-a') {
    return (
      <div className="dual-video-workflow">
        <h1>Golf Swing Analyzer</h1>
        <h2>Upload Video A</h2>
        <VideoUploadWorkflow
          key="video-a"
          videoSlot="A"
          sessionId={sessionId || undefined}
          onUploadComplete={handleVideoAUploadComplete}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  if (workflowState === 'upload-b') {
    return (
      <div className="dual-video-workflow">
        <h1>Golf Swing Analyzer</h1>
        <h2>Upload Video B</h2>
        <VideoUploadWorkflow
          key="video-b"
          videoSlot="B"
          sessionId={sessionId || undefined}
          onUploadComplete={handleVideoBUploadComplete}
          onCancel={handleCancel}
        />
        <div className="workflow-status">
          <p>✓ Video A uploaded: {videoA?.metadata?.filename || 'Unknown'}</p>
        </div>
      </div>
    );
  }

  // workflowState === 'playback'
  // Convert blobs to Files for DualVideoSyncDemo (maintains backward compatibility)
  const fileA = (videoA?.blob && videoA.metadata)
    ? new File([videoA.blob], videoA.metadata.filename, { type: 'video/mp4' })
    : null;
  const fileB = (videoB?.blob && videoB.metadata)
    ? new File([videoB.blob], videoB.metadata.filename, { type: 'video/mp4' })
    : null;

  return (
    <div className="dual-video-workflow">
      <div className="workflow-header">
        <h1>Golf Swing Analyzer</h1>
        <button onClick={handleReset} className="reset-button">
          Upload New Videos
        </button>
      </div>
      <DualVideoSyncDemo
        initialFileA={fileA}
        initialFileB={fileB}
      />
    </div>
  );
}
