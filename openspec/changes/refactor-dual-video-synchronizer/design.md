# Design: Refactor DualVideoSynchronizer

## Context

`DualVideoSynchronizer.tsx` is a 3,536-line monolithic React component that coordinates:
- Two video decoders (WebCodecs-based, via `useWebCodecsDecoder` hook)
- Dual-video synchronization (SYNC mode) and playback (PLAYBACK mode)
- Konva-based annotation rendering per video (7 annotation types)
- Session save/load lifecycle across 6 Zustand stores
- Keyboard shortcuts, trim bounds, loop mode, speed control

### Current State Problems

1. **State fragmentation**: Playhead state exists in 3 places (local `useState`, `useRef`, `playbackStore`). Sync offset exists in 3 places (local `useState`, `syncStore.temporalOffset`, `playheadState.syncOffset`). No single source of truth.

2. **Bidirectional annotation sync**: `useVideoAnnotations` owns annotation state locally and syncs to `annotationStore` via a `useEffect`. On session restore, `restoreSessionState()` writes to the store, and the component must then hydrate the hook — but the sync-back effect races with hydration. This is solved with `hydratedSessionIdRef`, `isHydratingSession`, and `isSavingToLibrary` guards that are fragile and hard to reason about.

3. **Handler duplication**: ~50 event handlers duplicated for Video A and Video B (play/pause, step ±1/±5, scrub, speed). Konva rendering JSX duplicated (~600 lines per video).

4. **Effect count**: ~130 `useEffect` hooks in a single component. The video-change detection effect has 6 dependencies and 4 early-return guards.

5. **Untestable**: 8 placeholder unit tests. The monolith structure makes isolated testing impractical.

### Existing Architecture (Stores)

```
sessionStore (orchestrator) ── reads/writes all other stores via getState()
├── videoStore (leaf) — metadata + blob
├── annotationStore (leaf) — annotation arrays per channel
├── syncStore (config) — mode, syncPoints, temporalOffset
├── playbackStore (runtime) — playhead, rate, loop, sliders
└── trimStore (leaf) — trimStart, trimEnd
```

The `sessionStore` is the orchestrator for persistence. The component is the orchestrator for rendering and interaction. The problem is that the component orchestrates *state synchronization* across stores and local state, not just rendering.

## Goals / Non-Goals

**Goals:**
- Eliminate bidirectional annotation sync by making `annotationStore` the single source of truth
- Consolidate playhead state ownership into `playbackStore`
- Extract the monolith into 5 focused components + 1 extracted hook
- Replace placeholder tests with real assertions (8 → ~20+)
- Create isolated test files for each extracted component (~80-120 new tests)
- Preserve all `data-testid` attributes for Playwright E2E compatibility
- Eliminate duplicate handler code via `useVideoControls` hook

**Non-Goals:**
- No behavioral changes — all user-visible functionality is preserved
- No new features (e.g., frame snapshot capture mentioned by user is out of scope)
- No Playwright integration test changes (DOM structure preserved)
- No backend API changes or backend changes
- No dependency changes
- No Workflow 5 (load → modify → re-save) integration tests (deferred)

## Decisions

### Decision 1: Store as Single Source of Truth for Annotations

**Choice**: `useVideoAnnotations` reads annotations from `annotationStore`. Ephemeral UI state (drawing, selection, reshaping) stays local in the hook. New annotations are written directly to the store.

**Why**: Eliminates the race condition at its root. No more sync-back effects, no more `hydratedSessionIdRef` guards. Session restore works because `restoreSessionState()` writes to the store → hook re-renders with new data.

**Alternatives considered**:
- *Keep local + use store reducers*: More Redux-like, keeps hydration logic centralized. But adds unnecessary complexity — Zustand updates are already synchronous and batched.
- *Keep bidirectional + add immutability*: Less architectural change. But the race condition is inherent to the pattern, not the implementation.

### Decision 2: playbackStore Owns PlayheadState

**Choice**: `playbackStore.playheadState` is the authoritative source. Local `useState` is eliminated. The `playbackLoopBoth` callback reads from `getState()`.

**Why**: `playbackStore` already stores `PlayheadState` but the component ignores it. The `playheadStateRef` workaround is a well-known React anti-pattern that causes stale closure bugs. One owner eliminates the problem.

**Alternatives considered**:
- *Local state owns runtime, store owns persisted*: Keeps current pattern but adds a reconcile effect. More moving parts = more bugs.
- *New dedicated hook (usePlayheadController)*: Self-contained. But Zustand is already used for all other state. Adding another pattern adds complexity.

