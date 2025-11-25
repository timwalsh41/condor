Code Review: Firefox Playback Fix
Let me trace through the changes and evaluate them critically:

1. LOOKAHEAD_FRAMES Constant (Line 17)
   ✅ Good: Eliminates magic numbers, ensures consistency between seek and playback
   ✅ Correct: Used in both seekToFrame (line 403) and playback buffer logic (line 618)
   ⚠️ Minor: Could benefit from making it configurable (e.g., based on GOP size), but hardcoded 60 is fine for MVP

2. seekToFrame: Error Handling (Lines 286-307)
   ✅ Critical Fix: Now throws errors instead of returning, properly rejecting the promise chain
   ✅ Correct: Playback loop's .catch() handler will now fire and stop playback
   ✅ Good: Maintains error messages for user feedback

3. seekToFrame: State Change Detection (Lines 445-469)
   ✅ Good Defensive Code: Detects synchronous decode errors and state transitions
   ✅ Useful Diagnostics: Logs will help identify if/when Firefox changes state mid-decode
   ⚠️ Type Safety Workaround: Uses any cast to check state (TypeScript doesn't expect it to change)
   ❓ Question: Is this still needed now that we fixed the queue overflow? May become noise in logs.

Recommendation: Keep for now (helps diagnose future issues), but consider removing the per-chunk logging if it's too verbose once stable.

4. Playback Loop: Incremental Buffer Fill (Lines 594-649)
   ✅ CRITICAL FIX: Only decodes missing frames instead of calling seekToFrame
   ✅ Correct Logic: Checks cache state and fills gaps incrementally
   ✅ Performance: Prevents queue overflow (was 400-500 frames, now should be <30)

However, there are concerns:

Concern A: Inefficient Frame→Sample Lookup
This is O(n²) - for each missing frame, we iterate through the entire timestampToIndex map and then the samples array. For 60 frames, this could be 3600+ iterations per playback tick!

Better approach: Pre-build a reverse map frameNumberToCts during initialization:

Then lookup is O(1):

Concern B: Duplicate Logic
The frame→CTS→sample lookup logic (lines 627-647) is duplicated from seekToFrame (lines 353-383). This violates DRY and creates maintenance burden.

Better approach: Extract to a helper function:

Concern C: Error Handling in RAF Loop
Errors are logged but swallowed - playback continues even if decode fails. This could lead to permanent gaps in the cache if a frame can't be decoded.

Better approach: Track failed frames and either:

Stop playback on first error (fail-fast)
Skip failed frames but show warning indicator
Retry failed frames on next iteration 5. Cache Miss Handler: Polling Logic (Lines 675-697)
⚠️ Code Smell: Polling with setTimeout in an async function inside a RAF loop is complex and fragile

Issues:

Blocking: Even though it's async, this ties up the promise chain
Race Condition: What if the output callback fires between the has() check and the setTimeout?
Redundant: If incremental decode works correctly, we shouldn't have cache misses during playback
Performance: 10ms polling interval = 100 checks/second, unnecessary overhead
Better approach:

If incremental decode is working, cache misses shouldn't happen
If they do happen, it indicates a bug in the buffer fill logic
Consider: Remove polling and just call seekToFrame which already handles the decode→render flow
Question: Is this polling actually needed, or is it a band-aid for a deeper issue?

6. Missing: Decoder Queue Size Monitoring
   The original issue was queue overflow (463 frames). After the fix, we should verify the queue stays small.

Recommendation: Add periodic logging in playback loop:

Summary of Concerns
Issue Severity Impact Effort to Fix
O(n²) frame lookup 🔴 High Performance degradation during playback Medium (add reverse map)
Duplicate lookup logic 🟡 Medium Maintenance burden, potential bugs Low (extract helper)
Error swallowing in RAF 🟡 Medium Silent failures, corrupt cache state Low (add error strategy)
Polling in cache miss 🟡 Medium Code complexity, may be unnecessary Medium (rethink approach)
Missing queue monitoring 🟢 Low Harder to diagnose future issues Low (add logging)
Architectural Question
The incremental decode approach assumes the decoder maintains state between decode() calls during sequential playback. This is correct BUT there's a subtle issue:

When we have a cache miss during playback (line 657), we call seekToFrame(nextFrame) which decodes from the keyframe to nextFrame + 60. This resets the decoder's "sequential decode state" because we're jumping backwards to the keyframe.

Example:

Playing frame 50 (cache has 50-110)
Render frame 110
Cache miss on frame 111
Call seekToFrame(111) → decodes from keyframe 90 to frame 171
Now incremental decode resumes from frame 111
But decoder just decoded 90→171, so it has all dependencies
This is actually fine - seekToFrame re-establishes the decode chain. But it means cache misses during playback are expensive (30+ frame decodes).

The real question: With proper incremental buffering, should we ever hit cache misses during forward playback? If the answer is "no", then the polling logic is unnecessary complexity.

Recommendation
The core fix (incremental decode) is correct and solves the queue overflow. However, there are code quality issues:

Performance: Add reverse frame→CTS map to eliminate O(n²) lookups
DRY: Extract frame→sample lookup to helper function
Simplification: Consider removing polling logic if cache misses don't occur with proper buffering
Monitoring: Add queue size logging to verify the fix
