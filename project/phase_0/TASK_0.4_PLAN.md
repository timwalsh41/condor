# Task 0.4: Dual Video Sync Spike - Implementation Plan

## Overview
Implement synchronized dual-video playback with **WebCodecs for all operations**. Two modes: **SYNC** (independent controls) and **PLAYBACK** (unified controls maintaining offset). Single event loop ensures perfectly synchronized playback.

## Confidence Assessment: 9/10

**High Confidence Factors:**
- ✅ WebCodecs-only architecture validated in Task 0.3
- ✅ Single playback loop eliminates timing issues (key simplification!)
- ✅ Cache-aware seeking (instant if cached)
- ✅ Clear UX flow: SYNC to set points → PLAYBACK to analyze
- ✅ Existing useWebCodecsDecoder hook provides all primitives needed

**Minimal Remaining Risks:**
- ⚠️ Memory pressure (~240MB) - acceptable per user
- ⚠️ Cache coordination during synchronized playback - mitigated by 60-frame read-ahead

---

## Implementation Phases

### Phase 1: Component Structure & SYNC Mode (Session 1, ~3-4 hours)

**1. Component Setup:**
```typescript
interface DualVideoState {
  mode: 'SYNC' | 'PLAYBACK';
  syncOffset: number | null;
  syncPoints: { frameA: number; frameB: number } | null;
}

const DualVideoSyncDemo = () => {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [mode, setMode] = useState<'SYNC' | 'PLAYBACK'>('SYNC');
  const [syncOffset, setSyncOffset] = useState<number | null>(null);
  const [syncPoints, setSyncPoints] = useState<{frameA: number, frameB: number} | null>(null);

  const videoA = useWebCodecsDecoder(fileA);
  const videoB = useWebCodecsDecoder(fileB);

  // ...
};
```

**2. Layout:**
- Two file upload inputs (Video A, Video B)
- Side-by-side canvases (CSS Grid: 2 columns)
- Mode indicator with color coding:
  - SYNC MODE (blue background)
  - PLAYBACK MODE (green background)
- Mode toggle button:
  - In SYNC: "Switch to PLAYBACK"
  - In PLAYBACK: "Switch to SYNC"

**3. SYNC Mode Controls (Two Independent Panels):**

**Video A Controls:**
```typescript
<div className="video-a-controls">
  <h3>Video A</h3>
  <div>Frame {videoA.currentFrame} of {videoA.totalFrames}</div>

  <button onClick={handlePlayPauseA}>
    {videoA.isPlaying ? '⏸ Pause' : '▶ Play'}
  </button>

  <button onClick={() => videoA.seekToFrame(Math.max(0, videoA.currentFrame - 5))}>
    ← Back 5 Frames
  </button>
  <button onClick={() => videoA.stepBackward()}>
    ← Back 1 Frame
  </button>
  <button onClick={() => videoA.stepForward()}>
    Forward 1 Frame →
  </button>
  <button onClick={() => videoA.seekToFrame(Math.min(videoA.totalFrames - 1, videoA.currentFrame + 5))}>
    Forward 5 Frames →
  </button>

  <select value={videoA.playbackRate} onChange={(e) => videoA.setPlaybackRate(Number(e.target.value))}>
    <option value="0.1">0.1x</option>
    <option value="0.25">0.25x</option>
    <option value="0.5">0.5x</option>
    <option value="1">1.0x</option>
    <option value="2">2.0x</option>
  </select>
</div>
```

**Video B Controls:** (identical structure)

**4. Mode Switching Logic:**

**SYNC → PLAYBACK:**
```typescript
const switchToPlaybackMode = () => {
  // Stop any playing videos
  if (videoA.isPlaying) videoA.pause();
  if (videoB.isPlaying) videoB.pause();

  // Calculate sync offset from current positions
  const offset = videoB.currentFrame - videoA.currentFrame;
  setSyncOffset(offset);

  // Store sync points for later restoration
  setSyncPoints({
    frameA: videoA.currentFrame,
    frameB: videoB.currentFrame
  });

  setMode('PLAYBACK');
};
```

