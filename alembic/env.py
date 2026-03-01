"""
Alembic migration environment — async SQLAlchemy setup.

Reads DATABASE_URL from application settings (environment / .env file) so
migrations use the same connection as the application runtime.

Supports both offline (SQL script) and online (live DB) migration modes.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import ORM models so Alembic autogenerate can detect schema changes
from backend.orm_models import Base  # noqa: F401

# Read application settings for the real DATABASE_URL
from backend.config import get_settings

alembic_config = context.config

# Override the sqlalchemy.url with the value from application settings
settings = get_settings()
alembic_config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Set up logging from the alembic.ini [loggers] section
if alembic_config.config_file_name is not None:
    fileConfig(alembic_config.config_file_name)

# Autogenerate compares against this metadata
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL migration script without connecting to the database.

    Useful for generating SQL to review or apply manually.
    """
    url = alembic_config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Execute migrations against the provided database connection."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations online."""
    connectable = async_engine_from_config(
        alembic_config.get_section(alembic_config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations against a live database using the async engine."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
