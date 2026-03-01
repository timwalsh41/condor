"""
Application configuration using pydantic-settings.

Settings are loaded from environment variables and/or a .env file.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Attributes:
        DATABASE_URL: Async PostgreSQL connection URL.
        VIDEO_STORAGE_PATH: Path for storing uploaded/processed videos.
        LOG_LEVEL: Logging verbosity level.
    """

    DATABASE_URL: str = "postgresql+asyncpg://condor_user:condor_dev@localhost/condor_db"
    VIDEO_STORAGE_PATH: str = "./video_storage"
    LOG_LEVEL: str = "INFO"

    model_config = {
        # Load from .env file if present, without failing if it doesn't exist
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings.

    Uses lru_cache so Settings are only instantiated once per process,
    which avoids redundant .env file reads on every request.

    Returns:
        Settings: The application settings instance.
    """
    return Settings()
