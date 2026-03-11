# Phase 2 Bug Fix Plan — 2026-03-11

## Overview

Four bugs identified in the Phase 2 MVP implementation. All fixes are concentrated in the frontend. No backend schema or migration changes are required.

---

## Bug 1: Analyze View State Not Persisting on Navigation

### Symptoms

- Navigating away from Analyze (to Library or Sessions) and back loses sync state, playback speed, loop selection, and mode.
- Videos reload correctly but trim handles behave incorrectly (Out handle extends beyond the right edge of the scrub bar).
- "No video loaded" placeholder appears for both channels despite videos being loaded and playable.

### Root Causes

**A — Component unmount on navigation:** `App.tsx` uses conditional rendering (`view === "analyze" && ...`), which unmounts `DualVideoSynchronizer` on navigation. Only Zustand store state survives; all local React state (`mode`, `syncOffset`, `syncPoints`, `playbackRateBoth`, `isLooping`, `sliderValues`, `playheadState`) is lost.

**B — Annotations cleared on every decoder-ready transition:** Two `useEffect` hooks in `DualVideoSynchronizer` call `clearAllA()` / `clearAllB()` whenever `videoA.isReady` or `videoB.isReady` becomes `true`. This fires unconditionally — on new uploads (correct) and on remount (incorrect, wiping restored or existing annotations).

**C — "No video loaded" message:** A direct consequence of the unmount/remount cycle. `videoA.isReady` is momentarily `false` on remount before the decoder re-initializes, causing the placeholder branch to render.

**D — Out trim handle beyond right edge:** In `TrimScrubBar.tsx`, the Out handle uses `left: trimEndPct` with `transform: translate(-50%, -50%)`. When `trimEnd == range.max` (100%), the right half of the handle extends outside the track container. Pure CSS positioning issue.

### Proposed Fixes

| Fix | File | Risk |
|-----|------|------|
| Replace conditional rendering with always-mounted + `display: none` | `App.tsx` | Low |
| Move `clearAllA/clearAllB` calls into `handleVideoAUploadComplete` / `handleVideoBUploadComplete`; remove the `isReady` `useEffect` blocks | `DualVideoSynchronizer.tsx` | Low |
| Add `clearAnnotationsA`/`clearAnnotationsB` calls in `handleLoad` when loading a library video into slot A/B (the `isReady` effects previously handled this path; removing them would leave library-loaded annotations uncleared) | `LibraryView.tsx` | Low |
| Clamp Out handle position: add `overflow: hidden` to track container | `TrimScrubBar.tsx` | Low |

---

## Bug 2: Save Analysis Fails with HTTP 500

### Symptom

Clicking "Save Session" results in a 500 response from `POST /api/sessions`.

### Root Cause

`buildSessionPayload` in `sessionStore.ts` reads `videoA?.metadata?.video_id` to populate `video_a_id` in the session create payload. For directly uploaded videos, this value is the upload-session-scoped UUID from `/api/upload` — **not** a `library_videos.id`. The `analysis_sessions.video_a_id` column carries an FK constraint to `library_videos.id`, so inserting an unrecognised UUID causes a constraint violation (500).

The gap: `AddToLibraryPanel` calls `addVideo(payload)` which creates the `LibraryVideo` record and returns a new `id`, but **never writes that new library UUID back to `videoStore`**. Subsequent save operations therefore use the stale upload UUID.

For library-loaded videos (session restore or Library "Load to Analyze"), `metadata.video_id` is correctly set to `meta.id` (the `library_videos.id`), so saves work correctly in those paths.

### Proposed Fix

| Fix | File | Risk |
|-----|------|------|
| After `await addVideo(payload)` succeeds, call `setVideoA` / `setVideoB` (from `useVideoStore`) to update the slot's `video_id` to the returned library UUID | `AddToLibraryPanel.tsx` | Low |

---

## Bug 3: Annotation Issues — Angle Measurement and Text Label

### Symptoms

- Angle measurement tool does not render visually as it is being drawn.
- Angle value badge is not clearly visible on finalised annotations.
- Text label annotations are too small.
- Text label content is not editable after creation.
- Angle annotation cannot be reshaped after creation (control points absent); the displayed angle value therefore cannot be adjusted.

### Root Causes

