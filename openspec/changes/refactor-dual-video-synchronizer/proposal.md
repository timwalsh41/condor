# Refactor DualVideoSynchronizer

## Why

`DualVideoSynchronizer.tsx` has grown to 3,536 lines as a single monolithic component that owns ~130 `useEffect` hooks, 50+ event handlers, and manages state across 6 Zustand stores plus local `useState`/`useRef`. This creates two critical problems:

1. **Brittle state management**: Annotation state flows bidirectionally between hook-local React state and the `annotationStore`, requiring a tangle of guards (`hydratedSessionIdRef`, `isHydratingSession`, `isSavingToLibrary`) to prevent race conditions during session restore. Playhead state and sync offset exist in 3 places each (local state, refs, and stores). This is the root cause of the bugs and edge cases the user has encountered around saving/loading state across library and session storage workflows.

2. **Untestable monolith**: 8 of 28 component-level unit tests are placeholders (`expect(true).toBe(true)`). The sheer size of the component makes it difficult to write isolated tests. The duplicate rendering code for Video A and Video B (~600 lines each) cannot be tested independently.

This refactor addresses the root cause, not just the symptoms.

## What Changes

### Structural Changes
- **Extract 6 new files** from `DualVideoSynchronizer.tsx`:
  - `VideoPanel.tsx` — per-video wrapper (layout, decoder integration, canvas mounting)
  - `VideoCanvas.tsx` — Konva rendering pipeline (annotations, drawing previews, control points)
  - `VideoControls.tsx` — SYNC mode controls (scrub bar, step buttons, speed select)
  - `PlaybackControls.tsx` — PLAYBACK mode controls (trim bar, joint playback, stepping)
  - `AnnotationToolbar.tsx` — shared tool selection + undo/redo/clear
  - `useVideoControls.ts` — extracted video control hook (play/pause/step/scrub)
- **Reduce `DualVideoSynchronizer.tsx`** from 3,536 lines to ~200-250 lines (orchestrator pattern)
- **No behavioral changes** — all user-visible functionality, DOM structure, and `data-testid` attributes are preserved

### State Management Changes (BREAKING for internal APIs)
- **Annotation state**: `useVideoAnnotations` reads annotations from `annotationStore` (store is single source of truth). The `hydrateAnnotations()` method and `hydratedSessionIdRef` guards are removed entirely. Sync-back `useEffect` hooks are removed.
- **Playhead state**: `playbackStore` owns `PlayheadState` authoritatively. Local `useState` in the component is eliminated. `playbackLoopBoth` reads from `getState()` instead of `playheadStateRef`.
- **Sync offset**: Consolidated into `playbackStore.playheadState.syncOffset`. `syncStore.temporalOffset` is removed (clean break). Local `useState` for sync offset is removed.
- **`useVideoAnnotations` interface change**: Removes `hydrateAnnotations()` from return type. All annotation operations write directly to the store.

### Testing Changes
- **Replace 8 placeholder tests** in `DualVideoSynchronizer.test.tsx` with real assertions
- **Create 5 new test files** (~80-120 tests): `VideoPanel.test.tsx`, `VideoCanvas.test.tsx`, `VideoControls.test.tsx`, `PlaybackControls.test.tsx`, `AnnotationToolbar.test.tsx`
- **Update `useVideoControls.test.ts`** (new file, ~15 tests for extracted hook)
- **Update `useVideoAnnotations.test.ts`** — add store subscription tests, remove `hydrateAnnotations` tests
- **Update `DualVideoSynchronizer.test.tsx`** — replace `hydrateAnnotations` mock assertions with store-backed assertions
- **Update store tests** — `playbackStore.test.ts` gains PlayheadState assertions; `syncStore.test.ts` removes `temporalOffset` references

## Capabilities

### Modified Capabilities
- No spec-level behavioral changes. All existing requirements are preserved.

## Impact

### Files Modified
- `frontend/src/components/DualVideoSynchronizer.tsx` — reduced to orchestrator
- `frontend/src/store/playbackStore.ts` — gains PlayheadState ownership
- `frontend/src/store/syncStore.ts` — removes `temporalOffset`
- `frontend/src/hooks/useVideoAnnotations.ts` — store-backed annotations, removes `hydrateAnnotations`
- `frontend/src/hooks/tests/useVideoAnnotations.test.ts` — updated
- `frontend/src/store/tests/playbackStore.test.ts` — updated
- `frontend/src/store/tests/syncStore.test.ts` — updated
- `frontend/src/components/tests/DualVideoSynchronizer.test.tsx` — updated

### Files Created
- `frontend/src/components/VideoPanel.tsx`
- `frontend/src/components/VideoCanvas.tsx`
- `frontend/src/components/VideoControls.tsx`
- `frontend/src/components/PlaybackControls.tsx`
- `frontend/src/components/AnnotationToolbar.tsx`
- `frontend/src/hooks/useVideoControls.ts`
- `frontend/src/components/tests/VideoPanel.test.tsx`
- `frontend/src/components/tests/VideoCanvas.test.tsx`
- `frontend/src/components/tests/VideoControls.test.tsx`
- `frontend/src/components/tests/PlaybackControls.test.tsx`
- `frontend/src/components/tests/AnnotationToolbar.test.tsx`
- `frontend/src/hooks/tests/useVideoControls.test.ts`

### Files Changed — Documentation
- `docs/SYSTEM_ARCHITECTURE.md` — updated component architecture table, state management description
- `docs/FRONTEND_DESIGN.md` — updated PlantUML diagrams, module architecture, state contracts, testing strategy
- `docs/BACKEND_DESIGN.md` — reviewed, no changes needed (backend unchanged)

### Files Unchanged
- All Playwright integration tests (8 files, ~70 tests) — DOM structure and `data-testid` preserved
- `useWebCodecsDecoder.ts` — untouched
- `dualVideoPlayback.ts` — pure functions unchanged
- `VideoUploadWorkflow.tsx` — untouched
- `TrimScrubBar.tsx` — untouched

### External Impact
- **None** — this is a frontend-only refactor. No API changes, no backend changes, no dependency changes.
- All `data-testid` attributes preserved for Playwright E2E compatibility.
