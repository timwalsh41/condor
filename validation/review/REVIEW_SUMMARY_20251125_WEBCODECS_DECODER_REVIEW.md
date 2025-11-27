# WebCodecs Decoder Implementation Review

**File:** `frontend/src/hooks/useWebCodecsDecoder.ts`
**Review Date:** 2025-11-25
**Reviewer:** Claude Code

## Executive Summary

The `useWebCodecsDecoder` hook implements a sophisticated frame-accurate video decoder with caching, seeking, and playback capabilities. The implementation demonstrates strong understanding of WebCodecs API, MP4 structure, and React patterns.

**Overall Assessment: GOOD with performance optimizations recommended**

### Strengths
- ✅ **Correct memory management** - VideoFrames properly cloned/closed, no leaks
- ✅ **Excellent documentation** - Clear comments explaining complex logic and design decisions
- ✅ **Robust error handling** - Decoder state recovery, comprehensive error logging
- ✅ **Sound architecture** - Proper separation between frame numbers, sample indices, and timestamps
- ✅ **Sequential decode order** - Correctly maintains inter-frame dependencies

### Critical Issues
- ⚠️ **None** - No bugs that would cause crashes or data corruption

### Performance Concerns
- 🔴 **O(n) lookups** - Repeated linear searches through timestamp maps and sample arrays (lines 166-171, 182-187, 378-386, 401-406, 697)
- 🟡 **Long functions** - `seekToFrame` (300 lines) and `playbackLoop` (204 lines) violate 100-line guideline
- 🟡 **Cache miss handling** - Fire-and-forget seek during playback could cause stuttering (line 801)
- 🟡 **Lookahead overhead** - Decoding 60 frames for single-step operations

### Code Quality Issues
- 🔵 **Magic numbers** - Queue size threshold (100), retry counts (5), delays (10ms) should be constants
- 🔵 **DRY violations** - Timestamp lookup logic duplicated across functions
- 🔵 **Inconsistent patterns** - Reverse mapping used in some places (line 430) but not others (lines 166-171, 378-386)

### Risk Assessment
- **Correctness:** LOW RISK - Implementation is fundamentally sound
- **Performance:** MEDIUM RISK - O(n) lookups acceptable for short videos, problematic for 1000+ frame videos
- **Maintainability:** MEDIUM RISK - Function length and complexity make changes error-prone

---

## Detailed Analysis

### 1. Correctness

#### 1.1 Race Condition Handling ✅
The implementation correctly uses `isSeekingRef` to coordinate between seek operations and playback loop:
```typescript
// Line 671-675: Playback buffer fill checks seeking flag
if (decoder && decoder.state === "configured" &&
    samples.length > 0 && !isSeekingRef.current) {
  // Safe to fill buffer
}
```

However, there's a subtle issue with cache miss during playback (lines 792-810):
```typescript
// Fire-and-forget seek - playback loop continues immediately
seekToFrame(nextFrame, false).catch((err) => {
  // Error handling
});
```
**Issue:** The playback loop continues to the next rAF callback before seek completes, potentially hitting another cache miss. This could cause cascading misses and visible stuttering.

**Recommendation:** Consider pausing playback during cache miss recovery, or awaiting the seek before continuing.

#### 1.2 Decoder State Management ✅
Good recovery logic for closed decoder (lines 308-332):
- Detects closed state
- Attempts reconfiguration with stored codec config
- Clears pending decodes (decoder discards queued frames)
- Throws error if recovery fails

#### 1.3 Frame Mapping ✅
Correctly maintains three separate concepts:
- **Frame number:** Presentation order (what user sees)
- **Sample index:** Decode order (MP4 samples array)
- **Timestamp (CTS):** MP4 composition timestamp

Two-way mappings are established during initialization (lines 921-930):
- `timestampToIndexRef`: CTS → frame number
- `frameToTimestampRef`: frame number → CTS

### 2. Performance Issues

#### 2.1 Coordinate System Mappings 🔴 CRITICAL

**The Problem:** The decoder bridges three coordinate systems with inefficient O(n) lookups and manual map synchronization.

**Three Coordinate Systems:**
1. **Frame Number** (presentation order): `0, 1, 2, 3...` - what user sees
2. **CTS** (composition timestamp): `0, 3000, 6000, 9000...` - MP4 timescale units
3. **Sample Index** (decode order): `0, 1, 2, 3...` - position in samples[] array

These form a **3-way isomorphism** - each value in one system maps to exactly one value in the others.

**Current Issues:**

**Issue A:** Inefficient O(n) lookups instead of using reverse map (lines 166-171, 378-386):
```typescript
let targetCts = -1;
for (const [cts, frameNum] of timestampToIndexRef.current.entries()) {
  if (frameNum === clampedTarget) {  // Should use frameToTimestampRef.get()!
    targetCts = cts;
    break;
  }
}
```

**Issue B:** Missing CTS → Sample index map (lines 401-406, 697):
```typescript
let targetSampleIndex = -1;
for (let i = 0; i < samples.length; i++) {
  if (samples[i].cts === targetCts) {
    targetSampleIndex = i;
    break;
  }
}
```

