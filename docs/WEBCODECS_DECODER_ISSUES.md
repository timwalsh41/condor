# WebCodecs Decoder Critical Issues

**Component:** `frontend/src/hooks/useWebCodecsDecoder.ts`
**Date:** 2025-11-24
**Severity:** High - Causes duplicate decode operations and potential rendering errors

---

## Issue 1: Incomplete `pendingDecodes` Tracking

### Severity: 🔴 CRITICAL

### Problem
Only playback loop tracks pending decodes. Initialization and `seekToFrame` do NOT add frames to `pendingDecodes`, causing duplicate decode requests.

### Current Code - Playback Loop (CORRECT)
```typescript
// Lines 624-646 - Playback loop DOES track pending
if (!cache.has(frameNum) && !pendingDecodes.has(frameNum)) {
  // ... find sample and create chunk
  decoder.decode(chunk);
  pendingDecodes.add(frameNum); // ✅ Tracked
  decodedCount++;
}
```

### Current Code - seekToFrame (BROKEN)
```typescript
// Lines 439-488 - seekToFrame does NOT track pending
for (let i = keyframeSampleIndex; i <= readAheadEnd; i++) {
  const chunk = createEncodedChunk(samples[i]);
  decoder.decode(chunk);
  // ❌ Missing: pendingDecodes.add(frameIndex)
}
```

### Current Code - Initialization (BROKEN)
```typescript
// Lines 918-927 - Initialization does NOT track pending
for (let i = 0; i <= readAheadEnd; i++) {
  const sample = samples[i];
  const chunk = new EncodedVideoChunk({...});
  decoder.decode(chunk);
  // ❌ Missing: pendingDecodes.add(i)
}
```

### Consequence - Duplicate Decode Scenario

**Timeline:**
```
T0: User seeks to frame 100
    → seekToFrame decodes frames 90-160 (not tracked in pendingDecodes)
    → Decoder queue: [90, 91, 92, ..., 160] (processing slowly)

T1: Frames 90-105 arrive and render (pendingDecodes updated as they arrive)
    → Cache: [90, 91, 92, ..., 105]
    → pendingDecodes: {} (cleared as frames arrive)

T2: User presses play at frame 105
    → Playback loop checks buffer [106-165]
    → Finds frames 106-160 are NOT cached AND NOT in pendingDecodes
    → Issues DUPLICATE decodes for frames 106-160
    → Decoder queue: [...original 106-160, ...duplicate 106-160]
```

### Impact
- **Performance**: Wasted CPU/GPU cycles decoding frames twice
- **Memory**: Increased decoder queue size
- **Latency**: Delayed response as decoder processes duplicates
- **Observed on**: Rapid seek-then-play interactions

---

## Issue 2: Race Condition - Concurrent Playback and Seek

### Severity: 🔴 CRITICAL

### Problem
Playback loop issues decode commands concurrently with `seekToFrame`. The `pendingOperationRef` queue only serializes seeks, not playback decodes.

### Current Code - Sequential Seek Queue
```typescript
// Lines 275-510 - Seeks are queued sequentially
const seekToFrame = useCallback(async (targetFrame: number) => {
  pendingOperationRef.current = pendingOperationRef.current.then(async () => {
    // ... decode logic
  });
  return pendingOperationRef.current;
}, []);
```

### Current Code - Playback Runs Independently
```typescript
// Lines 554-681 - Playback loop runs in rAF, NOT queued
function playbackLoop(timestamp: number) {
  if (!isPlayingRef.current) return;

  // ... render current frame

  // Issue decodes independently of pendingOperationRef
  for (let frameNum = bufferStart; frameNum <= bufferEnd; frameNum++) {
    if (!cache.has(frameNum) && !pendingDecodes.has(frameNum)) {
      decoder.decode(chunk); // ❌ Not coordinated with seeks
    }
  }

  playbackLoopRef.current = requestAnimationFrame(playbackLoop);
}
```

### Consequence - Overlapping Decode Operations

