/**
 * AddToLibraryPanel – Save currently uploaded videos to the library.
 *
 * Shown above the Analyze view when at least one video slot is populated.
 * Allows users to save Video A and/or Video B to the persistent library with
 * optional metadata.
 *
 * Phase 2, Task 2.7 (Video Library Frontend Workflows)
 * Validates: REQ-P2-LIB-001
 */

import { useState } from "react";
import { useVideoStore } from "../store/videoStore";
import { useLibraryStore } from "../store/libraryStore";
import type { LibraryVideoCreate } from "../types/api";
import "./LibraryView.css"; // Reuse shared button + modal styles

type Slot = "A" | "B";

interface SaveFormState {
  golferName: string;
  club: string;
  swingDate: string;
  notes: string;
  qualityScore: number | "";
}

const emptyForm = (): SaveFormState => ({
  golferName: "",
  club: "",
  swingDate: "",
  notes: "",
  qualityScore: "",
});

export function AddToLibraryPanel() {
  const { videoA, videoB } = useVideoStore();
  const { addVideo } = useLibraryStore();

  const [savingSlot, setSavingSlot] = useState<Slot | null>(null);
  const [formState, setFormState] = useState<SaveFormState>(emptyForm());
  const [savedSlots, setSavedSlots] = useState<Set<Slot>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Only show when at least one slot has a video
  if (!videoA && !videoB) return null;

  function openSave(slot: Slot) {
    setSavingSlot(slot);
    setFormState(emptyForm());
    setError(null);
  }

  function closeSave() {
    setSavingSlot(null);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const video = savingSlot === "A" ? videoA : videoB;
    if (!video?.metadata) return;

    const payload: LibraryVideoCreate = {
      video_id: video.metadata.video_id,
      golfer_name: formState.golferName.trim() || null,
      club: formState.club.trim() || null,
      swing_date: formState.swingDate || null,
      notes: formState.notes.trim() || null,
      quality_score: formState.qualityScore === "" ? null : Number(formState.qualityScore),
    };

    try {
      await addVideo(payload);
      setSavedSlots((prev) => new Set(prev).add(savingSlot!));
      closeSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save to library");
    }
  }

  return (
    <div className="add-to-library-panel">
      <span className="add-to-library-panel__label">Save to Library:</span>
      {videoA && (
        <button
          className={`btn btn--sm ${savedSlots.has("A") ? "btn--secondary" : "btn--primary"}`}
          onClick={() => openSave("A")}
        >
          {savedSlots.has("A") ? "✓ Video A saved" : "＋ Video A"}
        </button>
      )}
      {videoB && (
        <button
          className={`btn btn--sm ${savedSlots.has("B") ? "btn--secondary" : "btn--primary"}`}
          onClick={() => openSave("B")}
        >
          {savedSlots.has("B") ? "✓ Video B saved" : "＋ Video B"}
        </button>
      )}

      {/* Save modal */}
      {savingSlot && (
        <div className="library-modal-backdrop" onClick={closeSave}>
          <div className="library-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="library-modal__title">Save Video {savingSlot} to Library</h3>
            <p className="library-modal__subtitle">
              {(savingSlot === "A" ? videoA : videoB)?.metadata?.filename}
            </p>
            {error && (
              <p style={{ color: "#fc8181", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
                {error}
              </p>
            )}
            <form onSubmit={handleSave} className="library-modal__form">
              <label className="library-modal__label">
                Golfer name
                <input
                  type="text"
                  value={formState.golferName}
                  maxLength={100}
                  onChange={(e) =>
                    setFormState((f) => ({ ...f, golferName: e.target.value }))
                  }
                  className="library-modal__input"
                />
              </label>
              <label className="library-modal__label">
                Club
                <input
                  type="text"
                  value={formState.club}
                  maxLength={100}
                  onChange={(e) => setFormState((f) => ({ ...f, club: e.target.value }))}
                  className="library-modal__input"
                />
              </label>
              <label className="library-modal__label">
                Swing date
                <input
                  type="date"
                  value={formState.swingDate}
                  onChange={(e) =>
                    setFormState((f) => ({ ...f, swingDate: e.target.value }))
                  }
                  className="library-modal__input"
                />
              </label>
              <label className="library-modal__label">
                Notes
                <textarea
                  value={formState.notes}
                  onChange={(e) => setFormState((f) => ({ ...f, notes: e.target.value }))}
                  className="library-modal__textarea"
                  rows={2}
                />
              </label>
              <label className="library-modal__label">
                Quality score (1–10)
                <input
                  type="number"
                  value={formState.qualityScore}
                  min={1}
                  max={10}
                  onChange={(e) =>
                    setFormState((f) => ({
                      ...f,
                      qualityScore: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="library-modal__input library-modal__input--short"
                />
              </label>
              <div className="library-modal__actions">
                <button type="button" className="btn btn--secondary" onClick={closeSave}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  Save to Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
