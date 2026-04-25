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
import { useTrimStore } from './trimStore';
import type { VideoMetadata } from '../types/api';

interface SessionStoreState {
  /** List of all sessions (summaries). */
  sessions: AnalysisSessionSummary[];
  loading: boolean;
  error: string | null;
  /** ID of the currently loaded session (if any). */
  activeSessionId: string | null;
  /** True while a session is being hydrated into the Analyze view. */
  isHydratingSession: boolean;

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
export function buildSessionPayload(name: string, notes?: string): AnalysisSessionCreate {
  const { videoA, videoB } = useVideoStore.getState();
  const { annotationsA, annotationsB } = useAnnotationStore.getState();
  const { syncPoints } = useSyncStore.getState();
  const { playbackRate, isLooping } = usePlaybackStore.getState();
  const { trimStart, trimEnd } = useTrimStore.getState();

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
    loop_playback: isLooping,
    // Trim bounds (Video A frame units, unified playhead position)
    trim_start_a: trimStart,
    trim_end_a: trimEnd,
    trim_start_b: null,
    trim_end_b: null,
    annotations,
  };
}

/**
 * Restore the Analyze view state from a loaded session record.
 *
 * Returns a (possibly empty) list of non-fatal error messages, e.g. when a
 * referenced library video can no longer be fetched. Callers should surface
 * these to the user via the session store error field.
 */
export async function restoreSessionState(session: AnalysisSessionResponse): Promise<string[]> {
  const { setVideoA, setVideoB, setSessionId } = useVideoStore.getState();
  const { setAnnotationsA, setAnnotationsB } = useAnnotationStore.getState();
  const { addSyncPoint, clearSyncPoints, setTemporalOffset, setMode, setTargetSyncFrames } = useSyncStore.getState();
  const { setPlaybackRate, setIsLooping } = usePlaybackStore.getState();
  const { setTrimStart, setTrimEnd } = useTrimStore.getState();

  // Restore playback settings
  setPlaybackRate(session.playback_speed);
  setIsLooping(session.loop_playback);

  // Restore trim bounds
  setTrimStart(session.trim_start_a ?? null);
  setTrimEnd(session.trim_end_a ?? null);

  // Restore sync points and calculate temporal offset
  clearSyncPoints();
  if (session.sync_frame_a !== null && session.sync_frame_b !== null) {
    addSyncPoint({ frameA: session.sync_frame_a, frameB: session.sync_frame_b });
    // Calculate temporal offset: frameB = frameA + offset → offset = frameB - frameA
    setTemporalOffset(session.sync_frame_b - session.sync_frame_a);
  } else {
    setTemporalOffset(null);
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

  // Set mode to PLAYBACK for session viewing
  setMode('PLAYBACK');

  // Store target sync frames for seeking after video load
  if (session.sync_frame_a !== null && session.sync_frame_b !== null) {
    setTargetSyncFrames(session.sync_frame_a, session.sync_frame_b);
  } else {
    setTargetSyncFrames(null, null);
  }

  // Load library videos if referenced
  const loadErrors: string[] = [];

  async function loadLibraryVideoSlot(
    videoId: string | null,
    setSetter: (v: { metadata: VideoMetadata; blob: Blob } | null) => void,
    slotLabel: string,
  ) {
    if (!videoId) {
      setSetter(null);
      return;
    }
    console.log(`[loadSession] Fetching ${slotLabel} (id=${videoId})...`);
    try {
      const [meta, blob] = await Promise.all([
        getLibraryVideo(videoId),
        fetchLibraryVideoBlob(videoId),
      ]);
      console.log(`[loadSession] ${slotLabel} loaded: ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
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
    } catch (err) {
      // Non-fatal: video may have been deleted from the library. Record the
      // error so the caller can surface it and continue loading other state.
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[loadSession] ${slotLabel} failed to load: ${msg}`);
      loadErrors.push(`${slotLabel} could not be loaded: ${msg}`);
      setSetter(null);
    }
  }

  // Load sequentially to avoid saturating the connection with two concurrent
  // large downloads, which causes transient "network connection was lost" errors
  // (reproducible in Safari at ~50% rate with parallel 60 MB+ fetches).
  await loadLibraryVideoSlot(session.video_a_id, setVideoA, 'Video A');
  await loadLibraryVideoSlot(session.video_b_id, setVideoB, 'Video B');

  return loadErrors;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  sessions: [],
  loading: false,
  error: null,
  activeSessionId: null,
  isHydratingSession: false,

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
    set({ error: null, loading: true, isHydratingSession: true });
    try {
      // Fetch full session record from API
      const { getSession } = await import('../services/api');
      const session = await getSession(sessionId);
      const loadErrors = await restoreSessionState(session);
      set({
        activeSessionId: sessionId,
        loading: false,
        isHydratingSession: false,
        // Surface any non-fatal video-load failures (e.g. deleted library videos)
        error: loadErrors.length > 0
          ? `Session loaded with warnings: ${loadErrors.join('; ')}`
          : null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load session',
        loading: false,
        isHydratingSession: false,
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
