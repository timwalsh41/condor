# Tasks: Refactor DualVideoSynchronizer

## 1. Store Changes (Foundation)

### 1.1 Consolidate PlayheadState into playbackStore

- [x] 1.1.1 Review current `playbackStore.ts` state shape and add PlayheadState fields if needed (position, syncOffset, maxPosition)
- [x] 1.1.2 Add `setPlayheadPosition(frame: number)` action to playbackStore that updates position while preserving syncOffset
- [x] 1.1.3 Add `setSyncOffset(offset: number)` action to playbackStore
- [x] 1.1.4 Update `restoreSessionState()` in `sessionStore.ts` to write playhead state via `playbackStore.setPlayheadPosition()` and `playbackStore.setSyncOffset()` instead of any local component state
- [x] 1.1.5 Update `buildSessionPayload()` in `sessionStore.ts` to read playhead state from `playbackStore.getState().playheadState`
- [x] 1.1.6 Update `playbackStore.test.ts` — add tests for new actions, verify session save reads from store

### 1.2 Remove syncStore.temporalOffset

- [x] 1.2.1 Remove `temporalOffset` field from `syncStore.ts` state
- [x] 1.2.2 Remove `setTemporalOffset` action from `syncStore.ts`
- [x] 1.2.3 Update `sessionStore.ts` — remove all references to `temporalOffset` (read in `buildSessionPayload`, write in `restoreSessionState`)
- [x] 1.2.4 Update `DualVideoSynchronizer.tsx` — remove all references to `temporalOffset` (read in session load effect at line ~397-401)
- [x] 1.2.5 Update `syncStore.test.ts` — remove temporalOffset tests, verify remaining tests pass
- [x] 1.2.6 Verify no remaining references: `grep -r "temporalOffset" frontend/src/`

### 1.3 Refactor useVideoAnnotations for store-backed annotations

- [x] 1.3.1 Update `useVideoAnnotations.ts` to subscribe to `useAnnotationStore` for the current annotation array (use `useSelector` pattern or direct store subscription)
- [x] 1.3.2 Update `useVideoAnnotations.ts` to write new annotations directly to `annotationStore` via `setAnnotationsA`/`setAnnotationsB`
- [x] 1.3.3 Remove `hydrateAnnotations` method from `useVideoAnnotations.ts` return type
- [x] 1.3.4 Keep local state for ephemeral UI data: `drawingState`, `selectedIds`, `polylineMousePos`, `isDraggingAnnotation`, `isReshapingAnnotation`
- [x] 1.3.5 Remove all sync-back `useEffect` hooks that previously synced hook state → store (these were in `DualVideoSynchronizer.tsx`, not in the hook)
- [x] 1.3.6 Update `useVideoAnnotations.test.ts` — remove `hydrateAnnotations` tests, add store subscription tests
  - Add test: "annotations update when store changes"
  - Add test: "new annotations write to store"
  - Add test: "deleted annotations write to store"
  - Add test: "hydratedSessionIdRef is no longer needed"
  - Remove test: "should not overwrite store annotations during hydration" (replaced by store subscription test)

## 2. Extract useVideoControls Hook

### 2.1 Create useVideoControls hook

- [x] 2.1.1 Create `frontend/src/hooks/useVideoControls.ts`
- [x] 2.1.2 Extract play/pause handler — accepts `videoDecoder` ref, returns `playPause()`
- [x] 2.1.3 Extract step handlers — returns `stepForward(coarse: boolean)` and `stepBackward(coarse: boolean)`
- [x] 2.1.4 Extract scrub handlers — returns `onSliderChange(value: number)` and `onSliderRelease()`
- [x] 2.1.5 Extract speed handler — returns `onSpeedChange(rate: number)`
- [x] 2.1.6 Extract seek helper — returns `seekToFrame(frame: number)` that pauses playback first
- [x] 2.1.7 Add internal state: `sliderValue` for responsive UI updates
- [x] 2.1.8 Ensure all handlers access latest decoder state via refs (not closure)

### 2.2 Write useVideoControls tests

