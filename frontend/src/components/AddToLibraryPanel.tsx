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

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useVideoStore } from "../store/videoStore";
import { useLibraryStore } from "../store/libraryStore";
import type { LibraryVideoCreate } from "../types/api";
import "./LibraryView.css"; // Reuse shared button + modal styles

type Slot = "A" | "B";

interface AddToLibraryPanelProps {
  children?: ReactNode;
  highlightUnsaved?: boolean;
}

interface SaveFormState {
  golferName: string;
  club: string;
  swingDate: string;
  notes: string;
  qualityScore: number | "";
  cameraView: string;
}

const emptyForm = (): SaveFormState => ({
  golferName: "",
  club: "",
  swingDate: "",
  notes: "",
  qualityScore: "",
  cameraView: "",
});

export function AddToLibraryPanel({ children, highlightUnsaved = false }: AddToLibraryPanelProps) {
  const { videoA, videoB, setVideoA, setVideoB } = useVideoStore();
  const { addVideo, videos } = useLibraryStore();

  const [savingSlot, setSavingSlot] = useState<Slot | null>(null);
  const [formState, setFormState] = useState<SaveFormState>(emptyForm());
  const [savedSlots, setSavedSlots] = useState<Set<Slot>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Refs to track previous video IDs for change detection
  const prevVideoAIdRef = useRef<string | null>(null);
  const prevVideoBIdRef = useRef<string | null>(null);

  // Derive saved state from library membership - handles both initial load
  // from library and component remount scenarios
  useEffect(() => {
    const newSavedSlots = new Set<Slot>();
    
    // Check if video IDs are in the library videos array
    if (videoA?.metadata?.video_id && videos.some(v => v.id === videoA.metadata.video_id)) {
      newSavedSlots.add("A");
    }
    
    if (videoB?.metadata?.video_id && videos.some(v => v.id === videoB.metadata.video_id)) {
      newSavedSlots.add("B");
    }
    
    setSavedSlots(newSavedSlots);
  }, [videoA, videoB, videos]);

  // Detect video changes and reset saved state when a genuinely new video is uploaded
  // to the same channel.  Skip clearing when the ID change is a save-to-library
  // transition (new ID already exists in the library array).
  useEffect(() => {
    const currentVideoAId = videoA?.metadata?.video_id ?? null;
    const currentVideoBId = videoB?.metadata?.video_id ?? null;

    // Check if video A has changed (new upload)
    // Only process if prevVideoAIdRef has been initialized (not initial mount)
    if (prevVideoAIdRef.current !== null && currentVideoAId !== prevVideoAIdRef.current) {
      const isNowInLibrary = currentVideoAId !== null && videos.some(v => v.id === currentVideoAId);
      if (!isNowInLibrary) {
        // Video A changed to a new upload — remove from saved slots to allow re-saving
        setSavedSlots(prev => {
          const newSet = new Set(prev);
          newSet.delete("A");
          return newSet;
        });
      }
    }
    prevVideoAIdRef.current = currentVideoAId;

    // Check if video B has changed (new upload)
    // Only process if prevVideoBIdRef has been initialized (not initial mount)
    if (prevVideoBIdRef.current !== null && currentVideoBId !== prevVideoBIdRef.current) {
      const isNowInLibrary = currentVideoBId !== null && videos.some(v => v.id === currentVideoBId);
      if (!isNowInLibrary) {
        // Video B changed to a new upload — remove from saved slots to allow re-saving
        setSavedSlots(prev => {
          const newSet = new Set(prev);
          newSet.delete("B");
          return newSet;
        });
      }
    }
    prevVideoBIdRef.current = currentVideoBId;
  }, [videoA?.metadata?.video_id, videoB?.metadata?.video_id, videos]);

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
      camera_view: formState.cameraView || null,
    };

    try {
      const libraryVideo = await addVideo(payload);
      // Update the metadata.video_id in videoStore to the library_videos.id so
      // that subsequent session saves use the correct FK value.
      if (savingSlot === "A" && videoA?.metadata) {
        setVideoA({ ...videoA, metadata: { ...videoA.metadata, video_id: libraryVideo.id } });
      } else if (savingSlot === "B" && videoB?.metadata) {
        setVideoB({ ...videoB, metadata: { ...videoB.metadata, video_id: libraryVideo.id } });
      }
      // Update savedSlots immediately to disable the button
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
          className={`btn btn--sm ${savedSlots.has("A") ? "btn--secondary" : "btn--primary"} ${highlightUnsaved && !savedSlots.has("A") ? "btn--highlight" : ""}`}
          onClick={() => openSave("A")}
          disabled={savedSlots.has("A")}
          title={savedSlots.has("A") ? "Video A is already in library" : "Save Video A to library"}
        >
          {savedSlots.has("A") ? "✓ Video A saved" : "＋ Video A"}
        </button>
      )}
      {videoB && (
        <button
          className={`btn btn--sm ${savedSlots.has("B") ? "btn--secondary" : "btn--primary"} ${highlightUnsaved && !savedSlots.has("B") ? "btn--highlight" : ""}`}
          onClick={() => openSave("B")}
          disabled={savedSlots.has("B")}
          title={savedSlots.has("B") ? "Video B is already in library" : "Save Video B to library"}
        >
          {savedSlots.has("B") ? "✓ Video B saved" : "＋ Video B"}
        </button>
      )}

      {/* Extra toolbar content passed by parent (e.g. SaveSessionPanel) */}
      {children}

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
              <label className="library-modal__label">
                Camera view
                <select
                  value={formState.cameraView}
                  onChange={(e) =>
                    setFormState((f) => ({ ...f, cameraView: e.target.value }))
                  }
                  className="library-modal__input"
                >
                  <option value="">— Select —</option>
                  <option value="DTL">DTL (Down The Line)</option>
                  <option value="FO">FO (Face On)</option>
                  <option value="Other">Other</option>
                </select>
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
