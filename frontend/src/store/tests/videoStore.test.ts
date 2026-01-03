/**
 * Unit tests for videoStore (Zustand store for video metadata and session state).
 *
 * Phase: Phase 1 Task 1.2 (Backend Integration + Upload Workflow)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoStore } from '../videoStore';
import type { VideoMetadata } from '../../types/api';

describe('videoStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useVideoStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have null session ID initially', () => {
      const { sessionId } = useVideoStore.getState();
      expect(sessionId).toBeNull();
    });

    it('should have null video A initially', () => {
      const { videoA } = useVideoStore.getState();
      expect(videoA).toBeNull();
    });

    it('should have null video B initially', () => {
      const { videoB } = useVideoStore.getState();
      expect(videoB).toBeNull();
    });

    it('should not be uploading initially', () => {
      const { uploadingVideoA, uploadingVideoB } = useVideoStore.getState();
      expect(uploadingVideoA).toBe(false);
      expect(uploadingVideoB).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should set session ID', () => {
      const testSessionId = 'test-session-123';
      useVideoStore.getState().setSessionId(testSessionId);

      const { sessionId } = useVideoStore.getState();
      expect(sessionId).toBe(testSessionId);
    });
  });

  describe('Video A Management', () => {
    it('should set video A metadata and blob', () => {
      const mockMetadata: VideoMetadata = {
        video_id: 'video-a-123',
        session_id: 'session-123',
        filename: 'test-a.mp4',
        framerate: 30,
        duration: 10.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
      };
      const mockBlob = new Blob(['test'], { type: 'video/mp4' });

      useVideoStore.getState().setVideoA({
        metadata: mockMetadata,
        blob: mockBlob,
      });

      const { videoA } = useVideoStore.getState();
      expect(videoA).not.toBeNull();
      expect(videoA?.metadata).toEqual(mockMetadata);
      expect(videoA?.blob).toBe(mockBlob);
    });

    it('should clear video A when set to null', () => {
      // Set video A first
      const mockMetadata: VideoMetadata = {
        video_id: 'video-a-123',
        session_id: 'session-123',
        filename: 'test-a.mp4',
        framerate: 30,
        duration: 10.0,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
      };
      const mockBlob = new Blob(['test'], { type: 'video/mp4' });

      useVideoStore.getState().setVideoA({
        metadata: mockMetadata,
        blob: mockBlob,
      });

      // Clear video A
      useVideoStore.getState().setVideoA(null);

      const { videoA } = useVideoStore.getState();
      expect(videoA).toBeNull();
    });

    it('should set uploading video A state', () => {
      useVideoStore.getState().setUploadingVideoA(true);
      expect(useVideoStore.getState().uploadingVideoA).toBe(true);

      useVideoStore.getState().setUploadingVideoA(false);
      expect(useVideoStore.getState().uploadingVideoA).toBe(false);
    });
  });

  describe('Video B Management', () => {
    it('should set video B metadata and blob', () => {
      const mockMetadata: VideoMetadata = {
        video_id: 'video-b-456',
        session_id: 'session-123',
        filename: 'test-b.mp4',
        framerate: 25,
        duration: 15.0,
        width: 1280,
        height: 720,
        codec: 'h264',
        gop_size: 30,
      };
      const mockBlob = new Blob(['test'], { type: 'video/mp4' });

      useVideoStore.getState().setVideoB({
        metadata: mockMetadata,
        blob: mockBlob,
      });

      const { videoB } = useVideoStore.getState();
      expect(videoB).not.toBeNull();
      expect(videoB?.metadata).toEqual(mockMetadata);
      expect(videoB?.blob).toBe(mockBlob);
    });

    it('should set uploading video B state', () => {
      useVideoStore.getState().setUploadingVideoB(true);
      expect(useVideoStore.getState().uploadingVideoB).toBe(true);

      useVideoStore.getState().setUploadingVideoB(false);
      expect(useVideoStore.getState().uploadingVideoB).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset store to initial state', () => {
      // Set some state
      useVideoStore.getState().setSessionId('test-session');
      useVideoStore.getState().setVideoA({
        metadata: {
          video_id: 'video-a',
          session_id: 'session',
          filename: 'test.mp4',
          framerate: 30,
          duration: 10,
          width: 1920,
          height: 1080,
          codec: 'h264',
          gop_size: 30,
        },
        blob: new Blob(['test'], { type: 'video/mp4' }),
      });
      useVideoStore.getState().setUploadingVideoA(true);

      // Reset
      useVideoStore.getState().reset();

      // Verify reset
      const state = useVideoStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.videoA).toBeNull();
      expect(state.videoB).toBeNull();
      expect(state.uploadingVideoA).toBe(false);
      expect(state.uploadingVideoB).toBe(false);
    });
  });
});