- [x] 2.2.1 Create `frontend/src/hooks/tests/useVideoControls.test.ts`
- [x] 2.2.2 Test: initializes with default slider value of 0
- [x] 2.2.3 Test: playPause toggles isPlaying state
- [x] 2.2.4 Test: playPause pauses if playing, plays if paused
- [x] 2.2.5 Test: stepForward increments current frame by 1
- [x] 2.2.6 Test: stepForward increments current frame by 5 when coarse=true
- [x] 2.2.7 Test: stepBackward decrements current frame by 1
- [x] 2.2.8 Test: stepBackward decrements current frame by 5 when coarse=true
- [x] 2.2.9 Test: step handlers pause video before seeking
- [x] 2.2.10 Test: seekToFrame pauses video before seeking
- [x] 2.2.11 Test: onSliderChange updates slider value without seeking
- [x] 2.2.12 Test: onSliderRelease seeks to slider value and pauses video
- [x] 2.2.13 Test: onSpeedChange updates playback rate
- [x] 2.2.14 Test: step handlers respect frame boundaries (0 and totalFrames-1)
- [x] 2.2.15 Test: hook returns consistent references across re-renders (stable handlers via useCallback)

## 3. Extract VideoCanvas Component

### 3.1 Create VideoCanvas component

- [x] 3.1.1 Create `frontend/src/components/VideoCanvas.tsx`
- [x] 3.1.2 Define props interface: `VideoCanvasProps` with video decoder refs, annotation data, drawing state, scale, handlers, layer ref, and per-type callbacks
- [x] 3.1.3 Extract Konva Stage + Layer rendering (move from DualVideoSynchronizer, lines ~1522-2000 for Video A)
- [x] 3.1.4 Extract `pointsToKonva` helper — move into VideoCanvas as internal utility
- [x] 3.1.5 Extract `getControlPoints` helper — move into VideoCanvas as internal utility
- [x] 3.1.6 Extract all annotation type renderers: freehand, polyline, oval, arrow, text, angle (as parameterized sub-components or render functions)
- [x] 3.1.7 Extract drawing preview rendering: drag-drawing, polyline-active, angle-active (parameterized by drawingState and annotationManager)
- [x] 3.1.8 Extract control point rendering as a reusable sub-component
- [x] 3.1.9 Wrap component in `React.memo` with custom equality (skip re-render when annotations unchanged)
- [x] 3.1.10 Apply SCALE constant (CONTROL_POINT_SIZE, CONTROL_POINT_HIT_SIZE) — move to module level or config

### 3.2 Write VideoCanvas tests

- [x] 3.2.1 Create `frontend/src/components/tests/VideoCanvas.test.tsx`
- [x] 3.2.2 Test: renders Konva Stage with correct dimensions
- [x] 3.2.3 Test: renders freehand annotation when provided in annotations array
- [x] 3.2.4 Test: renders polyline annotation with all vertices
- [x] 3.2.5 Test: renders oval annotation with correct radius
- [x] 3.2.6 Test: renders arrow annotation with pointer
- [x] 3.2.7 Test: renders text annotation with correct position and text
- [x] 3.2.8 Test: renders angle annotation with angle label
- [x] 3.2.9 Test: renders control points when annotation is selected
- [x] 3.2.10 Test: does NOT re-render when annotations array identity unchanged (React.memo)
- [x] 3.2.11 Test: renders drawing preview when drawingState.mode is drag-drawing
- [x] 3.2.12 Test: renders polyline preview when drawingState.mode is polyline-active
- [x] 3.2.13 Test: renders angle preview when drawingState.mode is angle-active
- [x] 3.2.14 Test: passes mouseDown events to handlers
- [x] 3.2.15 Test: passes click events to handlers
- [x] 3.2.16 Test: pointsToKonva helper converts Point[] to flat number[] correctly
- [x] 3.2.17 Test: getControlPoints returns correct points for each annotation type
- [x] 3.2.18 Test: freehand control points are start and end only
- [x] 3.2.19 Test: oval control points include 8 points (corners + midpoints)

## 4. Extract VideoControls Component

### 4.1 Create VideoControls component

