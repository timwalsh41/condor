/**
 * SessionsView – Browse, load, and delete saved analysis sessions.
 *
 * Lists all persisted sessions and allows users to restore the full
 * Analyze view state (videos, sync, annotations) from any saved session.
 *
 * Phase 2, Task 2.9 (Session Persistence Frontend Workflows)
 * Validates: REQ-P2-SESS-001
 */

import { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import type { AnalysisSessionSummary } from '../types/api';
import './LibraryView.css';

// ─── Helper: format ISO timestamp ───────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Session Card ────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: AnalysisSessionSummary;
  isActive: boolean;
  loading: boolean;
  onLoad: () => void;
  onDelete: () => void;
}

function SessionCard({ session, isActive, loading, onLoad, onDelete }: SessionCardProps) {
  return (
    <div className={`library-card ${isActive ? 'library-card--active' : ''}`}>
      <div className="library-card__info">
        <p className="library-card__filename" title={session.name}>
          {session.name}
        </p>
        {session.notes && (
          <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 0.5rem' }}>
            {session.notes}
          </p>
        )}
        <dl className="library-card__meta">
          <dt>Saved</dt>
          <dd>{formatDate(session.created_at)}</dd>
          {session.video_a_id && (
            <>
              <dt>Video A</dt>
              <dd>{session.video_a_id.slice(0, 8)}…</dd>
            </>
          )}
          {session.video_b_id && (
            <>
              <dt>Video B</dt>
              <dd>{session.video_b_id.slice(0, 8)}…</dd>
            </>
          )}
        </dl>
        {isActive && (
          <span style={{ fontSize: '0.75rem', color: '#68d391', fontWeight: 600 }}>
            ✓ Currently loaded
          </span>
        )}
      </div>

      <div className="library-card__actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={onLoad}
          disabled={loading || isActive}
          title="Restore this session in the Analyze view"
        >
          {loading ? 'Loading…' : 'Load'}
        </button>
        <button className="btn btn--danger btn--sm" onClick={onDelete} disabled={loading}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── SessionsView ─────────────────────────────────────────────────────────────

interface SessionsViewProps {
  onNavigateToAnalyze: () => void;
}

export function SessionsView({ onNavigateToAnalyze }: SessionsViewProps) {
  const { sessions, loading, error, activeSessionId, fetchSessions, loadSession, removeSession, clearError } =
    useSessionStore();

  const [deleteTarget, setDeleteTarget] = useState<AnalysisSessionSummary | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function handleLoad(sessionId: string) {
    setLoadingSessionId(sessionId);
    try {
      await loadSession(sessionId);
      onNavigateToAnalyze();
    } catch {
      /* error surfaced via store */
    } finally {
      setLoadingSessionId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await removeSession(deleteTarget.id);
    } catch {
      /* error surfaced via store */
    }
    setDeleteTarget(null);
  }

  return (
    <div className="library-view">
      <div className="library-view__header">
        <h2 className="library-view__title">Saved Sessions</h2>
        <button
          className="btn btn--secondary"
          onClick={() => fetchSessions()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="library-view__error">
          {error}
          <button className="btn btn--sm btn--secondary" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <p className="library-view__empty">Loading sessions…</p>
      ) : !loading && sessions.length === 0 ? (
        <p className="library-view__empty">
          No saved sessions yet. Open the Analyze view, load videos, set sync points and
          annotations, then use <strong>Save Session</strong> to persist your work.
        </p>
      ) : (
        <div className="library-view__grid">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              loading={loadingSessionId === session.id}
              onLoad={() => handleLoad(session.id)}
              onDelete={() => setDeleteTarget(session)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="library-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="library-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="library-modal__title">Delete Session?</h3>
            <p>
              This will permanently delete the session{' '}
              <strong>{deleteTarget.name}</strong>. This action cannot be undone.
            </p>
            <div className="library-modal__actions">
              <button className="btn btn--secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
