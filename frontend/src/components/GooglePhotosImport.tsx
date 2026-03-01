/**
 * GooglePhotosImport – Mocked Google Photos import flow.
 *
 * Provides a step-by-step import wizard:
 *   1. Connect (mock OAuth)
 *   2. Browse albums
 *   3. Select videos
 *   4. Import → creates LibraryVideo records
 *
 * Validates: REQ-P2-IMPORT-001
 */

import { useState, useEffect } from 'react';
import {
  getGooglePhotosStatus,
  connectGooglePhotos,
  disconnectGooglePhotos,
  listGooglePhotosAlbums,
  listGooglePhotosAlbumVideos,
  importGooglePhotosVideos,
} from '../services/api';
import type { GooglePhotosAlbum, GooglePhotosVideo } from '../types/api';
import './GooglePhotosImport.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'idle' | 'connecting' | 'albums' | 'videos' | 'importing' | 'done' | 'error';

interface Props {
  /** Called after a successful import so the library list can be refreshed. */
  onImportComplete: () => void;
  /** Called to close the panel. */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GooglePhotosImport({ onImportComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  const [albums, setAlbums] = useState<GooglePhotosAlbum[]>([]);
  const [albumVideos, setAlbumVideos] = useState<GooglePhotosVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());

  const [importedCount, setImportedCount] = useState(0);

  // Check initial connection status on mount
  useEffect(() => {
    getGooglePhotosStatus()
      .then((status) => {
        if (status.connected) {
          setAccountEmail(status.account_email);
          setStep('albums');
          return listGooglePhotosAlbums();
        }
        return null;
      })
      .then((fetchedAlbums) => {
        if (fetchedAlbums) setAlbums(fetchedAlbums);
      })
      .catch(() => {
        // Not connected — stay on idle
      });
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleConnect() {
    setStep('connecting');
    setErrorMsg(null);
    try {
      const status = await connectGooglePhotos();
      setAccountEmail(status.account_email);
      const fetchedAlbums = await listGooglePhotosAlbums();
      setAlbums(fetchedAlbums);
      setStep('albums');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
      setStep('error');
    }
  }

  async function handleSelectAlbum(albumId: string) {
    setSelectedVideoIds(new Set());
    setStep('videos');
    try {
      const videos = await listGooglePhotosAlbumVideos(albumId);
      setAlbumVideos(videos);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load videos');
      setStep('error');
    }
  }

  function handleToggleVideo(videoId: string) {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedVideoIds.size === albumVideos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(albumVideos.map((v) => v.id)));
    }
  }

  async function handleImport() {
    if (selectedVideoIds.size === 0) return;
    setStep('importing');
    try {
      const job = await importGooglePhotosVideos({
        video_ids: Array.from(selectedVideoIds),
      });
      setImportedCount(job.items?.videos?.length ?? 0);
      setStep('done');
      onImportComplete();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed');
      setStep('error');
    }
  }

  async function handleDisconnect() {
    await disconnectGooglePhotos().catch(() => {});
    setAccountEmail(null);
    setAlbums([]);
    setAlbumVideos([]);
    setSelectedVideoIds(new Set());
    setStep('idle');
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="gp-backdrop" onClick={onClose}>
      <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gp-modal__header">
          <h3 className="gp-modal__title">
            <span className="gp-icon">📸</span> Google Photos
          </h3>
          <button className="gp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Idle / Connect ── */}
        {step === 'idle' && (
          <div className="gp-body">
            <p className="gp-desc">
              Connect your Google Photos account to import golf swing videos directly
              into your library.
            </p>
            <p className="gp-note">
              ℹ️ This is a <strong>demo integration</strong> — no real Google account is
              required. Clicking Connect will show a curated set of sample videos.
            </p>
            <button className="btn btn--primary gp-connect-btn" onClick={handleConnect}>
              Connect Google Photos
            </button>
          </div>
        )}

        {/* ── Connecting spinner ── */}
        {step === 'connecting' && (
          <div className="gp-body gp-body--centered">
            <div className="gp-spinner" />
            <p>Connecting…</p>
          </div>
        )}

        {/* ── Album list ── */}
        {step === 'albums' && (
          <div className="gp-body">
            <div className="gp-account-bar">
              <span className="gp-account-email">{accountEmail}</span>
              <button className="btn btn--sm btn--secondary" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
            <p className="gp-section-label">Select an album:</p>
            <ul className="gp-album-list">
              {albums.map((album) => (
                <li key={album.id} className="gp-album-item">
                  <button
                    className="gp-album-btn"
                    onClick={() => handleSelectAlbum(album.id)}
                  >
                    <span className="gp-album-title">📁 {album.title}</span>
                    <span className="gp-album-count">{album.video_count} videos</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Video selection ── */}
        {step === 'videos' && (
          <div className="gp-body">
            <button
              className="btn btn--sm btn--secondary gp-back-btn"
              onClick={() => { setStep('albums'); setAlbumVideos([]); }}
            >
              ← Back to albums
            </button>
            <div className="gp-select-bar">
              <p className="gp-section-label">
                {albumVideos.length > 0
                  ? `${selectedVideoIds.size} of ${albumVideos.length} selected`
                  : 'Loading videos…'}
              </p>
              {albumVideos.length > 0 && (
                <button className="btn btn--sm btn--secondary" onClick={handleSelectAll}>
                  {selectedVideoIds.size === albumVideos.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            <ul className="gp-video-list">
              {albumVideos.map((video) => (
                <li key={video.id} className="gp-video-item">
                  <label className="gp-video-label">
                    <input
                      type="checkbox"
                      checked={selectedVideoIds.has(video.id)}
                      onChange={() => handleToggleVideo(video.id)}
                    />
                    <span className="gp-video-filename">{video.filename}</span>
                    <span className="gp-video-meta">
                      {video.width}×{video.height} · {Math.round(video.duration)}s
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="gp-actions">
              <button
                className="btn btn--primary"
                disabled={selectedVideoIds.size === 0}
                onClick={handleImport}
              >
                Import {selectedVideoIds.size > 0 ? `${selectedVideoIds.size} video${selectedVideoIds.size > 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </div>
        )}

        {/* ── Importing spinner ── */}
        {step === 'importing' && (
          <div className="gp-body gp-body--centered">
            <div className="gp-spinner" />
            <p>Importing videos…</p>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'done' && (
          <div className="gp-body gp-body--centered">
            <div className="gp-success-icon">✅</div>
            <p className="gp-success-msg">
              {importedCount} video{importedCount !== 1 ? 's' : ''} imported to your library!
            </p>
            <p className="gp-note">
              Note: These are demo placeholders — video playback is not available for
              mock imports.
            </p>
            <div className="gp-actions">
              <button className="btn btn--primary" onClick={onClose}>
                View Library
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => {
                  setStep('albums');
                  setAlbumVideos([]);
                  setSelectedVideoIds(new Set());
                }}
              >
                Import More
              </button>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <div className="gp-body gp-body--centered">
            <p className="gp-error-msg">⚠️ {errorMsg}</p>
            <button className="btn btn--secondary" onClick={() => setStep('idle')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