- [x] 4.1.1 Create `frontend/src/components/VideoControls.tsx`
- [x] 4.1.2 Define props interface: `VideoControlsProps` with totalFrames, currentFrame, isPlaying, sliderValue, speed options, and callbacks
- [x] 4.1.3 Extract scrub bar input (range input with min/max/value/onChange/onMouseUp/onTouchEnd)
- [x] 4.1.4 Extract play/pause button with dynamic label and color
- [x] 4.1.5 Extract step buttons grid: back 5, forward 5, back 1, forward 1 (with disabled states)
- [x] 4.1.6 Extract speed selector dropdown
- [x] 4.1.7 Wire all callbacks to the extracted `useVideoControls` hook
- [x] 4.1.8 Preserve all `data-testid` attributes from current component

### 4.2 Write VideoControls tests

- [x] 4.2.1 Create `frontend/src/components/tests/VideoControls.test.tsx`
- [x] 4.2.2 Test: renders scrub bar with correct min/max values
- [x] 4.2.3 Test: renders play button with "▶ Play" when not playing
- [x] 4.2.4 Test: renders play button with "⏸ Pause" when playing
- [x] 4.2.5 Test: step-backward-1 button is disabled at frame 0
- [x] 4.2.6 Test: step-forward-1 button is disabled at max frame
- [x] 4.2.7 Test: step-backward-5 button is disabled at frame 0
- [x] 4.2.8 Test: step-forward-5 button is disabled at max frame
- [x] 4.2.9 Test: speed selector shows all 5 speed options
- [x] 4.2.10 Test: clicking play calls onPlayPause callback
- [x] 4.2.11 Test: dragging scrub bar calls onSliderChange with new value
- [x] 4.2.12 Test: releasing scrub bar calls onSliderRelease
- [x] 4.2.13 Test: clicking step buttons calls appropriate step callback
- [x] 4.2.14 Test: changing speed calls onSpeedChange callback

## 5. Extract PlaybackControls Component

### 5.1 Create PlaybackControls component

- [x] 5.1.1 Create `frontend/src/components/PlaybackControls.tsx`
- [x] 5.1.2 Define props interface: `PlaybackControlsProps` with playheadState, trimStart, trimEnd, isPlaying, isLooping, playbackRate, syncOffset, totalFrames, and callbacks
- [x] 5.1.3 Extract trim + scrub bar section (TrimScrubBar component wrapper with computed range)
- [x] 5.1.4 Extract play/pause button
- [x] 5.1.5 Extract joint step buttons: back 5, back 1, forward 1, forward 5 (4-column grid)
- [x] 5.1.6 Extract speed selector
- [x] 5.1.7 Extract sync offset display panel
- [x] 5.1.8 Wire callbacks to playbackStore actions and local state
- [x] 5.1.9 Preserve all `data-testid` attributes from current component

### 5.2 Write PlaybackControls tests

- [x] 5.2.1 Create `frontend/src/components/tests/PlaybackControls.test.tsx`
- [x] 5.2.2 Test: renders TrimScrubBar with computed range from sync offset
- [x] 5.2.3 Test: renders play button with correct label based on isPlaying
- [x] 5.2.4 Test: renders 4 step buttons in grid layout
- [x] 5.2.5 Test: speed selector shows all 5 speed options
- [x] 5.2.6 Test: displays sync offset with correct sign and description
- [x] 5.2.7 Test: clicking play calls onPlayPause callback
- [x] 5.2.8 Test: clicking trim start handle calls onTrimStartChange
- [x] 5.2.9 Test: clicking trim end handle calls onTrimEndChange
- [x] 5.2.10 Test: clicking return-to-in calls onReturnToIn
- [x] 5.2.11 Test: clicking loop toggle calls onLoopToggle
- [x] 5.2.12 Test: scrub bar playhead updates when playheadState changes
- [x] 5.2.13 Test: frame label shows correct Video A and Video B frame numbers
- [x] 5.2.14 Test: step buttons call appropriate step callback

## 6. Extract AnnotationToolbar Component

### 6.1 Create AnnotationToolbar component

