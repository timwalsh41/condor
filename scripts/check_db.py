"""
Standalone script to verify PostgreSQL database connectivity.

Usage:
    uv run python scripts/check_db.py

Reads DATABASE_URL from the environment or .env file (via python-dotenv).
Connects directly using asyncpg (no SQLAlchemy overhead) and runs SELECT 1.
"""

import asyncio
import os
import sys
from pathlib import Path

# Load .env from the project root (one level up from scripts/)
project_root = Path(__file__).parent.parent
env_file = project_root / ".env"

if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)

import asyncpg


async def check_connectivity() -> bool:
    """Connect to PostgreSQL and execute SELECT 1.

    Reads DATABASE_URL from the environment. Strips the SQLAlchemy driver
    prefix (``postgresql+asyncpg://``) since asyncpg uses its own DSN format.

    Returns:
        bool: True on success, False on failure.
    """
    raw_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://condor_user:condor_dev@localhost/condor_db",
    )

    # asyncpg expects "postgresql://..." not "postgresql+asyncpg://..."
    dsn = raw_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Connecting to: {dsn}")
    try:
        conn = await asyncpg.connect(dsn)
        result = await conn.fetchval("SELECT 1")
        await conn.close()
        print(f"SUCCESS: SELECT 1 returned {result}")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        print()
        print("Troubleshooting tips:")
        print("  - Is PostgreSQL running?  Try: pg_lsclusters")
        print("  - Does the user/database exist?  Try:")
        print("      sudo -u postgres psql -c '\\l'")
        print("      sudo -u postgres psql -c '\\du'")
        print("  - Check DATABASE_URL in .env matches your setup.")
        return False


if __name__ == "__main__":
    success = asyncio.run(check_connectivity())
    sys.exit(0 if success else 1)
