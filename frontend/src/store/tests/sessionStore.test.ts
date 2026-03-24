/**
 * Unit tests for sessionStore (Zustand store for analysis sessions).
 *
 * Phase 2, Task 2.2 (Session Load State Restoration)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSessionStore } from '../sessionStore';
import { useSyncStore } from '../syncStore';
import { useVideoStore } from '../videoStore';
import { useAnnotationStore } from '../annotationStore';
import { usePlaybackStore } from '../playbackStore';
import { useTrimStore } from '../trimStore';
import type { AnalysisSessionResponse } from '../../types/api';

// Mock the API module
vi.mock('../../services/api', () => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getLibraryVideo: vi.fn(),
  fetchLibraryVideoBlob: vi.fn(),
  getSession: vi.fn(),
}));

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset all stores to initial state before each test
    useSessionStore.getState().clearError();
    useSyncStore.getState().reset();
    useVideoStore.getState().reset();
    useAnnotationStore.getState().reset();
    usePlaybackStore.getState().reset();
    useTrimStore.getState().resetTrim();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty sessions list initially', () => {
      const { sessions } = useSessionStore.getState();
      expect(sessions).toEqual([]);
    });

    it('should not be loading initially', () => {
      const { loading } = useSessionStore.getState();
      expect(loading).toBe(false);
    });

    it('should have no error initially', () => {
      const { error } = useSessionStore.getState();
      expect(error).toBeNull();
    });

    it('should have no active session initially', () => {
      const { activeSessionId } = useSessionStore.getState();
      expect(activeSessionId).toBeNull();
    });
  });

  describe('Session State Restoration', () => {
    it('should set mode to PLAYBACK when restoring session state', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: 100,
        sync_frame_b: 200,
        trim_start_a: 10,
        trim_end_a: 500,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 0.5,
        loop_playback: false,
        annotations: { a: [], b: [] },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Mock the API response
      vi.mocked(getSession).mockResolvedValue(mockSession);

      // Mock video blob loading (to avoid actual network calls)
      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { mode } = useSyncStore.getState();
      expect(mode).toBe('PLAYBACK');
    });

    it('should calculate temporal offset from sync frames', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: 100,
        sync_frame_b: 200,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { temporalOffset } = useSyncStore.getState();
      // offset = frameB - frameA = 200 - 100 = 100
      expect(temporalOffset).toBe(100);
    });

    it('should set temporalOffset to null when no sync frames exist', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { temporalOffset } = useSyncStore.getState();
      expect(temporalOffset).toBeNull();
    });

    it('should store target sync frames for seeking after video load', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: 100,
        sync_frame_b: 200,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { targetSyncFrameA, targetSyncFrameB } = useSyncStore.getState();
      expect(targetSyncFrameA).toBe(100);
      expect(targetSyncFrameB).toBe(200);
    });

    it('should set target sync frames to null when no sync frames exist', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { targetSyncFrameA, targetSyncFrameB } = useSyncStore.getState();
      expect(targetSyncFrameA).toBeNull();
      expect(targetSyncFrameB).toBeNull();
    });

    it('should restore playback rate', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 2.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { playbackRate } = usePlaybackStore.getState();
      expect(playbackRate).toBe(2.0);
    });

    it('should restore trim bounds', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: 50,
        trim_end_a: 300,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { trimStart, trimEnd } = useTrimStore.getState();
      expect(trimStart).toBe(50);
      expect(trimEnd).toBe(300);
    });

    it('should restore annotations', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockAnnotations = {
        a: [{ id: 'ann-1', type: 'text', text: 'Test annotation A' }],
        b: [{ id: 'ann-2', type: 'text', text: 'Test annotation B' }],
      };

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: mockAnnotations,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { annotationsA, annotationsB } = useAnnotationStore.getState();
      expect(annotationsA).toHaveLength(1);
      expect(annotationsB).toHaveLength(1);
      expect(annotationsA[0].text).toBe('Test annotation A');
      expect(annotationsB[0].text).toBe('Test annotation B');
    });

    it('should clear previous annotations when session has no annotations', async () => {
      // First set some annotations
      useAnnotationStore.getState().setAnnotationsA([{ id: 'ann-1', type: 'text', text: 'Previous' }]);
      useAnnotationStore.getState().setAnnotationsB([{ id: 'ann-2', type: 'text', text: 'Previous' }]);

      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { annotationsA, annotationsB } = useAnnotationStore.getState();
      expect(annotationsA).toEqual([]);
      expect(annotationsB).toEqual([]);
    });

    it('should set session context to library', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { sessionId } = useVideoStore.getState();
      expect(sessionId).toBe('library');
    });

    it('should set active session ID after loading', async () => {
      const { loadSession } = useSessionStore.getState();
      const { getSession } = await import('../../services/api');

      const mockSession: AnalysisSessionResponse = {
        id: 'test-session-1',
        name: 'Test Session',
        notes: null,
        video_a_id: 'video-a-1',
        video_b_id: 'video-b-1',
        sync_frame_a: null,
        sync_frame_b: null,
        trim_start_a: null,
        trim_end_a: null,
        trim_start_b: null,
        trim_end_b: null,
        playback_speed: 1.0,
        loop_playback: false,
        annotations: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { getLibraryVideo, fetchLibraryVideoBlob } = await import('../../services/api');
      vi.mocked(getLibraryVideo).mockResolvedValue({
        id: 'test-video',
        filename: 'test.mp4',
        framerate: 30,
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        gop_size: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(fetchLibraryVideoBlob).mockResolvedValue(new Blob(['test']));

      await loadSession('test-session-1');

      const { activeSessionId } = useSessionStore.getState();
      expect(activeSessionId).toBe('test-session-1');
    });
  });
});