- [x] 6.1.1 Create `frontend/src/components/AnnotationToolbar.tsx`
- [x] 6.1.2 Define props interface: `AnnotationToolbarProps` with selectedTool, drawingStates, activeVideo, tools, and callbacks
- [x] 6.1.3 Extract tool buttons: select, freehand, polyline, oval, arrow, text, angle (with active styling)
- [x] 6.1.4 Extract undo/redo buttons for active video (conditional rendering)
- [x] 6.1.5 Extract clear all buttons for each video (conditional rendering)
- [x] 6.1.6 Extract helper text display (polyline/angle/text tool hints)
- [x] 6.1.7 Preserve all `data-testid` attributes from current component

### 6.2 Write AnnotationToolbar tests

- [x] 6.2.1 Create `frontend/src/components/tests/AnnotationToolbar.test.tsx`
- [x] 6.2.2 Test: renders all 7 tool buttons
- [x] 6.2.3 Test: selected tool has blue border and light blue background
- [x] 6.2.4 Test: unselected tools have gray border and white background
- [x] 6.2.5 Test: clicking a tool calls onToolChange callback
- [x] 6.2.6 Test: undo/redo buttons shown when activeVideo matches a ready video
- [x] 6.2.7 Test: undo button is disabled when canUndo is false
- [x] 6.2.8 Test: redo button is disabled when canRedo is false
- [x] 6.2.9 Test: clear-all buttons shown when video is ready
- [x] 6.2.10 Test: clear-all button is disabled when no annotations
- [x] 6.2.11 Test: helper text updates based on selected tool

## 7. Extract VideoPanel Component

### 7.1 Create VideoPanel component

- [x] 7.1.1 Create `frontend/src/components/VideoPanel.tsx`
- [x] 7.1.2 Define props interface: `VideoPanelProps` with videoSlot, decoder, metadata, annotations, drawingState, handlers, scale, layerRef, controls (SYNC mode only), and callbacks
- [x] 7.1.3 Extract video canvas layout: container div with scaling, rotation handling, canvas element
- [x] 7.1.4 Extract display dimension calculation (rotation-aware width/height)
- [x] 7.1.5 Extract VideoCanvas component integration (pass appropriate props)
- [x] 7.1.6 Extract frame counter display
- [x] 7.1.7 Extract VideoControls integration (when in SYNC mode)
- [x] 7.1.8 Extract "No video loaded" / "Loading..." placeholder
- [x] 7.1.9 Preserve all `data-testid` attributes from current component

### 7.2 Write VideoPanel tests

- [x] 7.2.1 Create `frontend/src/components/tests/VideoPanel.test.tsx`
- [x] 7.2.2 Test: renders "No video loaded" when no decoder ready
- [x] 7.2.3 Test: renders "Loading..." when decoder file is set but not ready
- [x] 7.2.4 Test: renders VideoCanvas with correct dimensions when decoder ready
- [x] 7.2.5 Test: applies rotation transform correctly (rotation=0)
- [x] 7.2.6 Test: applies rotation transform correctly (rotation=90)
- [x] 7.2.7 Test: scales display when video height exceeds videoHeight config
- [x] 7.2.8 Test: displays frame counter with correct frame number
- [x] 7.2.9 Test: renders VideoControls in SYNC mode
- [x] 7.2.10 Test: does not render VideoControls in PLAYBACK mode
- [x] 7.2.11 Test: passes correct videoSlot prop to child components

## 8. Rebuild DualVideoSynchronizer as Orchestrator

### 8.1 Remove duplicated code from DualVideoSynchronizer