**Timeline:**
```
T0: Playback at frame 50
    → Playback loop decodes ahead: frames 51-110
    → Decoder queue: [51, 52, ..., 110]

T1: User seeks to frame 30 (backward)
    → seekToFrame queued via pendingOperationRef
    → Playback STILL RUNNING (isPlayingRef.current = true)

T2: Playback continues executing
    → Next rAF: decodes frames 52-111
    → Decoder queue: [51-110, 52-111] (overlapping)

T3: seekToFrame executes
    → Finds keyframe at 0, decodes frames 0-90
    → Decoder queue: [51-110, 52-111, 0-90] (massive overlap)

T4: Output callback receives frames in order
    → Renders frame 51, 52, 53... (from playback)
    → Then renders frame 30 (from seek)
    → User sees brief flash of wrong frames
```

### Impact
- **Rendering glitches**: Wrong frames briefly displayed
- **Wasted decodes**: Frames 51-90 decoded twice
- **User experience**: Janky seeks during playback

---

## Issue 3: Shared `updateDisplayRef` Across Operations

### Severity: 🟡 MODERATE

### Problem
Multiple queued seeks share the same `updateDisplayRef`, causing later operations to override earlier ones before they complete.

### Current Code
```typescript
// Line 104 - Single shared ref
const updateDisplayRef = useRef<boolean>(true);

// Lines 267-273 - Set at operation start
const seekToFrame = useCallback(async (targetFrame: number, updateDisplay: boolean = true) => {
  console.log(`[SEEK] seekToFrame called: target=${targetFrame}, updateDisplay=${updateDisplay}`);

  // Store in shared ref for output callback access
  updateDisplayRef.current = updateDisplay; // ❌ Overwrites previous operation's value

  // Chain operation (may execute later)
  pendingOperationRef.current = pendingOperationRef.current.then(async () => {
    // ... decode logic
  });
}, []);

// Lines 838-843, 849-857 - Read in async output callback
if (frameIndex === 0 && seekTargetRef.current === 0) {
  if (updateDisplayRef.current) { // ❌ May have changed since operation started
    renderFrameToCanvas(cached);
  }
}

if (frameIndex === seekTargetRef.current && updateDisplayRef.current) {
  renderFrameToCanvas(cached); // ❌ May have changed
}
```

### Consequence - Wrong Rendering Behavior

**Scenario:**
```typescript
// User rapidly seeks multiple times:
seekToFrame(50, true);   // Op1: Should render frame 50
seekToFrame(100, false); // Op2: Should NOT render frame 100
seekToFrame(150, true);  // Op3: Should render frame 150

// Execution timeline:
// T0: Op1 starts, sets updateDisplayRef=true, queues decode
// T1: Op2 starts, sets updateDisplayRef=false (OVERWRITES)
// T2: Op3 starts, sets updateDisplayRef=true (OVERWRITES)
// T3: Op1's frame 50 arrives
//     → Checks updateDisplayRef.current (now true from Op3)
//     → Renders frame 50 ✅ (accidentally correct)
// T4: Op2's frame 100 arrives
//     → Checks updateDisplayRef.current (still true from Op3)
//     → Renders frame 100 ❌ (should NOT render)
```

### Impact
- **Incorrect behavior**: Frames rendered when they shouldn't be
- **Affects**: Internal seek operations with `updateDisplay=false`
- **Low observed frequency**: Requires rapid seeks with different updateDisplay values

---

## Issue 4: No Cleanup of `pendingDecodes` on Decoder Reset

### Severity: 🟡 MODERATE

### Problem
When decoder is reset/reconfigured, `pendingDecodes` retains entries for frames that were queued but will never arrive (decoder discarded them). These stale entries block future decode attempts.

**Note:** Clearing on pause would be WRONG - those frames are actively decoding and will populate the cache for subsequent operations.

### Current Code - Decoder Reconfiguration
```typescript
// Lines 295-317 - Does NOT clear pendingDecodes after reset
if (decoder.state === "closed") {
  console.warn("[SEEK] Decoder closed, attempting reconfiguration...");
  const config = codecConfigRef.current;
  if (config) {
    try {
      decoder.configure(config);
      console.log("[SEEK] Decoder reconfigured successfully");
      // ❌ Missing: pendingDecodesRef.current.clear()
    } catch (reconfigErr) {
      // ...
    }
  }
}
```

