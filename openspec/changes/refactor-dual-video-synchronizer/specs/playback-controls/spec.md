## ADDED Requirements

### Requirement: Synchronized playback
In PLAYBACK mode, both videos advance together maintaining the sync offset.

#### Scenario: Play/pause both videos
- **WHEN** the user clicks play in PLAYBACK mode
- **THEN** both videos play simultaneously
- **THEN** the sync offset is maintained between video positions
- **THEN** clicking pause stops both videos

#### Scenario: Fine stepping (±1 frame)
- **WHEN** the user steps forward 1 frame in PLAYBACK mode
- **THEN** Video A advances by 1 frame
- **THEN** Video B advances by 1 frame from its offset position
- **THEN** the frame counter updates for both videos

#### Scenario: Coarse stepping (±5 frames)
- **WHEN** the user steps forward 5 frames in PLAYBACK mode
- **THEN** Video A advances by 5 frames
- **THEN** Video B advances by 5 frames from its offset position
- **THEN** boundary checks prevent stepping beyond video limits

#### Scenario: Speed control
- **WHEN** the user changes playback speed in PLAYBACK mode
- **THEN** both videos play at the selected speed
- **THEN** speed options include: 0.1x, 0.25x, 0.5x, 1.0x, 2.0x
- **THEN** the speed setting survives session save/load

### Requirement: Joint scrub bar
In PLAYBACK mode, a unified scrub bar controls both videos.

#### Scenario: Scrub to specific position
- **WHEN** the user drags the playhead on the joint scrub bar
- **THEN** both videos seek to positions maintaining the sync offset
- **THEN** the scrub bar position reflects the current playhead position
- **THEN** releasing the scrub bar finalizes the seek

#### Scenario: Scrub bar range validation
- **WHEN** the user attempts to scrub beyond the valid range
- **THEN** the position is clamped to the valid range
- **THEN** a log message indicates the clamping occurred

### Requirement: Trim bounds
The user can set start and end trim points for playback.

#### Scenario: Set trim start
- **WHEN** the user drags the trim start handle
- **THEN** playback only proceeds from the trim start position onward
- **THEN** the trim start position is stored in the trim store as a Video A frame number

#### Scenario: Set trim end
- **WHEN** the user drags the trim end handle
- **THEN** playback stops when reaching the trim end position
- **THEN** the trim end position is stored in the trim store as a Video A frame number

#### Scenario: Loop playback within trim bounds
- **WHEN** loop mode is enabled and the user plays within trim bounds
- **THEN** playback restarts from trim start upon reaching trim end
- **THEN** pressing "Return to In" jumps to trim start

#### Scenario: Trim bounds survive session save/load
- **WHEN** the user saves a session with custom trim bounds
- **THEN** the trim bounds are restored when the session is loaded

### Requirement: Frame counter accuracy
Frame counters SHALL display exact frame numbers with zero tolerance.

#### Scenario: Frame counter reflects exact decoder position
- **WHEN** the user steps frame-by-frame
- **THEN** the displayed frame number matches the decoder's actual frame exactly
- **THEN** the frame number is within the valid range [0, totalFrames-1]

#### Scenario: Frame counter during playback
- **WHEN** the user plays videos in PLAYBACK mode
- **THEN** the frame counter updates for each displayed frame
- **THEN** the frame counter remains accurate at all playback speeds
