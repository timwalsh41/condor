"""Tests for backend.version module."""

from backend.version import VERSION


def test_version_is_string():
    """VERSION should be a non-empty string."""
    assert isinstance(VERSION, str)
    assert len(VERSION) > 0


def test_version_format():
    """VERSION should follow the expected format: tag, unreleased-hash, or dev."""
    if VERSION == "dev":
        return  # Development mode is always valid
    # Production builds: either a version string without 'v' prefix
    # or unreleased-<hash>
    assert not VERSION.startswith("v"), "Version should not have leading 'v'"
    assert " " not in VERSION, "Version should not contain spaces"
