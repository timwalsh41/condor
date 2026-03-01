/**
 * SaveSessionPanel – Save current Analyze view state as a named session.
 *
 * Shown in the Analyze view toolbar when at least one video is loaded.
 * Provides a modal to enter session name and notes before saving.
 *
 * Phase 2, Task 2.9 (Session Persistence Frontend Workflows)
 * Validates: REQ-P2-SESS-001
 */

import { useState } from 'react';
import { useVideoStore } from '../store/videoStore';
import { useSessionStore } from '../store/sessionStore';
import './LibraryView.css'; // Shared button / modal styles

export function SaveSessionPanel() {
  const { videoA, videoB } = useVideoStore();
  const { saveSession } = useSessionStore();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Only show when at least one video is loaded
  if (!videoA && !videoB) return null;

  function openModal() {
    setName('');
    setNotes('');
    setError(null);
    setSaved(false);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveSession(name.trim(), notes.trim() || undefined);
      setSaved(true);
      setTimeout(() => setOpen(false), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn btn--sm btn--secondary" onClick={openModal}>
        💾 Save Session
      </button>

      {open && (
        <div className="library-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="library-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="library-modal__title">Save Analysis Session</h3>
            <p className="library-modal__subtitle">
              Current sync points, annotations, and video references will be saved.
            </p>
            {error && (
              <p style={{ color: '#fc8181', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
                {error}
              </p>
            )}
            {saved ? (
              <p style={{ color: '#68d391', textAlign: 'center', padding: '1rem 0' }}>
                ✓ Session saved!
              </p>
            ) : (
              <form onSubmit={handleSave} className="library-modal__form">
                <label className="library-modal__label">
                  Session name *
                  <input
                    type="text"
                    value={name}
                    maxLength={200}
                    required
                    autoFocus
                    onChange={(e) => setName(e.target.value)}
                    className="library-modal__input"
                    placeholder="e.g. Driver practice 2024-06-01"
                  />
                </label>
                <label className="library-modal__label">
                  Notes
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="library-modal__textarea"
                    rows={2}
                    placeholder="Optional notes…"
                  />
                </label>
                <div className="library-modal__actions">
                  <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={saving || !name.trim()}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
