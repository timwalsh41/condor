"""
FastAPI backend for Golf Swing Analyzer.

Provides video upload, optimization, streaming, library management,
and session persistence services.
"""

import logging
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from logging.handlers import RotatingFileHandler

from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import AsyncSessionLocal, check_db_connectivity
from backend.repositories.user_repository import get_or_create_default_user

# Configure logging (console + file)
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

handlers = [
    logging.StreamHandler(sys.stdout),
    RotatingFileHandler(
        log_dir / "backend.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
]

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    handlers=handlers
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting Golf Swing Analyzer API")

    # Verify ffmpeg/ffprobe availability
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True, timeout=5)
        subprocess.run(['ffprobe', '-version'], capture_output=True, check=True, timeout=5)
        logger.info("ffmpeg and ffprobe available")
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.error(f"ffmpeg/ffprobe not available: {e}")
        logger.warning("Video optimization will not work without ffmpeg/ffprobe")

    # Verify database connectivity
    db_ok = await check_db_connectivity()
    if not db_ok:
        logger.warning("Database is not reachable - database-dependent features will be unavailable")
    else:
        # Apply any pending Alembic migrations automatically
        try:
            alembic_cfg = AlembicConfig("alembic.ini")
            alembic_command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied (or already up to date)")
        except Exception as e:
            logger.error(f"Migration failed: {e}")

        # Seed the default user (get-or-create, idempotent)
        try:
            async with AsyncSessionLocal() as session:
                user = await get_or_create_default_user(session)
                logger.info(f"Default user ready (id={user.id})")
        except Exception as e:
            logger.error(f"Failed to seed default user: {e}")

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
from backend.routes import upload, video, library, sessions, google_photos
app.include_router(upload.router)
app.include_router(video.router)
app.include_router(library.router)
app.include_router(sessions.router)
app.include_router(google_photos.router)


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
