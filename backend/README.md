# Backend API

FastAPI backend for The Condor video analysis platform.

## Development

```bash
# Run development server (from project root)
uv run python3 -m backend.main
# Server starts at http://localhost:8000
# API docs at http://localhost:8000/docs
```

## Testing

All test commands are run from the project root using `uv run pytest`.

**Unit Tests:**
```bash
uv run pytest backend/ -v
```

**Integration Tests:**
```bash
uv run pytest tests/test_backend_integration.py -v
```

**All Backend Tests:**
```bash
uv run pytest backend/ tests/test_backend_integration.py -v
```

**Test Coverage:**
```bash
uv run pytest backend/ --cov=backend --cov-report=term
```

## API Endpoints

- `POST /api/upload` - Upload video with optional rotation
- `GET /api/status/{session_id}` - Poll upload/processing status
- `GET /api/video/{session_id}` - Download processed video blob
- `GET /api/metadata/{session_id}` - Get video metadata

See interactive API docs at http://localhost:8000/docs