### Current Code - Output Callback Cleanup
```typescript
// Line 827 - Clears pending when frame arrives (normal case)
pendingDecodesRef.current.delete(frameIndex);
```

### Consequence - Stale Entries Block Future Decodes

**Scenario:**
```
T0: Playback at frame 50
    → Decodes frames 51-110
    → pendingDecodes: {51, 52, ..., 110}

T1: Frames 51-70 arrive
    → pendingDecodes: {71, 72, ..., 110}

T2: Decoder error occurs, gets reconfigured (lines 295-317)
    → Decoder state reset
    → Queued frames 71-110 discarded by browser
    → pendingDecodes: {71, 72, ..., 110} (STALE - these will never arrive)

T3: User seeks to frame 80
    → Checks cache.has(80) → false
    → Checks pendingDecodes.has(80) → TRUE ✅
    → SKIPS decoding frame 80 ❌
    → Frame never arrives, stuck waiting
```

### Impact
- **Low probability**: Requires decoder reconfiguration while frames pending
- **Symptom**: Frame seek "hangs" without rendering
- **Mitigation**: Clear pendingDecodes whenever decoder is reconfigured

---

## Issue 5: Decoder State Assumptions During Playback

### Severity: 🟡 LOW (Observation, not a bug)

### Problem
Playback loop's incremental decode assumes decoder has dependencies for each frame. Works during sequential playback but has implicit complexity.

### Current Code
```typescript
// Lines 619-656 - Decodes individual missing frames
for (let frameNum = bufferStart; frameNum <= bufferEnd; frameNum++) {
  if (!cache.has(frameNum) && !pendingDecodes.has(frameNum)) {
    // Find this frame's sample
    const sampleIndex = samples.findIndex(s => s.cts === targetCts);
    const chunk = createEncodedChunk(samples[sampleIndex]);

    decoder.decode(chunk); // Assumes decoder has dependencies
  }
}
```

### H.264 Decode Order vs Presentation Order Complexity

**Decoder processes frames in decode order (sample index), not presentation order (frame number):**

```
Decode order:  [I-frame, P-frame, B-frame, P-frame]
Sample index:  [   0,      1,        2,       3   ]
CTS/PTS:       [   0,     30,       10,      20   ]
Presentation:  Frame 0 (I), Frame 1 (B), Frame 2 (P), Frame 3 (P)

To track decoder state: Need sample index (decode order)
Playback loop uses: Frame number (presentation order)
```

**If tracking lastDecodedFrame:**
- Must be in **decode order** (sample index), not presentation order
- Must map frame number → sample index → check sequentiality in decode order
- B-frames make presentation order ≠ decode order

### Why Current Implementation Works

1. **Sequential forward playback** → decoder naturally accumulates state
2. **Seeks always decode from keyframe** → establish proper dependencies
3. **No flush() calls** → decoder state preserved during playback
4. **Incremental decode only during active playback** → sequential by definition

### Current Design Trade-off

**Implicit state tracking** (current):
- ✅ Simple, no additional tracking
- ✅ Works for forward playback
- ❌ Assumes playback is always sequential

**Explicit state tracking** (potential):
- ✅ Robust to edge cases
- ❌ Complex (decode order vs presentation order)
- ❌ Additional overhead

**Recommendation:** Keep current approach - it's simple and handles the use case (forward video playback)
```

---

## Recommendations

### Priority 1 - Fix Duplicate Decodes

**Add pendingDecodes tracking to all decode operations:**

```typescript
// In seekToFrame decode loop (line 439):
for (let i = keyframeSampleIndex; i <= readAheadEnd; i++) {
  const sample = samples[i];
  const chunk = createEncodedChunk(sample);

  // Get frame index from timestamp
  const frameIndex = timestampToIndexRef.current.get(sample.cts);
  if (frameIndex !== undefined) {
    pendingDecodesRef.current.add(frameIndex); // ✅ ADD THIS
  }

  decoder.decode(chunk);
}