- [x] 8.1.1 Remove all duplicated SYNC mode handlers (handlePlayPauseA/B, handleStep*, handleSlider*, handlePlaybackRate*) — replaced by useVideoControls
- [x] 8.1.2 Remove all duplicated Konva rendering JSX (Video A and Video B canvas blocks) — replaced by VideoPanel
- [x] 8.1.3 Remove duplicated SYNC mode controls JSX (Video A controls, Video B controls) — replaced by VideoPanel + VideoControls
- [x] 8.1.4 Remove PLAYBACK mode controls JSX (trim bar, step buttons, speed, sync offset) — replaced by PlaybackControls
- [x] 8.1.5 Remove annotation toolbar JSX (tool buttons, undo/redo/clear) — replaced by AnnotationToolbar
- [x] 8.1.6 Remove `pointsToKonva` and `getControlPoints` helpers — moved to VideoCanvas
- [x] 8.1.7 Remove `CONTROL_POINT_SIZE`, `CONTROL_POINT_HIT_SCALE`, `CONTROL_POINT_HIT_SIZE` constants — moved to VideoCanvas
- [x] 8.1.8 Remove `switchToPlaybackMode` and `switchToSyncMode` logic — keep as orchestrator methods but simplify to call store actions

### 8.2 Replace local state with store reads

- [x] 8.2.1 Remove `useState<number | null>(null)` for `syncOffset` — read from `playbackStore.getState().playheadState?.syncOffset`
- [x] 8.2.2 Remove `useState<{frameA, frameB}>` for `syncPoints` — read from `syncStore.getState().syncPoints`
- [x] 8.2.3 Remove `useState<number>` for `sliderValueA`/`sliderValueB`/`sliderValueBoth` — read from `playbackStore.getState().sliderPositions`
- [x] 8.2.4 Remove `useState` for `isPlayingBoth` — read from `playbackStore.getState().isPlaying`
- [x] 8.2.5 Remove `useState` for `playbackRateBoth` — read from `playbackStore.getState().playbackRate`
- [x] 8.2.6 Remove `useState` for `playheadState` — read from `playbackStore.getState().playheadState`
- [x] 8.2.7 Remove `useState` for `isLooping` — read from `playbackStore.getState().isLooping`
- [x] 8.2.8 Keep `useState` for mode-independent UI state: `selectedTool`, `videoHeight`, `activeVideo`

### 8.3 Eliminate redundant refs

- [x] 8.3.1 Remove `playheadStateRef` — replaced by reading `playbackStore.getState().playheadState` in playback loop
- [x] 8.3.2 Remove `isPlayingRef` — replaced by reading `playbackStore.getState().isPlaying`
- [x] 8.3.3 Keep `lastFrameTimeRef` — used for timing, no store equivalent
- [x] 8.3.4 Keep `playbackLoopRef` — requestAnimationFrame handle
- [x] 8.3.5 Keep `prevVideoAIdRef`/`prevVideoBIdRef` — needed for video change detection
- [x] 8.3.6 Remove `hydratedSessionIdRefA`/`hydratedSessionIdRefB` — no longer needed
- [x] 8.3.7 Keep `targetSeekedRef` — session restore seek guard

### 8.4 Eliminate redundant effects

- [x] 8.4.1 Remove sync-back effects for annotations (2 effects syncing annotationsA/B → store) — no longer needed, hook reads from store
- [x] 8.4.2 Remove hydration effects for annotations (2 effects hydrating from store) — no longer needed, hook reads from store
- [x] 8.4.3 Remove sync effects for playback rate/loop/sync offset from store — replaced by direct store subscription in PlaybackControls
- [x] 8.4.4 Remove `useLayoutEffect` for Konva layer draw after hydration — no longer needed
- [x] 8.4.5 Remove slider value sync effects (3 effects syncing currentFrame → sliderValue) — replaced by store subscription
- [x] 8.4.6 Keep video-change detection effect (simplified — only resets sync/trim on actual video swap)
- [x] 8.4.7 Keep keyboard shortcuts effect (moved logic or kept as-is)
- [x] 8.4.8 Keep playback loop effect (simplified — reads from store, writes to store)
- [x] 8.4.9 Keep trim state sync effects (trimStartRef/trimEndRef) — needed for playback loop timing
- [x] 8.4.10 Keep loop state sync effect (isLooping → store)

### 8.5 Wire extracted components