**PLAYBACK → SYNC:**
```typescript
const switchToSyncMode = async () => {
  // Stop playback
  stopPlayback();

  // Restore to original sync points (user likely wants to adjust)
  if (syncPoints) {
    await videoA.seekToFrame(syncPoints.frameA);
    await videoB.seekToFrame(syncPoints.frameB);
  }

  setMode('SYNC');
};
```

**Deliverable:** SYNC mode fully functional, mode switching works, positions saved/restored

---

### Phase 2: PLAYBACK Mode with Synchronized Event Loop (Session 1-2, ~3-4 hours)

**KEY INSIGHT:** Single requestAnimationFrame loop steps both videos synchronously - no separate play() calls, no sync monitor needed.

**1. Unified Controls (Single Panel):**
```typescript
<div className="playback-controls">
  <h3>PLAYBACK MODE</h3>

  {/* Display both frame counters + offset */}
  <div>
    Video A: Frame {videoA.currentFrame} of {videoA.totalFrames}
  </div>
  <div>
    Video B: Frame {videoB.currentFrame} of {videoB.totalFrames}
  </div>
  <div>
    Sync Offset: {syncOffset > 0 ? '+' : ''}{syncOffset} frames
  </div>

  {/* Unified play/pause button */}
  <button onClick={handlePlayPauseBoth}>
    {isPlayingBoth ? '⏸ Pause' : '▶ Play'}
  </button>

  {/* Unified stepping */}
  <button onClick={handleStepBackwardCoarse}>← Back 5 Frames</button>
  <button onClick={handleStepBackwardFine}>← Back 1 Frame</button>
  <button onClick={handleStepForwardFine}>Forward 1 Frame →</button>
  <button onClick={handleStepForwardCoarse}>Forward 5 Frames →</button>

  {/* Unified speed control */}
  <select value={playbackRateBoth} onChange={handleSpeedChange}>
    <option value="0.1">0.1x</option>
    <option value="0.25">0.25x</option>
    <option value="0.5">0.5x</option>
    <option value="1">1.0x</option>
    <option value="2">2.0x</option>
  </select>
</div>
```

**2. Synchronized Stepping:**
```typescript
const handleStepForwardFine = async () => {
  const nextFrameA = videoA.currentFrame + 1;
  const nextFrameB = nextFrameA + syncOffset!;

  // Boundary check
  if (nextFrameA >= videoA.totalFrames ||
      nextFrameB >= videoB.totalFrames ||
      nextFrameB < 0) {
    return; // Can't step further
  }

  // Step both (seekToFrame checks cache first - instant if cached)
  await Promise.all([
    videoA.seekToFrame(nextFrameA),
    videoB.seekToFrame(nextFrameB)
  ]);
};

const handleStepBackwardFine = async () => {
  const nextFrameA = videoA.currentFrame - 1;
  const nextFrameB = nextFrameA + syncOffset!;

  // Boundary check
  if (nextFrameA < 0 || nextFrameB >= videoB.totalFrames || nextFrameB < 0) {
    return;
  }

  await Promise.all([
    videoA.seekToFrame(nextFrameA),
    videoB.seekToFrame(nextFrameB)
  ]);
};

// Coarse stepping: ±5 frames
const handleStepForwardCoarse = () => handleStepForwardN(5);
const handleStepBackwardCoarse = () => handleStepBackwardN(5);
```

