# Backend API

FastAPI backend for The Condor video analysis platform.

## Development

```bash
# Install dependencies - note this will not work in a container, instead use
# sudo apt install python3-<package>
pip install -r requirements.txt

# Run development server
python3 -m backend.main
# Server starts at http://localhost:8000
# API docs at http://localhost:8000/docs
```

## Testing

**Unit Tests:**
```bash
# Install required dependency:
sudo apt install python3-pytest
python3 -m pytest backend/services/tests/ -v
```

**Integration Tests:**
```bash
python3 -m pytest tests/test_backend_integration.py -v
```

**All Backend Tests:**
```bash
python3 -m pytest backend/services/tests/ tests/test_backend_integration.py -v
```

**Test Coverage:**
```bash
python3 -m pytest backend/services/tests/ --cov=backend --cov-report=term
```

## API Endpoints

- `POST /api/upload` - Upload video with optional rotation
- `GET /api/status/{session_id}` - Poll upload/processing status
- `GET /api/video/{session_id}` - Download processed video blob
- `GET /api/metadata/{session_id}` - Get video metadata

See interactive API docs at http://localhost:8000/docs
