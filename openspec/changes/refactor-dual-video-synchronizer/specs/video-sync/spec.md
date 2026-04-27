## ADDED Requirements

### Requirement: Dual-video synchronization mode
In SYNC mode, each video has independent playback controls. The user navigates each video to a synchronization point and switches to PLAYBACK mode to lock the offset.

#### Scenario: Independent video playback in SYNC mode
- **WHEN** the user is in SYNC mode with both videos loaded
- **THEN** each video has its own play/pause, scrub bar, step buttons (±1, ±5), and speed selector
- **THEN** operating one video's controls does not affect the other video's position

#### Scenario: Mode toggle from SYNC to PLAYBACK
- **WHEN** the user clicks "Switch to PLAYBACK Mode" while in SYNC mode
- **THEN** both videos stop playing
- **THEN** the sync offset is calculated as `frameB - frameA` from current positions
- **THEN** the playhead is initialized with the calculated offset
- **THEN** trim handles are set to the full valid range

#### Scenario: Mode toggle from PLAYBACK to SYNC
- **WHEN** the user clicks "Switch to SYNC Mode" while in PLAYBACK mode
- **THEN** playback stops
- **THEN** both videos seek to the saved sync points
- **THEN** the mode indicator updates to SYNC

### Requirement: Sync offset calculation
The sync offset represents the frame difference between the two videos.

#### Scenario: Positive sync offset
- **WHEN** Video A is at frame 100 and Video B is at frame 150
- **THEN** the sync offset is +50 (Video B is 50 frames ahead)

#### Scenario: Negative sync offset
- **WHEN** Video A is at frame 150 and Video B is at frame 100
- **THEN** the sync offset is -50 (Video B is 50 frames behind)

#### Scenario: Zero sync offset
- **WHEN** both videos are at the same frame
- **THEN** the sync offset is 0

### Requirement: Sync offset persistence
The sync offset must survive session save and load.

#### Scenario: Save sync offset to session
- **WHEN** the user saves a session in PLAYBACK mode with a non-zero sync offset
- **THEN** the sync offset is stored in the session payload

#### Scenario: Restore sync offset on session load
- **WHEN** the user loads a saved session
- **THEN** the sync offset is restored from the stored session data
- **THEN** both videos are positioned according to the saved sync points