**3. Synchronized Playback Loop (CRITICAL):**
```typescript
const [isPlayingBoth, setIsPlayingBoth] = useState(false);
const playbackLoopRef = useRef<number | null>(null);
const lastFrameTimeRef = useRef<number>(0);

const playbackLoopBoth = useCallback((timestamp: number) => {
  if (!isPlayingBoth) return;

  // Initialize timing on first frame
  if (lastFrameTimeRef.current === 0) {
    lastFrameTimeRef.current = timestamp;
  }

  const elapsed = timestamp - lastFrameTimeRef.current;
  const frameInterval = 1000 / videoA.framerate / playbackRateBoth;

  if (elapsed >= frameInterval) {
    const nextFrameA = videoA.currentFrame + 1;
    const nextFrameB = nextFrameA + syncOffset!;

    // Boundary check - stop if either reaches end
    if (nextFrameA >= videoA.totalFrames ||
        nextFrameB >= videoB.totalFrames ||
        nextFrameB < 0) {
      setIsPlayingBoth(false);
      return;
    }

    // Check cache for both frames
    const cacheA = videoA.cacheStats; // Assume hook exposes cache.has()
    const cacheB = videoB.cacheStats;

    // OPTION A: Render from cache (synchronous, instant)
    if (cacheA.has(nextFrameA) && cacheB.has(nextFrameB)) {
      // Call internal render functions (may need to expose from hook)
      videoA.seekToFrame(nextFrameA, false); // updateDisplay=false, cache-only
      videoB.seekToFrame(nextFrameB, false);

      // Manual render (if hooks don't expose render-only function)
      // renderBothFrames(nextFrameA, nextFrameB);

      lastFrameTimeRef.current = timestamp;
    } else {
      // OPTION B: Cache miss - pause and rebuild cache
      console.warn(`Cache miss during playback: A=${nextFrameA}, B=${nextFrameB}`);
      setIsPlayingBoth(false);

      // Seek to rebuild cache (async)
      Promise.all([
        videoA.seekToFrame(nextFrameA),
        videoB.seekToFrame(nextFrameB)
      ]).then(() => {
        // Optionally resume playback after cache rebuilt
      });
      return;
    }
  }

  playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
}, [isPlayingBoth, syncOffset, playbackRateBoth, videoA.currentFrame, videoA.totalFrames, videoA.framerate]);

const startPlayback = () => {
  setIsPlayingBoth(true);
  lastFrameTimeRef.current = 0;
  playbackLoopRef.current = requestAnimationFrame(playbackLoopBoth);
};

const stopPlayback = () => {
  setIsPlayingBoth(false);
  if (playbackLoopRef.current) {
    cancelAnimationFrame(playbackLoopRef.current);
    playbackLoopRef.current = null;
  }
};
```

**NOTE:** May need to extend `useWebCodecsDecoder` to expose:
- `cache.has(frameIndex)` for cache checking
- Direct frame rendering without state updates (for synchronized loop)
- Or restructure to have playback loop inside component with access to both caches

**4. Unified Speed Control:**
```typescript
const [playbackRateBoth, setPlaybackRateBoth] = useState(1.0);

const handleSpeedChange = (e: ChangeEvent<HTMLSelectElement>) => {
  const rate = Number(e.target.value);
  setPlaybackRateBoth(rate);
  // Note: Don't call videoA.setPlaybackRate() - we control timing in our loop
};
```

**Deliverable:** PLAYBACK mode with perfectly synchronized playback (single event loop), unified controls

**Risks:**
- ⚠️ **Hook API limitations** - May need to refactor useWebCodecsDecoder to expose cache checking and direct rendering
  - **Mitigation:** Extend hook or inline some logic in component

---

### Phase 3: Testing & Validation (Session 2, ~3-4 hours)

**tests/spikes/test_dual_video_sync.spec.ts:**