| Issue | Root Cause | Location |
|-------|-----------|----------|
| No live preview while drawing angle | No `angle-active` preview block in JSX; only `drag-drawing` and `polyline-active` are handled | `DualVideoSynchronizer.tsx` |
| Angle value badge hard to see | `fontSize={14}`, same hue as stroke, no background; position clipped near top/left edges | `DualVideoSynchronizer.tsx` |
| Text label too small | Fixed `fontSize={18}`, no scale-aware sizing | `DualVideoSynchronizer.tsx` |
| Text not editable | Constructed via `window.prompt()` at creation only; no double-click re-edit path | `DualVideoSynchronizer.tsx`, `useVideoAnnotations.ts` |
| Angle not reshapable | No control point rendering for `"angle"` type in the `isSelected` block | `DualVideoSynchronizer.tsx` |

### Proposed Fixes

| Fix | File | Risk |
|-----|------|------|
| Add `angle-active` live-preview: render arm-1 from vertex to mouse cursor after first click; render both arms with rubber-band arm-2 after second click (reuse `polylineMousePos` cursor tracking) | `DualVideoSynchronizer.tsx` | Low |
| Increase angle label `fontSize` to 16–18px; render a semi-transparent white `Rect` background behind the label; clamp label position to stay within canvas bounds | `DualVideoSynchronizer.tsx` | Low |
| Increase text annotation `fontSize` from 18 to 20px | `DualVideoSynchronizer.tsx` | Low |
| Add `onDblClick` handler to `KonvaText` annotations that opens `window.prompt()` pre-populated with current text and updates the annotation in the manager | `DualVideoSynchronizer.tsx`, `useVideoAnnotations.ts` | Medium |
| Add three control points (vertex, arm-1 end, arm-2 end) to the `"angle"` `isSelected` rendering block, following the existing arrow/oval control-point pattern; wire to the existing `handleControlPointMouseDown` handler so the angle value updates reactively as points are repositioned | `DualVideoSynchronizer.tsx` | Medium |

---

## Bug 4: Annotations Not Restored When Loading a Saved Session

### Symptom

When a session is loaded via the Sessions view, `restoreSessionState` writes the annotation arrays to `annotationStore` (`setAnnotationsA`, `setAnnotationsB`). However, the rendered annotations are empty — the loaded annotations do not appear on the canvas.

### Root Cause

`useVideoAnnotations` maintains its own internal React state (`annotations`) and an `AnnotationManager` instance. These are **not seeded from `annotationStore`** on mount. The hook only writes *to* the store (via the sync `useEffect` in `DualVideoSynchronizer` that watches `annotationsA`/`annotationsB`). There is no path from the store back into the hook's internal state or the manager's annotation list.

Combined with Bug 1's unmount issue (navigation clears the hook state via remount), session annotations are doubly lost:
1. The hook state is populated from the store only if the component is remounted — but there is no such hydration path.
2. The `clearAllA/clearAllB` `useEffect` fires on `isReady` before any restore can take effect.

### Proposed Fix

| Fix | File | Risk |
|-----|------|------|
| After `restoreSessionState` loads annotations into the store, also call the annotation hook's local `setAnnotations` / manager via a new exported setter, **or** return a one-time hydration signal from the session store that `DualVideoSynchronizer` uses to seed the hook manager directly after video load completes | `sessionStore.ts`, `DualVideoSynchronizer.tsx`, `useVideoAnnotations.ts` | Medium |

The cleanest approach: expose a `hydrateAnnotations(annotations: Annotation[])` function from `useVideoAnnotations` that loads annotations directly into the manager and local state. `DualVideoSynchronizer` calls this function after each video becomes ready, reading from `annotationStore` only on the first load-after-session-restore (gated by the `activeSessionId` in session store). This is unambiguous and does not require any store subscription in the hook.

> **Note:** With the `display: none` fix from Bug 1, normal navigation will no longer unmount the component, so this bug surface is reduced to the specific case of loading a saved session for the first time. Both fixes should be implemented together.

---

## Summary

| Bug | Primary Files | Max Risk |
|-----|--------------|----------|
| 1 — View state + trim + no-video | `App.tsx`, `DualVideoSynchronizer.tsx`, `TrimScrubBar.tsx` | Low |
| 2 — Save session 500 | `AddToLibraryPanel.tsx` | Low |
| 3 — Angle/text annotation UX | `DualVideoSynchronizer.tsx`, `useVideoAnnotations.ts` | Medium |
| 4 — Session annotation restore | `sessionStore.ts`, `DualVideoSynchronizer.tsx`, `useVideoAnnotations.ts` | Medium |
