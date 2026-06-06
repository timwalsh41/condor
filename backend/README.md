# Backend API

FastAPI backend for The Condor video analysis platform.

## Development

```bash
# Run development server (from project root)
uv run python -m backend.main
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

## API Documentation

See the full API reference at `docs/API/BACKEND_API.md`, or open the interactive Swagger UI at http://localhost:8000/docs when the backend is running.