```typescript
// Test 1: SYNC mode - independent controls
test('SYNC mode allows independent video control', async ({ page }) => {
  // Upload 2 videos
  // Step video A to frame 50
  // Step video B to frame 75
  // Verify: frameA=50, frameB=75
});

// Test 2: Sync offset calculation
test('calculates sync offset on SYNC → PLAYBACK', async ({ page }) => {
  // SYNC mode: frameA=50, frameB=75
  // Click "Switch to PLAYBACK"
  // Verify: offset displayed as "+25 frames"
  // Verify: both frame positions unchanged
});

// Test 3: PLAYBACK stepping maintains exact offset
test('PLAYBACK stepping maintains exact sync offset', async ({ page }) => {
  // Set offset=25 (frameA=50, frameB=75)
  // Step forward 10 times
  // Verify: frameA=60, frameB=85 (offset maintained exactly)
});

// Test 4: PLAYBACK → SYNC restores sync points
test('switching to SYNC mode restores sync points', async ({ page }) => {
  // PLAYBACK mode: offset=25, currently at frameA=100, frameB=125
  // Click "Switch to SYNC"
  // Verify: frameA=50, frameB=75 (restored to sync points)
});

// Test 5: Synchronized playback maintains offset
test('synchronized playback maintains offset', async ({ page }) => {
  // PLAYBACK mode: offset=25, start at frameA=50
  // Click play, wait for 3 seconds
  // Sample frames periodically
  // Verify: frameB - frameA === 25 throughout (0 frame tolerance)
});

// Test 6: Speed changes work in PLAYBACK
test('speed changes affect both videos', async ({ page }) => {
  // Play at 0.1x, verify slow frame advancement
  // Change to 2.0x, verify fast frame advancement
  // Verify: offset maintained
});

// Test 7: Negative offset handling
test('handles negative sync offset correctly', async ({ page }) => {
  // SYNC mode: frameA=75, frameB=50
  // Switch to PLAYBACK (offset=-25)
  // Step forward
  // Verify: frameA=76, frameB=51
});

// Test 8: End-of-video boundary (accounting for offset)
test('stops at boundary considering offset', async ({ page }) => {
  // Video A: 300 frames, Video B: 300 frames, offset=+25
  // Seek to frameA=275 (frameB=300, at boundary)
  // Try to step forward
  // Verify: both videos stopped, frameA=275, frameB=300
});

// Test 9: Mode switching stops playback
test('switching modes stops any playback', async ({ page }) => {
  // SYNC mode: play video A
  // Switch to PLAYBACK
  // Verify: video A paused

  // PLAYBACK mode: play both
  // Switch to SYNC
  // Verify: both paused, restored to sync points
});
```

**Target:** 9 tests × 3 browsers = 27 tests passing

**Deliverable:** Comprehensive test coverage, all passing on Chrome, Firefox, WebKit

---

### Phase 4: Documentation & Project Plan Updates (Session 2, ~2 hours)

**1. Create docs/spike/VIDEO_SYNC.md:**
```markdown
# Dual Video Synchronization with WebCodecs

## Architecture
- Two independent WebCodecs decoders (video A, video B)
- All operations use WebCodecs canvas rendering
- Single synchronized playback loop (requestAnimationFrame)
- No HTML5 video elements, no mode switching complexity

## Modes

### SYNC Mode
- Purpose: Set synchronization points
- Controls: Independent play/pause/step for each video
- Speed control: Independent (can be different speeds)
- User workflow: Navigate each video to desired sync point

### PLAYBACK Mode
- Purpose: Analyze synchronized videos
- Controls: Unified play/pause/step for both videos
- Speed control: Unified (affects both videos)
- Sync offset: Calculated when switching from SYNC
- User workflow: Analyze swing with maintained sync

## Sync Offset Calculation
```
offset = frameB - frameA
```
Calculated when switching SYNC → PLAYBACK. Can be positive or negative.

## Synchronized Playback Implementation
Single requestAnimationFrame loop steps both videos together:
- Ensures exact frame-level synchronization
- No async timing issues
- Cache-aware: pauses if cache miss

## Performance
- Sync accuracy: 0 frame error (exact)
- Stepping latency: <10ms (cache hit)
- Playback smoothness: Depends on cache hit rate (>80% typical)
- Memory: ~240MB (120 frames × 2 videos)

## Known Limitations
- Audio not supported (application is visual-only, not a limitation)
- Both videos must have same framerate (MVP requirement)
- Cache miss during playback causes brief pause

## Future Enhancements
- Different framerate support (fractional frame stepping)
- Loop playback
- Scrubber UI for unified seeking
```

**2. Update PROJECT_PLAN.md (Task 0.4):**

Remove all references to:
- "HTML5 playback mode"
- "Hybrid approach"
- "Sync-back algorithm"
- "Mode switching between canvas and HTML5 video"