// In initialization (line 918):
for (let i = 0; i <= readAheadEnd; i++) {
  const sample = samples[i];
  // ... create chunk

  const frameIndex = timestampToIndexRef.current.get(sample.cts);
  if (frameIndex !== undefined) {
    pendingDecodesRef.current.add(frameIndex); // ✅ ADD THIS
  }

  decoder.decode(chunk);
}
```

### Priority 2 - Coordinate Playback and Seek

**Pause playback loop during seeks:**

```typescript
const isSeekingRef = useRef(false);

// In seekToFrame:
isSeekingRef.current = true;
pendingOperationRef.current = pendingOperationRef.current.then(async () => {
  try {
    // ... existing decode logic
  } finally {
    isSeekingRef.current = false;
  }
});

// In playback loop (line 602):
if (decoder && decoder.state === "configured" && samples.length > 0) {
  if (isSeekingRef.current) {
    // Skip buffer fill during seek
    return;
  }

  // ... existing buffer fill logic
}
```

### Priority 3 - Fix Shared updateDisplayRef

**Store updateDisplay per-operation:**

```typescript
// Replace single ref with map
const seekOperationsRef = useRef<Map<number, { target: number; updateDisplay: boolean }>>(new Map());
let operationIdCounter = 0;

// In seekToFrame:
const operationId = ++operationIdCounter;
seekOperationsRef.current.set(operationId, {
  target: clampedTarget,
  updateDisplay
});

// Pass operationId through seekTargetRef or separate ref
seekTargetRef.current = clampedTarget;
currentOperationIdRef.current = operationId;

// In output callback:
const operation = seekOperationsRef.current.get(currentOperationIdRef.current);
if (frameIndex === seekTargetRef.current && operation?.updateDisplay) {
  renderFrameToCanvas(cached);
  seekOperationsRef.current.delete(currentOperationIdRef.current);
}
```

### Priority 4 - Clear Pending State on Decoder Reset

```typescript
// In seekToFrame decoder reconfiguration (line 302):
if (decoder.state === "closed") {
  console.warn("[SEEK] Decoder closed, attempting reconfiguration...");
  const config = codecConfigRef.current;
  if (config) {
    try {
      decoder.configure(config);
      pendingDecodesRef.current.clear(); // ✅ ADD THIS - decoder discarded pending frames
      console.log("[SEEK] Decoder reconfigured successfully");
    } catch (reconfigErr) {
      // ...
    }
  }
}

// Also clear on initialization (line 897):
decoder.configure(codecConfig);
pendingDecodesRef.current.clear(); // ✅ ADD THIS - fresh decoder state
decoderRef.current = decoder;
```

---

## Testing Scenarios

### Test 1: Duplicate Decode Detection
```
1. Seek to frame 100 (initiates decode 90-160)
2. Immediately press play before frames arrive
3. Check console for duplicate "[PLAYBACK] Buffer fill" logs
4. Expected: Should NOT re-decode frames 100-160
```

### Test 2: Seek During Playback
```
1. Start playback from frame 0
2. While playing, rapidly seek backward to frame 30
3. Observe rendering (should not flash frames 50-60)
4. Check decoder queue size in logs
5. Expected: Clean transition to frame 30, minimal queue buildup
```

### Test 3: UpdateDisplay Override
```
1. Call seekToFrame(50, true)
2. Immediately call seekToFrame(100, false)
3. Observe whether frame 100 renders
4. Expected: Frame 100 should NOT render to canvas
```

### Test 4: Pause with Pending Frames
```
1. Start playback
2. Pause at frame 50
3. Trigger decoder error (load corrupted video segment)
4. Seek to frame 80
5. Expected: Frame 80 should render (not blocked by stale pendingDecodes)
```

---

## Metrics to Add

```typescript
const decodeMetrics = useRef({
  totalRequested: 0,
  duplicatesDetected: 0,
  cacheHits: 0,
  cacheMisses: 0,
});

// Before decoder.decode():
if (pendingDecodes.has(frameNum)) {
  decodeMetrics.current.duplicatesDetected++;
  console.warn(`[METRICS] Duplicate decode blocked: frame ${frameNum}`);
  return; // Skip decode
}
```

---

**End of Document**
