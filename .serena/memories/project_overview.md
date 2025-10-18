# Project Overview: Condor

## Purpose
Condor is an **open-source golf swing video analysis tool** that enables golfers and coaches to compare and annotate swing videos frame-by-frame. The system supports loading one or two videos, synchronizing them temporally, and drawing annotations to highlight swing mechanics.

## Current Status
**Planning Phase** - No implementation code yet
- `INITIAL.md` contains comprehensive design inputs
- Next step: Generate formal requirements using `/generate-prp` workflow
- Project follows PRP (Product Requirements Prompt) methodology

## Target Platform
- **MVP**: Desktop web browsers (Chrome, Firefox, Safari, Brave)
- **Deployment**: Local Linux server (Ubuntu on Raspberry Pi 4 8GB minimum)
- **Future**: Cloud hosting, mobile PWA

## Comparable Product
V1 Golf App - https://v1sports.com/athletes/v1-golf-app/

## MVP Scope
- Video upload (1-2 videos, same framerate)
- Frame-accurate playback and synchronization
- Annotation tools (polyline, oval, arrow, freehand)
- Non-destructive video trimming
- Ephemeral sessions (no persistence in MVP)

## Post-MVP Features (Explicitly Out of Scope for MVP)
- Session persistence
- Video library management
- User authentication
- Multi-framerate support
- Advanced annotations (text, angles, time-based)
- Video export
- Mobile support
- Coach mode
- Cloud deployment