- [x] 8.5.1 Import and render VideoPanel for Video A (with useVideoControls hook)
- [x] 8.5.2 Import and render VideoPanel for Video B (with useVideoControls hook)
- [x] 8.5.3 Import and render VideoControls inside each VideoPanel
- [x] 8.5.4 Import and render VideoCanvas inside each VideoPanel
- [x] 8.5.5 Import and render PlaybackControls in PLAYBACK mode
- [x] 8.5.6 Import and render AnnotationToolbar
- [x] 8.5.7 Wire mode toggle to syncStore.setMode()
- [x] 8.5.8 Wire VideoUploadWorkflow externalVideo props (preserve existing logic)
- [x] 8.5.9 Wire session load effect (simplified — write to stores, playback loop picks up via store subscription)

### 8.6 Remove unused imports and code

- [x] 8.6.1 Remove unused React imports (Fragment may still be needed)
- [x] 8.6.2 Remove unused Konva imports (only what VideoCanvas needs)
- [x] 8.6.3 Remove unused store imports (only what orchestrator needs)
- [x] 8.6.4 Remove unused utility imports (only what orchestrator needs)
- [x] 8.6.5 Verify file is ~200-250 lines

## 9. Update Existing Unit Tests

### 9.1 Update DualVideoSynchronizer tests

- [x] 9.1.1 Remove mock for `hydrateAnnotations` from `useVideoAnnotations` mock
- [x] 9.1.2 Replace `expect(mockHydrateA).toHaveBeenCalledWith(...)` with store-content assertions
- [x] 9.1.3 Replace `expect(mockClearAllB).not.toHaveBeenCalled()` with store-content assertions
- [x] 9.1.4 Replace 8 placeholder tests with real assertions:
  - Height configuration: test video height slider renders with correct min/max/default
  - Slider interaction: test slider value updates on change
  - Height updates on video change: test slider resets when videos change
  - Annotation independence: test annotations use video-internal dimensions
  - Slider bounds: test min=128px constraint
  - Aspect ratio: test scaling maintains aspect ratio
- [x] 9.1.5 Update `useVideoAnnotations` mock to not include `hydrateAnnotations`
- [x] 9.1.6 Run `npm run test` and fix any failures

### 9.2 Update store tests

- [x] 9.2.1 Update `playbackStore.test.ts` — add PlayheadState tests, remove dead code assertions
- [x] 9.2.2 Update `syncStore.test.ts` — remove temporalOffset tests
- [x] 9.2.3 Update `sessionStore.test.ts` — verify session save reads from corrected stores
- [x] 9.2.4 Run `npm run test` and fix any failures

### 9.3 Update annotation hook tests

- [x] 9.2.5 Add store subscription tests to `useVideoAnnotations.test.ts`
- [x] 9.2.6 Remove `hydrateAnnotations` test from `useVideoAnnotations.test.ts`
- [x] 9.2.7 Run `npm run test` and fix any failures

## 10. Validation

### 10.1 Type checking and linting

- [ ] 10.1.1 Run `npx tsc --noEmit` and fix any type errors
- [ ] 10.1.2 Run `npm run lint` and fix any lint errors
- [ ] 10.1.3 Verify no unused imports remain

### 10.2 Unit test verification

- [ ] 10.2.1 Run `npm run test` — all existing tests must pass
- [ ] 10.2.2 Verify test count increased (459 → ~550+)
- [ ] 10.2.3 Verify no placeholder tests remain (`expect(true).toBe(true`)

### 10.3 Integration test verification

- [ ] 10.3.1 Run `npm run test:e2e` — all Playwright tests must pass
- [ ] 10.3.2 Verify no `data-testid` attributes are broken
- [ ] 10.3.3 Verify frame stepping tests pass with exact frame accuracy

### 10.4 Manual verification

- [ ] 10.4.1 Load two videos, set sync point, switch to PLAYBACK mode — verify sync offset correct
- [ ] 10.4.2 Play videos, step forward/backward — verify frame accuracy
- [ ] 10.4.3 Set trim bounds, play, verify playback stops at trim end
- [ ] 10.4.4 Enable loop mode, verify playback restarts at trim start
- [ ] 10.4.5 Draw annotations on both videos — verify independence
- [ ] 10.4.6 Save session, reload page, load session — verify all state restored
- [ ] 10.4.7 Switch between sessions — verify annotations swap correctly
- [ ] 10.4.8 Test keyboard shortcuts (space, arrows, Ctrl+Z/Y)

