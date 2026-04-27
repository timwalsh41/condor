## ADDED Requirements

### Requirement: Session save
The system SHALL save the complete analysis session state including videos, sync settings, annotations, and playback configuration.

#### Scenario: Save session with sync/playback state
- **WHEN** the user is in PLAYBACK mode with videos loaded and sync configured
- **THEN** saving the session captures the mode, sync offset, trim bounds, playback rate, and loop state
- **THEN** saving the session captures all annotations from both video channels
- **THEN** the save requires library videos to be available (videos must be saved to library first)

#### Scenario: Save button disabled state
- **WHEN** videos have not been saved to the library
- **THEN** the save session button is disabled
- **WHEN** videos are saved to the library
- **THEN** the save session button becomes enabled

#### Scenario: Save without videos shows error
- **WHEN** the user attempts to save a session without loaded videos
- **THEN** an error state is shown indicating videos are required

### Requirement: Session load and restoration
The system SHALL restore a complete session from storage with all state intact.

#### Scenario: Full state restoration on session load
- **WHEN** the user loads a saved session
- **THEN** the mode is restored to PLAYBACK
- **THEN** the sync offset is restored
- **THEN** the playback rate is restored
- **THEN** the loop state is restored
- **THEN** trim bounds are restored
- **THEN** annotations from both channels are restored
- **THEN** videos are loaded from the library

#### Scenario: Session switching with annotation hydration
- **WHEN** the user switches from one session to another
- **THEN** the previous session's state is cleared
- **THEN** the new session's state is loaded
- **THEN** annotations are correctly hydrated for the new session
- **THEN** no annotations from the previous session leak into the new session

#### Scenario: Annotations visible immediately after restore
- **WHEN** a session with annotations is loaded
- **THEN** annotations are visible on the first rendered frame (no visual flash or delay)
- **THEN** the Konva layer is drawn synchronously after hydration

### Requirement: Session lifecycle
The system SHALL support the full session lifecycle: create → modify → save → load → re-save.

#### Scenario: Session persistence across page reload
- **WHEN** the user saves a session
- **THEN** the session survives a page reload
- **THEN** the user can reload the session after reloading the page

#### Scenario: Session deletion
- **WHEN** the user deletes a session
- **THEN** the session is removed from the sessions list
- **THEN** if the deleted session was active, the active session is cleared
