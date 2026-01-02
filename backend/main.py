"""
FastAPI backend for Golf Swing Analyzer.

Provides video upload, optimization, and streaming services.

Phase: Phase 1 Task 1.1 (Backend Skeleton + Video Upload)
"""

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting Golf Swing Analyzer API")

    # Verify ffmpeg/ffprobe availability
    try:
        import subprocess
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True, timeout=5)
        subprocess.run(['ffprobe', '-version'], capture_output=True, check=True, timeout=5)
        logger.info("ffmpeg and ffprobe available")
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.error(f"ffmpeg/ffprobe not available: {e}")
        logger.warning("Video optimization will not work without ffmpeg/ffprobe")

    yield

    # Shutdown
    logger.info("Shutting down Golf Swing Analyzer API")


app = FastAPI(
    title="Golf Swing Analyzer API",
    description="Backend API for frame-accurate golf swing video analysis",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware - allow all origins for MVP (local network deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # MVP: Local network only, no authentication
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from backend.routes import upload, video
app.include_router(upload.router)
app.include_router(video.router)


@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns:
        dict: Status and version information
    """
    return {
        "status": "healthy",
        "version": "0.1.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