Update technical notes to:
```markdown
**Technical Notes:**
- WebCodecs-only architecture: stepping, seeking, AND playback
- Single requestAnimationFrame loop for synchronized playback
- Both videos must have same framerate for MVP
- Sync offset can be positive or negative
- SYNC → PLAYBACK: Calculate offset, stop playback
- PLAYBACK → SYNC: Restore sync points, stop playback
- Cache-aware playback: pauses on cache miss to rebuild
```

**3. Update PROJECT_PLAN.md (Framerate Validation):**

Find references to framerate validation and update to defer to Phase 1:
- Task 1.1 or 1.2 (Video Upload with preview/rotation)
- Add note: "Validate same framerate during upload preview workflow"

**Deliverable:** Complete spike documentation, PROJECT_PLAN.md corrected

---

## Success Criteria

**Task 0.4 Complete when:**

- [ ] Dual video component renders side-by-side canvases
- [ ] SYNC mode: Independent play/pause/step (±1, ±5) controls for each video
- [ ] PLAYBACK mode: Unified play/pause/step controls
- [ ] Sync offset displayed in PLAYBACK mode (e.g., "+25 frames")
- [ ] Mode toggle button switches SYNC ↔ PLAYBACK
- [ ] SYNC → PLAYBACK: Stops playback, calculates offset, stores sync points
- [ ] PLAYBACK → SYNC: Stops playback, restores to sync points
- [ ] Synchronized playback: Single event loop steps both videos together
- [ ] Exact sync maintenance: frameB = frameA + offset (0 frame tolerance)
- [ ] Speed control (0.1x - 2.0x) in PLAYBACK mode
- [ ] Negative offset handling (video A ahead of video B)
- [ ] End-of-video boundary handling (stops both when either reaches end)
- [ ] Tests: 9+ tests passing on Chrome, Firefox, WebKit (27+ total)
- [ ] Documentation: VIDEO_SYNC.md with WebCodecs-only architecture
- [ ] Documentation: PROJECT_PLAN.md updated (hybrid approach removed)
- [ ] Documentation: Framerate validation deferred to Phase 1 upload preview task

---

## Session Timeline

- **Session 1** (5-6 hours): Phases 1-2 (Component + SYNC + PLAYBACK with synchronized loop)
- **Session 2** (4-5 hours): Phases 3-4 (Testing + Documentation)

**Total estimate:** 9-11 hours across 2 sessions

---

## Technical Notes

**Cache Behavior on Seeking:**
- `seekToFrame()` checks cache first (line 351-365 in useWebCodecsDecoder.ts)
- Cache hit: Instant render (<10ms)
- Cache miss: Decode from keyframe (~254-344ms for GOP=30)
- During playback: 60-frame read-ahead keeps cache warm
- Stepping in PLAYBACK mode: Should be cache hits if within 60-frame window

**Hook Extension Needed:**
May need to extend `useWebCodecsDecoder` to expose:
1. `cache.has(frameIndex)` - Check if frame cached without triggering decode
2. `renderFrame(frameIndex)` - Render cached frame without state update
3. Or: Move synchronized playback loop into hook itself

**Alternative: Component-Level Playback:**
If hook extension is complex, implement synchronized playback at component level:
- Access both hooks' internal state
- Manually call `seekToFrame(frame, updateDisplay=false)` to advance without rendering
- Then call separate render functions

---

## Questions/Clarifications - ALL RESOLVED ✓

1. ✓ Framerate validation → Defer to Phase 1 upload preview task
2. ✓ SYNC mode independent speeds → Allowed
3. ✓ Offset display → Yes, show for testing/debugging
4. ✓ Mode switching stops playback → Yes, always
5. ✓ Negative offset handling → No special handling, math works the same

---

## Next Steps After Plan Approval

1. Create `DualVideoSyncDemo.tsx` component
2. Implement SYNC mode with independent controls
3. Implement PLAYBACK mode with synchronized event loop
4. Build comprehensive test suite (9+ tests)
5. Document WebCodecs-only architecture (VIDEO_SYNC.md)
6. Update PROJECT_PLAN.md to remove hybrid approach
7. Mark framerate validation for Phase 1 upload preview