## 11. Documentation Updates

### 11.1 Update SYSTEM_ARCHITECTURE.md

- [ ] 11.1.1 Update Version to 1.2, Last Updated to current date
- [ ] 11.1.2 Update Component Architecture table — replace single `DualVideoSynchronizer.tsx` entry with extracted components:
  - `components/DualVideoSynchronizer.tsx` (orchestrator, ~200 lines)
  - `components/VideoPanel.tsx` (per-video wrapper)
  - `components/VideoCanvas.tsx` (Konva rendering)
  - `components/VideoControls.tsx` (SYNC mode controls)
  - `components/PlaybackControls.tsx` (PLAYBACK mode controls)
  - `components/AnnotationToolbar.tsx` (tool selection)
  - `hooks/useVideoControls.ts` (extracted video control hook)
- [ ] 11.1.3 Update state management description — replace "analyzeStore" reference with the actual store set: `videoStore`, `annotationStore`, `syncStore`, `playbackStore`, `trimStore`, `sessionStore`
- [ ] 11.1.4 Update "Data Architecture" — note that playhead state and sync offset are owned by `playbackStore`, sync offset no longer duplicated in `syncStore.temporalOffset`
- [ ] 11.1.5 Verify component ownership table accurately reflects the new module structure

### 11.2 Update FRONTEND_DESIGN.md

- [ ] 11.2.1 Update Version to 1.3, Last Updated to current date
- [ ] 11.2.2 Update Application Composition PlantUML diagram — replace `DualVideoSynchronizer.tsx` references with extracted components:
  - `DualVideoSynchronizer` (orchestrator) → `VideoPanel` (×2), `VideoCanvas` (×2), `VideoControls` (×2), `PlaybackControls`, `AnnotationToolbar`
  - `analyzeStore` → `videoStore`, `annotationStore`, `syncStore`, `playbackStore`, `trimStore`
  - `Media Engine` section: add `useVideoControls` hook
- [ ] 11.2.3 Update Module Architecture section:
  - Replace `DualVideoSynchronizer.tsx` monolith description with extracted component list
  - Remove reference to non-existent `analyzeStore.ts`
  - Document the six Zustand stores: `videoStore`, `annotationStore`, `syncStore`, `playbackStore`, `trimStore`, `sessionStore`
  - Document `useVideoControls.ts` as the extracted video control hook
- [ ] 11.2.4 Update State and Data Contracts — clarify that:
  - Sync/playback state is owned by `playbackStore` (PlayheadState with position, syncOffset, maxPosition)
  - Sync configuration is owned by `syncStore` (mode, syncPoints) — no temporalOffset
  - Annotations are stored in `annotationStore` per channel
  - Trim bounds are stored in `trimStore`
  - Session persistence writes to all relevant stores via `sessionStore.restoreSessionState()`
- [ ] 11.2.5 Update Analyze Save and Load Flow description to reflect store-backed architecture:
  - Save serializes from stores (not component local state)
  - Load writes to stores (not component local state)
  - Annotation hydration is direct store subscription (no hydrateAnnotations mechanism)
- [ ] 11.2.6 Update State and Data Contracts sequence diagram to reflect the actual store interactions:
  - `buildSnapshotPayload()` reads from all relevant stores
  - `restoreSessionState()` writes to all relevant stores
  - Component state is ephemeral (drawing, selection) — not persisted
- [ ] 11.2.7 Update Testing Strategy section — reflect new test file structure:
  - Component tests: `VideoPanel.test.tsx`, `VideoCanvas.test.tsx`, `VideoControls.test.tsx`, `PlaybackControls.test.tsx`, `AnnotationToolbar.test.tsx`
  - Hook tests: `useVideoControls.test.ts`, updated `useVideoAnnotations.test.ts`
  - Store tests: updated `playbackStore.test.ts`, updated `syncStore.test.ts`

### 11.3 Verify BACKEND_DESIGN.md

- [ ] 11.3.1 Review for any frontend references that need updating
- [ ] 11.3.2 Confirm no changes needed (backend is unchanged by this refactor)
