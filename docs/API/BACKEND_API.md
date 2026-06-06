# Backend API Reference

## Quick Start

```bash
# Start backend server
uv run python -m backend.main
# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

## Health

```
GET /health
```

Returns application status and version.

```bash
curl http://localhost:8000/health
# Response: {"status":"healthy","version":"0.1.0"}
```

## Upload

```
POST /api/upload
```

Upload a video file with optional rotation. Multipart form data.

**Parameters**:
- `file`: Video file (MP4, max 200MB)
- `rotation`: Optional rotation angle (0, 90, 180, 270)
- `session_id`: Optional session ID (auto-generated if omitted)

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@path/to/video.mp4" \
  -F "rotation=90"
# Response: {"video_id":"abc123","session_id":"xyz789","filename":"video.mp4",...}
```

```
GET /api/upload/{video_id}/status
```

Poll upload and processing status.

**Status values**: `pending` → `analyzing` → `processing` → `complete` | `error`

```bash
curl http://localhost:8000/api/upload/abc123/status
# Response: {"status":"complete","progress":1.0,"video_id":"abc123","metadata":{...}}
```

## Video Streaming

```
GET /api/video/{session_id}/{video_id}
```

Stream video with HTTP range request support (for seeking).

```bash
# Full video
curl http://localhost:8000/api/video/xyz789/abc123 -o output.mp4

# Partial content (byte range)
curl -H "Range: bytes=0-1023" http://localhost:8000/api/video/xyz789/abc123
```

## Library

```
GET /api/library
```

List all videos in the user's library, newest first.

```
POST /api/library
```

Add a processed video to the library with optional metadata (golfer name, club,
capture date, notes, quality score, camera view).

```
GET /api/library/{video_id}
```

Retrieve a single library video record.

```
PUT /api/library/{video_id}
```

Update editable metadata fields on a library video.

```
DELETE /api/library/{video_id}
```

Remove a video from the library.

```
GET /api/library/{video_id}/stream
```

Stream a library video (HTTP range support).

## Sessions

```
GET /api/sessions
```

List all analysis sessions (lightweight summaries, no annotation payload).

```
POST /api/sessions
```

Create a new analysis session with video references, sync points, trim bounds,
playback speed, loop state, and annotations.

```
GET /api/sessions/{session_id}
```

Get full session state including annotations.

```
PUT /api/sessions/{session_id}
```

Update an existing session's state (all fields optional).

```
DELETE /api/sessions/{session_id}
```

Delete a session.

## Google Photos Import (Mocked)

These endpoints provide a mock integration for importing videos from Google
Photos. The integration is not yet functional — endpoints return placeholder data.

```
GET  /api/google-photos/status
POST /api/google-photos/connect
POST /api/google-photos/disconnect
GET  /api/google-photos/albums
GET  /api/google-photos/albums/{album_id}/videos
POST /api/google-photos/import
GET  /api/google-photos/import/{job_id}
```

## Video Processing

**What happens on upload**:
1. File validated (size <200MB, format MP4)
2. Metadata extracted with ffprobe (framerate, duration, resolution, codec, GOP)
3. Video optimized if needed:
   - H.265/HEVC → H.264 (WebCodecs compatibility)
   - GOP > 30 → GOP=30 (frame-accurate seeking)
   - Rotation applied if requested
4. Optimized video stored

## Error Responses

```json
{
  "detail": "File size exceeds maximum allowed size of 200MB"
}
```

**Status codes**: `400` (validation), `404` (not found), `413` (file too large),
`416` (range not satisfiable), `500` (processing error)

## Interactive API Docs

Open http://localhost:8000/docs in browser for Swagger UI with:
- All endpoints documented
- Request/response schemas
- Try-it-out functionality
