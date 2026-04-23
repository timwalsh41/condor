/**
 * LibraryView – Browse, manage, and select library videos.
 *
 * Displays a grid of saved library videos with inline metadata editing
 * and actions to load them into the Analyze view (Video A or B slots).
 *
 * Phase 2, Task 2.7 (Video Library Frontend Workflows)
 * Validates: REQ-P2-LIB-001, REQ-P2-LIB-002, REQ-P2-LIB-003
 */

import { useEffect, useState } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { useVideoStore } from '../store/videoStore';
import { useAnnotationStore } from '../store/annotationStore';
import { fetchLibraryVideoBlob } from '../services/api';
import type { LibraryVideo, LibraryVideoUpdate } from '../types/api';
import type { VideoMetadata } from '../types/api';
import GooglePhotosImport from './GooglePhotosImport';
import './LibraryView.css';

// ─── Helper: format seconds as m:ss ─────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Edit Metadata Modal ─────────────────────────────────────────────────────

interface EditModalProps {
  video: LibraryVideo;
  onSave: (updates: LibraryVideoUpdate) => void;
  onClose: () => void;
}

function EditModal({ video, onSave, onClose }: EditModalProps) {
  const [golferName, setGolferName] = useState(video.golfer_name ?? '');
  const [club, setClub] = useState(video.club ?? '');
  const [swingDate, setSwingDate] = useState(video.swing_date ?? '');
  const [notes, setNotes] = useState(video.notes ?? '');
  const [qualityScore, setQualityScore] = useState<number | ''>(video.quality_score ?? '');
  const [cameraView, setCameraView] = useState(video.camera_view ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      golfer_name: golferName.trim() || null,
      club: club.trim() || null,
      swing_date: swingDate || null,
      notes: notes.trim() || null,
      quality_score: qualityScore === '' ? null : Number(qualityScore),
      camera_view: cameraView || null,
    });
  }

  return (
    <div className="library-modal-backdrop" onClick={onClose}>
      <div className="library-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="library-modal__title">Edit Metadata</h3>
        <p className="library-modal__subtitle">{video.filename}</p>
        <form onSubmit={handleSubmit} className="library-modal__form">
          <label className="library-modal__label">
            Golfer name
            <input
              type="text"
              value={golferName}
              maxLength={100}
              onChange={(e) => setGolferName(e.target.value)}
              className="library-modal__input"
            />
          </label>
          <label className="library-modal__label">
            Club
            <input
              type="text"
              value={club}
              maxLength={100}
              onChange={(e) => setClub(e.target.value)}
              className="library-modal__input"
            />
          </label>
          <label className="library-modal__label">
            Swing date
            <input
              type="date"
              value={swingDate}
              onChange={(e) => setSwingDate(e.target.value)}
              className="library-modal__input"
            />
          </label>
          <label className="library-modal__label">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="library-modal__textarea"
              rows={3}
            />
          </label>
          <label className="library-modal__label">
            Quality score (1–10)
            <input
              type="number"
              value={qualityScore}
              min={1}
              max={10}
              onChange={(e) =>
                setQualityScore(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="library-modal__input library-modal__input--short"
            />
          </label>
          <label className="library-modal__label">
            Camera view
            <select
              value={cameraView}
              onChange={(e) => setCameraView(e.target.value)}
              className="library-modal__input"
            >
              <option value="">— Select —</option>
              <option value="DTL">DTL (Down The Line)</option>
              <option value="FO">FO (Face On)</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <div className="library-modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Video Card ──────────────────────────────────────────────────────────────

interface VideoCardProps {
  video: LibraryVideo;
  onEdit: () => void;
  onDelete: () => void;
  onLoadA: () => void;
  onLoadB: () => void;
  loadingSlot: 'A' | 'B' | null;
}

function VideoCard({ video, onEdit, onDelete, onLoadA, onLoadB, loadingSlot }: VideoCardProps) {
  return (
    <div className="library-card">
      <div className="library-card__info">
        <p className="library-card__filename" title={video.filename}>
          {video.filename}
        </p>
        <dl className="library-card__meta">
          {video.golfer_name && (
            <>
              <dt>Golfer</dt>
              <dd>{video.golfer_name}</dd>
            </>
          )}
          {video.club && (
            <>
              <dt>Club</dt>
              <dd>{video.club}</dd>
            </>
          )}
          {video.swing_date && (
            <>
              <dt>Date</dt>
              <dd>{video.swing_date}</dd>
            </>
          )}
          <dt>Duration</dt>
          <dd>{formatDuration(video.duration)}</dd>
          <dt>Resolution</dt>
          <dd>
            {video.width}×{video.height}
          </dd>
          <dt>FPS</dt>
          <dd>{video.framerate.toFixed(2)}</dd>
          {video.quality_score !== null && (
            <>
              <dt>Quality</dt>
              <dd>{'★'.repeat(Math.round(video.quality_score / 2))} {video.quality_score}/10</dd>
            </>
          )}
          {video.camera_view && (
            <>
              <dt>Camera</dt>
              <dd>{video.camera_view}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="library-card__actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={onLoadA}
          disabled={loadingSlot !== null}
          title="Load as Video A in Analyze view"
        >
          {loadingSlot === 'A' ? 'Loading…' : 'Load → A'}
        </button>
        <button
          className="btn btn--primary btn--sm"
          onClick={onLoadB}
          disabled={loadingSlot !== null}
          title="Load as Video B in Analyze view"
        >
          {loadingSlot === 'B' ? 'Loading…' : 'Load → B'}
        </button>
        <button className="btn btn--secondary btn--sm" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn--danger btn--sm" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── LibraryView ─────────────────────────────────────────────────────────────

interface LibraryViewProps {
  /** Called when a video has been loaded into a slot — navigate to the Analyze view. */
  onNavigateToAnalyze: () => void;
}

export function LibraryView({ onNavigateToAnalyze }: LibraryViewProps) {
  const { videos, loading, error, fetchVideos, updateVideo, removeVideo, clearError } =
    useLibraryStore();
  const { setVideoA, setVideoB, setSessionId, sessionId } = useVideoStore();
  const { setAnnotationsA, setAnnotationsB } = useAnnotationStore();

  const [editTarget, setEditTarget] = useState<LibraryVideo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryVideo | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<Record<string, 'A' | 'B' | null>>({});
  const [showGooglePhotos, setShowGooglePhotos] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // ── Edit ──
  async function handleSaveEdit(updates: LibraryVideoUpdate) {
    if (!editTarget) return;
    try {
      await updateVideo(editTarget.id, updates);
    } catch (err) {
      /* error handled by store */
    }
    setEditTarget(null);
  }

  // ── Delete ──
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await removeVideo(deleteTarget.id);
    } catch (err) {
      /* error handled by store */
    }
    setDeleteTarget(null);
  }

  // ── Load into analyzer slot ──
  async function handleLoad(video: LibraryVideo, slot: 'A' | 'B') {
    setLoadingSlots((prev) => ({ ...prev, [video.id]: slot }));
    try {
      const blob = await fetchLibraryVideoBlob(video.id);

      // Build a VideoMetadata-compatible object from the library record
      const metadata: VideoMetadata = {
        video_id: video.id,
        session_id: sessionId ?? 'library',
        filename: video.filename,
        framerate: video.framerate,
        duration: video.duration,
        width: video.width,
        height: video.height,
        codec: video.codec,
        gop_size: video.gop_size,
      };

      if (!sessionId) {
        setSessionId('library');
      }

      if (slot === 'A') {
        setAnnotationsA([]);
        setVideoA({ metadata, blob });
      } else {
        setAnnotationsB([]);
        setVideoB({ metadata, blob });
      }

      onNavigateToAnalyze();
    } catch (err) {
      console.error('Failed to load library video:', err);
    } finally {
      setLoadingSlots((prev) => ({ ...prev, [video.id]: null }));
    }
  }

  return (
    <div className="library-view">
      <div className="library-view__header">
        <h2 className="library-view__title">Video Library</h2>
        <div className="library-view__header-actions">
          <button
            className="btn btn--secondary"
            onClick={() => setShowGooglePhotos(true)}
          >
            📸 Import from Google Photos
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => fetchVideos()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="library-view__error">
          {error}
          <button className="btn btn--sm btn--secondary" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      {loading && videos.length === 0 ? (
        <p className="library-view__empty">Loading library…</p>
      ) : !loading && videos.length === 0 ? (
        <p className="library-view__empty">
          No videos in your library yet. Upload a video and save it to the library from the
          Analyze view.
        </p>
      ) : (
        <div className="library-view__grid">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              loadingSlot={loadingSlots[video.id] ?? null}
              onEdit={() => setEditTarget(video)}
              onDelete={() => setDeleteTarget(video)}
              onLoadA={() => handleLoad(video, 'A')}
              onLoadB={() => handleLoad(video, 'B')}
            />
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          video={editTarget}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="library-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="library-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="library-modal__title">Delete Video?</h3>
            <p>
              This will permanently delete <strong>{deleteTarget.filename}</strong> and its file
              from disk. This action cannot be undone.
            </p>
            <div className="library-modal__actions">
              <button
                className="btn btn--secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button className="btn btn--danger" onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Photos import modal */}
      {showGooglePhotos && (
        <GooglePhotosImport
          onImportComplete={() => fetchVideos()}
          onClose={() => setShowGooglePhotos(false)}
        />
      )}
    </div>
  );
}
