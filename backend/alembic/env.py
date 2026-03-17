from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, create_engine
from alembic import context
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.models.base import Base
from app.models import *  # noqa: F401, F403

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_url() -> str:
    """Get database URL from environment, converting asyncpg to psycopg2 sync driver."""
    url = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
    # Alembic needs a sync driver — convert asyncpg to psycopg2
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    return url


def run_migrations_offline():
    url = _get_url()
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = create_engine(_get_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
