"""Tests for backend.config module."""

from backend.config import Settings, get_settings


def test_get_settings_returns_settings_object():
    """get_settings() should return a Settings instance."""
    settings = get_settings()
    assert isinstance(settings, Settings)


def test_database_url_default():
    """DATABASE_URL should default to the local condor_db connection string."""
    # Create a fresh Settings without a .env override to test the hard-coded default
    settings = Settings(
        _env_file=None  # type: ignore[call-arg]
    )
    assert settings.DATABASE_URL == "postgresql+asyncpg://condor_user:condor_dev@localhost/condor_db"


def test_video_storage_path_default():
    """VIDEO_STORAGE_PATH should default to ./video_storage."""
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.VIDEO_STORAGE_PATH == "./video_storage"


def test_log_level_default():
    """LOG_LEVEL should default to INFO."""
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.LOG_LEVEL == "INFO"
