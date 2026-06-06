# Backend API Reference

## Quick Start

```bash
# Start backend server
python3 -m backend.main
# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

## Endpoints (MVP Phase 1)

### Health Check

```bash
curl http://localhost:8000/health
# Response: {"status":"healthy","version":"0.1.0"}
```

### Upload Video

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@path/to/video.mp4" \
  -F "rotation=90"
# Response: {"video_id":"abc123","session_id":"xyz789","filename":"video.mp4",...}
```

**Parameters**:
- `file`: Video file (MP4, max 200MB)
- `rotation`: Optional rotation angle (0, 90, 180, 270)
- `session_id`: Optional session ID (auto-generated if omitted)

### Check Upload Status

```bash
curl http://localhost:8000/api/upload/abc123/status
# Response: {"status":"complete","progress":1.0,"video_id":"abc123"}
```

**Status values**: `pending` → `processing` → `complete` | `error`

### Stream Video

```bash
# Full video
curl http://localhost:8000/api/video/xyz789/abc123 -o output.mp4

# Partial content (byte range)
curl -H "Range: bytes=0-1023" http://localhost:8000/api/video/xyz789/abc123
```

**URL format**: `/api/video/{session_id}/{video_id}`

## Video Processing

**What happens on upload**:
1. File validated (size <200MB, format MP4)
2. Metadata extracted with ffprobe (framerate, duration, resolution, codec, GOP)
3. Video optimized if needed:
   - H.265/HEVC → H.264 (WebCodecs compatibility)
   - GOP > 30 → GOP=30 (frame-accurate seeking)
   - Rotation applied if requested
4. Optimized video stored at `/tmp/condor/{session_id}/{video_id}.mp4`

**Processing time**: ~0.42x realtime (60s video → 25s processing)

## Error Responses

```json
{
  "detail": "File size exceeds maximum allowed size of 200MB"
}
```

**Status codes**: `400` (validation), `413` (file too large), `500` (processing error)

## Testing

```bash
# Upload test video (generated with ffmpeg)
cd tests/fixtures
bash generate_test_videos.sh
curl -X POST http://localhost:8000/api/upload -F "file=@videos/test_30fps_10s.mp4"
```

## Interactive API Docs

Open http://localhost:8000/docs in browser for Swagger UI with:
- All endpoints documented
- Request/response schemas
- Try-it-out functionality
