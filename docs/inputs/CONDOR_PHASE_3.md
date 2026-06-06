# Overview

Condor Phase 3 further enhances basic product functionality, preparing for multi-user support and adding general ease-of-use improvements.

# List of Features

## Workflow Improvements

- [ ] Set default video height to 800 px
- [ ] Support different frame rates between videos in a session by adjusting playback framerate and step size
- [ ] Allow manual override of fps setting - seems phone cameras (particularly with slow-mo mode) do not always report this accurately
- [ ] With "Select" tool, when clicking on the canvas off any existing annotation, then deselect all annotations for that channel

## Library and Session Management

- [ ] Show available existing golfer names from library in a dropdown when filling out library/session info
- [ ] Auto-populate golfer name(s) from saved videos into session metadata 
- [ ] Auto-populate today's date as the swing date in the save video dialog
- [ ] Add a clear session button in the control bar with the video and session save controls, clear should basically restore to a fresh analysis screen with no videos loaded, no sync/trim state, and no annotations
- [ ] Once a session has been saved, we should be able to override the saved data if we make changes (e.g. update an existing saved session, not just create a new saved session)
- [ ] Add filtering on library and session list views based on metadata (dates, golfers, club, quality score)
- [ ] Add sort options on library view - by date new to old (default), by date old to new, by golfer name (forward/reverse alphabetical), by quality high to low/low to high
- [ ] Add to video metadata - user-settable video title
- [ ] Show video metadata in the Analyze view (golfer name, club, camera angle, etc.)
- [ ] Library view - show user-set title for each video
- [ ] Library view - minimize metadata shown (don't need filename, duration, resolution, FPS - can show these with the video preview)
- [ ] Add to session metadata - golfer names (one or two names), clubs (one or two clubs), quality (1-10)
- [ ] Uploading a video that is already in the  library can be saved again to the library, can we prevent this?
- [ ] When in sync mode, if a new video is uploaded or loaded from the library, return to playback mode and set both videos back to frame 0; make sure the scrub bars reflect position 0 as well
- [ ] Backup/redundancy for database & video libraries

## New Workflows and Data Model Improvements

- [ ] Multi-user support
- [ ] Save single-frame captures of key positions (this is a big change - need some way to store these, add metadata, add to a session, list available snapshots, and display them in the analyze view)
- [ ] Update data structure - typically have both a DTL and FO video, can pair those together with a single set of metadata; organize library this way
    - [ ] Maintain backwards compatibility for single video session
- [ ] Library view - show a small thumbnail preview of the video, and allow local playback in the library view with minimal video controls (play/pause, scrub, coarse/fine step, playback speed)
- [ ] Add feature to edit metadata for videos and sessions

## Bug fixes

- [ ] In the save video view, selecting the text in the "Notes" entry cancels the save

## Other minor improvements

- [ ] Add date recorded to video metadata displayed in `Analyze` view
- [ ] Add mechanism to back up deployment Postgres & video store volumes

## Code Quality

- [ ] Add playwright tests for new workflows - library and session views/workflows, trim video
