# UX Workflow Specification

## Document Control

- **Version**: 1.0
- **Last Updated**: 2026-02-27

## Overview

This document defines user-facing workflows, app shell structure, and interaction expectations for Analyze, Library, Sessions, and Import experiences in Condor Phase 2.

## App Shell Layout

The application layout uses a persistent primary navigation with four workflow destinations: Analyze, Library, Sessions, and Import.

The Analyze view is the execution workspace for playback, synchronization, trim, and annotation operations.

The Library view is the catalog and metadata management surface for all user-accessible videos.

The Sessions view is the persistence surface for listing, saving context, loading state, and deleting saved analysis sessions.

The Import view is the media ingestion surface for provider-connected import workflows and import job status.

## Workflow 1: Manage Video Library

The user opens Library, reviews video records, edits metadata fields, and selects one or two videos for Analyze.

The metadata fields are golfer name, capture date, club, notes, and quality score.

Library actions support list, view, update metadata, delete, and select-for-analyze behaviors.

## Workflow 1A: Library Video Preview and Playback

The Library view presents a split layout with a list pane showing thumbnail and key metadata and a detail pane showing full metadata and a preview player for the selected video.

Selecting a video from the list loads detail metadata and prepares preview playback without autoplay.

Library preview playback controls include play/pause, fine step, coarse step, and playback speed controls and use the same control semantics as Analyze.

The selected-library-video context is explicit so users can preview and confirm media before sending one or two videos to Analyze.

## Workflow 1B: Local Upload to Library

The user starts local upload from Library or Import and selects a local media file.

The upload flow validates file constraints, submits media for backend processing, and surfaces progress and completion status.

Completed uploads create library video records with technical metadata and editable user metadata fields.

## Workflow 2: Start Analysis

The user enters Analyze with selected videos and controls playback, frame stepping, synchronization, trim bounds, and annotations.

The Analyze workflow supports single-video and dual-video operation using the same core control model.

## Workflow 3: Save Session

The user saves a named session with notes from Analyze.

Saved state includes selected video references, synchronization state, trim state, playback state, and annotation payloads.

## Workflow 4: Load Session

The user opens Sessions, chooses a saved session, and loads it into Analyze.

The loaded session restores the saved state so the user can continue analysis without manual reconfiguration.

## Workflow 5: Continue and Re-save

The user modifies a loaded analysis session and saves updates to the same session or saves a new session variant.

Session save and load interactions preserve state fidelity for sync, trim, playback controls, and annotations.

## Workflow 6: Import from Google Photos

The user opens Import, authorizes Google Photos access, selects media, and starts import.

Imported videos appear in Library as first-class records and can be selected for Analyze and included in saved sessions.

## Cross-Workflow UX Rules

Analyze responsiveness is preserved while library/session/import operations execute asynchronously with clear loading and error states.

Keyboard shortcuts operate in Analyze for playback and stepping actions and do not override active text inputs.

All workflows surface deterministic success/failure feedback so users can recover from validation, network, or provider errors without losing in-progress analysis state.