### Decision 3: Clean Break on `syncStore.temporalOffset`

**Choice**: Remove `temporalOffset` from `syncStore`. Sync offset is fully represented by `playbackStore.playheadState.syncOffset`.

**Why**: Three sources for the same value is the problem. `temporalOffset` was created before `playheadStore` existed. Now that playhead owns it, `temporalOffset` is dead code.

**Alternatives considered**:
- *Deprecation layer*: Keep `temporalOffset` as a computed alias. But this perpetuates the duplication and adds unnecessary getters.

### Decision 4: Extract VideoPanel + VideoCanvas (Not Single VideoComponent)

**Choice**: Two components — `VideoPanel` (layout + decoder integration) and `VideoCanvas` (Konva rendering).

**Why**: The Konva rendering is ~600 lines and contains all 7 annotation type renderers, control points, and drawing previews. It's complex enough to warrant its own component with its own test file. `VideoPanel` is simpler — just layout, decoder refs, and canvas mounting.

**Alternatives considered**:
- *Single VideoComponent*: Simpler file structure. But the Konva rendering is too complex to test in isolation.
- *VideoWrapper + VideoCanvas + VideoControls*: Three components per channel. Over-engineering — `VideoControls` is SYNC-mode-only and shared across channels, not per-channel.

### Decision 5: `useVideoControls` Hook for SYNC Mode

**Choice**: Extract play/pause, step ±1/±5, scrub, and speed into a reusable hook.

**Why**: Eliminates ~50 lines of duplicated handler code per video. Each handler is identical except for which video decoder it operates on. A hook parameterized by decoder eliminates the duplication.

**Alternatives considered**:
- *Inline extraction (just extract to a function)*: Doesn't capture the dependency on `videoA`/`videoB` refs properly. A hook is the right abstraction.

## Risks / Trade-offs

### Risk 1: Hook subscription timing during session restore

**Risk**: When `useVideoAnnotations` subscribes to `annotationStore` instead of managing local state, there's a brief moment during session restore where the hook renders empty annotations before the store is populated.

**Mitigation**: The `restoreSessionState()` function in `sessionStore` already populates the store synchronously (before `activeSessionId` is set). The component's `activeSessionId` state triggers re-render with data already in the store. No race condition possible because Zustand updates are synchronous.

### Risk 2: `playbackLoopBoth` stale closure on `getState()`

**Risk**: The `playbackLoopBoth` callback is memoized with `useCallback`. If it reads from `getState()` but the store changes between `requestAnimationFrame` calls, the loop might use stale data.

**Mitigation**: This is actually the *opposite* of the current bug. Currently, the loop reads from `playheadStateRef.current` which can become stale if `setPlayheadState` hasn't batched yet. Reading from `getState()` always returns the latest committed state. The loop already handles this by re-reading `getState()` on every frame iteration.

### Risk 3: Test mock breakage

**Risk**: The existing `DualVideoSynchronizer.test.tsx` mocks `useVideoAnnotations` with `hydrateAnnotations` which is removed. All 8 tests (including 4 real ones) need updating.

**Mitigation**: The `useVideoAnnotations` mock is hoisted in the test file. Update the mock to return the new interface (no `hydrateAnnotations`). The 4 real session-load tests change from asserting `mockHydrateA` calls to asserting store contents. This is actually simpler and more correct.

### Risk 4: Konva rendering performance

**Risk**: Extracting `VideoCanvas` into its own component could cause unnecessary re-renders if props are not properly memoized.

**Mitigation**: `VideoCanvas` will use `React.memo` with custom equality checks for annotation arrays and handlers. The `useMemo` for `getControlPoints` and `pointsToKonva` moves into `VideoCanvas`.

### Risk 5: Breaking changes in `useVideoAnnotations` interface

**Risk**: Other components or tests may depend on `hydrateAnnotations` from `useVideoAnnotations`.

**Mitigation**: `useVideoAnnotations` is only used by `DualVideoSynchronizer`. After extraction, it's used by `VideoPanel` (one consumer). All references are updated in the same PR.

### Risk 6: Documentation drift during refactor

**Risk**: Documentation may reference stale component names (`DualVideoSynchronizer.tsx` as monolith, `analyzeStore.ts`) after the refactor lands, confusing future developers.

**Mitigation**: Documentation updates are the final phase (Phase 11) of the refactor, executed after all code changes are complete and verified. The `openspec-propose` task list includes 7 specific documentation update tasks covering `SYSTEM_ARCHITECTURE.md` and `FRONTEND_DESIGN.md`, with a verification pass for `BACKEND_DESIGN.md`. No third-party consumers.