**Issue C:** Manual synchronization of isomorphic Frame ↔ CTS maps:
```typescript
timestampToIndexRef.current.set(cts, frameNum);
frameToTimestampRef.current.set(frameNum, cts);  // Must update both manually
```

**Impact:** For a 1000-frame video, each seek performs 2-3 O(n) searches. During playback with buffer fill, this executes hundreds of times per second.

**Solution:** Create a `CoordinateMapping` class that encapsulates the entire 3-way relationship:

```typescript
// utils/CoordinateMapping.ts
export class CoordinateMapping {
  private frameCts = new BiDirectionalMap<number, number>();
  private ctsToSample = new Map<number, number>();
  private samples: Sample[];

  constructor(samples: Sample[]) {
    this.samples = samples;
  }

  set(frameNum: number, cts: number, sampleIdx: number): void {
    this.frameCts.set(frameNum, cts);
    this.ctsToSample.set(cts, sampleIdx);
  }

  // Frame ↔ CTS (O(1))
  getCts(frameNum: number): number | undefined {
    return this.frameCts.get(frameNum);
  }
  getFrame(cts: number): number | undefined {
    return this.frameCts.getReverse(cts);
  }

  // CTS ↔ Sample (O(1))
  getSample(cts: number): number | undefined {
    return this.ctsToSample.get(cts);
  }
  getCtsFromSample(sampleIdx: number): number {
    return this.samples[sampleIdx].cts;  // O(1) array access
  }

  // Frame ↔ Sample (O(1) - composed from two O(1) lookups)
  getSampleFromFrame(frameNum: number): number | undefined {
    const cts = this.getCts(frameNum);
    return cts !== undefined ? this.getSample(cts) : undefined;
  }
  getFrameFromSample(sampleIdx: number): number | undefined {
    const cts = this.getCtsFromSample(sampleIdx);
    return this.getFrame(cts);
  }

  clear(): void {
    this.frameCts.clear();
    this.ctsToSample.clear();
  }
}
```

**Usage in useWebCodecsDecoder.ts:**

```typescript
// Replace timestampToIndexRef, frameToTimestampRef with single mapping
const coordinateMap = useRef<CoordinateMapping>(null!);

// Initialization (lines ~921-930)
coordinateMap.current = new CoordinateMapping(samples);

for (let frameNum = 0; frameNum < sortedByPts.length; frameNum++) {
  const { cts, sampleIndex } = sortedByPts[frameNum];
  coordinateMap.current.set(frameNum, cts, sampleIndex);
}

// Usage - Replace lines 166-171, 378-386
const targetCts = coordinateMap.current.getCts(targetFrameNumber);  // O(1)

// Usage - Replace lines 401-406, 697
const targetSampleIndex = coordinateMap.current.getSample(targetCts);  // O(1)

// Usage - Output callback (line 945)
const frameIndex = coordinateMap.current.getFrame(frame.timestamp);  // O(1)
```

**Benefits:**
- ✅ All 6 directions are O(1) (direct lookups 1 hop, composed lookups 2 hops)
- ✅ Makes 3-way isomorphism explicit in the architecture
- ✅ Impossible for mappings to get out of sync
- ✅ Clear, readable API: `getCts(frame)` vs `map.current.get(frame)`
- ✅ Single source of truth for coordinate conversions
- ✅ Same memory usage (3 internal maps)

#### 2.2 Lookahead Strategy 🟡
```typescript
const LOOKAHEAD_FRAMES = 60; // Lines 17
```
- Decodes 60 frames (2 seconds) for every seek operation
- Good for continuous playback, excessive for single-step operations
- Memory impact: ~1MB per frame × 60 = ~60MB per seek

**Recommendation:** Consider adaptive lookahead based on operation type:
- Single step: 5-10 frames
- Playback: 60 frames
- Rapid seeking: 30 frames

#### 2.3 Sequential Decode Logic ✅
The buffer fill correctly decodes ALL samples from `lastDecodedSampleRef + 1` to `maxSampleNeeded` (lines 706-723). This is necessary to maintain inter-frame dependencies, despite seeming inefficient.

**Note:** This is correct for inter-frame codecs (H.264, H.265). The alternative would be seeking from keyframe each time, which is worse.

### 3. Code Quality

#### 3.1 Function Length 🔴
Violates CLAUDE.md guideline (100 lines max):
- `seekToFrame`: 300 lines (277-576)
- `playbackLoop`: 204 lines (615-819)

**Recommendation:** Extract helper functions:
```typescript
// Extract decode loop
function decodeFrameRange(decoder, samples, startIdx, endIdx) { ... }

// Extract buffer fill logic
function fillPlaybackBuffer(currentFrame, lookaheadFrames) { ... }

// Extract timestamp lookups
function getTimestampForFrame(frameNum: number): number { ... }
function getSampleIndexForTimestamp(cts: number): number { ... }
```

