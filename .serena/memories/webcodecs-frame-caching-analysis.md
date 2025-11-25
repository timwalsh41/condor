# WebCodecs Frame Caching Analysis

## Issue: Initialization Caches to Frame 57 Instead of 59

### Expected Behavior
With `LOOKAHEAD_FRAMES = 60`, initialization should cache frames 0-59 (60 frames total).

### Observed Behavior  
User reports caching stops at frame 57 (58 frames total).

### Root Cause Analysis

#### 1. **Terminology Confusion: Samples vs Frames**

The initialization code iterates over **samples** (decode order), but comments/logs say **frames** (presentation order):

```typescript
// Line 1016-1022
// Decode frame 0 through LOOKAHEAD_FRAMES for smooth playback start  // ❌ Misleading comment
const readAheadEnd = Math.min(LOOKAHEAD_FRAMES, samples.length - 1);  // 60
console.log(`[INIT] Decoding initial buffer: frames 0-${readAheadEnd}...`);  // ❌ Says "frames" but means "samples"

for (let i = 0; i <= readAheadEnd; i++) {  // Decodes samples 0-60 (61 samples)
  const sample = samples[i];
  decoder.decode(chunk);
}
```

**The code decodes 61 samples (indices 0-60), not frames 0-60.**

#### 2. **Sample-to-Frame Mapping with B-frames**

Due to H.264 B-frames:
- **Samples** are stored in **decode order** (dependency order)
- **Frames** are displayed in **presentation order** (sorted by CTS)
- Decoding samples 0-60 doesn't necessarily give frames 0-60

**Example with B-frames:**
```
Sample 0: CTS=0   → Frame 0 (I)
Sample 1: CTS=40  → Frame 2 (P) 
Sample 2: CTS=20  → Frame 1 (B)
Sample 3: CTS=60  → Frame 3 (P)
Sample 4: CTS=80  → Frame 4 (P)
...
```

In typical H.264 encoding with GOP size 30:
- Samples 0-29 contain frames 0-29 (just reordered)
- Samples 30-59 contain frames 30-59 (just reordered)
- Sample 60 contains frame 60

**So decoding samples 0-60 should give frames 0-60**, maintaining the 1:1 mapping within GOP boundaries.

#### 3. **Possible Explanations for Frame 57**

If initialization decodes 61 samples (0-60) but only caches frames 0-57 (58 frames), possible causes:

**A. Off-by-two error in sample count:**
- If the code is actually decoding samples 0-57 (58 samples), readAheadEnd would be 57
- But `Math.min(LOOKAHEAD_FRAMES, samples.length - 1) = Math.min(60, ...) = 60` (not 57)
- **Unlikely** unless LOOKAHEAD_FRAMES is somehow 57

**B. Three samples have invalid timestamp mappings:**
- Output callback skips frames where `frameIndex === undefined` (line 888-894)
- If 3 samples have CTSes not in `timestampToIndexRef`, they'd be skipped
- **Unlikely** since all samples are mapped during initialization (line 863-867)

**C. Asynchronous decode timing:**
- `decoder.decode()` is synchronous (queues work)
- Output callback is asynchronous (fires when frame ready)
- **Most likely**: Frames 58-60 may still be in the decode queue when user checks cache
- But user reports waiting "a moment" and it never reaches 58

**D. Sample-to-frame mismatch (B-frame edge case):**
- If samples 58-60 correspond to frames from a later GOP due to encoding artifact
- **Possible but rare** - would violate typical GOP structure

#### 4. **Off-by-One Error (Separate Issue)**

Even if all samples decode successfully, there's an off-by-one error:

```typescript
const readAheadEnd = Math.min(LOOKAHEAD_FRAMES, samples.length - 1);  // 60
for (let i = 0; i <= readAheadEnd; i++)  // Decodes 0-60 (61 samples)
```

If `LOOKAHEAD_FRAMES = 60` means "cache 60 frames", we should decode samples 0-59:

```typescript
const readAheadEnd = Math.min(LOOKAHEAD_FRAMES - 1, samples.length - 1);  // 59
for (let i = 0; i <= readAheadEnd; i++)  // Decodes 0-59 (60 samples)
```

But this would give 60 frames, not 58.

### Diagnostic Questions

To pinpoint the issue, check console logs:

1. **What does initialization log?**
   ```
   [INIT] Decoding initial buffer: frames 0-<X> (<Y> total frames)
   ```
   - Is X = 60? (decoding 61 samples)
   - Is Y = 61?

2. **What does output callback log?**
   ```
   [OUTPUT] Received frame: timestamp=<cts>, frameIndex=<N>, ...
   ```
   - Do you see frames 0-57 received?
   - Do you see frames 58, 59, 60 ever arrive?
   - Any "Unknown timestamp" warnings?

3. **What is the GOP size?**
   ```
   [INIT] Video metadata: ..., GOP=<X>
   ```

4. **Are there any decode errors?**
   - Any `[DECODER ERROR]` logs?

### Hypothesis

**Most likely:** Timing-related issue where initialization completes before all 61 queued frames finish decoding. Frames 58-60 are in the decode queue but haven't called the output callback yet.

**Fix:** Add logging at end of initialization to show `pendingDecodesRef.current.size` - if it's 3, that confirms frames are pending but not cached yet.

**Alternative hypothesis:** Off-by-one error combined with a timing issue - we're decoding 61 samples but only expecting/waiting for 60, and due to async timing, only 58 have arrived when initialization "completes".

### Recommended Fix

1. **Fix off-by-one error:**
   ```typescript
   const readAheadEnd = Math.min(LOOKAHEAD_FRAMES - 1, samples.length - 1);
   ```

2. **Fix misleading logs:**
   ```typescript
   console.log(`[INIT] Decoding initial buffer: samples 0-${readAheadEnd} (${readAheadEnd + 1} samples, will cache corresponding frames)`);
   ```

3. **Add diagnostic logging:**
   ```typescript
   console.log(`[INIT] Queued ${readAheadEnd + 1} samples, pending decodes: ${pendingDecodesRef.current.size}`);
   ```
