/**
 * Zustand store for analysis sessions.
 *
 * Manages session list, save/load operations, and Analyze view state
 * restoration when loading a saved session.
 *
 * Phase 2, Task 2.9 (Session Persistence Frontend Workflows)
 * Validates: REQ-P2-SESS-001
 */

import { create } from 'zustand';
import type { Annotation } from '../types/annotations';
import type {
  AnalysisSessionSummary,
  AnalysisSessionResponse,
  AnalysisSessionCreate,
  AnnotationPayload,
} from '../types/api';
import {
  listSessions,
  createSession,
  deleteSession,
  getLibraryVideo,
  fetchLibraryVideoBlob,
} from '../services/api';
import { useVideoStore } from './videoStore';
import { useAnnotationStore } from './annotationStore';
import { useSyncStore } from './syncStore';
import { usePlaybackStore } from './playbackStore';
import type { VideoMetadata } from '../types/api';

interface SessionStoreState {
  /** List of all sessions (summaries). */
  sessions: AnalysisSessionSummary[];
  loading: boolean;
  error: string | null;
  /** ID of the currently loaded session (if any). */
  activeSessionId: string | null;

  fetchSessions: () => Promise<void>;
  saveSession: (name: string, notes?: string) => Promise<AnalysisSessionResponse>;
  loadSession: (sessionId: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Convert the Analyze view's current Zustand state into a session create payload.
 *
 * Reads from videoStore, annotationStore, syncStore, and playbackStore.
 */
function buildSessionPayload(name: string, notes?: string): AnalysisSessionCreate {
  const { videoA, videoB } = useVideoStore.getState();
  const { annotationsA, annotationsB } = useAnnotationStore.getState();
  const { syncPoints } = useSyncStore.getState();
  const { playbackRate } = usePlaybackStore.getState();

  // Use first sync point as canonical sync frames (MVP: single sync point)
  const syncPoint = syncPoints[0] ?? null;

  const annotations: AnnotationPayload = {
    a: annotationsA as unknown as Record<string, unknown>[],
    b: annotationsB as unknown as Record<string, unknown>[],
  };

  return {
    name,
    notes: notes ?? null,
    // Library video IDs are stored in metadata.video_id when loaded from library
    video_a_id: videoA?.metadata?.video_id ?? null,
    video_b_id: videoB?.metadata?.video_id ?? null,
    sync_frame_a: syncPoint?.frameA ?? null,
    sync_frame_b: syncPoint?.frameB ?? null,
    playback_speed: playbackRate,
    loop_playback: false,
    annotations,
  };
}

/**
 * Restore the Analyze view state from a loaded session record.
 */
async function restoreSessionState(session: AnalysisSessionResponse): Promise<void> {
  const { setVideoA, setVideoB, setSessionId } = useVideoStore.getState();
  const { setAnnotationsA, setAnnotationsB } = useAnnotationStore.getState();
  const { addSyncPoint, clearSyncPoints } = useSyncStore.getState();
  const { setPlaybackRate } = usePlaybackStore.getState();

  // Restore playback settings
  setPlaybackRate(session.playback_speed);

  // Restore sync points
  clearSyncPoints();
  if (session.sync_frame_a !== null && session.sync_frame_b !== null) {
    addSyncPoint({ frameA: session.sync_frame_a, frameB: session.sync_frame_b });
  }

  // Restore annotations
  if (session.annotations) {
    setAnnotationsA((session.annotations.a ?? []) as unknown as Annotation[]);
    setAnnotationsB((session.annotations.b ?? []) as unknown as Annotation[]);
  } else {
    setAnnotationsA([]);
    setAnnotationsB([]);
  }

  // Set session context
  setSessionId('library');

  // Load library videos if referenced
  async function loadLibraryVideoSlot(
    videoId: string | null,
    setSetter: (v: { metadata: VideoMetadata; blob: Blob } | null) => void,
  ) {
    if (!videoId) {
      setSetter(null);
      return;
    }
    try {
      const [meta, blob] = await Promise.all([
        getLibraryVideo(videoId),
        fetchLibraryVideoBlob(videoId),
      ]);
      const metadata: VideoMetadata = {
        video_id: meta.id,
        session_id: 'library',
        filename: meta.filename,
        framerate: meta.framerate,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        codec: meta.codec,
        gop_size: meta.gop_size,
      };
      setSetter({ metadata, blob });
    } catch {
      // Non-fatal: video may have been deleted from library
      setSetter(null);
    }
  }

  await Promise.all([
    loadLibraryVideoSlot(session.video_a_id, setVideoA),
    loadLibraryVideoSlot(session.video_b_id, setVideoB),
  ]);
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  sessions: [],
  loading: false,
  error: null,
  activeSessionId: null,

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const sessions = await listSessions();
      set({ sessions, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load sessions', loading: false });
    }
  },

  saveSession: async (name: string, notes?: string) => {
    set({ error: null });
    const payload = buildSessionPayload(name, notes);
    const session = await createSession(payload);
    set((state) => ({
      sessions: [
        { id: session.id, name: session.name, notes: session.notes,
          video_a_id: session.video_a_id, video_b_id: session.video_b_id,
          created_at: session.created_at, updated_at: session.updated_at },
        ...state.sessions,
      ],
      activeSessionId: session.id,
    }));
    return session;
  },

  loadSession: async (sessionId: string) => {
    set({ error: null, loading: true });
    try {
      // Fetch full session record from API
      const { getSession } = await import('../services/api');
      const session = await getSession(sessionId);
      await restoreSessionState(session);
      set({ activeSessionId: sessionId, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load session',
        loading: false,
      });
    }
  },

  removeSession: async (sessionId: string) => {
    set({ error: null });
    await deleteSession(sessionId);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    }));
  },

  clearError: () => set({ error: null }),
}));