#### 3.2 Magic Numbers 🔵
```typescript
if (decoder.decodeQueueSize > 100) { ... }  // Line 785
if (retryCount < 5) { ... }                 // Line 1003
setTimeout(retryRender, 10 * retryCount);   // Line 1006
```

**Recommendation:**
```typescript
const MAX_DECODER_QUEUE_SIZE = 100;
const MAX_CANVAS_RENDER_RETRIES = 5;
const CANVAS_RETRY_DELAY_MS = 10;
```

#### 3.3 DRY Violations 🔵
EncodedVideoChunk creation logic appears in two places:
- `createEncodedChunk` function (lines 246-256)
- Initialization loop (lines 1117-1122)

**Good:** First location uses the helper
**Bad:** Initialization duplicates the logic instead of calling helper

#### 3.4 Logging 🟡
Extensive console.log statements throughout:
- Good for debugging
- Should be removed or gated in production
- Some logs are appropriately throttled (line 629: every 30 frames)

**Recommendation:**
```typescript
const DEBUG = process.env.NODE_ENV === 'development';
const log = (...args) => DEBUG && console.log(...args);
```

### 4. Potential Issues

#### 4.1 Pending Decodes Tracking 🟡
The `pendingDecodesRef` set tracks frames queued for decode (prevents duplicates). However:
- No timeout mechanism
- If output callback never fires (decode error), frame stays pending forever
- Buffer fill will skip that frame indefinitely

**Recommendation:** Add cleanup logic in decoder error callback:
```typescript
error: (err) => {
  // Clear pending decodes - decoder has discarded all queued frames
  pendingDecodesRef.current.clear();
  // ... existing error handling
}
```

#### 4.2 Canvas Retry Logic 🔵
Lines 996-1014 use nested `setTimeout` for retrying canvas render:
```typescript
const retryRender = () => {
  if (canvasRef.current && cacheRef.current.has(0)) {
    renderFrameToCanvas(frame0);
  } else if (retryCount < 5) {
    retryCount++;
    setTimeout(retryRender, 10 * retryCount);
  }
};
setTimeout(retryRender, 10);
```

**Issue:** Complex nested callbacks, hard to reason about timing

**Recommendation:** Simplify with async/await:
```typescript
async function waitForCanvas(maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    if (canvasRef.current) return true;
    await new Promise(resolve => setTimeout(resolve, 10 * (i + 1)));
  }
  return false;
}
```

#### 4.3 Inconsistent Reverse Mapping Usage 🔵
The code creates `frameToTimestampRef` (frame → CTS) at line 929, and correctly uses it at line 430:
```typescript
const lookaheadFrameCts = frameToTimestampRef.current.get(targetFramePlusLookahead);
```

But earlier in the same function (lines 378-386), it uses a linear search instead:
```typescript
let targetCts = -1;
for (const [cts, frameNum] of timestampToIndexRef.current.entries()) {
  if (frameNum === clampedTarget) {
    targetCts = cts;
    break;
  }
}
```

**Fix:** Replace with `const targetCts = frameToTimestampRef.current.get(clampedTarget);`

### 5. Memory Management ✅

Correct handling throughout:
```typescript
// Line 960: Clone for cache
const cached = frame.clone();
cacheRef.current.set(frameIndex, cached);

// Line 974: Close original
frame.close();

// Line 1171: Cleanup clears cache
cache.clear(); // This closes all cached frames
```

**No memory leaks detected.**

### 6. Recommendations Summary

#### High Priority (Performance)
1. **Implement CoordinateMapping class** - Encapsulate 3-way isomorphism (Frame↔CTS↔Sample) to eliminate all O(n) lookups and prevent map desync (lines 166-171, 378-386, 401-406, 697)
2. **Improve cache miss handling** - Pause playback or await seek completion (line 801)

#### Medium Priority (Code Quality)
3. **Extract helper functions** - Break down `seekToFrame` and `playbackLoop`
4. **Convert magic numbers** - Define named constants for thresholds
5. **Clean up logging** - Gate debug logs behind environment flag
6. **Clear pending decodes on error** - Prevent stuck pending frames

#### Low Priority (Nice to Have)
7. **Adaptive lookahead** - Reduce frames for single-step operations
8. **Simplify canvas retry** - Use async/await instead of nested callbacks
9. **Add performance metrics** - Track decode times, cache hit rates in production

---

## Conclusion

This is a **well-implemented, production-ready decoder** with room for performance optimization. The core logic is sound, memory management is correct, and error handling is robust. The main concerns are:

1. **Performance degrades for long videos** due to O(n) coordinate system lookups
2. **Function complexity** makes maintenance challenging
3. **Cache miss during playback** could cause stuttering

All issues are fixable with targeted refactoring. The decoder will work correctly as-is, but the **CoordinateMapping class** optimization (#1 above) is strongly recommended before deploying to production with videos >500 frames to ensure consistent O(1) performance.

**Risk Level:** LOW
**Deployment Ready:** YES (with performance monitoring)
**Recommended Actions:** Implement CoordinateMapping class to eliminate O(n) lookups before production release
